import re
from datetime import timedelta
from decimal import Decimal, InvalidOperation

from django.conf import settings
from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework import serializers

from .images import InvalidImage, image_from_base64, image_from_url
from .models import Category, Favorite, Ingredient, MealPlan, Recipe, ShoppingListItem, Step, UserUsage


def new_cover_image(request, img_b64, img_url):
    """
    Procesa la foto nueva (si vino) y la cuenta para el tope diario.
    Una foto que llega mal tira ValidationError; una URL que no baja devuelve None.
    """
    if not img_b64 and not img_url:
        return None
    usage, _ = UserUsage.objects.get_or_create(user=request.user)
    max_daily = settings.PIZCA_MAX_IMAGES_PER_USER_PER_DAY
    if not usage.can_upload_image(max_daily):
        raise serializers.ValidationError(
            {'image': f'Llegaste al máximo de {max_daily} fotos por día. Podés guardar la receta sin foto y agregarla mañana.'}
        )
    if img_b64:
        try:
            image = image_from_base64(img_b64)
        except InvalidImage as e:
            raise serializers.ValidationError({'image': str(e)})
    else:
        image = image_from_url(img_url)
    if image:
        usage.record_image()
    return image


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

    # Las listas los traen anotados (ver RecipeViewSet.get_queryset); si no, una consulta por receta.
    def get_is_favorite(self, obj):
        if hasattr(obj, 'is_favorite_annotated'):
            return obj.is_favorite_annotated
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return Favorite.objects.filter(user=request.user, recipe=obj).exists()
        return False

    def get_favorite_count(self, obj):
        if hasattr(obj, 'favorite_count_annotated'):
            return obj.favorite_count_annotated
        return obj.favorited_by.count()

    @staticmethod
    def _create_ingredients(recipe, ingredients_data):
        Ingredient.objects.bulk_create(
            Ingredient(recipe=recipe, **{'order': i, **item}) for i, item in enumerate(ingredients_data)
        )

    def create(self, validated_data):
        ingredients_data = validated_data.pop('ingredients')
        steps_data = validated_data.pop('steps')
        categories_data = validated_data.pop('categories', [])

        img_b64 = validated_data.pop('image_base64', None)
        img_url = validated_data.pop('image_url', None)

        image = new_cover_image(self.context['request'], img_b64, img_url)
        if image:
            validated_data['image'] = image

        with transaction.atomic():
            recipe = Recipe.objects.create(**validated_data)
            recipe.categories.set(categories_data)
            self._create_ingredients(recipe, ingredients_data)
            Step.objects.bulk_create(Step(recipe=recipe, **step) for step in steps_data)
        return recipe

    def update(self, instance, validated_data):
        ingredients_data = validated_data.pop('ingredients', None)
        steps_data = validated_data.pop('steps', None)
        categories_data = validated_data.pop('categories', None)
        img_b64 = validated_data.pop('image_base64', None)
        img_url = validated_data.pop('image_url', None)
        remove_image = validated_data.pop('remove_image', False)

        for field, value in validated_data.items():
            setattr(instance, field, value)

        # Imagen de portada: una nueva gana sobre "quitar".
        image = new_cover_image(self.context['request'], img_b64, img_url)
        if image:
            instance.image = image
        elif remove_image and not (img_b64 or img_url):
            instance.image = None

        with transaction.atomic():
            instance.save()

            if categories_data is not None:
                instance.categories.set(categories_data)

            # Ingredientes: se reemplazan (son texto simple con cantidad, nadie los referencia).
            if ingredients_data is not None:
                instance.ingredients.all().delete()
                self._create_ingredients(instance, ingredients_data)

            # Pasos: se conservan los ids que vuelven (los usa el modo cocina), se crean los nuevos
            # y se borran los que el usuario quitó.
            if steps_data is not None:
                existing = {step.id: step for step in instance.steps.all()}
                to_update, to_create = [], []
                for item in steps_data:
                    step = existing.get(item.get('id'))
                    if step:
                        step.order = item.get('order', step.order)
                        step.instruction = item.get('instruction', step.instruction)
                        to_update.append(step)
                    else:
                        item.pop('id', None)  # un id ajeno o inventado se trata como paso nuevo
                        to_create.append(Step(recipe=instance, **item))
                instance.steps.exclude(id__in=[step.id for step in to_update]).delete()
                Step.objects.bulk_update(to_update, ['order', 'instruction'])
                Step.objects.bulk_create(to_create)

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
        fields = ['id', 'week_start', 'ingredient_name', 'quantity', 'category', 'is_checked', 'is_manual']
        read_only_fields = ['is_manual']