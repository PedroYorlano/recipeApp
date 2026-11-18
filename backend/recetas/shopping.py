"""
Lista de compras: junta los ingredientes del plan semanal y los ubica en su góndola.

La góndola de cada ingrediente sale, en este orden, de:
1. Lo que eligió el usuario al mover un ítem (UserIngredientAisle).
   También se llena con las góndolas que trae una receta importada con IA, sin pisar lo que eligió.
2. El caché global (IngredientAisle), que se llena con lo que Gemini clasifica acá. Cada
   ingrediente se le pregunta a la IA una sola vez para todos.
3. Una llamada en lote a Gemini con lo que falta. Si falla o no hay cupo: "Otros".
"""
import logging
import unicodedata
from decimal import Decimal
from fractions import Fraction

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


def learn_from_recipe(user, recipe: dict) -> None:
    """
    Las importaciones con IA traen la góndola de cada ingrediente (`aisle`): va al caché de ese
    usuario y se saca de la receta, que el frontend no la necesita. Nunca rompe la importación.

    No va al caché global: la receta sale de una página o un video ajeno, y un texto armado a
    propósito podría hacer que la IA ubique mal un ingrediente para todos los usuarios.
    """
    ingredients = [i for i in recipe.get('ingredients') or [] if isinstance(i, dict)]
    rows = {}
    for ingredient in ingredients:
        key = normalize_name(str(ingredient.get('name') or ''))
        aisle = ingredient.pop('aisle', None)
        if key and aisle in AISLES:
            rows.setdefault(key, aisle)
    if not rows:
        return
    try:
        # ignore_conflicts: lo que el usuario ya eligió a mano no se pisa.
        UserIngredientAisle.objects.bulk_create(
            [UserIngredientAisle(user=user, name=k, aisle=a) for k, a in rows.items()], ignore_conflicts=True,
        )
    except Exception:
        logger.exception('No se pudieron guardar las góndolas de una receta importada')


def remember_user_choice(user, name: str, aisle: str) -> None:
    key = normalize_name(name)
    if key:
        UserIngredientAisle.objects.update_or_create(user=user, name=key, defaults={'aisle': aisle})


def _ask_ai(user, names: list[str]) -> dict[str, str]:
    """Clasifica con Gemini (una llamada). Devuelve {clave normalizada: góndola} y lo guarda en el caché."""
    # Dos frenos, porque los nombres los escribe el usuario y cada uno nuevo es una llamada:
    # un tope por persona y una parte del cupo global que queda para importar recetas e Ideas.
    usage = GlobalUsage.get_today()
    if not usage.can_request(settings.PIZCA_MAX_GEMINI_REQUESTS_PER_DAY - settings.PIZCA_GEMINI_REQUESTS_RESERVED):
        logger.warning('Sin cupo diario de Gemini: %s ingredientes quedan en "%s"', len(names), OTHER_AISLE)
        return {}
    # Se cuenta antes y aunque falle: un pedido que hace fallar a Gemini no puede salir gratis.
    # (El cupo global lo descuenta generate_json por cada llamada.)
    user_usage, _ = UserUsage.objects.get_or_create(user=user)
    if not user_usage.try_reserve_classification(settings.PIZCA_MAX_AISLE_CALLS_PER_USER_PER_DAY):
        logger.warning('%s llegó al tope diario de clasificaciones de góndola', user.username)
        return {}
    names = names[:MAX_NAMES_PER_CALL]
    try:
        answer = classify_ingredients(names, AISLES)
    except Exception:
        logger.exception('Gemini no pudo clasificar los ingredientes')
        return {}
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


# Igual que frontend/src/utils/units.ts: las medidas métricas van en decimal, el resto en fracción.
METRIC_UNITS = {
    'g', 'gr', 'grs', 'gramo', 'gramos', 'mg', 'kg', 'kgs', 'kilo', 'kilos', 'ml', 'cc', 'cl', 'l', 'lt', 'lts',
    'litro', 'litros',
}
FRACTIONS = [
    (Fraction(0), ''), (Fraction(1, 8), '1/8'), (Fraction(1, 4), '1/4'), (Fraction(1, 3), '1/3'),
    (Fraction(1, 2), '1/2'), (Fraction(2, 3), '2/3'), (Fraction(3, 4), '3/4'), (Fraction(1), ''),
]
FRACTION_TOLERANCE = Fraction(1, 25)


def _decimal_text(quantity: Decimal) -> str:
    return f'{quantity.normalize():f}'.replace('.', ',')


def _fraction_text(quantity: Decimal) -> str:
    """Decimal('0.25') → '1/4'; Decimal('1.50') → '1 1/2'; Decimal('0.33') → '1/3'."""
    value = Fraction(quantity)
    whole = int(value)
    rest = value - whole
    target, label = min(FRACTIONS, key=lambda f: abs(rest - f[0]))
    if abs(rest - target) >= FRACTION_TOLERANCE:
        return _decimal_text(quantity)
    whole += 1 if target == 1 else 0
    if not label:
        return str(whole) if whole else _decimal_text(quantity)
    return f'{whole} {label}' if whole else label


def format_quantity(quantity: Decimal | None, unit: str) -> str:
    """Decimal('200.00'), 'g' → '200 g'; Decimal('0.50'), 'taza' → '1/2 taza'."""
    if quantity is None:
        return unit
    is_metric = normalize_name(unit or '').replace('.', '') in METRIC_UNITS
    text = _decimal_text(quantity) if is_metric else _fraction_text(quantity)
    return f'{text} {unit}'.strip()


# Unidad escrita → (unidad canónica, cuántas canónicas vale una). Sirve para sumar en la lista
# de compras "1 cdita" + "1 cucharadita", o "500 g" + "1 kg". Las claves van como las deja
# _unit_key (sin tildes, puntos ni mayúsculas). Lo que no está acá se suma solo con la misma unidad.
UNIT_ALIASES: dict[str, tuple[str, Decimal]] = {}


def _alias(canonical: str, factor: str | int, *names: str) -> None:
    for name in names:
        UNIT_ALIASES[name] = (canonical, Decimal(factor))


_alias('g', 1, 'g', 'gr', 'grs', 'gramo', 'gramos')
_alias('g', 1000, 'kg', 'kgs', 'kilo', 'kilos', 'kilogramo', 'kilogramos')
_alias('ml', 1, 'ml', 'cc', 'mililitro', 'mililitros')
_alias('ml', 10, 'cl')
_alias('ml', 1000, 'l', 'lt', 'lts', 'litro', 'litros')
_alias('taza', 1, 'taza', 'tazas', 'tz', 'tza', 'cup', 'cups')
_alias('cda', 1, 'cda', 'cdas', 'cucharada', 'cucharadas', 'cucharada sopera', 'cucharadas soperas', 'cs', 'c/s', 'tbsp')
_alias('cdita', 1, 'cdita', 'cditas', 'cdta', 'cdtas', 'cucharadita', 'cucharaditas', 'cucharadita de te',
       'cucharaditas de te', 'c/c', 'tsp')
_alias('unidad', 1, 'unidad', 'unidades', 'u', 'un')
_alias('diente', 1, 'diente', 'dientes')
_alias('pizca', 1, 'pizca', 'pizcas')
_alias('lata', 1, 'lata', 'latas')
_alias('paquete', 1, 'paquete', 'paquetes', 'paq')


def _unit_key(unit: str) -> str:
    return ' '.join(normalize_name(unit).replace('.', ' ').split())


def canonical_unit(unit: str) -> tuple[str, Decimal]:
    """'Cucharaditas' → ('cdita', 1); 'kg' → ('g', 1000); 'lata grande' → ('lata grande', 1)."""
    key = _unit_key(unit)
    return UNIT_ALIASES.get(key, (key, Decimal(1)))


def _display(quantity: Decimal, canonical: str) -> tuple[Decimal, str]:
    """1500 g → 1,5 kg y 2000 ml → 2 l, para que la lista no muestre números enormes."""
    if canonical in ('g', 'ml') and quantity >= 1000:
        return quantity / 1000, 'kg' if canonical == 'g' else 'l'
    return quantity, canonical


def consolidate(ingredients) -> list[dict]:
    """
    Suma las cantidades de un mismo ingrediente cuando las unidades son equivalentes
    ("cdita" y "cucharadita", "g" y "kg"). Si no lo son, se queda con la primera (no se puede
    sumar "1 taza" con "200 g"). Si todas venían en la misma unidad, se muestra tal cual.
    """
    consolidated: dict[str, dict] = {}
    for ingredient in ingredients:
        key = normalize_name(ingredient.name)
        qty, unit = split_quantity_unit(ingredient.quantity, (ingredient.unit or '').strip())
        canonical, factor = canonical_unit(unit)
        current = consolidated.get(key)
        if current is None:
            consolidated[key] = {
                'name': ingredient.name.strip(), 'unit': unit, 'canonical': canonical,
                'base': None if qty is None else qty * factor, 'mixed': False,
            }
        elif qty is not None and current['canonical'] == canonical:
            current['base'] = (current['base'] or 0) + qty * factor
            current['mixed'] |= _unit_key(current['unit']) != _unit_key(unit)
    items = []
    for item in consolidated.values():
        base, unit = item['base'], item['unit']
        if base is None:
            quantity = None
        elif item['mixed']:
            quantity, unit = _display(base, item['canonical'])
        else:
            quantity = base / canonical_unit(unit)[1]
        items.append({'name': item['name'], 'quantity': quantity, 'unit': unit})
    return items
