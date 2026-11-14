import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE } from '../constants';
import { Category, IdeasResponse, MealPlan, Recipe, ShoppingListItem, User } from '../types';

// --- Errores ---

/** La API respondió con error. `message` ya es legible para el usuario (puede venir vacío). */
export class ApiError extends Error {
    constructor(public status: number, public body: unknown, message: string) {
        super(message);
        this.name = 'ApiError';
    }
}

/** No hay forma de renovar el token: hay que volver a entrar. */
export class SessionExpiredError extends Error {
    constructor() {
        super('Tu sesión venció. Volvé a entrar.');
        this.name = 'SessionExpiredError';
    }
}

/**
 * Saca el primer mensaje legible de un error de DRF:
 * `{error: "..."}`, `{detail: "..."}` o errores por campo (`{title: ["..."]}`, también anidados).
 */
const messageFromBody = (body: unknown): string => {
    if (!body) return '';
    if (typeof body === 'string') return body.length < 200 ? body : '';
    if (Array.isArray(body)) return messageFromBody(body[0]);
    if (typeof body === 'object') {
        const obj = body as Record<string, unknown>;
        if (typeof obj.error === 'string') return obj.error;
        if (typeof obj.detail === 'string') return obj.detail;
        for (const value of Object.values(obj)) {
            const msg = messageFromBody(value);
            if (msg) return msg;
        }
    }
    return '';
};

// --- Tokens ---

const ACCESS_KEY = 'authToken';
const REFRESH_KEY = 'refreshToken';

export const hasStoredSession = async () => !!(await AsyncStorage.getItem(ACCESS_KEY));

const saveTokens = (access: string, refresh?: string) =>
    AsyncStorage.multiSet(refresh ? [[ACCESS_KEY, access], [REFRESH_KEY, refresh]] : [[ACCESS_KEY, access]]);

export const clearTokens = () => AsyncStorage.multiRemove([ACCESS_KEY, REFRESH_KEY]);

/**
 * Devuelve el access nuevo, o null si la sesión venció de verdad (el backend rechazó el refresh).
 * Sin red, o con el server caído o limitando (429, 5xx), tira el error y los tokens quedan:
 * un corte de un minuto no puede desloguear a nadie.
 */
const doRefresh = async (): Promise<string | null> => {
    const refresh = await AsyncStorage.getItem(REFRESH_KEY);
    if (!refresh) return null;
    const response = await fetch(`${API_BASE}/token/refresh/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh }),
    });
    if (response.status === 400 || response.status === 401) {
        await clearTokens();
        return null;
    }
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.access) throw new ApiError(response.status, data, messageFromBody(data));
    // ROTATE_REFRESH_TOKENS está activo: si no guardamos el nuevo, la sesión muere a los 7 días del login.
    await saveTokens(data.access, data.refresh);
    return data.access;
};

// Un solo refresh a la vez: si varias requests reciben 401 juntas, todas esperan el mismo.
let refreshInFlight: Promise<string | null> | null = null;
const refreshAccessToken = () => {
    refreshInFlight ??= doRefresh().finally(() => { refreshInFlight = null; });
    return refreshInFlight;
};

/** fetch con el token. Ante un 401 renueva el token y reintenta una vez. */
const authenticatedFetch = async (url: string, init: RequestInit): Promise<Response> => {
    const headers = new Headers(init.headers);
    const token = await AsyncStorage.getItem(ACCESS_KEY);
    if (token) headers.set('Authorization', `Bearer ${token}`);

    const response = await fetch(url, { ...init, headers });
    if (response.status !== 401) return response;

    const newToken = await refreshAccessToken();
    if (!newToken) throw new SessionExpiredError();
    headers.set('Authorization', `Bearer ${newToken}`);
    return fetch(url, { ...init, headers });
};

// --- Request genérico ---

interface RequestOptions {
    method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    /** Objeto (va como JSON) o FormData (multipart, el boundary lo pone fetch). */
    body?: unknown;
    /** false para login, registro y demás endpoints sin sesión. */
    auth?: boolean;
}

/** `path` relativo a API_BASE ("/recetas/") o una URL absoluta (cursores de paginación). */
const request = async <T>(path: string, { method = 'GET', body, auth = true }: RequestOptions = {}): Promise<T> => {
    const url = path.startsWith('http') ? path : `${API_BASE}${path}`;
    const init: RequestInit = { method };
    if (body instanceof FormData) {
        init.body = body;
    } else if (body !== undefined) {
        init.headers = { 'Content-Type': 'application/json' };
        init.body = JSON.stringify(body);
    }

    const response = auth ? await authenticatedFetch(url, init) : await fetch(url, init);
    // Un 502 del proxy o un 204 no traen JSON.
    const data = response.status === 204 ? null : await response.json().catch(() => null);
    if (!response.ok) throw new ApiError(response.status, data, messageFromBody(data));
    return data as T;
};

// --- Auth ---

interface Tokens { access: string; refresh: string }

export const loginService = async (username: string, password: string) => {
    const data = await request<Tokens>('/token/', { method: 'POST', body: { username, password }, auth: false });
    await saveTokens(data.access, data.refresh);
    return data;
};

export const registerService = (username: string, email: string, password: string) =>
    request<{ message: string; email: string }>('/register/', { method: 'POST', body: { username, email, password }, auth: false });

/** La contraseña es la misma del registro: el backend la pide para saber que quien verifica es quien se registró. */
export const verifyRegisterOTPService = async (email: string, otpCode: string, password: string) => {
    const data = await request<Tokens>('/register/verify/', { method: 'POST', body: { email, otp_code: otpCode, password }, auth: false });
    await saveTokens(data.access, data.refresh);
    return data;
};

export const resendRegisterOTPService = (email: string) =>
    request<{ message: string }>('/register/resend/', { method: 'POST', body: { email }, auth: false });

export const requestPasswordResetService = (email: string) =>
    request<{ message: string }>('/password-reset/request/', { method: 'POST', body: { email }, auth: false });

export const verifyPasswordResetOTPService = (email: string, otpCode: string, newPassword: string) =>
    request<{ message: string }>('/password-reset/verify/', {
        method: 'POST', body: { email, otp_code: otpCode, new_password: newPassword }, auth: false,
    });

export const logoutService = clearTokens;

export const getCurrentUserService = () => request<User>('/me/');

// --- Recetas ---

/** Respuesta paginada de DRF (CursorPagination). */
export interface PaginatedResponse<T> {
    next: string | null;
    previous: string | null;
    results: T[];
}

/** Primera página con filtros, o la siguiente si viene `cursorUrl` (ya trae los filtros). */
export const getRecipesService = (
    categoryId?: number | null,
    search?: string,
    favorites?: boolean,
    cursorUrl?: string | null,
): Promise<PaginatedResponse<Recipe>> => {
    if (cursorUrl) return request(cursorUrl);
    const params = new URLSearchParams();
    if (categoryId) params.append('categories', String(categoryId));
    if (search) params.append('search', search);
    if (favorites) params.append('favorites', 'true');
    return request(`/recetas/?${params}`);
};

/** Con id edita (PUT), sin id crea (POST). */
export const saveRecipeService = (recipe: Recipe) =>
    recipe.id
        ? request<Recipe>(`/recetas/${recipe.id}/`, { method: 'PUT', body: recipe })
        : request<Recipe>('/recetas/', { method: 'POST', body: recipe });

export const deleteRecipeService = (id: number) => request<void>(`/recetas/${id}/`, { method: 'DELETE' });

export const toggleFavoriteService = (recipeId: number) =>
    request<{ is_favorite: boolean }>(`/recetas/${recipeId}/favorite/`, { method: 'POST' });

/** Marca una receta como pública (necesario para que el link compartido funcione). */
export const setRecipePublicService = (id: number, isPublic: boolean) =>
    request<Recipe>(`/recetas/${id}/`, { method: 'PATCH', body: { is_public: isPublic } });

/** Receta pública por uuid. Con sesión también devuelve las propias aunque no sean públicas. */
export const getSharedRecipeService = async (uuid: string): Promise<Recipe> => {
    const path = `/compartidas/${uuid}/`;
    if (!(await hasStoredSession())) return request(path, { auth: false });
    try {
        return await request(path);
    } catch (e) {
        // Sesión vencida: probamos como anónimo.
        if (e instanceof SessionExpiredError) return request(path, { auth: false });
        throw e;
    }
};

// --- Importar con IA (todas devuelven { message, recipe }) ---

interface ImportResponse { message: string; recipe: Recipe }

export const importRecipeService = (url: string) =>
    request<ImportResponse>('/importar/', { method: 'POST', body: { url } });

// --- Colecciones (TikTok y playlists de YouTube) ---

export interface CollectionVideo { url: string; title: string }

export type CollectionListing =
    | { is_collection: false }
    | { is_collection: true; title: string; videos: CollectionVideo[]; already_imported: string[]; remaining_today: number };

/** Lista los videos sin gastar cupo. Si el link es un video suelto devuelve is_collection=false. */
export const listCollectionService = (url: string) =>
    request<CollectionListing>('/importar/coleccion/', { method: 'POST', body: { url } });

/** Importa y guarda un video de la colección. skipped=true si ya estaba. */
export const importCollectionItemService = (url: string, category?: number | null) =>
    request<{ skipped: boolean; recipe: Recipe }>('/importar/coleccion/receta/', {
        method: 'POST',
        body: category ? { url, category } : { url },
    });

export const importRecipeServiceAudio = (fileUri: string, fileName: string, fileType: string, webFile?: File) => {
    const formData = new FormData();
    if (webFile) {
        // En web FormData necesita un File/Blob real; el objeto {uri, name, type} es solo de React Native.
        formData.append('file', webFile, fileName);
    } else {
        formData.append('file', { uri: fileUri, name: fileName, type: fileType } as unknown as Blob);
    }
    return request<ImportResponse>('/importar-archivo/', { method: 'POST', body: formData });
};

export const importRecipeServiceText = (text: string) =>
    request<ImportResponse>('/importar-texto/', { method: 'POST', body: { text } });

export const importRecipeServiceWeb = (url: string) =>
    request<ImportResponse>('/importar-web/', { method: 'POST', body: { url } });

// --- Categorías ---

export const getCategoriesService = () => request<Category[]>('/categorias/');

export const createCategoryService = (name: string) =>
    request<Category>('/categorias/', { method: 'POST', body: { name } });

// --- Planificador ---

export const getWeekPlans = (weekStart: string) => request<MealPlan[]>(`/planner/week/?week_start=${weekStart}`);

export const createMealPlan = (data: { date: string; meal_type: string; recipe: string }) =>
    request<MealPlan>('/planner/', { method: 'POST', body: data });

export const deleteMealPlan = (id: number) => request<void>(`/planner/${id}/`, { method: 'DELETE' });

// --- Lista de compras ---

export const generateShoppingList = (weekStart: string) =>
    request<ShoppingListItem[]>('/planner/generate_shopping_list/', { method: 'POST', body: { week_start: weekStart } });

export const getShoppingList = (weekStart: string) =>
    request<ShoppingListItem[]>(`/shopping/?week_start=${weekStart}`);

export const toggleShoppingItem = (id: number, isChecked: boolean) =>
    request<ShoppingListItem>(`/shopping/${id}/`, { method: 'PATCH', body: { is_checked: isChecked } });

export const createShoppingItem = (data: { week_start: string; ingredient_name: string; quantity?: string; category?: string }) =>
    request<ShoppingListItem>('/shopping/', { method: 'POST', body: data });

export const updateShoppingItem = (id: number, data: Partial<ShoppingListItem>) =>
    request<ShoppingListItem>(`/shopping/${id}/`, { method: 'PATCH', body: data });

export const deleteShoppingItem = (id: number) => request<void>(`/shopping/${id}/`, { method: 'DELETE' });

// --- Ideas (chat IA) ---

export const sendIdeasMessage = (message: string) =>
    request<IdeasResponse>('/ideas/', { method: 'POST', body: { message } });
