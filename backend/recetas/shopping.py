"""Lista de compras: junta los ingredientes del plan semanal y los agrupa por góndola."""
import re
from decimal import Decimal

from .serializers import split_quantity_unit

INGREDIENT_CATEGORIES = {
    'Verduras y frescos': [
        'lechuga', 'tomate', 'cebolla', 'zanahoria', 'palta', 'pimiento',
        'zapallo', 'berenjena', 'espinaca', 'brócoli', 'ajo', 'papa',
        'batata', 'limón', 'naranja', 'manzana', 'verdeo', 'apio',
    ],
    'Carnes y proteínas': [
        'pollo', 'carne', 'cerdo', 'pescado', 'atún', 'huevo', 'tofu',
        'nalga', 'milanesa', 'chorizo', 'salchicha', 'jamón', 'lomo',
    ],
    'Lácteos': [
        'leche', 'queso', 'crema', 'manteca', 'yogur', 'ricota',
        'mozzarella', 'cheddar', 'mantequilla',
    ],
    'Despensa': [
        'arroz', 'fideos', 'harina', 'azúcar', 'sal', 'aceite',
        'vinagre', 'soja', 'mirin', 'salsa', 'caldo', 'lenteja',
        'garbanzo', 'frijol', 'pasta', 'avena', 'mostaza',
        'mayonesa', 'ketchup', 'barbacoa', 'vino', 'cerveza',
    ],
    'Panadería': ['pan', 'tostada', 'galletita', 'bizcocho', 'factura'],
    'Especias y condimentos': [
        'pimienta', 'comino', 'orégano', 'pimentón', 'curry', 'jengibre',
        'cúrcuma', 'canela', 'ají molido',
    ],
}

# Al principio de una palabra: "huevos" es huevo, pero "mostaza" no es sal ni "espinaca" pan.
_CATEGORY_PATTERNS = [
    (category, re.compile(r'\b(?:' + '|'.join(map(re.escape, keywords)) + r')', re.IGNORECASE))
    for category, keywords in INGREDIENT_CATEGORIES.items()
]


def categorize_ingredient(name: str) -> str:
    for category, pattern in _CATEGORY_PATTERNS:
        if pattern.search(name):
            return category
    return 'Otros'


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
        key = ingredient.name.lower().strip()
        qty, unit = split_quantity_unit(ingredient.quantity, (ingredient.unit or '').strip())
        current = consolidated.get(key)
        if current is None:
            consolidated[key] = {
                'name': ingredient.name.strip(),
                'quantity': qty,
                'unit': unit,
                'category': categorize_ingredient(ingredient.name),
            }
        elif qty is not None and current['unit'].lower() == unit.lower():
            current['quantity'] = (current['quantity'] or 0) + qty
    return list(consolidated.values())
