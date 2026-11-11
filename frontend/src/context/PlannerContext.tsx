import React, { createContext, useState, useEffect, useContext, useCallback, useMemo } from 'react';
import { MealPlan, ShoppingListItem, Recipe } from '../types';
import { useApp } from './AppContext';
import { getRecipeImage } from '../utils';
import { addWeeks, getCurrentMonday } from '../utils/dates';
import {
    getWeekPlans,
    createMealPlan,
    deleteMealPlan,
    generateShoppingList as generateShoppingListService,
    getShoppingList,
    toggleShoppingItem as toggleShoppingItemService,
    createShoppingItem as createShoppingItemService,
    updateShoppingItem as updateShoppingItemService,
    deleteShoppingItem as deleteShoppingItemService,
} from '../services/api';

// --- Draft slot para el planning volátil ---

export interface DraftSlot {
    date: string;
    meal_type: string;
    recipeUuid: string;
    recipeTitle: string;
    recipeImage: string | null;
    recipePrepTime: number | null;
}

// --- Context type ---

interface PlannerContextType {
    weekStart: string;
    // Plans: server state + draft overlay
    serverPlans: MealPlan[];
    draftSlots: Record<string, DraftSlot>; // key: `date|meal_type`
    removedIds: Set<number>;
    hasUnsavedChanges: boolean;
    isLoadingPlans: boolean;
    isSaving: boolean;

    // Shopping
    shoppingList: ShoppingListItem[];
    isLoadingShoppingList: boolean;
    isGeneratingList: boolean;

    // Week navigation
    canGoBack: boolean;
    canGoForward: boolean;
    goToPreviousWeek: () => void;
    goToNextWeek: () => void;

    // Draft actions (volatile)
    assignRecipe: (date: string, mealType: string, recipe: Recipe) => void;
    removeFromPlan: (date: string, mealType: string) => void;
    savePlan: () => Promise<boolean>;
    discardChanges: () => void;

    // Shopping actions
    generateList: () => Promise<void>;
    fetchShoppingList: () => Promise<void>;
    toggleItem: (id: number, isChecked: boolean) => Promise<void>;
    addShoppingItem: (name: string, quantity?: string, category?: string) => Promise<void>;
    editShoppingItem: (id: number, data: Partial<ShoppingListItem>) => Promise<void>;
    removeShoppingItem: (id: number) => Promise<void>;

    // Helpers
    getMergedPlanForSlot: (date: string, mealType: string) => MealPlan | DraftSlot | undefined;
    getPlansForDate: (date: string) => (MealPlan | DraftSlot)[];
    refreshPlans: () => Promise<void>;
}

const PlannerContext = createContext<PlannerContextType | undefined>(undefined);

// Slot key helper
const slotKey = (date: string, mealType: string) => `${date}|${mealType}`;

export const PlannerProvider = ({ children }: { children: React.ReactNode }) => {
    const { isAuthenticated } = useApp();
    const [weekStart, setWeekStart] = useState(getCurrentMonday());
    const [serverPlans, setServerPlans] = useState<MealPlan[]>([]);
    const [draftSlots, setDraftSlots] = useState<Record<string, DraftSlot>>({});
    const [removedIds, setRemovedIds] = useState<Set<number>>(new Set());
    const [isLoadingPlans, setIsLoadingPlans] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    const [shoppingList, setShoppingList] = useState<ShoppingListItem[]>([]);
    const [isLoadingShoppingList, setIsLoadingShoppingList] = useState(false);
    const [isGeneratingList, setIsGeneratingList] = useState(false);

    const currentMonday = getCurrentMonday();
    const maxWeekStart = addWeeks(currentMonday, 3);
    const canGoBack = weekStart > currentMonday;
    const canGoForward = weekStart < maxWeekStart;

    const hasUnsavedChanges = Object.keys(draftSlots).length > 0 || removedIds.size > 0;

    const fetchPlans = useCallback(async () => {
        setIsLoadingPlans(true);
        try {
            const data = await getWeekPlans(weekStart);
            setServerPlans(data);
            // Clear drafts when loading fresh data
            setDraftSlots({});
            setRemovedIds(new Set());
        } catch (e) {
            console.warn('Error cargando el plan semanal', e);
            setServerPlans([]);
        } finally {
            setIsLoadingPlans(false);
        }
    }, [weekStart]);

    // Plan de la semana: al entrar y al cambiar de semana. Al salir, se limpia todo.
    useEffect(() => {
        if (isAuthenticated) {
            fetchPlans();
        } else {
            setServerPlans([]);
            setDraftSlots({});
            setRemovedIds(new Set());
            setShoppingList([]);
            setWeekStart(getCurrentMonday());
        }
    }, [isAuthenticated, fetchPlans]);

    // --- Week navigation ---

    const goToPreviousWeek = useCallback(() => {
        const prev = addWeeks(weekStart, -1);
        if (prev >= currentMonday) setWeekStart(prev);
    }, [weekStart, currentMonday]);

    const goToNextWeek = useCallback(() => {
        const next = addWeeks(weekStart, 1);
        if (next <= maxWeekStart) setWeekStart(next);
    }, [weekStart, maxWeekStart]);

    // --- Draft actions (volatile) ---

    const assignRecipe = useCallback((date: string, mealType: string, recipe: Recipe) => {
        const key = slotKey(date, mealType);
        // If overwriting a server plan, mark it for removal
        const existingServer = serverPlans.find(
            p => p.date === date && p.meal_type === mealType && !removedIds.has(p.id)
        );
        if (existingServer) {
            setRemovedIds(prev => new Set(prev).add(existingServer.id));
        }
        const imageSource = getRecipeImage(recipe);
        setDraftSlots(prev => ({
            ...prev,
            [key]: {
                date,
                meal_type: mealType,
                recipeUuid: recipe.uuid,
                recipeTitle: recipe.title,
                recipeImage: imageSource?.uri || null,
                recipePrepTime: recipe.prep_time || null,
            },
        }));
    }, [serverPlans, removedIds]);

    const removeFromPlan = useCallback((date: string, mealType: string) => {
        const key = slotKey(date, mealType);
        // Check if it's a draft
        if (draftSlots[key]) {
            setDraftSlots(prev => {
                const next = { ...prev };
                delete next[key];
                return next;
            });
            return;
        }
        // It's a server plan — mark for removal
        const serverPlan = serverPlans.find(
            p => p.date === date && p.meal_type === mealType
        );
        if (serverPlan) {
            setRemovedIds(prev => new Set(prev).add(serverPlan.id));
        }
    }, [draftSlots, serverPlans]);

    const discardChanges = useCallback(() => {
        setDraftSlots({});
        setRemovedIds(new Set());
    }, []);

    const savePlan = useCallback(async (): Promise<boolean> => {
        setIsSaving(true);
        try {
            // 1. Delete removed plans
            const deletePromises = Array.from(removedIds).map(id => deleteMealPlan(id));
            await Promise.all(deletePromises);

            // 2. Create new plans from drafts
            const createPromises = Object.values(draftSlots).map(slot =>
                createMealPlan({
                    date: slot.date,
                    meal_type: slot.meal_type,
                    recipe: slot.recipeUuid,
                })
            );
            await Promise.all(createPromises);

            // 3. Refresh from server
            await fetchPlans();
            return true;
        } catch {
            return false;
        } finally {
            setIsSaving(false);
        }
    }, [removedIds, draftSlots, fetchPlans]);

    // --- Helpers: merged view ---

    const getMergedPlanForSlot = useCallback(
        (date: string, mealType: string): MealPlan | DraftSlot | undefined => {
            const key = slotKey(date, mealType);
            // Draft takes priority
            if (draftSlots[key]) return draftSlots[key];
            // Server plan (if not removed)
            const server = serverPlans.find(
                p => p.date === date && p.meal_type === mealType
            );
            if (server && !removedIds.has(server.id)) return server;
            return undefined;
        },
        [serverPlans, draftSlots, removedIds]
    );

    const getPlansForDate = useCallback(
        (date: string): (MealPlan | DraftSlot)[] => {
            const result: (MealPlan | DraftSlot)[] = [];
            for (const mt of ['breakfast', 'lunch', 'dinner']) {
                const plan = getMergedPlanForSlot(date, mt);
                if (plan) result.push(plan);
            }
            return result;
        },
        [getMergedPlanForSlot]
    );

    // --- Shopping list actions ---

    const fetchShoppingListFn = useCallback(async () => {
        setIsLoadingShoppingList(true);
        try {
            const data = await getShoppingList(weekStart);
            setShoppingList(data);
        } catch {
            setShoppingList([]);
        } finally {
            setIsLoadingShoppingList(false);
        }
    }, [weekStart]);

    const generateList = useCallback(async () => {
        setIsGeneratingList(true);
        try {
            const data = await generateShoppingListService(weekStart);
            setShoppingList(data);
        } finally {
            setIsGeneratingList(false);
        }
    }, [weekStart]);

    const toggleItem = useCallback(async (id: number, isChecked: boolean) => {
        setShoppingList(prev =>
            prev.map(item => item.id === id ? { ...item, is_checked: isChecked } : item)
        );
        try {
            await toggleShoppingItemService(id, isChecked);
        } catch {
            setShoppingList(prev =>
                prev.map(item => item.id === id ? { ...item, is_checked: !isChecked } : item)
            );
        }
    }, []);

    const addShoppingItem = useCallback(async (name: string, quantity?: string, category?: string) => {
        const item = await createShoppingItemService({
            week_start: weekStart,
            ingredient_name: name,
            quantity: quantity || '',
            category: category || 'Otros',
        });
        setShoppingList(prev => [...prev, item]);
    }, [weekStart]);

    const editShoppingItem = useCallback(async (id: number, data: Partial<ShoppingListItem>) => {
        const updated = await updateShoppingItemService(id, data);
        setShoppingList(prev => prev.map(item => item.id === id ? updated : item));
    }, []);

    const removeShoppingItem = useCallback(async (id: number) => {
        await deleteShoppingItemService(id);
        setShoppingList(prev => prev.filter(item => item.id !== id));
    }, []);

    const value = useMemo<PlannerContextType>(() => ({
        weekStart, serverPlans, draftSlots, removedIds,
        hasUnsavedChanges, isLoadingPlans, isSaving,
        shoppingList, isLoadingShoppingList, isGeneratingList,
        canGoBack, canGoForward, goToPreviousWeek, goToNextWeek,
        assignRecipe, removeFromPlan, savePlan, discardChanges,
        generateList, fetchShoppingList: fetchShoppingListFn,
        toggleItem, addShoppingItem, editShoppingItem, removeShoppingItem,
        getMergedPlanForSlot, getPlansForDate, refreshPlans: fetchPlans,
    }), [
        weekStart, serverPlans, draftSlots, removedIds, hasUnsavedChanges, isLoadingPlans, isSaving,
        shoppingList, isLoadingShoppingList, isGeneratingList, canGoBack, canGoForward,
        goToPreviousWeek, goToNextWeek, assignRecipe, removeFromPlan, savePlan, discardChanges,
        generateList, fetchShoppingListFn, toggleItem, addShoppingItem, editShoppingItem,
        removeShoppingItem, getMergedPlanForSlot, getPlansForDate, fetchPlans,
    ]);

    return <PlannerContext.Provider value={value}>{children}</PlannerContext.Provider>;
};

export const usePlanner = () => {
    const context = useContext(PlannerContext);
    if (!context) throw new Error('usePlanner must be used within PlannerProvider');
    return context;
};
