import ipaddress
import socket
from urllib.parse import urlparse

from rest_framework import viewsets, status, filters
from rest_framework.decorators import api_view, permission_classes, throttle_classes, action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.generics import RetrieveAPIView, CreateAPIView
from rest_framework.throttling import UserRateThrottle
from django.contrib.auth.models import User
from django_filters.rest_framework import DjangoFilterBackend
from django.db.models import Q
from django.conf import settings
from .models import Recipe, Category, Favorite, UserUsage, GlobalUsage, MealPlan, ShoppingListItem
from .serializers import RecipeSerializer, CategorySerializer, UserRegistrationSerializer, MealPlanSerializer, ShoppingListItemSerializer
from datetime import date, timedelta
import os
from .utils import download_audio_from_url, extract_recipe_from_audio, extract_recipe_from_text, extract_keywords, build_recipes_summary, call_fogoncito
import tempfile
import requests
from bs4 import BeautifulSoup

# Create your views here.

# --- Throttle personalizado para importaciones ---
class ImportRateThrottle(UserRateThrottle):
    """Limita las importaciones con IA a 5 por minuto por usuario."""
    scope = 'import'


# --- Whitelist de hosts para video ---
ALLOWED_VIDEO_HOSTS = [
    'youtube.com', 'www.youtube.com', 'youtu.be', 'm.youtube.com',
    'tiktok.com', 'www.tiktok.com', 'vm.tiktok.com', 'vt.tiktok.com',
    'instagram.com', 'www.instagram.com',
]

INGREDIENT_CATEGORIES = {
    'Verduras y frescos': [
        'lechuga', 'tomate', 'cebolla', 'zanahoria', 'palta', 'pimiento',
        'zapallo', 'berenjena', 'espinaca', 'brócoli', 'ajo', 'papa',
        'batata', 'limón', 'naranja', 'manzana', 'verdeo', 'apio'
    ],
    'Carnes y proteínas': [
        'pollo', 'carne', 'cerdo', 'pescado', 'atún', 'huevo', 'tofu',
        'nalga', 'milanesa', 'chorizo', 'salchicha', 'jamón', 'lomo'
    ],
    'Lácteos': [
        'leche', 'queso', 'crema', 'manteca', 'yogur', 'ricota',
        'mozzarella', 'cheddar', 'mantequilla'
    ],
    'Despensa': [
        'arroz', 'fideos', 'harina', 'azúcar', 'sal', 'aceite',
        'vinagre', 'soja', 'mirin', 'salsa', 'caldo', 'lenteja',
        'garbanzo', 'frijol', 'pasta', 'avena', 'mostaza',
        'mayonesa', 'ketchup', 'barbacoa', 'vino', 'cerveza',
        'aceite de oliva', 'aceite de girasol'
    ],
    'Panadería': [
        'pan', 'tostada', 'galletita', 'bizcocho', 'factura'
    ],
    'Especias y condimentos': [
        'pimienta', 'comino', 'orégano', 'pimentón', 'curry', 'jengibre',
        'cúrcuma', 'canela', 'ají molido'
    ],
}


def validate_video_url(url):
    """Valida que la URL pertenece a un host de video permitido."""
    try:
        parsed = urlparse(url)
        host = parsed.hostname
        if not host:
            return False, "URL inválida"
        if host not in ALLOWED_VIDEO_HOSTS:
            return False, f"Solo se permiten links de YouTube, TikTok e Instagram. Host recibido: {host}"
        return True, None
    except Exception:
        return False, "URL malformada"


def validate_web_url_ssrf(url):
    """
    Protección SSRF: valida que la URL es HTTPS y apunta a una IP pública.
    Bloquea acceso a IPs privadas, loopback, link-local y metadata de cloud.
    """
    try:
        parsed = urlparse(url)

        # 1. Forzar HTTPS
        if parsed.scheme != 'https':
            return False, "Solo se permiten URLs con HTTPS por seguridad."

        hostname = parsed.hostname
        if not hostname:
            return False, "URL inválida"

        # 2. Resolver DNS y verificar que la IP es pública
        resolved_ip = socket.gethostbyname(hostname)
        ip_obj = ipaddress.ip_address(resolved_ip)

        if ip_obj.is_private or ip_obj.is_loopback or ip_obj.is_link_local or ip_obj.is_reserved:
            return False, "No se permite acceder a direcciones IP privadas o reservadas."

        return True, None
    except socket.gaierror:
        return False, "No se pudo resolver el dominio."
    except Exception as e:
        return False, f"Error validando URL: {str(e)}"


def check_usage_limits(user):
    """
    Verifica límites de uso antes de una importación:
    1. Límite por usuario/día
    2. Límite global de requests a Gemini/día
    Retorna (can_proceed: bool, error_message: str | None)
    """
    max_per_user = getattr(settings, 'FOGON_MAX_IMPORTS_PER_USER_PER_DAY', 10)
    max_global = getattr(settings, 'FOGON_MAX_GEMINI_REQUESTS_PER_DAY', 20)

    # 1. Límite por usuario
    usage, _ = UserUsage.objects.get_or_create(user=user)
    if not usage.can_import(max_per_user):
        return False, f"Alcanzaste tu límite de {max_per_user} importaciones por día. ¡Mañana podés seguir!"

    # 2. Límite global de Gemini
    global_usage = GlobalUsage.get_today()
    if not global_usage.can_request(max_global):
        return False, "Se alcanzó el límite diario de importaciones del sistema. ¡Intentá mañana!"

    return True, None


def record_usage(user):
    """Registra una importación exitosa en ambos contadores."""
    usage, _ = UserUsage.objects.get_or_create(user=user)
    usage.record_import()

    global_usage = GlobalUsage.get_today()
    global_usage.record_request()


class RecipeViewSet(viewsets.ModelViewSet):
    serializer_class = RecipeSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['categories']
    search_fields = ['title', 'description', 'ingredients__name']

    def get_queryset(self):
        qs = Recipe.objects.filter(user=self.request.user).order_by('-created_at')
        
        # Filtro de favoritos
        if self.request.query_params.get('favorites') == 'true':
            qs = qs.filter(favorited_by__user=self.request.user)
        
        return qs

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context['request'] = self.request
        return context

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    def perform_update(self, serializer):
        serializer.save(user=self.request.user)

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated])
    def favorite(self, request, pk=None):
        """Toggle favorito: si ya existe lo elimina, si no existe lo crea."""
        recipe = self.get_object()
        fav, created = Favorite.objects.get_or_create(user=request.user, recipe=recipe)
        
        if not created:
            # Ya existía → lo eliminamos (toggle off)
            fav.delete()
            return Response({'is_favorite': False, 'message': 'Eliminado de favoritos'})
        
        return Response({'is_favorite': True, 'message': '¡Agregado a favoritos!'})


class SharedRecipeView(RetrieveAPIView):
    queryset = Recipe.objects.all()
    serializer_class = RecipeSerializer
    permission_classes = [AllowAny]
    lookup_field = 'uuid'

class CategoryViewSet(viewsets.ModelViewSet):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer
    permission_classes = [AllowAny]
    pagination_class = None


class RegisterView(CreateAPIView):
    queryset = User.objects.all()
    permission_classes = [AllowAny]
    serializer_class = UserRegistrationSerializer


class MealPlanViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = MealPlanSerializer
    pagination_class = None
    http_method_names = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options']

    def get_queryset(self):
        return MealPlan.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    def perform_update(self, serializer):
        serializer.save(user=self.request.user)

    @staticmethod
    def categorize_ingredient(name: str) -> str:
        name_lower = name.lower()
        for category, keywords in INGREDIENT_CATEGORIES.items():
            if any(kw in name_lower for kw in keywords):
                return category
        return 'Otros'

    @action(detail=False, methods=['get'])
    def week(self, request):
        week_start = request.query_params.get('week_start')
        try:
            start = date.fromisoformat(week_start)
        except (ValueError, TypeError):
            # Si no viene el parámetro, usamos la semana actual
            today = date.today()
            start = today - timedelta(days=today.weekday())
        
        end = start + timedelta(days=6)
        plans = self.get_queryset().filter(
            date__range=(start, end)
        ).select_related('recipe')
        
        serializer = self.get_serializer(plans, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['post'])
    def generate_shopping_list(self, request):
        week_start = request.data.get('week_start')
        try:
            start = date.fromisoformat(week_start)
        except (ValueError, TypeError):
            today = date.today()
            start = today - timedelta(days=today.weekday())

        end = start + timedelta(days=6)

        # Traemos todas las recetas del plan de la semana
        plans = MealPlan.objects.filter(
            user=request.user,
            date__range=(start, end)
        ).prefetch_related('recipe__ingredients')

        # Consolidamos ingredientes
        consolidated = {}
        for plan in plans:
            if not plan.recipe:
                continue
            for ingredient in plan.recipe.ingredients.all():
                key = ingredient.name.lower().strip()
                if key not in consolidated:
                    consolidated[key] = {
                        'name': ingredient.name,
                        'quantity': ingredient.quantity,
                        'unit': ingredient.unit,
                        'category': self.categorize_ingredient(ingredient.name)
                    }
                # Si ya existe, sumamos cantidades si son del mismo unit
                # Por ahora dejamos la primera cantidad — mejora futura

        # Borramos solo los NO tachados de esa semana y creamos los nuevos
        from django.db import transaction
        with transaction.atomic():
            # Obtenemos los ingredientes ya tachados para no duplicarlos
            checked_names = set(
                ShoppingListItem.objects.filter(
                    user=request.user,
                    week_start=start,
                    is_checked=True
                ).values_list('ingredient_name', flat=True)
            )

            ShoppingListItem.objects.filter(
                user=request.user,
                week_start=start,
                is_checked=False
            ).delete()

            # Creamos solo ítems que no estén ya tachados
            items = [
                ShoppingListItem(
                    user=request.user,
                    week_start=start,
                    ingredient_name=v['name'],
                    quantity=f"{v['quantity']} {v['unit']}".strip() if v['quantity'] is not None else (v['unit'] or ''),
                    category=v['category'],
                )
                for v in consolidated.values()
                if v['name'].lower().strip() not in {n.lower().strip() for n in checked_names}
            ]
            ShoppingListItem.objects.bulk_create(items, ignore_conflicts=True)

        # Devolvemos la lista completa actualizada
        all_items = ShoppingListItem.objects.filter(
            user=request.user,
            week_start=start
        ).order_by('category', 'ingredient_name')

        serializer = ShoppingListItemSerializer(all_items, many=True)
        return Response(serializer.data)


class ShoppingListItemViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = ShoppingListItemSerializer
    pagination_class = None
    http_method_names = ['get', 'post', 'put', 'patch', 'delete']

    def get_queryset(self):
        week_start = self.request.query_params.get('week_start')
        qs = ShoppingListItem.objects.filter(user=self.request.user)
        if week_start:
            qs = qs.filter(week_start=week_start)
        return qs.order_by('category', 'ingredient_name')

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
@throttle_classes([ImportRateThrottle])
def import_recipe_view(request):
    target_url = request.data.get('url')

    if not target_url:
        return Response({'error': 'URL no proporcionada'}, status=status.HTTP_400_BAD_REQUEST)

    # Validar URL contra whitelist
    is_valid, error_msg = validate_video_url(target_url)
    if not is_valid:
        return Response({'error': error_msg}, status=status.HTTP_400_BAD_REQUEST)

    # Verificar límites de uso
    can_proceed, limit_msg = check_usage_limits(request.user)
    if not can_proceed:
        return Response({'error': limit_msg}, status=status.HTTP_429_TOO_MANY_REQUESTS)

    audio_path, description_text, thumbnail_url = download_audio_from_url(target_url)

    if not audio_path or not description_text:
        return Response({'error': 'Error al descargar el audio'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        recipe_data = extract_recipe_from_audio(audio_path, description_text, thumbnail_url)
    
        if not recipe_data:
            return Response({'error': 'Error al extraer la receta'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        # Registrar uso exitoso
        record_usage(request.user)

        if os.path.exists(audio_path):
            os.remove(audio_path)

        return Response({'message': 'Receta importada exitosamente', 'recipe': recipe_data}, status=status.HTTP_201_CREATED)
    
    except Exception as e:
        if os.path.exists(audio_path):
            os.remove(audio_path)
        return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
@throttle_classes([ImportRateThrottle])
def import_recipe_from_file_view(request):
    uploaded_file = request.FILES.get('file')

    if not uploaded_file:
        return Response({'error': 'No se proporcionó ningún archivo'}, status=status.HTTP_400_BAD_REQUEST)

    # Verificar límites de uso
    can_proceed, limit_msg = check_usage_limits(request.user)
    if not can_proceed:
        return Response({'error': limit_msg}, status=status.HTTP_429_TOO_MANY_REQUESTS)

    try:
        temp = tempfile.NamedTemporaryFile(delete=False, suffix=f"_{uploaded_file.name}")
        for chunk in uploaded_file.chunks():
            temp.write(chunk)
        temp.close()
        temp_path = temp.name

        recipe_data = extract_recipe_from_audio(temp_path, "", None)

        os.remove(temp_path)

        if not recipe_data:
            return Response({'error': 'IA falló al extraer la receta'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        # Registrar uso exitoso
        record_usage(request.user)

        return Response({'message': 'Receta importada exitosamente', 'recipe': recipe_data}, status=status.HTTP_201_CREATED)
    
    except Exception as e:
        if 'temp_path' in locals() and os.path.exists(temp_path):
            os.remove(temp_path)
        return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
@throttle_classes([ImportRateThrottle])
def import_recipe_from_text_view(request):
    text_data = request.data.get('text')
    
    if not text_data or len(text_data.strip()) == 0:
        return Response({'error': 'No se proporcionó texto de receta'}, status=status.HTTP_400_BAD_REQUEST)

    # Verificar límites de uso
    can_proceed, limit_msg = check_usage_limits(request.user)
    if not can_proceed:
        return Response({'error': limit_msg}, status=status.HTTP_429_TOO_MANY_REQUESTS)
        
    try:
        recipe_data = extract_recipe_from_text(text_data)
        if not recipe_data:
            return Response({'error': 'IA falló al extraer la receta'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        # Registrar uso exitoso
        record_usage(request.user)

        return Response({'message': 'Receta generada a partir de texto', 'recipe': recipe_data}, status=status.HTTP_201_CREATED)
    
    except Exception as e:
        return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
@throttle_classes([ImportRateThrottle])
def import_recipe_from_web_view(request):
    target_url = request.data.get('url')
    
    if not target_url:
        return Response({'error': 'No se proporcionó URL'}, status=status.HTTP_400_BAD_REQUEST)

    # Protección SSRF
    is_valid, error_msg = validate_web_url_ssrf(target_url)
    if not is_valid:
        return Response({'error': error_msg}, status=status.HTTP_400_BAD_REQUEST)

    # Verificar límites de uso
    can_proceed, limit_msg = check_usage_limits(request.user)
    if not can_proceed:
        return Response({'error': limit_msg}, status=status.HTTP_429_TOO_MANY_REQUESTS)
        
    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
        res = requests.get(target_url, headers=headers, timeout=10, stream=True)
        res.raise_for_status()

        # Protección contra descargas enormes (max 5MB)
        content_length = res.headers.get('Content-Length')
        if content_length and int(content_length) > 5 * 1024 * 1024:
            return Response({'error': 'La página es demasiado grande para procesar (máx 5MB).'}, 
                          status=status.HTTP_400_BAD_REQUEST)

        # Leer con límite
        content = res.content[:5 * 1024 * 1024]  # max 5MB de contenido
        soup = BeautifulSoup(content, 'html.parser')

        # Remover scripts y estilos visuales ruidosos
        for script in soup(["script", "style", "noscript", "header", "footer"]):
            script.decompose()

        cleaned_text = soup.get_text(separator=' ', strip=True)

        # Enviar 100k limit
        cleaned_text = cleaned_text[:100000]

        recipe_data = extract_recipe_from_text(
            f"Por favor extrae la receta estructurada del siguiente contenido de una página web. Elimina las historias/publicidades/comentarios del blog:\n\n{cleaned_text}",
            strict_mode=True
        )
        
        if not recipe_data:
            return Response({'error': 'No pudimos extraer la receta automáticamente porque este sitio web bloquea los sistemas automáticos (protección anti-scrapers). Por favor, copiá el texto de la receta desde tu navegador y usá la opción "Pegar Texto" en la app.'}, status=status.HTTP_400_BAD_REQUEST)

        # Registrar uso exitoso
        record_usage(request.user)

        og_image = soup.find('meta', property='og:image')
        if og_image and og_image.get('content'):
            recipe_data['image_url'] = og_image['content']

        return Response({'message': 'Receta generada a partir de blog web', 'recipe': recipe_data}, status=status.HTTP_201_CREATED)
    
    except requests.exceptions.RequestException as e:
        return Response({"error": f"Fallo al acceder al sitio web: {str(e)}"}, status=status.HTTP_400_BAD_REQUEST)
    except Exception as e:
        return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def current_user_view(request):
    user = request.user
    return Response({
        'id': user.id,
        'username': user.username,
        'email': user.email
    })

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def fogoncito(request):
    user_message = request.data.get('message', '').strip()
    if not user_message:
        return Response({'error': 'Mensaje vacío'}, status=400)

    # 1. Extraer keywords del mensaje
    keywords = extract_keywords(user_message)

    # 2. Filtrar recetas del usuario
    recipes_qs = Recipe.objects.filter(user=request.user)
    if keywords:
        q = Q()
        for kw in keywords:
            q |= Q(ingredients__name__icontains=kw)
        recipes_qs = recipes_qs.filter(q).distinct()
    recipes_qs = recipes_qs.prefetch_related('ingredients', 'categories')[:10]

    # 3. Construir contexto compacto
    recipes_summary = build_recipes_summary(recipes_qs)

    # 4. Llamar a Gemini
    try:
        result = call_fogoncito(user_message, recipes_summary)
    except Exception as e:
        return Response(
            {'error': 'Fogoncito no está disponible en este momento. Intentá de nuevo.'},
            status=503
        )

    return Response(result)