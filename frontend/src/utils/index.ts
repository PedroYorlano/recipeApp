import { SERVER_URL } from "../constants";
import { Recipe } from "../types";

/**
 * Formatea una cantidad numérica + unidad para mostrar.
 * Ej: formatQuantity(200, "g") → "200 g"
 *     formatQuantity(0.5, "taza") → "0.5 taza"
 *     formatQuantity(null, "") → ""
 */
export const formatQuantity = (value: number | null, unit: string): string => {
  if (value === null || value === undefined) return unit || '';
  // Redondeamos para no tener "333.33333g"
  const rounded = Math.round(value * 100) / 100;
  return `${rounded} ${unit}`.trim();
};

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
    // CASO 1: Imagen guardada en Django (Backend)
    if (item.image) {
        // Si ya viene con http (ej: Cloudinary en el futuro), la usamos directa
        if (item.image.startsWith('http')) return { uri: item.image };
        
        // Si es una ruta relativa (/media/...), le pegamos la IP del servidor
        return { uri: `${SERVER_URL}${item.image}` };
    }
    
    // CASO 2: Borrador local (foto subida del celular)
    if (item.localImage) return { uri: item.localImage };
    
    // CASO 3: Fallback
    return null;
  };