from django.db import models
from django.contrib.auth.models import User
from datetime import date, timedelta
from django.utils import timezone
import uuid
from django.db.models.signals import pre_save, post_delete
from django.dispatch import receiver

# Create your models here.

class Category(models.Model):
    name = models.CharField(max_length=100)
    parent = models.ForeignKey('self', on_delete=models.CASCADE, null=True, blank=True, related_name='subcategories')

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
    last_reset = models.DateField(auto_now_add=True)

    def reset_if_new_day(self):
        if self.last_reset < date.today():
            self.import_count = 0
            self.last_reset = date.today()
            self.save()

    def can_import(self, max_daily):
        self.reset_if_new_day()
        return self.import_count < max_daily

    def record_import(self):
        self.reset_if_new_day()
        from django.db.models import F
        UserUsage.objects.filter(pk=self.pk).update(import_count=F('import_count') + 1)
        self.refresh_from_db()

    def __str__(self):
        return f"{self.user.username}: {self.import_count} imports ({self.last_reset})"


class GlobalUsage(models.Model):
    """Uso global diario de la API de Gemini (compartido entre todos los usuarios)."""
    date = models.DateField(unique=True)
    gemini_requests = models.PositiveIntegerField(default=0)

    @classmethod
    def get_today(cls):
        obj, _ = cls.objects.get_or_create(date=date.today())
        return obj

    def can_request(self, max_daily):
        return self.gemini_requests < max_daily

    def record_request(self):
        from django.db.models import F
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
    category = models.CharField(max_length=50, blank=True, default='')
    is_checked = models.BooleanField(default=False)

    class Meta:
        ordering = ['user', 'week_start', 'ingredient_name']

    def __str__(self):
        qty = self.quantity if self.quantity is not None else ''
        return f"{qty} {self.category} {self.ingredient_name}".strip()

@receiver(pre_save, sender=Recipe)
def delete_old_image(sender, instance, **kwargs):
    if not instance.pk:
        return
    try:
        old_image = Recipe.objects.get(pk=instance.pk).image
    except Recipe.DoesNotExist:
        return
    if old_image and old_image != instance.image:
        old_image.delete(save=False)


@receiver(post_delete, sender=Recipe)
def delete_image_on_recipe_delete(sender, instance, **kwargs):
    """Limpia la imagen de R2/disco cuando se elimina una receta."""
    if instance.image:
        instance.image.delete(save=False)


def default_otp_expiry():
    return timezone.now() + timedelta(minutes=2)


class PendingRegistration(models.Model):
    username = models.CharField(max_length=150, unique=True)
    email = models.EmailField(unique=True)
    password = models.CharField(max_length=128)  # Hashed password
    otp_code = models.CharField(max_length=6)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField(default=default_otp_expiry)

    def is_expired(self):
        return timezone.now() > self.expires_at

    def __str__(self):
        return f"Pending: {self.username} ({self.email})"


class PasswordResetOTP(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='password_reset_otps')
    otp_code = models.CharField(max_length=6)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField(default=default_otp_expiry)

    def is_expired(self):
        return timezone.now() > self.expires_at

    def __str__(self):
        return f"Reset OTP for {self.user.username}"