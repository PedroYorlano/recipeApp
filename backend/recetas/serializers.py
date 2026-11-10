from rest_framework import serializers
from .models import Category, Recipe, Ingredient, Step, Favorite, MealPlan, ShoppingListItem
from django.db import transaction
import base64
import uuid
from django.core.files.base import ContentFile
import re
import requests
from decimal import Decimal, InvalidOperation
from django.contrib.auth.models import User
from django.db.models import Q

class UserRegistrationSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=True, min_length=8, style={'input_type': 'password'})

    class Meta:
        model = User
        fields = ['username', 'email', 'password']
        extra_kwargs = {
            'email': {'required': True}
        }

    def validate_username(self, value):
        if len(value) < 3:
            raise serializers.ValidationError("El nombre de usuario debe tener al menos 3 caracteres.")
        if len(value) > 30:
            raise serializers.ValidationError("El nombre de usuario no puede tener más de 30 caracteres.")
        return value

    def create(self, validated_data):
        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data['email'],
            password=validated_data['password']
        )
        return user

def decode_base64_file(data):
    if not data:
        return None
    # Limitar tamaño de base64 (~5MB de imagen = ~6.7MB en base64)
    if len(data) > 7 * 1024 * 1024:
        raise serializers.ValidationError("La imagen es demasiado grande (máximo 5MB).")
    format, imgstr = data.split(';base64,')
    ext = format.split('/')[-1]
    # Solo permitir formatos de imagen
    allowed_formats = ['jpeg', 'jpg', 'png', 'webp', 'gif']
    if ext.lower() not in allowed_formats:
        raise serializers.ValidationError(f"Formato de imagen no permitido: {ext}")
    return ContentFile(base64.b64decode(imgstr), name=f"{uuid.uuid4()}.{ext}")

def download_image_from_url(url):
    try:
        import socket
        import ipaddress
        from urllib.parse import urlparse
        # SSRF protection: solo permitir URLs HTTPS con IPs públicas
        parsed = urlparse(url)
        if parsed.scheme not in ('http', 'https'):
            return None
        hostname = parsed.hostname
        if not hostname:
            return None
        resolved_ip = socket.gethostbyname(hostname)
        ip_obj = ipaddress.ip_address(resolved_ip)
        if ip_obj.is_private or ip_obj.is_loopback or ip_obj.is_link_local or ip_obj.is_reserved:
            return None

        response = requests.get(url, timeout=10, stream=True)
        if response.status_code == 200:
            # Limitar descarga a 5MB
            content_length = response.headers.get('Content-Length')
            if content_length and int(content_length) > 5 * 1024 * 1024:
                return None
            content = response.content[:5 * 1024 * 1024]
            return ContentFile(content, name=f"{uuid.uuid4()}.jpg")
    except Exception:
        return None
        

class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ['id', 'name', 'parent']

# "400ml", "1/2 taza", "1,5 kg": número al principio de la unidad.
_LEADING_QTY = re.compile(r'^\s*(\d+\s*/\s*\d+|\d+(?:[.,]\d+)?)\s*(.*)$')


def split_quantity_unit(quantity, unit):
    """Si la cantidad vino pegada a la unidad (recetas viejas o la IA), la separa."""
    if quantity is not None or not unit:
        return quantity, unit
    match = _LEADING_QTY.match(unit)
    if not match:
        return quantity, unit
    raw, rest = match.groups()
    try:
        if '/' in raw:
            num, den = (Decimal(x.strip()) for x in raw.split('/'))
            if den == 0:
                return quantity, unit
            value = (num / den).quantize(Decimal('0.01'))
        else:
            value = Decimal(raw.replace(',', '.'))
    except InvalidOperation:
        return quantity, unit
    return value, rest.strip()


class IngredientSerializer(serializers.ModelSerializer):
    # Número en el JSON (no "200.00"), que es lo que espera el front.
    quantity = serializers.DecimalField(
        max_digits=8, decimal_places=2, coerce_to_string=False, required=False, allow_null=True
    )

    class Meta:
        model = Ingredient
        fields = ['id', 'name', 'quantity', 'unit', 'order']

    def validate(self, data):
        data['quantity'], data['unit'] = split_quantity_unit(data.get('quantity'), data.get('unit', ''))
        return data

    def to_representation(self, instance):
        data = super().to_representation(instance)
        quantity, unit = split_quantity_unit(data.get('quantity'), data.get('unit'))
        data['quantity'] = float(quantity) if isinstance(quantity, Decimal) else quantity
        data['unit'] = unit
        return data

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

    def validate_ingredients(self, value):
        if len(value) > 50:
            raise serializers.ValidationError("Máximo 50 ingredientes por receta.")
        return value

    def validate_steps(self, value):
        if len(value) > 100:
            raise serializers.ValidationError("Máximo 100 pasos por receta.")
        return value

    def validate_categories(self, value):
        user = self.context['request'].user
        allowed = set(
            Category.objects.filter(Q(user__isnull=True) | Q(user=user)).values_list('id', flat=True)
        )
        if any(cat.id not in allowed for cat in value):
            raise serializers.ValidationError("Categoría inválida.")
        return value

    def validate_title(self, value):
        if len(value.strip()) < 2:
            raise serializers.ValidationError("El título debe tener al menos 2 caracteres.")
        return value.strip()

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

        # 2. Actualizar campos simples (title, description, servings, prep_time, original_url, is_public...)
        for field, value in validated_data.items():
            setattr(instance, field, value)

        # 3. Imagen de portada: una nueva gana sobre "quitar"
        if img_b64:
            instance.image = decode_base64_file(img_b64)
        elif img_url:
            instance.image = download_image_from_url(img_url)
        elif remove_image:
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

class MealPlanRecipeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Recipe
        fields = ['uuid', 'title', 'image', 'prep_time', 'servings']

class MealPlanSerializer(serializers.ModelSerializer):
    recipe_detail = MealPlanRecipeSerializer(source='recipe', read_only=True)
    recipe = serializers.SlugRelatedField(
        slug_field='uuid',
        queryset=Recipe.objects.all(),
        write_only=True,
        required=False,
        allow_null=True,
    )

    class Meta:
        model = MealPlan
        fields = ['id', 'date', 'meal_type', 'recipe', 'recipe_detail']

    def validate_recipe(self, value):
        if value and value.user != self.context['request'].user:
            raise serializers.ValidationError("Solo podés planificar con tus propias recetas.")
        return value

    def validate_date(self, value):
        from datetime import timedelta
        from django.utils import timezone
        today = timezone.localdate()
        max_date = today + timedelta(weeks=4)
        if value < today:
            raise serializers.ValidationError("No podés planificar en el pasado.")
        if value > max_date:
            raise serializers.ValidationError("Solo podés planificar hasta 4 semanas.")
        return value

    def validate(self, data):
        user = self.context['request'].user
        date_val = data.get('date', getattr(self.instance, 'date', None))
        meal_type_val = data.get('meal_type', getattr(self.instance, 'meal_type', None))
        if date_val and meal_type_val:
            if MealPlan.objects.filter(
                user=user, date=date_val, meal_type=meal_type_val
            ).exclude(pk=self.instance.pk if self.instance else None).exists():
                raise serializers.ValidationError("Ya tenés una receta en ese slot.")
        return data

class ShoppingListItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = ShoppingListItem
        fields = ['id', 'week_start', 'ingredient_name', 'quantity', 'category', 'is_checked']