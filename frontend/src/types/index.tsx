export interface Ingredient {
  id?: number;
  name: string;
  quantity: number | null;
  unit: string;
  order?: number;
}

export interface Step {
  id?: number;
  order: number;
  instruction: string;
}

export interface Recipe {
  uuid: string;
  id?: number; // Es opcional (?) porque al importar de la IA aun no tiene ID
  title: string;
  description: string;
  ingredients: Ingredient[];
  servings: number | null;
  prep_time?: number | null;
  steps: Step[];
  categories: number[];
  categories_details: { id: number; name: string }[];
  original_url?: string;
  image?: string; // URL final (backend)
  image_url?: string; // URL temporal (tiktok)
  localImage?: string; // URI local (seleccionada por usuario)
  image_base64?: string; // Imagen en base64 para el upload
  remove_image?: boolean; // Bandera para marcar imagen para eliminación
  is_favorite?: boolean; // Si el usuario actual marcó como favorita
  favorite_count?: number; // Total de likes (para futuro módulo social)
  is_public?: boolean;
}

export interface Category {
  id: number;
  name: string;
}

export interface User {
  id: number;
  username: string;
  email: string;
}

export interface MealPlan {
  id: number;
  date: string; // ISO: 'YYYY-MM-DD'
  meal_type: 'breakfast' | 'lunch' | 'dinner';
  recipe: string; // uuid — write only
  recipe_detail: {
    uuid: string;
    title: string;
    image: string | null;
    prep_time: number | null;
    servings: number | null;
  } | null;
}

export interface ShoppingListItem {
  id: number;
  week_start: string;
  ingredient_name: string;
  quantity: string;
  category: string;
  is_checked: boolean;
}

export interface FogoncitoSuggestion {
  uuid: string;
  title: string;
}

export interface FogoncitoResponse {
  message: string;
  suggestions: FogoncitoSuggestion[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'bot';
  text: string;
  suggestions?: FogoncitoSuggestion[];
  isLoading?: boolean;
  isError?: boolean;
}