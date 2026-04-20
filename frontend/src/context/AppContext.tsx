import React, { createContext, useState, useEffect, useContext, useRef, useCallback } from 'react';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Category, Recipe } from '../types';
import { getRecipesService, saveRecipeService, deleteRecipeService, importRecipeService, importRecipeServiceAudio, importRecipeServiceText, importRecipeServiceWeb, loginService, logoutService, getCategoriesService, createCategoryService, toggleFavoriteService } from '../services/api';

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
    user: any;
    fetchRecipes: () => Promise<void>;
    fetchMoreRecipes: () => Promise<void>;
    createCategory: (name: string) => Promise<void>;
    saveRecipe: (recipe: Recipe) => Promise<void>;
    deleteRecipe: (id: number) => Promise<void>;
    toggleFavorite: (recipeId: number) => Promise<void>;
    importRecipeAI: (url: string) => Promise<Recipe>;
    importRecipeAIAudio: (fileUri: string, fileName: string, fileType: string) => Promise<Recipe>;
    importRecipeAIText: (text: string) => Promise<Recipe>;
    importRecipeAIWeb: (url: string) => Promise<Recipe>;
    login: (u: string, p: string) => Promise<void>;
    logout: () => Promise<void>;

    createMode: 'manual' | 'video' | 'audio' | 'text' | 'link-web' | null;
    setCreateMode: (mode: 'manual' | 'video' | 'audio' | 'text' | 'link-web' | null) => void;

    // Control de Modales Globales
    isCreateMenuVisible: boolean;
    setCreateMenuVisible: (v: boolean) => void;
    formModalVisible: boolean;
    setFormModalVisible: (v: boolean) => void;
    editingRecipe: Recipe | null;
    setEditingRecipe: (r: Recipe | null) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

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
    const [user, setUser] = useState(null);

    // Estados para modales globales
    const [isCreateMenuVisible, setCreateMenuVisible] = useState(false);
    const [formModalVisible, setFormModalVisible] = useState(false);
    const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);
    const [createMode, setCreateMode] = useState<'manual' | 'video' | 'audio' | 'text' | 'link-web' | null>(null);

    // Ref para debounce de búsqueda
    const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    // Ref para evitar fetch duplicados al montar
    const initialFetchDone = useRef(false);

    // Inicialización
    useEffect(() => {
        checkAuth();
    }, []);

    // Carga inicial cuando se autentica
    useEffect(() => {
        if (isAuthenticated && !initialFetchDone.current) {
            initialFetchDone.current = true;
            fetchInitialData();
        }
        if (!isAuthenticated) {
            initialFetchDone.current = false;
        }
    }, [isAuthenticated]);

    // Re-fetch cuando cambian filtros (categoría o favoritos)
    useEffect(() => {
        if (isAuthenticated && initialFetchDone.current) {
            fetchRecipes();
        }
    }, [selectedCategory, showFavorites]);

    // Debounce para búsqueda server-side (400ms)
    useEffect(() => {
        if (!isAuthenticated || !initialFetchDone.current) return;

        if (searchTimerRef.current) {
            clearTimeout(searchTimerRef.current);
        }

        searchTimerRef.current = setTimeout(() => {
            fetchRecipes();
        }, 400);

        return () => {
            if (searchTimerRef.current) {
                clearTimeout(searchTimerRef.current);
            }
        };
    }, [searchQuery]);

    const checkAuth = async () => {
        try {
            const token = await AsyncStorage.getItem('authToken');
            if (token) {
                setIsAuthenticated(!!token);
            }
        } catch (e) {
            console.error(e);
            setIsAuthenticated(false);
        } finally {
            setIsAuthLoading(false);
        }
    };

    const fetchInitialData = async () => {
        setLoading(true);
        try {
            const [recData, catData] = await Promise.all([
                getRecipesService(),
                getCategoriesService()
            ]);
            setRecipes(recData.results);
            setNextCursor(recData.next);
            setCategories(catData);
        } catch (e: any) {
            console.log("Error al cargar datos:", e.message);
            if (e.message === 'No autorizado' || e.message.includes('401')) {
                await logout();
            } else {
                Alert.alert('Error', 'No se pudieron cargar los datos');
            }
        }
        finally { setLoading(false); }
    };

    // Fetch primera página (resetea lista) — se usa con filtros actuales
    const fetchRecipes = useCallback(async () => {
        setLoading(true);
        try {
            const data = await getRecipesService(
                selectedCategory,
                searchQuery || undefined,
                showFavorites || undefined,
            );
            setRecipes(data.results);
            setNextCursor(data.next);
        } catch (e: any) {
            console.error("Error fetching recipes:", e);
            if (e.message === 'No autorizado' || e.message.includes('401')) {
                await logout();
            }
        }
        finally { setLoading(false); }
    }, [selectedCategory, searchQuery, showFavorites]);

    // Fetch siguiente página (append a la lista) — para infinite scroll
    const fetchMoreRecipes = useCallback(async () => {
        if (!nextCursor || loadingMore) return;
        setLoadingMore(true);
        try {
            const data = await getRecipesService(null, undefined, undefined, nextCursor);
            setRecipes(prev => [...prev, ...data.results]);
            setNextCursor(data.next);
        } catch (e) {
            console.error("Error loading more recipes:", e);
        }
        finally { setLoadingMore(false); }
    }, [nextCursor, loadingMore]);

    const login = async (u: string, p: string) => {
        const data = await loginService(u, p);
        if (data && data.access) {
            await AsyncStorage.setItem('authToken', data.access);
            setIsAuthenticated(true);
        } else {
            throw new Error("Login fallido: No se recibió token");
        }
    };

    const logout = async () => {
        try {
            await logoutService();
        } catch (e) {
            console.log("Error en logout service", e);
        }
        await AsyncStorage.removeItem('authToken');
        setIsAuthenticated(false);
        setRecipes([]);
        setCategories([]);
        setNextCursor(null);
    };

    const saveRecipe = async (recipe: Recipe) => {
        await saveRecipeService(recipe);
        fetchRecipes();
        setFormModalVisible(false);
    };

    const deleteRecipe = async (id: number) => {
        await deleteRecipeService(id);
        fetchRecipes();
    };

    const toggleFavorite = async (recipeId: number) => {
        try {
            const result = await toggleFavoriteService(recipeId);
            // Actualizar el estado local inmediatamente (optimistic UI)
            setRecipes(prev => prev.map(r => 
                r.id === recipeId 
                    ? { ...r, is_favorite: result.is_favorite }
                    : r
            ));
        } catch (e) {
            console.error("Error toggling favorite:", e);
        }
    };

    const importRecipeAI = async (url: string) => {
        const data = await importRecipeService(url);
        return data.recipe || data;
    };

    const importRecipeAIAudio = async (fileUri: string, fileName: string, fileType: string) => {
        const data = await importRecipeServiceAudio(fileUri, fileName, fileType);
        return data.recipe || data;
    };
    
    const importRecipeAIText = async (text: string) => {
        const data = await importRecipeServiceText(text);
        return data.recipe || data;
    };

    const importRecipeAIWeb = async (url: string) => {
        const data = await importRecipeServiceWeb(url);
        return data.recipe || data;
    };

    const createCategory = async (name: string) => {
        try {
            const newCategory = await createCategoryService(name);
            setCategories((prevCols) => [...prevCols, newCategory]);
        } catch (e) { console.error(e); }
    };

    return (
        <AppContext.Provider value={{
            recipes, categories, selectedCategory, setSelectedCategory, 
            searchQuery, setSearchQuery,
            showFavorites, setShowFavorites,
            loading, loadingMore, hasMore: !!nextCursor,
            isAuthenticated, isAuthLoading, user,
            fetchRecipes, fetchMoreRecipes,
            saveRecipe, deleteRecipe, toggleFavorite,
            importRecipeAI, importRecipeAIAudio, importRecipeAIText, importRecipeAIWeb, login, logout, createCategory,
            isCreateMenuVisible, setCreateMenuVisible,
            formModalVisible, setFormModalVisible,
            editingRecipe, setEditingRecipe,
            createMode, setCreateMode
        }}>
            {children}
        </AppContext.Provider>
    );
};

export const useApp = () => {
    const context = useContext(AppContext);
    if (!context) throw new Error("useApp must be used within AppProvider");
    return context;
};