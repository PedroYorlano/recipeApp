"""
Lista de compras: junta los ingredientes del plan semanal y los ubica en su góndola.

La góndola de cada ingrediente sale, en este orden, de:
1. Lo que eligió el usuario al mover un ítem (UserIngredientAisle).
2. El caché global (IngredientAisle), que se llena al importar recetas con IA y con lo que
   Gemini clasifica acá. Cada ingrediente se le pregunta a la IA una sola vez para todos.
3. Una llamada en lote a Gemini con lo que falta. Si falla o no hay cupo: "Otros".
"""
import logging
import unicodedata
from decimal import Decimal

from django.conf import settings

from .models import AISLES, OTHER_AISLE, GlobalUsage, IngredientAisle, UserIngredientAisle, UserUsage
from .serializers import split_quantity_unit
from .utils import classify_ingredients

logger = logging.getLogger(__name__)

# Tope por llamada: una semana con muchas recetas puede tener ~150 ingredientes distintos.
MAX_NAMES_PER_CALL = 200


def normalize_name(name: str) -> str:
    """'  Limón  Tahití ' → 'limon tahiti': la clave del caché no depende de tildes, mayúsculas ni espacios."""
    text = unicodedata.normalize('NFKD', name.lower())
    text = ''.join(c for c in text if not unicodedata.combining(c))
    return ' '.join(text.split())[:100]


def remember_aisles(pairs) -> None:
    """Guarda en el caché global pares (nombre, góndola). Lo que ya estaba no se pisa."""
    rows = {}
    for name, aisle in pairs:
        key = normalize_name(name or '')
        if key and aisle in AISLES:
            rows.setdefault(key, aisle)
    if rows:
        IngredientAisle.objects.bulk_create(
            [IngredientAisle(name=k, aisle=a) for k, a in rows.items()], ignore_conflicts=True,
        )


def learn_from_recipe(recipe: dict) -> None:
    """
    Las importaciones con IA traen la góndola de cada ingrediente (`aisle`): va al caché y se
    saca de la receta, que el frontend no la necesita. Nunca rompe la importación.
    """
    ingredients = [i for i in recipe.get('ingredients') or [] if isinstance(i, dict)]
    try:
        remember_aisles((i.get('name'), i.get('aisle')) for i in ingredients)
    except Exception:
        logger.exception('No se pudieron guardar las góndolas de una receta importada')
    for ingredient in ingredients:
        ingredient.pop('aisle', None)


def remember_user_choice(user, name: str, aisle: str) -> None:
    key = normalize_name(name)
    if key:
        UserIngredientAisle.objects.update_or_create(user=user, name=key, defaults={'aisle': aisle})


def _ask_ai(user, names: list[str]) -> dict[str, str]:
    """Clasifica con Gemini (una llamada). Devuelve {clave normalizada: góndola} y lo guarda en el caché."""
    # Dos frenos, porque los nombres los escribe el usuario y cada uno nuevo es una llamada:
    # un tope por persona y una parte del cupo global que queda para importar recetas e Ideas.
    user_usage, _ = UserUsage.objects.get_or_create(user=user)
    if not user_usage.can_classify(settings.PIZCA_MAX_AISLE_CALLS_PER_USER_PER_DAY):
        logger.warning('%s llegó al tope diario de clasificaciones de góndola', user.username)
        return {}
    usage = GlobalUsage.get_today()
    if not usage.can_request(settings.PIZCA_MAX_GEMINI_REQUESTS_PER_DAY - settings.PIZCA_GEMINI_REQUESTS_RESERVED):
        logger.warning('Sin cupo diario de Gemini: %s ingredientes quedan en "%s"', len(names), OTHER_AISLE)
        return {}
    names = names[:MAX_NAMES_PER_CALL]
    # Se cuenta aunque falle: un pedido que hace fallar a Gemini no puede salir gratis.
    user_usage.record_classification()
    try:
        answer = classify_ingredients(names, AISLES)
    except Exception:
        logger.exception('Gemini no pudo clasificar los ingredientes')
        return {}
    usage.record_request()
    # Solo lo que se preguntó: el caché es de todos, y un nombre con instrucciones adentro
    # podría hacer que la IA devuelva góndolas para ingredientes que nadie pidió.
    asked = {normalize_name(n) for n in names}
    result = {}
    for name, aisle in answer.items():
        key = normalize_name(name) if isinstance(name, str) else ''
        if key in asked and aisle in AISLES:
            result[key] = aisle
    remember_aisles(result.items())
    return result


def resolve_aisles(user, names, use_ai: bool = True) -> dict[str, str]:
    """Devuelve {nombre original: góndola} para cada nombre."""
    keys = {name: normalize_name(name) for name in names}
    wanted = set(keys.values())
    found = dict(IngredientAisle.objects.filter(name__in=wanted).values_list('name', 'aisle'))
    # Lo que eligió el usuario le gana al caché.
    found.update(UserIngredientAisle.objects.filter(user=user, name__in=wanted).values_list('name', 'aisle'))

    missing = sorted(wanted - found.keys())
    if missing and use_ai:
        # A la IA va el nombre como lo escribió la persona (con tildes, que ayudan a entenderlo).
        originals = {}
        for name, key in keys.items():
            if key in missing:
                originals.setdefault(key, name.strip())
        found.update(_ask_ai(user, list(originals.values())))

    return {name: found.get(key, OTHER_AISLE) for name, key in keys.items()}


def format_quantity(quantity: Decimal | None, unit: str) -> str:
    """Decimal('200.00'), 'g' → '200 g'; Decimal('0.50') → '0.5'."""
    if quantity is None:
        return unit
    text = f'{quantity.normalize():f}'
    return f'{text} {unit}'.strip()


def consolidate(ingredients) -> list[dict]:
    """
    Suma las cantidades de un mismo ingrediente cuando vienen en la misma unidad.
    Si las unidades no coinciden se queda con la primera (no se puede sumar "1 taza" con "200 g").
    """
    consolidated: dict[str, dict] = {}
    for ingredient in ingredients:
        key = normalize_name(ingredient.name)
        qty, unit = split_quantity_unit(ingredient.quantity, (ingredient.unit or '').strip())
        current = consolidated.get(key)
        if current is None:
            consolidated[key] = {'name': ingredient.name.strip(), 'quantity': qty, 'unit': unit}
        elif qty is not None and current['unit'].lower() == unit.lower():
            current['quantity'] = (current['quantity'] or 0) + qty
    return list(consolidated.values())
