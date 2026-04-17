from rest_framework import serializers
from .models import Category, Recipe, Ingredient, Step, Favorite
from django.db import transaction
import base64
import uuid
from django.core.files.base import ContentFile
import requests

def decode_base64_file(data):
    if not data:
        return None
    format, imgstr = data.split(';base64,')
    ext = format.split('/')[-1]
    return ContentFile(base64.b64decode(imgstr), name=f"{uuid.uuid4()}.{ext}")

def download_image_from_url(url):
    try:
        response = requests.get(url)
        if response.status_code == 200:
            return ContentFile(response.content, name=f"{uuid.uuid4()}.jpg")
    except Exception:
        return None
        

class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ['id', 'name', 'parent']

class IngredientSerializer(serializers.ModelSerializer):
    class Meta:
        model = Ingredient
        fields = ['id', 'name', 'quantity', 'unit', 'order']

class StepSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(required=False)
    class Meta:
        model = Step
        fields = ['id', 'order', 'instruction']

class RecipeSerializer(serializers.ModelSerializer):
    ingredients = IngredientSerializer(many=True)
    steps = StepSerializer(many=True)

    categories = serializers.PrimaryKeyRelatedField(
        many=True, 
        queryset=Category.objects.all(),
        required=False
    )
    categories_details = CategorySerializer(source='categories', many=True, read_only=True)

    image_base64 = serializers.CharField(write_only=True, required=False, allow_null=True)
    image_url = serializers.URLField(write_only=True, required=False, allow_null=True)
    remove_image = serializers.BooleanField(write_only=True, required=False)

    # Campos computados para favoritos
    is_favorite = serializers.SerializerMethodField()
    favorite_count = serializers.SerializerMethodField()

    class Meta:
        model = Recipe
        fields = [
            'uuid', 'id', 'title', 'description', 'servings', 'prep_time',
            'categories', 'categories_details', 'original_url',
            'ingredients', 'steps', 'image', 'image_base64', 'image_url', 'remove_image',
            'is_favorite', 'favorite_count', 'is_public',
        ]
        extra_kwargs = {
            'image': {'read_only': True}
        }

    def get_is_favorite(self, obj):
        request = self.context.get('request')
        if request and request.user and request.user.is_authenticated:
            return Favorite.objects.filter(user=request.user, recipe=obj).exists()
        return False

    def get_favorite_count(self, obj):
        return obj.favorited_by.count()

    def create(self, validated_data):
        ingredients_data = validated_data.pop('ingredients')
        steps_data = validated_data.pop('steps')
        categories_data = validated_data.pop('categories', [])

        img_b64 = validated_data.pop('image_base64', None)
        img_url = validated_data.pop('image_url', None)

        if img_b64:
            validated_data['image'] = decode_base64_file(img_b64)
        elif img_url:
            validated_data['image'] = download_image_from_url(img_url)

        with transaction.atomic():
            recipe = Recipe.objects.create(**validated_data)

            recipe.categories.set(categories_data)
            
            for i, ingredient in enumerate(ingredients_data):
                ingredient.setdefault('order', i)
                Ingredient.objects.create(recipe=recipe, **ingredient)

            for step in steps_data:
                Step.objects.create(recipe=recipe, **step)
        
        return recipe

    def update(self, instance, validated_data):
        # 1. Extraer datos anidados
        ingredients_data = validated_data.pop('ingredients', None)
        steps_data = validated_data.pop('steps', None)
        categories_data = validated_data.pop('categories', None)
        img_b64 = validated_data.pop('image_base64', None)
        img_url = validated_data.pop('image_url', None)
        remove_image = validated_data.pop('remove_image', False)

        # 2. Actualizar campos simples de la receta
        instance.title = validated_data.get('title', instance.title)
        instance.description = validated_data.get('description', instance.description)
        instance.servings = validated_data.get('servings', instance.servings)
        instance.prep_time = validated_data.get('prep_time', instance.prep_time)

        # 3. Actualizar Imagen de Portada (Si hay nueva)
        if img_b64:
            instance.image = decode_base64_file(img_b64)
        elif img_url:
            instance.image = download_image_from_url(img_url)
        if remove_image:
            instance.image = None
        
        instance.save()

        # 4. Actualizar Categorías
        if categories_data is not None:
            instance.categories.set(categories_data)

        # 5. Actualizar Ingredientes (borrar y recrear — son texto simple con cantidad)
        if ingredients_data is not None:
            instance.ingredients.all().delete()
            for i, item in enumerate(ingredients_data):
                item.setdefault('order', i)
                Ingredient.objects.create(recipe=instance, **item)

        # 6. ACTUALIZACIÓN DE PASOS
        if steps_data is not None:
            # Lista para guardar los IDs de pasos que procesamos para no borrarlos
            keep_step_ids = []

            for item in steps_data:
                step_id = item.get('id')
                if step_id:
                    # CASO A: El paso ya existe -> Lo actualizamos
                    try:
                        step_obj = Step.objects.get(id=step_id, recipe=instance)
                        step_obj.order = item.get('order', step_obj.order)
                        step_obj.instruction = item.get('instruction', step_obj.instruction)
                        step_obj.save()
                        keep_step_ids.append(step_obj.id)
                    except Step.DoesNotExist:
                        continue # Si mandaron un ID raro, lo ignoramos
                else:
                    # CASO B: El paso es nuevo -> Lo creamos
                    new_step = Step.objects.create(recipe=instance, **item)
                    keep_step_ids.append(new_step.id)

            # CASO C: Borrar pasos que el usuario eliminó en el frontend
            # (Borramos todos los pasos de esta receta que NO estén en la lista de keep_ids)
            instance.steps.exclude(id__in=keep_step_ids).delete()

        return instance