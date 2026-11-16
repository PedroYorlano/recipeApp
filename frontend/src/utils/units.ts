/**
 * Unidades de cocina: cantidades en fracciones ("1/4 taza") y pasaje de tazas/cucharadas a gramos.
 *
 * La conversión usa una tabla fija de densidades (gramos por taza de 240 ml). Lo que no está en
 * la tabla, o no viene en una medida de volumen, se muestra tal cual.
 */

const CUP_ML = 240;

/** Saca tildes, mayúsculas, puntos y espacios de más: "Cdas. " → "cdas". */
const normalize = (text: string) =>
  text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\./g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .join(' ');

const VOLUME_ML: Record<string, number> = {};
const addUnits = (ml: number, names: string[]) => names.forEach(n => (VOLUME_ML[n] = ml));
addUnits(240, ['taza', 'tazas', 'tz', 'tza', 'cup', 'cups']);
addUnits(15, [
  'cucharada', 'cucharadas', 'cucharada sopera', 'cucharadas soperas', 'cda', 'cdas', 'cs', 'c/s',
  'tbsp', 'tbs', 'tablespoon', 'tablespoons',
]);
addUnits(5, [
  'cucharadita', 'cucharaditas', 'cucharadita de te', 'cucharaditas de te', 'cdita', 'cditas', 'cdta',
  'cdtas', 'c/c', 'tsp', 'teaspoon', 'teaspoons',
]);

/** Unidades del sistema métrico: se muestran en decimal ("1,5 kg"), nunca en fracción. */
const METRIC = new Set([
  'g', 'gr', 'grs', 'gramo', 'gramos', 'mg', 'kg', 'kgs', 'kilo', 'kilos', 'ml', 'cc', 'cl', 'l', 'lt', 'lts',
  'litro', 'litros',
]);

/** Gramos por taza de 240 ml. Claves ya normalizadas (sin tildes, minúsculas). */
const GRAMS_PER_CUP: Record<string, number> = {
  // Harinas y almidones
  'harina': 125, 'harina 0000': 125, 'harina 000': 125, 'harina comun': 125, 'harina de trigo': 125,
  'harina leudante': 125, 'harina integral': 120, 'harina de maiz': 140, 'harina de almendras': 96,
  'harina de arroz': 160, 'harina de avena': 90, 'harina de garbanzo': 92, 'maicena': 128,
  'almidon de maiz': 128, 'fecula de maiz': 128, 'fecula de mandioca': 120, 'almidon de mandioca': 120,
  'polenta': 160, 'semola': 167, 'pan rallado': 110,
  // Azúcares y dulces
  'azucar': 200, 'azucar comun': 200, 'azucar blanca': 200, 'azucar rubia': 213, 'azucar negra': 213,
  'azucar mascabo': 213, 'azucar morena': 213, 'azucar impalpable': 120, 'azucar glas': 120,
  'azucar glass': 120, 'miel': 340, 'dulce de leche': 300, 'leche condensada': 306,
  'cacao': 85, 'cacao amargo': 85, 'cacao en polvo': 85, 'chips de chocolate': 170, 'chocolate en chips': 170,
  // Grasas
  'manteca': 227, 'mantequilla': 227, 'margarina': 227, 'aceite': 216, 'aceite de oliva': 216,
  'aceite de girasol': 216, 'aceite de coco': 218, 'mayonesa': 220,
  // Lácteos y líquidos
  'leche': 242, 'crema': 238, 'crema de leche': 238, 'yogur': 245, 'yogurt': 245, 'queso crema': 232,
  'ricota': 246, 'queso rallado': 100, 'agua': 240, 'caldo': 240, 'vino': 240, 'jugo de limon': 240,
  'jugo de naranja': 240, 'pure de tomate': 245, 'salsa de tomate': 245, 'esencia de vainilla': 200,
  'extracto de vainilla': 200,
  // Granos, semillas y frutos secos
  'arroz': 185, 'avena': 90, 'quinoa': 170, 'lentejas': 192, 'garbanzos': 200, 'coco rallado': 85,
  'nueces': 120, 'almendras': 143, 'mani': 145, 'pasas de uva': 150, 'pasas': 150, 'semillas de chia': 170,
  'chia': 170, 'semillas de sesamo': 144, 'sesamo': 144, 'semillas de lino': 168, 'lino': 168,
  // Polvos y especias
  'sal': 288, 'sal fina': 288, 'sal gruesa': 240, 'polvo de hornear': 192, 'polvo para hornear': 192,
  'bicarbonato': 288, 'bicarbonato de sodio': 288, 'levadura seca': 150, 'levadura instantanea': 150,
  'canela': 125, 'canela en polvo': 125,
};
const DENSITY_KEYS = Object.keys(GRAMS_PER_CUP).sort((a, b) => b.length - a.length);

/** "Harina 0000 tamizada" → 125. Busca la entrada más larga con la que empieza el nombre. */
const gramsPerCup = (name: string): number | null => {
  const key = normalize(name).replace(/^de /, '');
  if (GRAMS_PER_CUP[key]) return GRAMS_PER_CUP[key];
  const match = DENSITY_KEYS.find(k => key.startsWith(`${k} `) || key.startsWith(`${k},`));
  return match ? GRAMS_PER_CUP[match] : null;
};

/** Gramos redondeados como se cocina: 3 g, 25 g, 125 g, 340 g. */
const roundGrams = (g: number) => (g > 100 ? Math.round(g / 5) * 5 : Math.max(1, Math.round(g)));

/**
 * Pasa una medida de volumen a gramos. Devuelve null si la unidad no es taza/cucharada/cucharadita
 * o si el ingrediente no está en la tabla.
 * Ej: toGrams(1, 'taza', 'Harina 0000') → 125
 */
export const toGrams = (quantity: number | null, unit: string, name: string): number | null => {
  if (quantity === null || quantity === undefined || quantity <= 0) return null;
  const ml = VOLUME_ML[normalize(unit || '')];
  if (!ml) return null;
  const density = gramsPerCup(name);
  if (!density) return null;
  return roundGrams((quantity * ml * density) / CUP_ML);
};

const FRACTIONS: [number, string][] = [
  [0, ''], [1 / 8, '1/8'], [1 / 4, '1/4'], [1 / 3, '1/3'], [1 / 2, '1/2'], [2 / 3, '2/3'], [3 / 4, '3/4'], [1, ''],
];
const TOLERANCE = 0.04;

const formatDecimal = (value: number) => String(Math.round(value * 100) / 100).replace('.', ',');

/** 0.25 → "1/4", 1.5 → "1 1/2", 2 → "2". Si no se parece a ninguna fracción común, decimal ("0,15"). */
export const toFraction = (value: number): string => {
  const whole = Math.floor(value);
  const rest = value - whole;
  let best = FRACTIONS[0];
  for (const candidate of FRACTIONS) {
    if (Math.abs(rest - candidate[0]) < Math.abs(rest - best[0])) best = candidate;
  }
  if (Math.abs(rest - best[0]) >= TOLERANCE) return formatDecimal(value);
  const units = whole + (best[0] === 1 ? 1 : 0);
  if (!best[1]) return units ? String(units) : formatDecimal(value);
  return units ? `${units} ${best[1]}` : best[1];
};

/**
 * Cantidad + unidad para mostrar. Las medidas caseras (taza, cucharada, unidad…) van en fracción;
 * las métricas en decimal.
 * Ej: formatAmount(0.25, 'taza') → "1/4 taza"; formatAmount(1.5, 'kg') → "1,5 kg"
 */
export const formatAmount = (value: number | null, unit: string): string => {
  if (value === null || value === undefined) return unit || '';
  const text = METRIC.has(normalize(unit || '')) ? formatDecimal(value) : toFraction(value);
  return `${text} ${unit || ''}`.trim();
};

/** "1/2", "1 1/2", "1,5" → número. null si no se entiende. */
export const parseAmount = (text: string): number | null => {
  const t = text.trim();
  const mixed = t.match(/^(\d+)\s+(\d+)\s*\/\s*(\d+)$/);
  if (mixed) {
    const den = Number(mixed[3]);
    return den ? Number(mixed[1]) + Number(mixed[2]) / den : null;
  }
  const frac = t.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (frac) {
    const den = Number(frac[2]);
    return den ? Number(frac[1]) / den : null;
  }
  const n = parseFloat(t.replace(',', '.'));
  return isNaN(n) ? null : n;
};
