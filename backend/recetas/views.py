from rest_framework import viewsets, status, filters
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.generics import RetrieveAPIView
from .models import Recipe, Category
from .serializers import RecipeSerializer, CategorySerializer
import os
from .utils import download_audio_from_url, extract_recipe_from_audio
from django_filters.rest_framework import DjangoFilterBackend

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
