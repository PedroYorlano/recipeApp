from django.db import migrations

DEFAULT_CATEGORIES = ['Entradas', 'Salado', 'Postres', 'Meriendas']


def crear(apps, schema_editor):
    Category = apps.get_model('recetas', 'Category')
    for name in DEFAULT_CATEGORIES:
        Category.objects.get_or_create(name=name, user=None, parent=None)


def borrar(apps, schema_editor):
    Category = apps.get_model('recetas', 'Category')
    Category.objects.filter(name__in=DEFAULT_CATEGORIES, user=None, parent=None).delete()


class Migration(migrations.Migration):
    dependencies = [('recetas', '0019_shoppinglistitem_is_manual')]
    operations = [migrations.RunPython(crear, borrar)]
