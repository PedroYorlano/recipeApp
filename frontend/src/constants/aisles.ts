/**
 * Góndolas de la lista de compras, en el orden en que se recorre el súper.
 * Es la misma lista que AISLES en backend/recetas/models.py: si cambia una, cambia la otra.
 */
export const AISLES = [
    'Verduras y frutas',
    'Carnes y pescados',
    'Lácteos y huevos',
    'Panadería',
    'Almacén',
    'Especias y condimentos',
    'Bebidas',
    'Congelados',
    'Otros',
] as const;

export type Aisle = (typeof AISLES)[number];

export const OTHER_AISLE: Aisle = 'Otros';
