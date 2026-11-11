import React, { createContext, useState, useEffect, useContext, useRef, useCallback, useMemo } from 'react';

import { Category, Recipe, User } from '../types';
import {
    ApiError, SessionExpiredError, clearTokens, hasStoredSession,
    getRecipesService, saveRecipeService, deleteRecipeService, toggleFavoriteService,
    importRecipeService, importRecipeServiceAudio, importRecipeServiceText, importRecipeServiceWeb,
    loginService, registerService, verifyRegisterOTPService, getCurrentUserService,
    getCategoriesService, createCategoryService,
} from '../services/api';
import { notify } from '../utils/dialogs';
import { useDebouncedValue } from '../hooks/useDebouncedValue';

export type CreateMode = 'manual' | 'video' | 'audio' | 'text' | 'link-web';

interface AppContextType {
    recipes: Recipe[];
    categories: Category[];
    selectedCategory: number | null;
    setSelectedCategory: (catId: number | null) => void;
    searchQuery: string;
    setSearchQuery: (query: string) => void;
    showFavorites: boolean;
    setShowFavorites: (show: boolean) => void;
    loading: boolean;
    loadingMore: boolean;
    hasMore: boolean;
    isAuthenticated: boolean;
    isAuthLoading: boolean;
    user: User | null;
    fetchRecipes: () => Promise<void>;
    fetchMoreRecipes: () => Promise<void>;
    createCategory: (name: string) => Promise<Category>;
    saveRecipe: (recipe: Recipe) => Promise<void>;
    deleteRecipe: (id: number) => Promise<void>;
    toggleFavorite: (recipeId: number) => Promise<void>;
    markRecipePublic: (recipeId: number) => void;
    importRecipeAI: (url: string) => Promise<Recipe>;
    importRecipeAIAudio: (fileUri: string, fileName: string, fileType: string, webFile?: File) => Promise<Recipe>;
    importRecipeAIText: (text: string) => Promise<Recipe>;
    importRecipeAIWeb: (url: string) => Promise<Recipe>;
    login: (u: string, p: string) => Promise<void>;
    register: (u: string, e: string, p: string) => Promise<unknown>;
    verifyRegisterOTP: (email: string, otpCode: string) => Promise<void>;
    logout: () => Promise<void>;

    createMode: CreateMode | null;
    setCreateMode: (mode: CreateMode | null) => void;

    // Control de Modales Globales
    isCreateMenuVisible: boolean;
    setCreateMenuVisible: (v: boolean) => void;
    formModalVisible: boolean;
    setFormModalVisible: (v: boolean) => void;
    editingRecipe: Recipe | null;
    setEditingRecipe: (r: Recipe | null) => void;
    initialImportUrl: string | null;
    setInitialImportUrl: (url: string | null) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const isAuthFailure = (e: unknown) =>
    e instanceof SessionExpiredError || (e instanceof ApiError && e.status === 401);

export const AppProvider = ({ children }: { children: React.ReactNode }) => {
    const [recipes, setRecipes] = useState<Recipe[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [showFavorites, setShowFavorites] = useState(false);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [nextCursor, setNextCursor] = useState<string | null>(null);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isAuthLoading, setIsAuthLoading] = useState(true);
    const [user, setUser] = useState<User | null>(null);

    // Estados para modales globales
    const [isCreateMenuVisible, setCreateMenuVisible] = useState(false);
    const [formModalVisible, setFormModalVisible] = useState(false);
    const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);
    const [createMode, setCreateMode] = useState<CreateMode | null>(null);
    const [initialImportUrl, setInitialImportUrl] = useState<string | null>(null);

    // Búsqueda server-side: se pide recién cuando se deja de tipear.
    const debouncedSearch = useDebouncedValue(searchQuery, 400);
    // Cada carga de la primera página tiene un número; las respuestas viejas (de una búsqueda
    // anterior que tardó más) se descartan en vez de pisar la lista.
    const requestIdRef = useRef(0);
    const loadingMoreRef = useRef(false);

    const logout = useCallback(async () => {
        await clearTokens().catch(() => {});
        requestIdRef.current++;
        setIsAuthenticated(false);
        setUser(null);
        setRecipes([]);
        setCategories([]);
        setNextCursor(null);
        // Que el próximo usuario no herede filtros ni modales abiertos.
        setSelectedCategory(null);
        setSearchQuery('');
        setShowFavorites(false);
        setFormModalVisible(false);
        setCreateMenuVisible(false);
        setEditingRecipe(null);
    }, []);

    /** Si la sesión venció, afuera. Devuelve true si el error ya quedó resuelto así. */
    const handleAuthFailure = useCallback((e: unknown) => {
        if (!isAuthFailure(e)) return false;
        logout();
        return true;
    }, [logout]);

    // Al abrir la app: si hay token guardado, se valida pidiendo el usuario.
    useEffect(() => {
        (async () => {
            try {
                if (!(await hasStoredSession())) return;
                setUser(await getCurrentUserService());
                setIsAuthenticated(true);
            } catch (e) {
                // Sin red se conservan los tokens para el próximo intento; solo se borran si el backend los rechazó.
                if (isAuthFailure(e)) await clearTokens().catch(() => {});
            } finally {
                setIsAuthLoading(false);
            }
        })();
    }, []);

    // Categorías: una vez por sesión.
    useEffect(() => {
        if (!isAuthenticated) return;
        getCategoriesService()
            .then(setCategories)
            .catch(e => { if (!handleAuthFailure(e)) console.warn('Error cargando categorías', e); });
    }, [isAuthenticated, handleAuthFailure]);

    // Primera página con los filtros actuales (resetea la lista).
    const fetchRecipes = useCallback(async () => {
        const requestId = ++requestIdRef.current;
        setLoading(true);
        try {
            const data = await getRecipesService(selectedCategory, debouncedSearch || undefined, showFavorites || undefined);
            if (requestId !== requestIdRef.current) return;
            setRecipes(data.results);
            setNextCursor(data.next);
        } catch (e) {
            if (requestId !== requestIdRef.current || handleAuthFailure(e)) return;
            notify('Error', 'No pudimos cargar tus recetas.');
        } finally {
            if (requestId === requestIdRef.current) setLoading(false);
        }
    }, [selectedCategory, debouncedSearch, showFavorites, handleAuthFailure]);

    useEffect(() => {
        if (isAuthenticated) fetchRecipes();
    }, [isAuthenticated, fetchRecipes]);

    // Siguiente página (infinite scroll). onEndReached se dispara varias veces seguidas: el ref lo frena.
    const fetchMoreRecipes = useCallback(async () => {
        if (!nextCursor || loadingMoreRef.current) return;
        const requestId = requestIdRef.current;
        loadingMoreRef.current = true;
        setLoadingMore(true);
        try {
            const data = await getRecipesService(null, undefined, undefined, nextCursor);
            if (requestId !== requestIdRef.current) return; // cambiaron los filtros mientras tanto
            setRecipes(prev => [...prev, ...data.results]);
            setNextCursor(data.next);
        } catch (e) {
            if (!handleAuthFailure(e)) console.warn('Error cargando más recetas', e);
        } finally {
            loadingMoreRef.current = false;
            setLoadingMore(false);
        }
    }, [nextCursor, handleAuthFailure]);

    const login = useCallback(async (u: string, p: string) => {
        await loginService(u, p);
        setUser(await getCurrentUserService());
        setIsAuthenticated(true);
    }, []);

    const register = useCallback((u: string, e: string, p: string) => registerService(u, e, p), []);

    const verifyRegisterOTP = useCallback(async (email: string, otpCode: string) => {
        await verifyRegisterOTPService(email, otpCode);
        setUser(await getCurrentUserService());
        setIsAuthenticated(true);
    }, []);

    const saveRecipe = useCallback(async (recipe: Recipe) => {
        await saveRecipeService(recipe);
        setFormModalVisible(false);
        fetchRecipes();
    }, [fetchRecipes]);

    const deleteRecipe = useCallback(async (id: number) => {
        await deleteRecipeService(id);
        setRecipes(prev => prev.filter(r => r.id !== id));
    }, []);

    const toggleFavorite = useCallback(async (recipeId: number) => {
        try {
            const { is_favorite } = await toggleFavoriteService(recipeId);
            setRecipes(prev => showFavorites && !is_favorite
                // En "Favoritas", la que se desmarca se va de la lista.
                ? prev.filter(r => r.id !== recipeId)
                : prev.map(r => (r.id === recipeId ? { ...r, is_favorite } : r)));
        } catch (e) {
            if (!handleAuthFailure(e)) notify('Error', 'No pudimos actualizar la favorita.');
        }
    }, [showFavorites, handleAuthFailure]);

    const markRecipePublic = useCallback((recipeId: number) => {
        setRecipes(prev => prev.map(r => (r.id === recipeId ? { ...r, is_public: true } : r)));
    }, []);

    const importRecipeAI = useCallback(async (url: string) => (await importRecipeService(url)).recipe, []);
    const importRecipeAIAudio = useCallback(
        async (fileUri: string, fileName: string, fileType: string, webFile?: File) =>
            (await importRecipeServiceAudio(fileUri, fileName, fileType, webFile)).recipe,
        [],
    );
    const importRecipeAIText = useCallback(async (text: string) => (await importRecipeServiceText(text)).recipe, []);
    const importRecipeAIWeb = useCallback(async (url: string) => (await importRecipeServiceWeb(url)).recipe, []);

    const createCategory = useCallback(async (name: string) => {
        const created = await createCategoryService(name.trim());
        setCategories(prev => [...prev, created]);
        return created;
    }, []);

    // Memoizado: sin esto, cualquier cambio (p. ej. cada tecla del buscador) re-renderiza a todos los consumidores.
    const value = useMemo<AppContextType>(() => ({
        recipes, categories, selectedCategory, setSelectedCategory,
        searchQuery, setSearchQuery,
        showFavorites, setShowFavorites,
        loading, loadingMore, hasMore: !!nextCursor,
        isAuthenticated, isAuthLoading, user,
        fetchRecipes, fetchMoreRecipes,
        saveRecipe, deleteRecipe, toggleFavorite, markRecipePublic,
        importRecipeAI, importRecipeAIAudio, importRecipeAIText, importRecipeAIWeb,
        login, register, verifyRegisterOTP, logout, createCategory,
        isCreateMenuVisible, setCreateMenuVisible,
        formModalVisible, setFormModalVisible,
        editingRecipe, setEditingRecipe,
        createMode, setCreateMode,
        initialImportUrl, setInitialImportUrl,
    }), [
        recipes, categories, selectedCategory, searchQuery, showFavorites, loading, loadingMore, nextCursor,
        isAuthenticated, isAuthLoading, user, fetchRecipes, fetchMoreRecipes, saveRecipe, deleteRecipe,
        toggleFavorite, markRecipePublic, importRecipeAI, importRecipeAIAudio, importRecipeAIText,
        importRecipeAIWeb, login, register, verifyRegisterOTP, logout, createCategory,
        isCreateMenuVisible, formModalVisible, editingRecipe, createMode, initialImportUrl,
    ]);

    return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useApp = () => {
    const context = useContext(AppContext);
    if (!context) throw new Error('useApp must be used within AppProvider');
    return context;
};
