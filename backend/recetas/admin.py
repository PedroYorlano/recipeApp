from django.contrib import admin
from .models import Category, Recipe, Ingredient, Step

class RecipeAdmin(admin.ModelAdmin):
    # Esto crea un buscador y columnas en la lista de recetas
    list_display = ('title', 'created_at') 
    search_fields = ('title', 'description')
    
    # LA MAGIA: Cambia el selector de categorías por uno de doble caja
    filter_horizontal = ('categories',)

# Register your models here.

admin.site.register(Category)
admin.site.register(Recipe, RecipeAdmin)
admin.site.register(Ingredient)
admin.site.register(Step)