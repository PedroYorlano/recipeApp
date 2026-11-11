import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE } from '../constants';
import { Category, Recipe, MealPlan, ShoppingListItem, IdeasResponse } from '../types';

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
        // ROTATE_REFRESH_TOKENS está activo: si no guardamos el nuevo, la sesión muere a los 7 días del login.
        if (data.refresh) await AsyncStorage.setItem('refreshToken', data.refresh);
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

export const registerService = async (username: string, email: string, password: string) => {
    const response = await fetch(`${API_BASE}/register/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password }),
    });
    if (!response.ok) {
        const errorData = await response.json();
        const errorMsg = Object.values(errorData).flat().join(', ');
        throw new Error(errorMsg || 'Error al iniciar registro');
    }
    return await response.json();
};

export const verifyRegisterOTPService = async (email: string, otpCode: string) => {
    const response = await fetch(`${API_BASE}/register/verify/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp_code: otpCode }),
    });
    if (!response.ok) {
        const errorData = await response.json();
        const errorMsg = Object.values(errorData).flat().join(', ');
        throw new Error(errorMsg || 'Error al verificar código');
    }
    const data = await response.json();
    
    // Almacenar tokens tras verificar exitosamente
    await AsyncStorage.setItem('authToken', data.access);
    await AsyncStorage.setItem('refreshToken', data.refresh);
    
    return data;
};

export const resendRegisterOTPService = async (email: string) => {
    const response = await fetch(`${API_BASE}/register/resend/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
    });
    if (!response.ok) {
        const errorData = await response.json();
        const errorMsg = Object.values(errorData).flat().join(', ');
        throw new Error(errorMsg || 'Error al reenviar código');
    }
    return await response.json();
};

export const requestPasswordResetService = async (email: string) => {
    const response = await fetch(`${API_BASE}/password-reset/request/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
    });
    if (!response.ok) {
        const errorData = await response.json();
        const errorMsg = Object.values(errorData).flat().join(', ');
        throw new Error(errorMsg || 'Error al solicitar OTP de recuperación');
    }
    return await response.json();
};

export const verifyPasswordResetOTPService = async (email: string, otpCode: string, newPassword: string) => {
    const response = await fetch(`${API_BASE}/password-reset/verify/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp_code: otpCode, new_password: newPassword }),
    });
    if (!response.ok) {
        const errorData = await response.json();
        const errorMsg = Object.values(errorData).flat().join(', ');
        throw new Error(errorMsg || 'Error al restablecer contraseña');
    }
    return await response.json();
};

export const logoutService = async () => {
    await AsyncStorage.removeItem('authToken');
    await AsyncStorage.removeItem('refreshToken');
};

export const getCurrentUserService = async () => {
    const response = await authenticatedFetch(`${API_BASE}/me/`);
    if (!response.ok) throw new Error('Error al cargar el usuario');
    return await response.json();
};

// Obtener Categorías
export const getCategoriesService = async () => {
    const response = await authenticatedFetch(`${API_BASE}/categorias/`);
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

export const importRecipeServiceAudio = async (fileUri: string, fileName: string, fileType: string, webFile?: File) => {
    const formData = new FormData();
    if (webFile) {
        // En web FormData necesita un File/Blob real; el objeto {uri, name, type} es solo de React Native.
        formData.append('file', webFile, fileName);
    } else {
        formData.append('file', {
            uri: fileUri,
            name: fileName,
            type: fileType,
        } as any);
    }

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

/** Receta pública por uuid. Con sesión también devuelve las propias aunque no sean públicas. */
export const getSharedRecipeService = async (uuid: string): Promise<Recipe> => {
    const url = `${API_BASE}/compartidas/${uuid}/`;
    const hasToken = !!(await AsyncStorage.getItem('authToken'));
    let response: Response;
    try {
        response = hasToken ? await authenticatedFetch(url) : await fetch(url);
    } catch {
        // Sesión vencida: probamos como anónimo.
        response = await fetch(url);
    }
    if (!response.ok) throw new Error('Receta no encontrada');
    return await response.json();
};

/** Marca una receta como pública (necesario para que el link compartido funcione). */
export const setRecipePublicService = async (id: number, isPublic: boolean) => {
    const response = await authenticatedFetch(`${API_BASE}/recetas/${id}/`, {
        method: 'PATCH',
        headers: buildHeaders(),
        body: JSON.stringify({ is_public: isPublic }),
    });
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(JSON.stringify(errorData));
    }
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

// --- PLANNER SERVICES ---

export const getWeekPlans = async (weekStart: string): Promise<MealPlan[]> => {
    const response = await authenticatedFetch(
        `${API_BASE}/planner/week/?week_start=${weekStart}`,
        { headers: buildHeaders() }
    );
    if (!response.ok) throw new Error('Error al cargar el plan semanal');
    return await response.json();
};

export const createMealPlan = async (data: {
    date: string;
    meal_type: string;
    recipe: string;
}): Promise<MealPlan> => {
    const response = await authenticatedFetch(`${API_BASE}/planner/`, {
        method: 'POST',
        headers: buildHeaders(),
        body: JSON.stringify(data),
    });
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(JSON.stringify(errorData));
    }
    return await response.json();
};

export const deleteMealPlan = async (id: number): Promise<void> => {
    const response = await authenticatedFetch(`${API_BASE}/planner/${id}/`, {
        method: 'DELETE',
        headers: buildHeaders(),
    });
    if (!response.ok) throw new Error('Error al eliminar del plan');
};

// --- SHOPPING LIST SERVICES ---

export const generateShoppingList = async (weekStart: string): Promise<ShoppingListItem[]> => {
    const response = await authenticatedFetch(`${API_BASE}/planner/generate_shopping_list/`, {
        method: 'POST',
        headers: buildHeaders(),
        body: JSON.stringify({ week_start: weekStart }),
    });
    if (!response.ok) throw new Error('Error al generar la lista de compras');
    return await response.json();
};

export const getShoppingList = async (weekStart: string): Promise<ShoppingListItem[]> => {
    const response = await authenticatedFetch(
        `${API_BASE}/shopping/?week_start=${weekStart}`,
        { headers: buildHeaders() }
    );
    if (!response.ok) throw new Error('Error al cargar la lista de compras');
    return await response.json();
};

export const toggleShoppingItem = async (
    id: number,
    isChecked: boolean
): Promise<ShoppingListItem> => {
    const response = await authenticatedFetch(`${API_BASE}/shopping/${id}/`, {
        method: 'PATCH',
        headers: buildHeaders(),
        body: JSON.stringify({ is_checked: isChecked }),
    });
    if (!response.ok) throw new Error('Error al actualizar ítem');
    return await response.json();
};

export const createShoppingItem = async (data: {
    week_start: string;
    ingredient_name: string;
    quantity?: string;
    category?: string;
}): Promise<ShoppingListItem> => {
    const response = await authenticatedFetch(`${API_BASE}/shopping/`, {
        method: 'POST',
        headers: buildHeaders(),
        body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('Error al agregar ítem');
    return await response.json();
};

export const updateShoppingItem = async (
    id: number,
    data: Partial<ShoppingListItem>
): Promise<ShoppingListItem> => {
    const response = await authenticatedFetch(`${API_BASE}/shopping/${id}/`, {
        method: 'PATCH',
        headers: buildHeaders(),
        body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('Error al editar ítem');
    return await response.json();
};

export const deleteShoppingItem = async (id: number): Promise<void> => {
    const response = await authenticatedFetch(`${API_BASE}/shopping/${id}/`, {
        method: 'DELETE',
        headers: buildHeaders(),
    });
    if (!response.ok) throw new Error('Error al eliminar ítem');
};

// --- IDEAS (chat IA) ---

export const sendIdeasMessage = async (message: string): Promise<IdeasResponse> => {
    const response = await authenticatedFetch(`${API_BASE}/ideas/`, {
        method: 'POST',
        headers: buildHeaders(),
        body: JSON.stringify({ message }),
    });
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Ideas no está disponible en este momento');
    }
    return await response.json();
};
