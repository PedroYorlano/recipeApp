import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE } from '../constants';
import { Category, Recipe } from '../types';

// Helper: obtener cabeceras con token
const getHeaders = async (isMultiPart: boolean = false) => {
    const token = await AsyncStorage.getItem('authToken');
    const headers: any = {
        'Authorization': token ? `Bearer ${token}` : '',
    };
    if (!isMultiPart) {
        headers['Content-Type'] = 'application/json';
    }
    return headers;
};

// --- AUTH SERVICES ---
export const loginService = async (username: string, password: string) => {
    const response = await fetch(`${API_BASE}/token/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
    });
    if (!response.ok) throw new Error('Credenciales inválidas');
    const data = await response.json();

    await AsyncStorage.setItem('authToken', data.access);
    await AsyncStorage.setItem('refreshToken', data.refresh);

    return data;
};

export const logoutService = async () => {
    await AsyncStorage.removeItem('authToken');
    await AsyncStorage.removeItem('refreshToken');
};

// Obtener Categorías
export const getCategoriesService = async () => {
    const response = await fetch(`${API_BASE}/categorias/`);
    if (!response.ok) throw new Error('Error al cargar categorías');
    return await response.json();
};

// Obtener Recetas (Con filtros de búsqueda y categoría)
export const getRecipesService = async (categoryId?: number | null, search?: string) => {
    // Construimos la URL con parámetros limpios
    const params = new URLSearchParams();
    if (categoryId) params.append('categories', categoryId.toString());
    if (search) params.append('search', search);

    const headers = await getHeaders();
    const response = await fetch(`${API_BASE}/recetas/?${params.toString()}`, { headers });

    if (response.status === 401) {
        throw new Error('No autorizado');
    }

    if (!response.ok) {
        console.error('Error fetching recipes:', response.status, response.statusText);
        throw new Error('Error al cargar recetas');
    }

    return await response.json();
};

// Guardar Receta (Decide si es Crear o Editar automáticamente)
export const saveRecipeService = async (recipe: Recipe) => {
    // Si tiene ID, es EDITAR (PUT). Si no, es CREAR (POST).
    const isEditing = !!recipe.id;
    const url = isEditing ? `${API_BASE}/recetas/${recipe.id}/` : `${API_BASE}/recetas/`;
    const method = isEditing ? 'PUT' : 'POST';

    const headers = await getHeaders();
    const response = await fetch(url, {
        method,
        headers,
        body: JSON.stringify(recipe),
    });

    if (!response.ok) {
        // Intentamos leer el error del backend para saber qué pasó
        const errorData = await response.json();
        throw new Error(JSON.stringify(errorData));
    }

    return await response.json();
};

// Borrar Receta
export const deleteRecipeService = async (id: number) => {
    const headers = await getHeaders();
    const response = await fetch(`${API_BASE}/recetas/${id}/`, {
        method: 'DELETE',
        headers,
    });

    if (!response.ok) throw new Error('Error al eliminar la receta');
    return true; // Retornamos true si salió bien
};

// Importar desde IA
export const importRecipeService = async (url: string) => {
    const headers = await getHeaders();
    const response = await fetch(`${API_BASE}/importar/`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ url }),
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(JSON.stringify(errorData));
    }
    return await response.json();
};

export const getSharedRecipeService = async (uuid: string) => {
    const response = await fetch(`${API_BASE}/compartidas/${uuid}/`);
    if (!response.ok) throw new Error('Receta no encontrada');
    return await response.json();
};

// crear categoria
export const createCategoryService = async (name: string) => {
    const headers = await getHeaders();
    const response = await fetch(`${API_BASE}/categorias/`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ name }),
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(JSON.stringify(errorData));
    }
    return await response.json();
};
