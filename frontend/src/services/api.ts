import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE } from '../constants';
import { Category, Recipe } from '../types';

// --- Token Refresh con mutex ---
// Evita múltiples refresh simultáneos cuando varias requests reciben 401 al mismo tiempo
let isRefreshing = false;
let refreshPromise: Promise<string | null> | null = null;

/**
 * Intenta refrescar el access token usando el refresh token almacenado.
 * Retorna el nuevo access token o null si falla (sesión expirada).
 */
const refreshAccessToken = async (): Promise<string | null> => {
    const refreshToken = await AsyncStorage.getItem('refreshToken');
    if (!refreshToken) return null;

    try {
        const response = await fetch(`${API_BASE}/token/refresh/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refresh: refreshToken }),
        });

        if (!response.ok) {
            // Refresh token también expiró → limpiar todo
            await AsyncStorage.removeItem('authToken');
            await AsyncStorage.removeItem('refreshToken');
            return null;
        }

        const data = await response.json();
        await AsyncStorage.setItem('authToken', data.access);
        return data.access;
    } catch {
        return null;
    }
};

/**
 * Wrapper de fetch que maneja token refresh automáticamente.
 * Si recibe 401, refresca el token y reintenta la request original UNA vez.
 */
const authenticatedFetch = async (url: string, options: RequestInit = {}): Promise<Response> => {
    // Primera request con el token actual
    const token = await AsyncStorage.getItem('authToken');
    const headers = new Headers(options.headers || {});
    if (token) {
        headers.set('Authorization', `Bearer ${token}`);
    }

    let response = await fetch(url, { ...options, headers });

    // Si no es 401, devolver directamente
    if (response.status !== 401) {
        return response;
    }

    // 401 → Intentar refresh (con mutex para evitar múltiples refresh simultáneos)
    if (!isRefreshing) {
        isRefreshing = true;
        refreshPromise = refreshAccessToken().finally(() => {
            isRefreshing = false;
            refreshPromise = null;
        });
    }

    const newToken = await (refreshPromise || refreshAccessToken());

    if (!newToken) {
        // Refresh falló → sesión expirada, propagar el 401
        throw new Error('Sesión expirada');
    }

    // Reintentar con el nuevo token
    headers.set('Authorization', `Bearer ${newToken}`);
    return fetch(url, { ...options, headers });
};

// Helper: construir headers (para requests que no usan authenticatedFetch)
const buildHeaders = (isMultiPart: boolean = false): Record<string, string> => {
    const headers: Record<string, string> = {};
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

// Tipo de respuesta paginada del backend (DRF CursorPagination)
export interface PaginatedResponse<T> {
    next: string | null;
    previous: string | null;
    results: T[];
}

// Obtener Recetas con paginación por cursor (con filtros de búsqueda, categoría y favoritos)
export const getRecipesService = async (
    categoryId?: number | null,
    search?: string,
    favorites?: boolean,
    cursorUrl?: string | null,
): Promise<PaginatedResponse<Recipe>> => {
    // Si tenemos cursorUrl, usarla directamente (ya incluye filtros + cursor)
    if (cursorUrl) {
        const response = await authenticatedFetch(cursorUrl, {
            headers: buildHeaders(),
        });
        if (!response.ok) throw new Error('Error al cargar recetas');
        return await response.json();
    }

    // Primera carga: construir URL con filtros
    const params = new URLSearchParams();
    if (categoryId) params.append('categories', categoryId.toString());
    if (search) params.append('search', search);
    if (favorites) params.append('favorites', 'true');

    const response = await authenticatedFetch(`${API_BASE}/recetas/?${params.toString()}`, {
        headers: buildHeaders(),
    });

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

    const response = await authenticatedFetch(url, {
        method,
        headers: buildHeaders(),
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
    const response = await authenticatedFetch(`${API_BASE}/recetas/${id}/`, {
        method: 'DELETE',
        headers: buildHeaders(),
    });

    if (!response.ok) throw new Error('Error al eliminar la receta');
    return true; // Retornamos true si salió bien
};

// Importar desde IA
export const importRecipeService = async (url: string) => {
    const response = await authenticatedFetch(`${API_BASE}/importar/`, {
        method: 'POST',
        headers: buildHeaders(),
        body: JSON.stringify({ url }),
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(JSON.stringify(errorData));
    }
    return await response.json();
};

export const importRecipeServiceAudio = async (fileUri: string, fileName: string, fileType: string) => {
    const formData = new FormData();
    formData.append('file', {
        uri: fileUri,
        name: fileName,
        type: fileType,
    } as any);

    const response = await authenticatedFetch(`${API_BASE}/importar-archivo/`, {
        method: 'POST',
        headers: buildHeaders(true),
        body: formData,
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(JSON.stringify(errorData));
    }
    return await response.json();
};

export const importRecipeServiceText = async (text: string) => {
    const response = await authenticatedFetch(`${API_BASE}/importar-texto/`, {
        method: 'POST',
        headers: buildHeaders(),
        body: JSON.stringify({ text }),
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(JSON.stringify(errorData));
    }
    return await response.json();
};

export const importRecipeServiceWeb = async (url: string) => {
    const response = await authenticatedFetch(`${API_BASE}/importar-web/`, {
        method: 'POST',
        headers: buildHeaders(),
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
    const response = await authenticatedFetch(`${API_BASE}/categorias/`, {
        method: 'POST',
        headers: buildHeaders(),
        body: JSON.stringify({ name }),
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(JSON.stringify(errorData));
    }
    return await response.json();
};

// Toggle Favorito (like/unlike)
export const toggleFavoriteService = async (recipeId: number) => {
    const response = await authenticatedFetch(`${API_BASE}/recetas/${recipeId}/favorite/`, {
        method: 'POST',
        headers: buildHeaders(),
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(JSON.stringify(errorData));
    }
    return await response.json();
};
