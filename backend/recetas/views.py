import logging
import os
import re
import secrets
import shutil
import tempfile
from datetime import date, timedelta
from urllib.parse import urljoin, urlparse

from bs4 import BeautifulSoup
from django.conf import settings
from django.contrib.auth.hashers import check_password, make_password
from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.mail import send_mail
from django.core.validators import validate_email
from django.db import IntegrityError, transaction
from django.db.models import Count, Exists, IntegerField, OuterRef, Q, Subquery, Value
from django.db.models.functions import Coalesce
from django.http import Http404
from django.utils import timezone
from django.utils.crypto import constant_time_compare
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, status, viewsets
from rest_framework.decorators import action, api_view, permission_classes, throttle_classes
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.generics import RetrieveAPIView
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle, UserRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from .models import (
    OTP_TTL, Category, Favorite, GlobalUsage, Ingredient, MealPlan, PasswordResetOTP,
    PendingRegistration, Recipe, ShoppingListItem, UserUsage,
)
from .net import FetchError, fetch_public
from .serializers import CategorySerializer, MealPlanSerializer, RecipeSerializer, ShoppingListItemSerializer
from .shopping import consolidate, format_quantity, learn_from_recipe, normalize_name, remember_user_choice, resolve_aisles
from .utils import (
    AIInputError, build_recipes_summary, call_ideas, convert_audio_to_mp3,
    download_audio_from_url, extract_recipe_from_audio, extract_recipe_from_text, list_collection,
)

logger = logging.getLogger(__name__)

MAX_AUDIO_UPLOAD_BYTES = 20 * 1024 * 1024
MAX_WEB_PAGE_BYTES = 5 * 1024 * 1024
MAX_IMPORT_TEXT_CHARS = 50_000
MAX_IDEAS_MESSAGE_CHARS = 2000

# Dominios de video aceptados (incluye subdominios: www., m., vm., ...).
ALLOWED_VIDEO_DOMAINS = ('youtube.com', 'youtu.be', 'tiktok.com', 'instagram.com', 'facebook.com', 'fb.watch')


class ImportRateThrottle(UserRateThrottle):
    """Limita las importaciones con IA a 5 por minuto por usuario."""
    scope = 'import'


class IdeasRateThrottle(UserRateThrottle):
    """Limita el chat de Ideas a 10 por minuto por usuario."""
    scope = 'ideas'


def error(message, code=status.HTTP_400_BAD_REQUEST):
    return Response({'error': message}, status=code)


# ---------------------------------------------------------------------------
# Límites de uso de la IA
# ---------------------------------------------------------------------------

def check_usage_limits(user):
    """
    Verifica los límites antes de llamar a Gemini: por usuario y por día, y global por día.
    Devuelve el mensaje de error, o None si se puede seguir.
    """
    max_per_user = settings.PIZCA_MAX_IMPORTS_PER_USER_PER_DAY
    usage, _ = UserUsage.objects.get_or_create(user=user)
    if not usage.can_import(max_per_user):
        return f"Alcanzaste tu límite de {max_per_user} importaciones por día. ¡Mañana podés seguir!"
    if not GlobalUsage.get_today().can_request(settings.PIZCA_MAX_GEMINI_REQUESTS_PER_DAY):
        return "Se alcanzó el límite diario de importaciones del sistema. ¡Intentá mañana!"
    return None


def record_usage(user):
    """Registra una llamada exitosa en ambos contadores."""
    usage, _ = UserUsage.objects.get_or_create(user=user)
    usage.record_import()
    GlobalUsage.get_today().record_request()


def _ai_import(request, extract, failure_message, failure_status=status.HTTP_500_INTERNAL_SERVER_ERROR):
    """
    Lo común a todas las importaciones: límites, errores y registro de uso.
    `extract()` devuelve el dict de la receta o None; puede tirar AIInputError/FetchError
    con un mensaje para el usuario. Devuelve (receta, None) o (None, Response de error).
    """
    limit_msg = check_usage_limits(request.user)
    if limit_msg:
        return None, Response({'error': limit_msg, 'limit': 'daily'}, status=status.HTTP_429_TOO_MANY_REQUESTS)
    try:
        recipe = extract()
    except (AIInputError, FetchError) as e:
        return None, error(str(e))
    except Exception:
        logger.exception('Falló una importación con IA')
        return None, error('Algo falló al armar la receta. Probá de nuevo en un rato.', status.HTTP_500_INTERNAL_SERVER_ERROR)
    if not recipe:
        return None, error(failure_message, failure_status)
    learn_from_recipe(request.user, recipe)
    record_usage(request.user)
    return recipe, None


def run_ai_import(request, extract, failure_message, failure_status=status.HTTP_500_INTERNAL_SERVER_ERROR):
    """Importación que devuelve un borrador para que el usuario lo revise antes de guardar."""
    recipe, failure = _ai_import(request, extract, failure_message, failure_status)
    if failure:
        return failure
    return Response({'message': 'Receta importada', 'recipe': recipe}, status=status.HTTP_201_CREATED)


def is_allowed_video_url(url):
    host = (urlparse(url).hostname or '').lower()
    return any(host == d or host.endswith('.' + d) for d in ALLOWED_VIDEO_DOMAINS)


VIDEO_FAILURE = 'No pudimos sacar una receta de este video.'


def extract_from_video(url):
    workdir, audio_path, description, thumbnail = download_audio_from_url(url)
    try:
        if not audio_path:
            raise AIInputError(
                'No pudimos bajar el video. Revisá que sea público y que no dure más de 20 minutos.'
            )
        return extract_recipe_from_audio(audio_path, description, thumbnail)
    finally:
        shutil.rmtree(workdir, ignore_errors=True)


# ---------------------------------------------------------------------------
# Recetas
# ---------------------------------------------------------------------------

class RecipeViewSet(viewsets.ModelViewSet):
    serializer_class = RecipeSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['categories']
    search_fields = ['title', 'description', 'ingredients__name']

    def get_queryset(self):
        user = self.request.user
        favorite_count = (
            Favorite.objects.filter(recipe=OuterRef('pk'))
            .values('recipe').annotate(n=Count('pk')).values('n')
        )
        qs = (
            Recipe.objects.filter(user=user)
            .annotate(
                is_favorite_annotated=Exists(Favorite.objects.filter(user=user, recipe=OuterRef('pk'))),
                favorite_count_annotated=Coalesce(Subquery(favorite_count, output_field=IntegerField()), Value(0)),
            )
            # Sin esto, cada receta de la página hace sus propias consultas de ingredientes, pasos y categorías.
            .prefetch_related('ingredients', 'steps', 'categories')
            .order_by('-created_at')
        )
        if self.request.query_params.get('favorites') == 'true':
            qs = qs.filter(is_favorite_annotated=True)
        return qs

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    @transaction.atomic
    def perform_destroy(self, instance):
        # Sin esto quedan slots del planner "ocupados" por una receta que ya no existe.
        MealPlan.objects.filter(user=self.request.user, recipe=instance).delete()
        instance.delete()

    @action(detail=True, methods=['post'])
    def favorite(self, request, pk=None):
        """Toggle favorito: si ya existe lo elimina, si no existe lo crea."""
        recipe = self.get_object()
        deleted, _ = Favorite.objects.filter(user=request.user, recipe=recipe).delete()
        if deleted:
            return Response({'is_favorite': False, 'message': 'Eliminado de favoritos'})
        Favorite.objects.get_or_create(user=request.user, recipe=recipe)
        return Response({'is_favorite': True, 'message': '¡Agregado a favoritos!'})


class SharedRecipeView(RetrieveAPIView):
    """Receta por uuid: las públicas para cualquiera y, con sesión, también las propias."""
    serializer_class = RecipeSerializer
    permission_classes = [AllowAny]
    lookup_field = 'uuid'

    def get_queryset(self):
        visible = Q(is_public=True)
        if self.request.user.is_authenticated:
            visible |= Q(user=self.request.user)
        return Recipe.objects.filter(visible).prefetch_related('ingredients', 'steps', 'categories')

    def get_object(self):
        try:
            return super().get_object()
        except Http404:
            raise NotFound('Esta receta no existe o ya no está compartida.')


class CategoryViewSet(viewsets.ModelViewSet):
    serializer_class = CategorySerializer
    permission_classes = [IsAuthenticated]
    pagination_class = None
    http_method_names = ['get', 'post', 'head', 'options']

    def get_queryset(self):
        return Category.objects.filter(Q(user__isnull=True) | Q(user=self.request.user))

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


# ---------------------------------------------------------------------------
# Registro y recuperación de contraseña (códigos por mail)
# ---------------------------------------------------------------------------

def generate_otp():
    return f'{secrets.randbelow(1_000_000):06d}'


def send_code(email, subject, body):
    try:
        send_mail(subject=subject, message=body, from_email=settings.DEFAULT_FROM_EMAIL,
                  recipient_list=[email], fail_silently=False)
    except Exception:
        logger.exception('No se pudo mandar el mail "%s"', subject)


def check_otp(record, code):
    """Devuelve el mensaje de error, o None si el código es válido. Cada fallo cuenta como intento."""
    if record.is_locked():
        return 'Pasaste el límite de intentos. Pedí un código nuevo.'
    if record.is_expired():
        return 'El código venció. Pedí uno nuevo.'
    if not constant_time_compare(record.otp_code, code):
        record.register_failed_attempt()
        return 'El código es incorrecto.'
    return None


def password_error(password, user):
    """Las reglas de AUTH_PASSWORD_VALIDATORS (largo, contraseñas comunes, parecido al usuario)."""
    try:
        validate_password(password, user=user)
    except DjangoValidationError as e:
        return ' '.join(e.messages)
    return None


def clean_email(value):
    return str(value or '').strip().lower()


class AuthView(APIView):
    """Base de los endpoints sin sesión: limitan pedidos por IP (cada uno manda mails o prueba códigos)."""
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'auth'


class RegisterView(AuthView):
    def post(self, request):
        username = str(request.data.get('username', '')).strip()
        email = clean_email(request.data.get('email'))
        password = str(request.data.get('password', ''))

        if not username or not email or not password:
            return error('Todos los campos son obligatorios.')
        if not 3 <= len(username) <= 30:
            return error('El nombre de usuario debe tener entre 3 y 30 caracteres.')
        if not re.fullmatch(r'[\w.+-]+', username):
            return error('El nombre de usuario solo puede tener letras, números y . _ + -')
        try:
            validate_email(email)
        except DjangoValidationError:
            return error('El correo electrónico no es válido.')
        pwd_error = password_error(password, User(username=username, email=email))
        if pwd_error:
            return error(pwd_error)

        if User.objects.filter(username__iexact=username).exists():
            return error('Este nombre de usuario ya está registrado.')
        if User.objects.filter(email__iexact=email).exists():
            return error('Este correo electrónico ya está registrado.')

        # Otro registro a medias con el mismo usuario: si venció se libera, si no, está tomado.
        others = PendingRegistration.objects.filter(username__iexact=username).exclude(email=email)
        others.filter(expires_at__lt=timezone.now()).delete()
        if others.exists():
            return error('Este nombre de usuario ya está en uso.')

        otp_code = generate_otp()
        PendingRegistration.objects.update_or_create(
            email=email,
            defaults={
                'username': username,
                'password': make_password(password),
                'otp_code': otp_code,
                'attempts': 0,
                'expires_at': timezone.now() + OTP_TTL,
            },
        )
        send_code(
            email, 'Código de verificación - Pizca',
            f'Tu código para registrarte en Pizca es: {otp_code}\n\nVence en 10 minutos.',
        )
        return Response({'message': 'Te mandamos un código por mail.', 'email': email})


class RegisterVerifyView(AuthView):
    def post(self, request):
        email = clean_email(request.data.get('email'))
        otp_code = str(request.data.get('otp_code', '')).strip()
        password = str(request.data.get('password', ''))
        if not email or not otp_code:
            return error('Faltan el mail o el código.')

        pending = PendingRegistration.objects.filter(email__iexact=email).first()
        if not pending:
            return error('No encontramos un registro pendiente para este correo.')
        otp_error = check_otp(pending, otp_code)
        if otp_error:
            return error(otp_error)
        # El código le llega al dueño del mail, pero el registro lo pudo haber pisado otra persona
        # con su propia contraseña. Solo quien la eligió puede terminar de crear la cuenta.
        if not check_password(password, pending.password):
            return error('Este registro no coincide con el que empezaste. Volvé a registrarte.')

        try:
            with transaction.atomic():
                # Alguien pudo haber tomado el usuario o el mail mientras tanto.
                if User.objects.filter(Q(username__iexact=pending.username) | Q(email__iexact=pending.email)).exists():
                    pending.delete()
                    return error('Ese usuario o correo ya está registrado. Empezá el registro de nuevo.')
                user = User.objects.create(username=pending.username, email=pending.email, password=pending.password)
                pending.delete()
        except IntegrityError:
            return error('Ese usuario o correo ya está registrado. Empezá el registro de nuevo.')

        refresh = RefreshToken.for_user(user)
        return Response({
            'message': 'Cuenta creada con éxito.',
            'access': str(refresh.access_token),
            'refresh': str(refresh),
        }, status=status.HTTP_201_CREATED)


class RegisterResendView(AuthView):
    def post(self, request):
        email = clean_email(request.data.get('email'))
        if not email:
            return error('El email es requerido.')
        pending = PendingRegistration.objects.filter(email__iexact=email).first()
        if not pending:
            return error('No hay un registro pendiente para este correo.')

        pending.otp_code = generate_otp()
        pending.attempts = 0
        pending.expires_at = timezone.now() + OTP_TTL
        pending.save(update_fields=['otp_code', 'attempts', 'expires_at'])
        send_code(
            pending.email, 'Nuevo código de verificación - Pizca',
            f'Tu nuevo código es: {pending.otp_code}\n\nVence en 10 minutos.',
        )
        return Response({'message': 'Te mandamos un código nuevo.'})


class PasswordResetRequestView(AuthView):
    def post(self, request):
        email = clean_email(request.data.get('email'))
        if not email:
            return error('El email es requerido.')

        # Misma respuesta exista o no la cuenta: no se revela qué mails están registrados.
        user = User.objects.filter(email__iexact=email).first()
        if user:
            PasswordResetOTP.objects.filter(user=user).delete()
            otp = PasswordResetOTP.objects.create(
                user=user, otp_code=generate_otp(), expires_at=timezone.now() + OTP_TTL,
            )
            send_code(
                user.email, 'Restablecer contraseña - Pizca',
                f'Hola {user.username},\n\nPediste restablecer tu contraseña. Tu código es: {otp.otp_code}\n\nVence en 10 minutos.',
            )
        return Response({
            'message': 'Si el correo está registrado, te llega un código para restablecer la contraseña.',
            'email': email,
        })


class PasswordResetVerifyView(AuthView):
    def post(self, request):
        email = clean_email(request.data.get('email'))
        otp_code = str(request.data.get('otp_code', '')).strip()
        new_password = str(request.data.get('new_password', ''))
        if not email or not otp_code or not new_password:
            return error('Faltan el mail, el código o la contraseña nueva.')

        user = User.objects.filter(email__iexact=email).first()
        otp = PasswordResetOTP.objects.filter(user=user).order_by('-created_at').first() if user else None
        if not otp:
            # Mismo mensaje que un código equivocado: no se revela si la cuenta existe.
            return error('El código es incorrecto.')
        otp_error = check_otp(otp, otp_code)
        if otp_error:
            return error(otp_error)
        pwd_error = password_error(new_password, user)
        if pwd_error:
            return error(pwd_error)

        user.set_password(new_password)
        user.save(update_fields=['password'])
        PasswordResetOTP.objects.filter(user=user).delete()
        return Response({'message': 'Contraseña restablecida con éxito.'})


# ---------------------------------------------------------------------------
# Planificador y lista de compras
# ---------------------------------------------------------------------------

def parse_week_start(value):
    """'YYYY-MM-DD' → date. Sin valor (o inválido) es el lunes de esta semana."""
    try:
        return date.fromisoformat(value)
    except (TypeError, ValueError):
        today = timezone.localdate()
        return today - timedelta(days=today.weekday())


class MealPlanViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = MealPlanSerializer
    pagination_class = None

    def get_queryset(self):
        return MealPlan.objects.filter(user=self.request.user).select_related('recipe')

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    @action(detail=False, methods=['get'])
    def week(self, request):
        start = parse_week_start(request.query_params.get('week_start'))
        plans = self.get_queryset().filter(date__range=(start, start + timedelta(days=6)), recipe__isnull=False)
        return Response(self.get_serializer(plans, many=True).data)

    @action(detail=False, methods=['post'])
    def generate_shopping_list(self, request):
        start = parse_week_start(request.data.get('week_start'))
        plans = (
            MealPlan.objects
            .filter(user=request.user, date__range=(start, start + timedelta(days=6)), recipe__isnull=False)
            .select_related('recipe')
            .prefetch_related('recipe__ingredients')
        )
        # Una receta planeada dos veces suma sus ingredientes dos veces.
        items = consolidate(ing for plan in plans for ing in plan.recipe.ingredients.all())
        # Antes de la transacción: puede llamar a Gemini con lo que no está en el caché.
        aisles = resolve_aisles(request.user, [item['name'] for item in items])

        # Regeneramos: se va lo armado desde el plan y lo tachado; lo agregado a mano y sin tachar queda.
        with transaction.atomic():
            week_items = ShoppingListItem.objects.filter(user=request.user, week_start=start)
            checked = {
                normalize_name(name)
                for name in week_items.filter(is_checked=True).values_list('ingredient_name', flat=True)
            }
            week_items.filter(Q(is_manual=False) | Q(is_checked=True)).delete()
            ShoppingListItem.objects.bulk_create(
                ShoppingListItem(
                    user=request.user,
                    week_start=start,
                    ingredient_name=item['name'],
                    quantity=format_quantity(item['quantity'], item['unit']),
                    category=aisles[item['name']],
                )
                for item in items
                if normalize_name(item['name']) not in checked
            )

        all_items = ShoppingListItem.objects.filter(user=request.user, week_start=start).order_by('category', 'ingredient_name')
        return Response(ShoppingListItemSerializer(all_items, many=True).data)


class ShoppingListItemViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = ShoppingListItemSerializer
    pagination_class = None

    def get_queryset(self):
        qs = ShoppingListItem.objects.filter(user=self.request.user)
        week_start = self.request.query_params.get('week_start')
        if week_start:
            try:
                qs = qs.filter(week_start=date.fromisoformat(week_start))
            except ValueError:
                raise ValidationError({'week_start': 'Fecha inválida, se espera AAAA-MM-DD.'})
        return qs.order_by('category', 'ingredient_name')

    def perform_create(self, serializer):
        extra = {}
        if 'category' not in serializer.validated_data:
            name = serializer.validated_data['ingredient_name']
            extra['category'] = resolve_aisles(self.request.user, [name])[name]
        serializer.save(user=self.request.user, is_manual=True, **extra)

    def perform_update(self, serializer):
        item = serializer.save()
        # Si el usuario lo movió de góndola, la próxima vez ese ingrediente va directo ahí.
        if 'category' in serializer.validated_data:
            remember_user_choice(self.request.user, item.ingredient_name, item.category)


# ---------------------------------------------------------------------------
# Importar recetas con IA
# ---------------------------------------------------------------------------

@api_view(['POST'])
@permission_classes([IsAuthenticated])
@throttle_classes([ImportRateThrottle])
def import_recipe_view(request):
    """Video de TikTok, Instagram, YouTube o Facebook."""
    url = str(request.data.get('url') or '').strip()
    if not url:
        return error('Falta el link del video.')
    if not is_allowed_video_url(url):
        return error('Solo se pueden importar videos de YouTube, TikTok, Instagram y Facebook.')

    return run_ai_import(request, lambda: extract_from_video(url), VIDEO_FAILURE)


def remaining_imports_today(user):
    usage, _ = UserUsage.objects.get_or_create(user=user)
    usage.reset_if_new_day()
    return max(0, settings.PIZCA_MAX_IMPORTS_PER_USER_PER_DAY - usage.import_count)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
@throttle_classes([ImportRateThrottle])
def list_collection_view(request):
    """
    Colección de TikTok o playlist de YouTube: lista los videos (sin IA, no gasta cupo).
    Si el link resulta ser un video suelto devuelve is_collection=False y el cliente sigue
    con la importación de siempre (pasa con los links cortos de TikTok, que no dicen qué son).
    """
    url = str(request.data.get('url') or '').strip()
    if not url:
        return error('Falta el link.')
    if not is_allowed_video_url(url):
        return error('Solo se pueden importar colecciones de TikTok y playlists de YouTube.')
    try:
        collection = list_collection(url)
    except AIInputError as e:
        return error(str(e))
    if collection is None:
        return Response({'is_collection': False})

    videos = [v for v in collection['videos'] if is_allowed_video_url(v['url'])]
    urls = [v['url'] for v in videos]
    already = set(
        Recipe.objects.filter(user=request.user, original_url__in=urls).values_list('original_url', flat=True)
    )
    return Response({
        'is_collection': True,
        'title': collection['title'],
        'videos': videos,
        'already_imported': [u for u in urls if u in already],
        'remaining_today': remaining_imports_today(request.user),
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
@throttle_classes([ImportRateThrottle])
def import_collection_item_view(request):
    """
    Un video de una colección: se extrae y se guarda directo (privada), sin borrador.
    Si ya está importado no gasta cupo y devuelve skipped=True.
    """
    url = str(request.data.get('url') or '').strip()
    if not url:
        return error('Falta el link del video.')
    if not is_allowed_video_url(url) or len(url) > Recipe._meta.get_field('original_url').max_length:
        return error('Link de video inválido.')
    category = request.data.get('category')
    categories = []
    if category not in (None, ''):
        # Se valida antes de gastar la llamada a la IA.
        if not str(category).isdigit() or not Category.objects.filter(
            Q(user__isnull=True) | Q(user=request.user), pk=int(category)
        ).exists():
            return error('Categoría inválida.')
        categories = [int(category)]

    existing = Recipe.objects.filter(user=request.user, original_url=url).first()
    if existing:
        data = RecipeSerializer(existing, context={'request': request}).data
        return Response({'skipped': True, 'recipe': data})

    recipe, failure = _ai_import(request, lambda: extract_from_video(url), VIDEO_FAILURE)
    if failure:
        return failure

    # Sin cupo de fotos se guarda igual, sin portada: la receta ya gastó la llamada a la IA.
    usage, _ = UserUsage.objects.get_or_create(user=request.user)
    if not usage.can_upload_image(settings.PIZCA_MAX_IMAGES_PER_USER_PER_DAY):
        recipe.pop('image_url', None)

    serializer = RecipeSerializer(
        data={**recipe, 'original_url': url, 'categories': categories},
        context={'request': request},
    )
    if not serializer.is_valid():
        logger.warning('Receta de colección inválida %s: %s', url, serializer.errors)
        return error('La receta de este video salió incompleta.')
    serializer.save(user=request.user)
    return Response({'skipped': False, 'recipe': serializer.data}, status=status.HTTP_201_CREATED)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
@throttle_classes([ImportRateThrottle])
def import_recipe_from_file_view(request):
    """Audio subido o grabado en la app."""
    uploaded_file = request.FILES.get('file')
    if not uploaded_file:
        return error('No llegó ningún archivo.')
    if uploaded_file.size > MAX_AUDIO_UPLOAD_BYTES:
        return error('El archivo es demasiado grande (máximo 20 MB).')

    def extract():
        with tempfile.TemporaryDirectory(prefix='pizca-') as workdir:
            # Solo la extensión del nombre original: el nombre lo manda el cliente.
            ext = os.path.splitext(uploaded_file.name or '')[1][:10]
            path = os.path.join(workdir, f'upload{ext}')
            with open(path, 'wb') as f:
                for chunk in uploaded_file.chunks():
                    f.write(chunk)
            mp3_path = convert_audio_to_mp3(path)
            return extract_recipe_from_audio(mp3_path, '', None, require_audio=True)

    return run_ai_import(request, extract, 'No pudimos entender el audio. Probá de nuevo en un rato.')


@api_view(['POST'])
@permission_classes([IsAuthenticated])
@throttle_classes([ImportRateThrottle])
def import_recipe_from_text_view(request):
    text = request.data.get('text')
    if not isinstance(text, str) or not text.strip():
        return error('Falta el texto de la receta.')
    if len(text) > MAX_IMPORT_TEXT_CHARS:
        return error('El texto es demasiado largo (máximo 50.000 caracteres).')

    return run_ai_import(
        request, lambda: extract_recipe_from_text(text),
        'No encontramos una receta en el texto. Probá sumando ingredientes y pasos.',
    )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
@throttle_classes([ImportRateThrottle])
def import_recipe_from_web_view(request):
    """Blog o sitio de recetas: se baja el HTML, se limpia y la IA saca la receta."""
    url = str(request.data.get('url') or '').strip()
    if not url:
        return error('Falta el link.')
    if urlparse(url).scheme != 'https':
        return error('Solo se permiten links con HTTPS.')

    def extract():
        html = fetch_public(url, MAX_WEB_PAGE_BYTES, schemes=('https',))
        soup = BeautifulSoup(html, 'html.parser')
        og_image = soup.find('meta', property='og:image')
        for tag in soup(['script', 'style', 'noscript', 'header', 'footer', 'nav', 'aside']):
            tag.decompose()
        text = soup.get_text(separator=' ', strip=True)[:100_000]
        recipe = extract_recipe_from_text(
            text,
            strict_mode=True,
            source='Es el texto de una página web: dejá afuera historias, publicidades y comentarios del blog.',
        )
        if recipe and og_image and og_image.get('content'):
            # Muchos sitios la ponen relativa ("/img/a.jpg") o sin protocolo ("//cdn.../a.jpg").
            image_url = urljoin(url, str(og_image['content']).strip())
            if urlparse(image_url).scheme in ('http', 'https') and len(image_url) <= 2000:
                recipe['image_url'] = image_url
        return recipe

    return run_ai_import(
        request, extract,
        'No pudimos sacar la receta de este sitio (algunos bloquean la lectura automática). '
        'Copiá el texto de la receta y usá "Pegar texto".',
        failure_status=status.HTTP_400_BAD_REQUEST,
    )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def current_user_view(request):
    user = request.user
    return Response({'id': user.id, 'username': user.username, 'email': user.email})


# ---------------------------------------------------------------------------
# Ideas (chat con IA sobre las recetas del usuario)
# ---------------------------------------------------------------------------

@api_view(['POST'])
@permission_classes([IsAuthenticated])
@throttle_classes([IdeasRateThrottle])
def ideas(request):
    user_message = str(request.data.get('message', '')).strip()
    if not user_message:
        return error('Mensaje vacío')
    if len(user_message) > MAX_IDEAS_MESSAGE_CHARS:
        return error('Mensaje demasiado largo (máximo 2000 caracteres).')

    limit_msg = check_usage_limits(request.user)
    if limit_msg:
        return error(limit_msg, status.HTTP_429_TOO_MANY_REQUESTS)

    # Ingredientes y categorías que el usuario nombra en el mensaje (sin distinguir mayúsculas).
    message_lower = user_message.lower()
    ingredient_names = Ingredient.objects.filter(recipe__user=request.user).values_list('name', flat=True).distinct()
    category_names = Category.objects.filter(Q(user__isnull=True) | Q(user=request.user)).values_list('name', flat=True)
    matching_ingredients = {n.lower().strip() for n in ingredient_names if n and n.lower().strip() in message_lower}
    matching_categories = {n.lower().strip() for n in category_names if n and n.lower().strip() in message_lower}

    # Si nombró ingredientes y categorías, tienen que coincidir las dos cosas.
    recipes = Recipe.objects.filter(user=request.user)
    if matching_ingredients:
        q = Q()
        for name in matching_ingredients:
            q |= Q(ingredients__name__icontains=name)
        recipes = recipes.filter(q)
    if matching_categories:
        q = Q()
        for name in matching_categories:
            q |= Q(categories__name__icontains=name)
        recipes = recipes.filter(q)
    limit = 15 if (matching_ingredients or matching_categories) else 20  # sin filtros: las últimas
    recipes = recipes.distinct().order_by('-created_at').prefetch_related('ingredients', 'categories')[:limit]

    try:
        result = call_ideas(user_message, build_recipes_summary(recipes))
    except Exception:
        logger.exception('Falló Ideas')
        return error('Ideas no está disponible en este momento. Intentá de nuevo.', status.HTTP_503_SERVICE_UNAVAILABLE)

    record_usage(request.user)
    return Response(result)
