import uuid
from datetime import timedelta

from django.contrib.auth.models import User
from django.db import models, transaction
from django.db.models import F
from django.db.models.signals import post_delete, pre_save
from django.dispatch import receiver
from django.utils import timezone

OTP_TTL = timedelta(minutes=10)
MAX_OTP_ATTEMPTS = 5

# Góndolas de la lista de compras, en el orden en que se recorre el súper.
# Son las secciones que muestra la app (frontend/src/constants/aisles.ts tiene la misma lista).
AISLES = [
    'Verduras y frutas',
    'Carnes y pescados',
    'Lácteos y huevos',
    'Panadería',
    'Almacén',
    'Especias y condimentos',
    'Bebidas',
    'Congelados',
    'Otros',
]
OTHER_AISLE = 'Otros'
AISLE_CHOICES = [(a, a) for a in AISLES]

class Category(models.Model):
    name = models.CharField(max_length=100)
    parent = models.ForeignKey('self', on_delete=models.CASCADE, null=True, blank=True, related_name='subcategories')
    user = models.ForeignKey(User, on_delete=models.CASCADE, null=True, blank=True, related_name='categories')

    def __str__(self):
        if self.parent:
            return f"{self.parent.name} -> {self.name}"
        return self.name

class Recipe(models.Model):
    uuid = models.UUIDField(default=uuid.uuid4, editable=False, unique=True)
    title = models.CharField(max_length=100)
    description = models.TextField(blank=True, null=True)
    categories = models.ManyToManyField(Category, related_name='recipes', blank=True)
    image = models.ImageField(upload_to='recipes/%Y/%m', blank=True, null=True)
    original_url = models.URLField(blank=True, null=True)
    servings = models.PositiveIntegerField(blank=True, null=True)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='recipes') 
    is_public = models.BooleanField(default=False)
    prep_time = models.PositiveIntegerField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        # La lista principal: recetas de un usuario, las más nuevas primero (paginación por cursor).
        indexes = [models.Index(fields=['user', '-created_at'], name='recipe_user_created_idx')]

    def __str__(self):
        return self.title

class Ingredient(models.Model):
    recipe = models.ForeignKey(Recipe, on_delete=models.CASCADE, related_name='ingredients')
    name = models.CharField(max_length=100)
    quantity = models.DecimalField(max_digits=8, decimal_places=2, blank=True, null=True)
    unit = models.CharField(max_length=50, blank=True, default='')
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['order']

    def __str__(self):
        qty = self.quantity if self.quantity is not None else ''
        return f"{qty} {self.unit} {self.name}".strip()

class Step(models.Model):
    recipe = models.ForeignKey(Recipe, on_delete=models.CASCADE, related_name='steps')
    order = models.PositiveIntegerField()
    instruction = models.TextField()

    class Meta:
        ordering = ['order']

    def __str__(self):
        return f"Step {self.order} - {self.instruction}"


class Favorite(models.Model):
    """Tabla intermedia para favoritos/likes. Cada fila = 'User X marcó Recipe Y como favorita'."""
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='favorites')
    recipe = models.ForeignKey(Recipe, on_delete=models.CASCADE, related_name='favorited_by')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('user', 'recipe')

    def __str__(self):
        return f"{self.user.username} ♥ {self.recipe.title}"


class UserUsage(models.Model):
    """Uso diario por usuario — limita importaciones de IA por día."""
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='usage')
    import_count = models.PositiveIntegerField(default=0)
    image_count = models.PositiveIntegerField(default=0)  # fotos de portada subidas hoy
    last_reset = models.DateField(auto_now_add=True)

    def reset_if_new_day(self):
        if self.last_reset < timezone.localdate():
            self.import_count = 0
            self.image_count = 0
            self.last_reset = timezone.localdate()
            self.save()

    def can_import(self, max_daily):
        self.reset_if_new_day()
        return self.import_count < max_daily

    def record_import(self):
        self.reset_if_new_day()
        UserUsage.objects.filter(pk=self.pk).update(import_count=F('import_count') + 1)
        self.refresh_from_db()

    def can_upload_image(self, max_daily):
        self.reset_if_new_day()
        return self.image_count < max_daily

    def record_image(self):
        UserUsage.objects.filter(pk=self.pk).update(image_count=F('image_count') + 1)

    def __str__(self):
        return f"{self.user.username}: {self.import_count} imports ({self.last_reset})"


class GlobalUsage(models.Model):
    """Uso global diario de la API de Gemini (compartido entre todos los usuarios)."""
    date = models.DateField(unique=True)
    gemini_requests = models.PositiveIntegerField(default=0)

    @classmethod
    def get_today(cls):
        obj, _ = cls.objects.get_or_create(date=timezone.localdate())
        return obj

    def can_request(self, max_daily):
        return self.gemini_requests < max_daily

    def record_request(self):
        GlobalUsage.objects.filter(pk=self.pk).update(gemini_requests=F('gemini_requests') + 1)
        self.refresh_from_db()

    def __str__(self):
        return f"Gemini {self.date}: {self.gemini_requests} requests"


class MealPlan(models.Model):
    MEAL_TYPES = [
        ('breakfast', 'Desayuno'),
        ('lunch', 'Almuerzo'),
        ('dinner', 'Cena'),
    ]
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='meal_plans')
    date = models.DateField()
    meal_type = models.CharField(max_length=20, choices=MEAL_TYPES)
    recipe = models.ForeignKey(Recipe, on_delete=models.SET_NULL, null=True, blank=True)

    class Meta:
        unique_together = ('user', 'date', 'meal_type')
        ordering = ['date', 'meal_type']

    def __str__(self):
        return f"{self.user.username} - {self.date} - {self.meal_type}"


class ShoppingListItem(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='shopping_list')
    week_start = models.DateField()
    ingredient_name = models.CharField(max_length=100)
    quantity = models.CharField(max_length=50, blank=True, null=True)
    category = models.CharField(max_length=50, choices=AISLE_CHOICES, default=OTHER_AISLE)
    is_checked = models.BooleanField(default=False)
    # Lo agregó el usuario a mano: sobrevive a regenerar la lista desde el plan.
    is_manual = models.BooleanField(default=False)

    class Meta:
        ordering = ['user', 'week_start', 'ingredient_name']
        indexes = [models.Index(fields=['user', 'week_start'], name='shopping_user_week_idx')]

    def __str__(self):
        qty = self.quantity if self.quantity is not None else ''
        return f"{qty} {self.category} {self.ingredient_name}".strip()

class IngredientAisle(models.Model):
    """
    Caché global de en qué góndola va cada ingrediente (lo decide Gemini una sola vez).
    `name` está normalizado con shopping.normalize_name.
    """
    name = models.CharField(max_length=100, unique=True)
    aisle = models.CharField(max_length=50, choices=AISLE_CHOICES)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.name} → {self.aisle}"


class UserIngredientAisle(models.Model):
    """Góndola que eligió el usuario para un ingrediente: le gana al caché global, solo para él."""
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='ingredient_aisles')
    name = models.CharField(max_length=100)
    aisle = models.CharField(max_length=50, choices=AISLE_CHOICES)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=['user', 'name'], name='user_ingredient_aisle_unique')]

    def __str__(self):
        return f"{self.user.username}: {self.name} → {self.aisle}"


def _delete_image_after_commit(name):
    """Borra la foto del bucket recién cuando la base confirmó el cambio: si el save falla, la foto sigue."""
    if name:
        storage = Recipe._meta.get_field('image').storage
        transaction.on_commit(lambda: storage.delete(name))


@receiver(pre_save, sender=Recipe)
def delete_old_image(sender, instance, **kwargs):
    if not instance.pk:
        return
    old = Recipe.objects.filter(pk=instance.pk).values_list('image', flat=True).first()
    if old != instance.image.name:
        _delete_image_after_commit(old)


@receiver(post_delete, sender=Recipe)
def delete_image_on_recipe_delete(sender, instance, **kwargs):
    """Limpia la imagen de R2/disco cuando se elimina una receta."""
    _delete_image_after_commit(instance.image.name)


def default_otp_expiry():
    return timezone.now() + OTP_TTL


class OTPMixin(models.Model):
    otp_code = models.CharField(max_length=6)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField(default=default_otp_expiry)
    # Intentos fallidos: al llegar a MAX_OTP_ATTEMPTS el código deja de servir (frena la fuerza bruta).
    attempts = models.PositiveSmallIntegerField(default=0)

    class Meta:
        abstract = True

    def is_expired(self):
        return timezone.now() > self.expires_at

    def is_locked(self):
        return self.attempts >= MAX_OTP_ATTEMPTS

    def register_failed_attempt(self):
        type(self).objects.filter(pk=self.pk).update(attempts=F('attempts') + 1)


class PendingRegistration(OTPMixin):
    username = models.CharField(max_length=150, unique=True)
    email = models.EmailField(unique=True)
    password = models.CharField(max_length=128)  # Hashed password

    def __str__(self):
        return f"Pending: {self.username} ({self.email})"


class PasswordResetOTP(OTPMixin):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='password_reset_otps')

    def __str__(self):
        return f"Reset OTP for {self.user.username}"
