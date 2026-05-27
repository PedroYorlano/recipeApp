from django.contrib import admin
from .models import Category, Recipe, Ingredient, Step, Favorite, UserUsage, GlobalUsage, PendingRegistration, PasswordResetOTP

class RecipeAdmin(admin.ModelAdmin):
    # Esto crea un buscador y columnas en la lista de recetas
    list_display = ('title', 'user', 'is_public', 'created_at') 
    search_fields = ('title', 'description')
    list_filter = ('is_public', 'categories')
    
    # LA MAGIA: Cambia el selector de categorías por uno de doble caja
    filter_horizontal = ('categories',)

class FavoriteAdmin(admin.ModelAdmin):
    list_display = ('user', 'recipe', 'created_at')
    list_filter = ('user',)

class UserUsageAdmin(admin.ModelAdmin):
    list_display = ('user', 'import_count', 'last_reset')

class GlobalUsageAdmin(admin.ModelAdmin):
    list_display = ('date', 'gemini_requests')

class PendingRegistrationAdmin(admin.ModelAdmin):
    list_display = ('username', 'email', 'otp_code', 'created_at', 'expires_at')
    search_fields = ('username', 'email')

class PasswordResetOTPAdmin(admin.ModelAdmin):
    list_display = ('user', 'otp_code', 'created_at', 'expires_at')
    search_fields = ('user__username', 'user__email')

# Register your models here.

admin.site.register(Category)
admin.site.register(Recipe, RecipeAdmin)
admin.site.register(Ingredient)
admin.site.register(Step)
admin.site.register(Favorite, FavoriteAdmin)
admin.site.register(UserUsage, UserUsageAdmin)
admin.site.register(GlobalUsage, GlobalUsageAdmin)
admin.site.register(PendingRegistration, PendingRegistrationAdmin)
admin.site.register(PasswordResetOTP, PasswordResetOTPAdmin)