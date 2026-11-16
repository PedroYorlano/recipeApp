import { SERVER_URL } from "../constants";
import { Recipe } from "../types";
import { formatAmount } from "./units";

/**
 * Formatea una cantidad numérica + unidad para mostrar (fracciones para medidas caseras).
 * Ej: formatQuantity(200, "g") → "200 g"
 *     formatQuantity(0.5, "taza") → "1/2 taza"
 *     formatQuantity(null, "") → ""
 */
export const formatQuantity = formatAmount;

/**
 * Escala una cantidad proporcionalmente según porciones.
 * Ej: scaleQuantity(200, 4, 8) → 400 (doble de porciones)
 */
export const scaleQuantity = (
  value: number | null,
  originalServings: number,
  currentServings: number
): number | null => {
  if (value === null || value === undefined) return null;
  if (originalServings === 0) return value;
  return (value / originalServings) * currentServings;
};

export const getRecipeImage = (item: Recipe) => {
    // CASO 1: Imagen guardada en el backend
    if (item.image) {
        // Con R2 Cloudflare, la URL ya viene completa (https://pub-xxx.r2.dev/...)
        if (item.image.startsWith('http')) return { uri: item.image };
        
        // Fallback: ruta relativa en dev local (/media/...)
        return { uri: `${SERVER_URL}${item.image}` };
    }
    
    // CASO 2: Borrador local (foto subida del celular, aún no guardada)
    if (item.localImage) return { uri: item.localImage };
    
    // CASO 3: Fallback
    return null;
  };