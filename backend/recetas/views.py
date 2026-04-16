from rest_framework import viewsets, status, filters
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.generics import RetrieveAPIView
from .models import Recipe, Category
from .serializers import RecipeSerializer, CategorySerializer
import os
from .utils import download_audio_from_url, extract_recipe_from_audio, extract_recipe_from_text
from django_filters.rest_framework import DjangoFilterBackend
import tempfile
import requests
from bs4 import BeautifulSoup

# Create your views here.

class RecipeViewSet(viewsets.ModelViewSet):
    serializer_class = RecipeSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['categories']
    search_fields = ['title', 'description', 'ingredients__name']

    def get_queryset(self):
        return Recipe.objects.filter(user=self.request.user).order_by('-id')

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    def perform_update(self, serializer):
        serializer.save(user=self.request.user)

class SharedRecipeView(RetrieveAPIView):
    queryset = Recipe.objects.all()
    serializer_class = RecipeSerializer
    permission_classes = [AllowAny]
    lookup_field = 'uuid'

class CategoryViewSet(viewsets.ModelViewSet):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer
    permission_classes = [AllowAny]

@api_view(['POST'])
def import_recipe_view(request):
    target_url = request.data.get('url')

    if not target_url:
        return Response({'error': 'URL no proporcionada'}, status=status.HTTP_400_BAD_REQUEST)

    audio_path, description_text, thumbnail_url = download_audio_from_url(target_url)

    if not audio_path or not description_text:
        return Response({'error': 'Error al descargar el audio'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    try:
        recipe_data = extract_recipe_from_audio(audio_path, description_text, thumbnail_url)
    
        if not recipe_data:
            return Response({'error': 'Error al extraer la receta'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        if os.path.exists(audio_path):
            os.remove(audio_path)

        return Response({'message': 'Receta importada exitosamente', 'recipe': recipe_data}, status=status.HTTP_201_CREATED)
    
    except Exception as e:
        if os.path.exists(audio_path):
            os.remove(audio_path)
        return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['POST'])
def import_recipe_from_file_view(request):
    uploaded_file = request.FILES.get('file')

    if not uploaded_file:
        return Response({'error': 'No se proporcionó ningún archivo'}, status=status.HTTP_400_BAD_REQUEST)

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

        return Response({'message': 'Receta importada exitosamente', 'recipe': recipe_data}, status=status.HTTP_201_CREATED)
    
    except Exception as e:
        if 'temp_path' in locals() and os.path.exists(temp_path):
            os.remove(temp_path)
        return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['POST'])
def import_recipe_from_text_view(request):
    text_data = request.data.get('text')
    
    if not text_data or len(text_data.strip()) == 0:
        return Response({'error': 'No se proporcionó texto de receta'}, status=status.HTTP_400_BAD_REQUEST)
        
    try:
        recipe_data = extract_recipe_from_text(text_data)
        if not recipe_data:
            return Response({'error': 'IA falló al extraer la receta'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        return Response({'message': 'Receta generada a partir de texto', 'recipe': recipe_data}, status=status.HTTP_201_CREATED)
    
    except Exception as e:
        return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['POST'])
def import_recipe_from_web_view(request):
    target_url = request.data.get('url')
    
    if not target_url:
        return Response({'error': 'No se proporcionó URL'}, status=status.HTTP_400_BAD_REQUEST)
        
    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
        res = requests.get(target_url, headers=headers, timeout=10)
        res.raise_for_status()

        soup = BeautifulSoup(res.text, 'html.parser')

        # Remover scripts y estilos visuales ruidosos
        for script in soup(["script", "style", "noscript", "header", "footer"]):
            script.decompose()

        cleaned_text = soup.get_text(separator=' ', strip=True)

        # Enviar 100k limit
        cleaned_text = cleaned_text[:100000]

        recipe_data = extract_recipe_from_text(f"Por favor extrae la receta estructurada del siguiente contenido de una página web. Elimina las historias/publicidades/comentarios del blog:\n\n{cleaned_text}")
        
        if not recipe_data:
            return Response({'error': 'IA falló al extraer la receta'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        og_image = soup.find('meta', property='og:image')
        if og_image and og_image.get('content'):
            recipe_data['image_url'] = og_image['content']

        return Response({'message': 'Receta generada a partir de blog web', 'recipe': recipe_data}, status=status.HTTP_201_CREATED)
    
    except requests.exceptions.RequestException as e:
        return Response({"error": f"Fallo al acceder al sitio web: {str(e)}"}, status=status.HTTP_400_BAD_REQUEST)
    except Exception as e:
        return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
