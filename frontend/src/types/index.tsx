export interface Ingredient {
  name: string;
  quantity: string;
}

export interface Step {
  order: number;
  instruction: string;
}

export interface Recipe {
  uuid: string;
  id?: number; // Es opcional (?) porque al importar de la IA aun no tiene ID
  title: string;
  description: string;
  ingredients: Ingredient[];
  servings: number;
  steps: Step[];
  categories: number[];
  categories_details: { id: number; name: string }[];
  original_url?: string;
  image?: string; // URL final (backend)
  image_url?: string; // URL temporal (tiktok)
  localImage?: string; // URI local (seleccionada por usuario)
  image_base64?: string; // Imagen en base64 para el upload
  remove_image?: boolean; // Bandera para marcar imagen para eliminación
}

export interface Category {
  id: number;
  name: string;
}