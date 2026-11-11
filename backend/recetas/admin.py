from django.contrib import admin

from .models import (
    Category, Favorite, GlobalUsage, Ingredient, MealPlan, PasswordResetOTP, PendingRegistration,
    Recipe, ShoppingListItem, Step, UserUsage,
)


class IngredientInline(admin.TabularInline):
    model = Ingredient
    extra = 0


class StepInline(admin.TabularInline):
    model = Step
    extra = 0


@admin.register(Recipe)
class RecipeAdmin(admin.ModelAdmin):
    list_display = ('title', 'user', 'is_public', 'created_at')
    search_fields = ('title', 'description')
    list_filter = ('is_public', 'categories')
    list_select_related = ('user',)
    filter_horizontal = ('categories',)
    inlines = [IngredientInline, StepInline]


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ('name', 'parent', 'user')
    list_select_related = ('parent', 'user')


@admin.register(Favorite)
class FavoriteAdmin(admin.ModelAdmin):
    list_display = ('user', 'recipe', 'created_at')
    list_select_related = ('user', 'recipe')


@admin.register(MealPlan)
class MealPlanAdmin(admin.ModelAdmin):
    list_display = ('user', 'date', 'meal_type', 'recipe')
    list_filter = ('meal_type',)
    list_select_related = ('user', 'recipe')


@admin.register(ShoppingListItem)
class ShoppingListItemAdmin(admin.ModelAdmin):
    list_display = ('user', 'week_start', 'ingredient_name', 'quantity', 'category', 'is_checked', 'is_manual')
    list_select_related = ('user',)


@admin.register(UserUsage)
class UserUsageAdmin(admin.ModelAdmin):
    list_display = ('user', 'import_count', 'image_count', 'last_reset')
    list_select_related = ('user',)


@admin.register(GlobalUsage)
class GlobalUsageAdmin(admin.ModelAdmin):
    list_display = ('date', 'gemini_requests')


@admin.register(PendingRegistration)
class PendingRegistrationAdmin(admin.ModelAdmin):
    list_display = ('username', 'email', 'created_at', 'expires_at', 'attempts')
    search_fields = ('username', 'email')
    exclude = ('password',)


@admin.register(PasswordResetOTP)
class PasswordResetOTPAdmin(admin.ModelAdmin):
    list_display = ('user', 'created_at', 'expires_at', 'attempts')
    search_fields = ('user__username', 'user__email')
    list_select_related = ('user',)
