import { SERVER_URL } from "../constants";
import { Recipe } from "../types";

export const parseQuantity = (quantityStr: string) => {
  // Regex que busca números al principio (enteros o decimales)
  const match = quantityStr.match(/^(\d+(\.\d+)?|\d+\/\d+)\s*(.*)$/);
  
  if (!match) return { value: null, unit: quantityStr };

  let value = 0;
  const numPart = match[1];
  const unitPart = match[3];

  // Manejo de fracciones simples "1/2"
  if (numPart.includes('/')) {
    const [num, den] = numPart.split('/').map(Number);
    value = num / den;
  } else {
    value = parseFloat(numPart);
  }

  return { value, unit: unitPart };
};

// Función para formatear de nuevo (ej: 1000 -> "1k" si quisieras, o simple)
export const formatQuantity = (value: number, unit: string) => {
  // Redondeamos para no tener "333.33333g"
  const rounded = Math.round(value * 100) / 100; 
  return `${rounded} ${unit}`;
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