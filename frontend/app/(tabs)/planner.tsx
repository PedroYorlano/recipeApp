import React, { useState, useMemo } from 'react';
import {
    View, Text, TouchableOpacity, ScrollView, ActivityIndicator,
    StyleSheet, StatusBar as RNStatusBar, TextInput,
    LayoutAnimation, Platform, UIManager, Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

if (Platform.OS === 'android') {
    UIManager.setLayoutAnimationEnabledExperimental?.(true);
}
import { Image } from 'expo-image';
import { usePlanner, DraftSlot } from '../../src/context/PlannerContext';
import { COLORS, SPACING, RADIUS } from '../../src/theme';
import { SERVER_URL } from '../../src/constants';
import {
    ChevronLeft, ChevronRight, Sun, Coffee, Moon,
    Plus, ShoppingCart, Trash2, Calendar, Save, Edit2, X,
} from 'lucide-react-native';
import { MealPlan, Recipe, ShoppingListItem } from '../../src/types';
import { RecipePickerModal } from '../../src/components/planner/RecipePickerModal';
import { FogoncitoChat } from '../../src/components/planner/FogoncitoChat';
import { notify, confirmAction } from '../../src/utils/dialogs';
import { addDays, getTodayISO, parseISODate } from '../../src/utils/dates';

// --- Constantes ---

const MEAL_TYPES = [
    { key: 'breakfast' as const, label: 'Desayuno', icon: Sun, emoji: '☕' },
    { key: 'lunch' as const, label: 'Almuerzo', icon: Coffee, emoji: '☀️' },
    { key: 'dinner' as const, label: 'Cena', icon: Moon, emoji: '🌙' },
];

const DAY_NAMES = ['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM'];
const MONTH_NAMES = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
];

type TabView = 'week' | 'shopping' | 'fogoncito';

// --- Helpers ---

const getWeekDays = (weekStart: string): { date: string; dayName: string; dayNum: number }[] =>
    DAY_NAMES.map((name, i) => {
        const iso = addDays(weekStart, i);
        return { date: iso, dayName: name, dayNum: parseISODate(iso).getDate() };
    });

const formatWeekRange = (weekStart: string): string => {
    const start = new Date(weekStart + 'T00:00:00');
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    const startDay = start.getDate();
    const endDay = end.getDate();
    const startMonth = MONTH_NAMES[start.getMonth()];
    const endMonth = MONTH_NAMES[end.getMonth()];

    if (startMonth === endMonth) {
        return `Semana del ${startDay} al ${endDay} de ${startMonth}`;
    }
    return `Semana del ${startDay} de ${startMonth} al ${endDay} de ${endMonth}`;
};

const getImageUri = (image: string | null): string | null => {
    if (!image) return null;
    if (image.startsWith('http')) return image;
    return `${SERVER_URL}${image}`;
};


// --- Main Screen ---

export default function PlannerScreen() {
    const [activeTab, setActiveTab] = useState<TabView>('week');

    return (
        <SafeAreaView style={styles.container}>
            <RNStatusBar barStyle="dark-content" backgroundColor={COLORS.background} />

            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Planificar</Text>
            </View>

            {/* Segmented Control */}
            <View style={styles.segmentedContainer}>
                {(['week', 'shopping', 'fogoncito'] as TabView[]).map(tab => (
                    <TouchableOpacity
                        key={tab}
                        style={[styles.segmentBtn, activeTab === tab && styles.segmentBtnActive]}
                        onPress={() => setActiveTab(tab)}
                        activeOpacity={0.7}
                    >
                        <Text style={[
                            styles.segmentText,
                            activeTab === tab && styles.segmentTextActive,
                        ]}>
                            {tab === 'week' ? 'Semana' : tab === 'shopping' ? 'Compras' : 'Fogoncito'}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* Content */}
            {activeTab === 'week' && <WeekView onSwitchTab={setActiveTab} />}
            {activeTab === 'shopping' && <ShoppingView />}
            {activeTab === 'fogoncito' && <FogoncitoChat />}
        </SafeAreaView>
    );
}

// ============================================================
// WEEK VIEW
// ============================================================

function WeekView({ onSwitchTab }: { onSwitchTab: (tab: TabView) => void }) {
    const {
        weekStart, isLoadingPlans, isSaving, hasUnsavedChanges,
        canGoBack, canGoForward, goToPreviousWeek, goToNextWeek,
        getPlansForDate, getMergedPlanForSlot, removeFromPlan,
        assignRecipe, savePlan, discardChanges,
    } = usePlanner();

    const weekDays = useMemo(() => getWeekDays(weekStart), [weekStart]);
    const todayISO = getTodayISO();
    const [selectedDate, setSelectedDate] = useState(weekDays[0].date);
    const [pickerSlot, setPickerSlot] = useState<{ date: string; mealType: string } | null>(null);

    React.useEffect(() => {
        const days = getWeekDays(weekStart);
        const today = getTodayISO();
        const todayInWeek = days.find(d => d.date === today);
        setSelectedDate(todayInWeek ? today : days[0].date);
    }, [weekStart]);

    const handleRemove = async (date: string, mealType: string, title: string) => {
        const ok = await confirmAction({
            title: 'Quitar del plan',
            message: `\u00bfSacamos \"${title}\" de este d\u00eda?`,
            confirmText: 'Quitar',
            destructive: true,
        });
        if (ok) removeFromPlan(date, mealType);
    };

    const handleAssign = (recipe: Recipe) => {
        if (!pickerSlot) return;
        assignRecipe(pickerSlot.date, pickerSlot.mealType, recipe);
        setPickerSlot(null);
    };

    const handleSave = async () => {
        const ok = await savePlan();
        if (ok) {
            const goShopping = await confirmAction({
                title: '\u00a1Plan guardado!',
                message: '\u00bfQuer\u00e9s ir a Compras para generar tu lista?',
                confirmText: 'Ir a Compras',
                cancelText: 'Ahora no',
            });
            if (goShopping) onSwitchTab('shopping');
        } else {
            notify('Error', 'No pudimos guardar el plan. Intentalo de nuevo.');
        }
    };

    return (
        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
            {/* Week Navigation */}
            <View style={styles.weekNav}>
                <TouchableOpacity
                    onPress={goToPreviousWeek}
                    disabled={!canGoBack}
                    style={[styles.navArrow, !canGoBack && styles.navArrowDisabled]}
                    activeOpacity={0.6}
                >
                    <ChevronLeft size={22} color={canGoBack ? COLORS.secondary : COLORS.text.secondary} />
                </TouchableOpacity>
                <Text style={styles.weekRange}>{formatWeekRange(weekStart)}</Text>
                <TouchableOpacity
                    onPress={goToNextWeek}
                    disabled={!canGoForward}
                    style={[styles.navArrow, !canGoForward && styles.navArrowDisabled]}
                    activeOpacity={0.6}
                >
                    <ChevronRight size={22} color={canGoForward ? COLORS.secondary : COLORS.text.secondary} />
                </TouchableOpacity>
            </View>

            {/* Day Selector */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dayRow}>
                {weekDays.map(day => {
                    const isActive = day.date === selectedDate;
                    const hasPlans = getPlansForDate(day.date).length > 0;
                    const isPast = day.date < todayISO;
                    return (
                        <TouchableOpacity
                            key={day.date}
                            style={[styles.dayItem, isActive && styles.dayItemActive, isPast && styles.dayItemPast]}
                            onPress={() => setSelectedDate(day.date)}
                            activeOpacity={0.7}
                        >
                            <Text style={[styles.dayName, isActive && styles.dayNameActive, isPast && styles.dayTextPast]}>{day.dayName}</Text>
                            <Text style={[styles.dayNum, isActive && styles.dayNumActive, isPast && styles.dayTextPast]}>{day.dayNum}</Text>
                            <View style={[styles.dayDot, hasPlans ? styles.dayDotActive : styles.dayDotEmpty]} />
                        </TouchableOpacity>
                    );
                })}
            </ScrollView>

            {/* Meal Slots */}
            {isLoadingPlans ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={COLORS.primary} />
                </View>
            ) : (
                <View style={styles.slotsContainer}>
                    {MEAL_TYPES.map(meal => {
                        const plan = getMergedPlanForSlot(selectedDate, meal.key);
                        const isPast = selectedDate < todayISO;
                        return (
                            <MealSlotCard
                                key={meal.key}
                                meal={meal}
                                plan={plan}
                                isPast={isPast}
                                onAdd={() => setPickerSlot({ date: selectedDate, mealType: meal.key })}
                                onRemove={() => {
                                    const title = isDraft(plan) ? plan.recipeTitle : plan?.recipe_detail?.title || '';
                                    handleRemove(selectedDate, meal.key, title);
                                }}
                            />
                        );
                    })}
                </View>
            )}

            {/* Save / Discard Bar */}
            {hasUnsavedChanges && (
                <View style={styles.saveBar}>
                    <TouchableOpacity style={styles.discardBtn} onPress={discardChanges} activeOpacity={0.7}>
                        <X size={18} color={COLORS.text.secondary} />
                        <Text style={styles.discardBtnText}>Descartar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.saveBtn, isSaving && styles.saveBtnDisabled]}
                        onPress={handleSave}
                        disabled={isSaving}
                        activeOpacity={0.8}
                    >
                        {isSaving ? (
                            <ActivityIndicator size="small" color={COLORS.secondary} />
                        ) : (
                            <>
                                <Save size={18} color={COLORS.secondary} />
                                <Text style={styles.saveBtnText}>Guardar plan</Text>
                            </>
                        )}
                    </TouchableOpacity>
                </View>
            )}

            <View style={{ height: 20 }} />

            <RecipePickerModal
                visible={!!pickerSlot}
                onClose={() => setPickerSlot(null)}
                onSelect={handleAssign}
            />
        </ScrollView>
    );
}

// --- Helpers ---

function isDraft(plan: any): plan is DraftSlot {
    return plan && 'recipeUuid' in plan;
}

function getSlotTitle(plan: MealPlan | DraftSlot | undefined): string {
    if (!plan) return '';
    return isDraft(plan) ? plan.recipeTitle : plan.recipe_detail?.title || '';
}

function getSlotImage(plan: MealPlan | DraftSlot | undefined): string | null {
    if (!plan) return null;
    const img = isDraft(plan) ? plan.recipeImage : plan.recipe_detail?.image || null;
    return getImageUri(img);
}

function getSlotPrepTime(plan: MealPlan | DraftSlot | undefined): number | null {
    if (!plan) return null;
    return isDraft(plan) ? plan.recipePrepTime : plan.recipe_detail?.prep_time || null;
}

// --- Meal Slot Card ---

interface MealSlotProps {
    meal: typeof MEAL_TYPES[number];
    plan: MealPlan | DraftSlot | undefined;
    isPast?: boolean;
    onAdd: () => void;
    onRemove: () => void;
}

function MealSlotCard({ meal, plan, isPast, onAdd, onRemove }: MealSlotProps) {
    const IconComponent = meal.icon;
    const title = getSlotTitle(plan);
    const imageUri = getSlotImage(plan);
    const prepTime = getSlotPrepTime(plan);
    const draft = plan && isDraft(plan);

    if (plan && title) {
        return (
            <TouchableOpacity
                style={[styles.slotCardFilled, draft && styles.slotCardDraft]}
                onLongPress={isPast ? undefined : onRemove}
                activeOpacity={0.85}
            >
                {imageUri ? (
                    <Image source={{ uri: imageUri }} style={styles.slotImage} contentFit="cover" />
                ) : (
                    <View style={[styles.slotImage, styles.slotImagePlaceholder]}>
                        <IconComponent size={24} color={COLORS.text.secondary} />
                    </View>
                )}
                <View style={styles.slotInfo}>
                    <Text style={styles.slotMealLabel}>
                        {meal.emoji} {meal.label}{draft ? ' (sin guardar)' : ''}
                    </Text>
                    <Text style={styles.slotRecipeTitle} numberOfLines={2}>{title}</Text>
                    {prepTime ? <Text style={styles.slotPrepTime}>\u23f1 {prepTime} min</Text> : null}
                </View>
                {!isPast && (
                    <TouchableOpacity onPress={onRemove} style={styles.slotRemoveBtn} activeOpacity={0.6}>
                        <Trash2 size={16} color={COLORS.text.secondary} />
                    </TouchableOpacity>
                )}
            </TouchableOpacity>
        );
    }

    if (isPast) {
        return (
            <View style={[styles.slotCardEmpty, { opacity: 0.5 }]}>
                <IconComponent size={24} color={COLORS.text.secondary} />
                <View style={styles.slotEmptyInfo}>
                    <Text style={styles.slotMealLabelEmpty}>{meal.label}</Text>
                    <Text style={styles.slotEmptyText}>D\u00eda pasado</Text>
                </View>
            </View>
        );
    }

    return (
        <TouchableOpacity style={styles.slotCardEmpty} onPress={onAdd} activeOpacity={0.7}>
            <IconComponent size={24} color={COLORS.text.secondary} />
            <View style={styles.slotEmptyInfo}>
                <Text style={styles.slotMealLabelEmpty}>{meal.label}</Text>
                <Text style={styles.slotEmptyText}>Sin planificar</Text>
            </View>
            <View style={styles.slotAddBtn}>
                <Plus size={20} color={COLORS.primary} />
            </View>
        </TouchableOpacity>
    );
}

// ============================================================
// SHOPPING VIEW
// ============================================================

function ShoppingView() {
    const {
        weekStart, shoppingList, isLoadingShoppingList, isGeneratingList,
        generateList, fetchShoppingList, toggleItem,
        addShoppingItem, editShoppingItem, removeShoppingItem,
    } = usePlanner();

    const [newItemName, setNewItemName] = useState('');
    const [newItemQty, setNewItemQty] = useState('');

    const [expandedId, setExpandedId] = useState<number | null>(null);
    const [editValues, setEditValues] = useState<{
        ingredient_name: string;
        quantity: string;
    }>({ ingredient_name: '', quantity: '' });
    const [originalValues, setOriginalValues] = useState<{
        ingredient_name: string;
        quantity: string;
    }>({ ingredient_name: '', quantity: '' });
    const [deleteConfirming, setDeleteConfirming] = useState(false);

    React.useEffect(() => { fetchShoppingList(); }, [weekStart]);

    const grouped = useMemo(() => {
        const map: Record<string, typeof shoppingList> = {};
        for (const item of shoppingList) {
            const cat = item.category || 'Otros';
            if (!map[cat]) map[cat] = [];
            map[cat].push(item);
        }
        return Object.entries(map);
    }, [shoppingList]);

    const handleGenerate = async () => {
        try { await generateList(); }
        catch { notify('Error', 'No pudimos generar la lista.'); }
    };

    const handleAdd = async () => {
        const name = newItemName.trim();
        if (!name) return;
        try {
            await addShoppingItem(name, newItemQty.trim());
            setNewItemName('');
            setNewItemQty('');
        } catch { notify('Error', 'No pudimos agregar el ítem.'); }
    };

    const collapseAndSave = async () => {
        if (expandedId === null) return;

        const currentExpandedId = expandedId;
        const currentEditValues = { ...editValues };

        const hasChanges =
            currentEditValues.ingredient_name.trim() !== originalValues.ingredient_name ||
            currentEditValues.quantity.trim() !== originalValues.quantity;

        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setExpandedId(null);
        setDeleteConfirming(false);
        Keyboard.dismiss();

        if (!hasChanges) return;

        try {
            await editShoppingItem(currentExpandedId, {
                ingredient_name: currentEditValues.ingredient_name.trim(),
                quantity: currentEditValues.quantity.trim()
            });
        } catch (error) {
            // Silencioso por requerimiento (el contexto hace optimistic update si falla o la UI solo lo ignora)
        }
    };

    const expandItem = (item: ShoppingListItem) => {
        if (expandedId === item.id) return;

        if (expandedId !== null) {
            collapseAndSave();
        }

        const values = {
            ingredient_name: item.ingredient_name,
            quantity: item.quantity || '',
        };
        setEditValues(values);
        setOriginalValues(values);
        setDeleteConfirming(false);

        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setExpandedId(item.id);
    };

    return (
        <ScrollView
            style={{ flex: 1 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            onScrollBeginDrag={collapseAndSave}
        >
            {/* Generate Button */}
            <View style={styles.shoppingHeader}>
                <TouchableOpacity
                    style={[styles.generateBtn, isGeneratingList && styles.generateBtnDisabled]}
                    onPress={handleGenerate}
                    disabled={isGeneratingList}
                    activeOpacity={0.8}
                >
                    {isGeneratingList ? (
                        <View style={styles.generateBtnContent}>
                            <ActivityIndicator size="small" color={COLORS.secondary} />
                            <Text style={styles.generateBtnText}>Generando...</Text>
                        </View>
                    ) : (
                        <View style={styles.generateBtnContent}>
                            <ShoppingCart size={20} color={COLORS.secondary} />
                            <Text style={styles.generateBtnText}>
                                {shoppingList.length > 0 ? 'Regenerar lista' : 'Generar lista'}
                            </Text>
                        </View>
                    )}
                </TouchableOpacity>
            </View>

            {/* Add Item Bar */}
            <View style={styles.addItemBar}>
                <TextInput
                    style={styles.addItemInput}
                    placeholder="Agregar ítem..."
                    placeholderTextColor={COLORS.text.secondary}
                    value={newItemName}
                    onChangeText={setNewItemName}
                />
                <TextInput
                    style={styles.addItemQtyInput}
                    placeholder="Cant."
                    placeholderTextColor={COLORS.text.secondary}
                    value={newItemQty}
                    onChangeText={setNewItemQty}
                />
                <TouchableOpacity
                    style={[styles.addItemBtn, !newItemName.trim() && { opacity: 0.4 }]}
                    onPress={handleAdd}
                    disabled={!newItemName.trim()}
                    activeOpacity={0.7}
                >
                    <Plus size={20} color={COLORS.secondary} />
                </TouchableOpacity>
            </View>

            {/* Shopping List */}
            {isLoadingShoppingList ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={COLORS.primary} />
                </View>
            ) : shoppingList.length === 0 ? (
                <View style={styles.emptyState}>
                    <View style={styles.emptyIconContainer}>
                        <ShoppingCart size={48} color={COLORS.primary} strokeWidth={1} />
                    </View>
                    <Text style={styles.emptyTitle}>Tu lista de compras está vacía</Text>
                    <Text style={styles.emptySubtitle}>
                        Generá la lista a partir de tu plan semanal
                    </Text>
                </View>
            ) : (
                <View style={styles.shoppingListContainer}>
                    {grouped.map(([category, items]) => (
                        <View key={category} style={styles.categoryGroup}>
                            <View style={styles.categoryPill}>
                                <Text style={styles.categoryPillText}>{category}</Text>
                            </View>
                            {items.map(item => {
                                const isExpanded = expandedId === item.id;
                                return (
                                    <View key={item.id}>
                                        <TouchableOpacity
                                            style={[styles.shoppingItem, isExpanded && styles.shoppingItemExpandedTop]}
                                            onPress={() => expandItem(item)}
                                            activeOpacity={0.7}
                                        >
                                            <TouchableOpacity
                                                style={[styles.checkbox, item.is_checked && styles.checkboxChecked]}
                                                onPress={() => toggleItem(item.id, !item.is_checked)}
                                                activeOpacity={0.8}
                                            >
                                                {item.is_checked && <Text style={styles.checkmark}>✓</Text>}
                                            </TouchableOpacity>
                                            <Text style={[styles.itemName, item.is_checked && styles.itemNameChecked]}>
                                                {item.ingredient_name}
                                            </Text>
                                            {item.quantity ? (
                                                <Text style={[styles.itemQty, item.is_checked && styles.itemQtyChecked]}>
                                                    {item.quantity}
                                                </Text>
                                            ) : null}
                                        </TouchableOpacity>

                                        {isExpanded && (
                                            <View style={styles.expandedPanel}>
                                                <View style={styles.expandedInputsRow}>
                                                    <TextInput
                                                        style={[styles.expandedInput, { flex: 2 }]}
                                                        value={editValues.ingredient_name}
                                                        onChangeText={text => setEditValues(v => ({ ...v, ingredient_name: text }))}
                                                        placeholder="Nombre"
                                                        placeholderTextColor={COLORS.text.secondary}
                                                    />
                                                    <TextInput
                                                        style={[styles.expandedInput, { flex: 1, marginLeft: 8 }]}
                                                        value={editValues.quantity}
                                                        onChangeText={text => setEditValues(v => ({ ...v, quantity: text }))}
                                                        placeholder="Cant."
                                                        placeholderTextColor={COLORS.text.secondary}
                                                    />
                                                </View>
                                                <View style={styles.expandedActionsRow}>
                                                    <TouchableOpacity
                                                        style={[styles.deleteBtn, deleteConfirming && styles.deleteBtnConfirm]}
                                                        onPress={() => {
                                                            if (deleteConfirming) {
                                                                const idToDelete = item.id;
                                                                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                                                                setExpandedId(null);
                                                                setDeleteConfirming(false);
                                                                removeShoppingItem(idToDelete).catch(() => { });
                                                            } else {
                                                                setDeleteConfirming(true);
                                                                setTimeout(() => setDeleteConfirming(false), 2000);
                                                            }
                                                        }}
                                                    >
                                                        <Trash2 size={16} color={deleteConfirming ? '#FFF' : '#C0392B'} />
                                                        <Text style={[styles.deleteBtnText, deleteConfirming && styles.deleteBtnTextConfirm, { marginLeft: 6 }]}>
                                                            {deleteConfirming ? '¿Confirmar?' : 'Eliminar'}
                                                        </Text>
                                                    </TouchableOpacity>
                                                </View>
                                            </View>
                                        )}
                                    </View>
                                );
                            })}
                        </View>
                    ))}
                </View>
            )}
            <View style={{ height: 40 }} />
        </ScrollView>
    );
}

// ============================================================
// STYLES
// ============================================================

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    header: {
        paddingHorizontal: SPACING.l,
        paddingTop: SPACING.s,
        paddingBottom: SPACING.m,
    },
    headerTitle: {
        fontSize: 32,
        fontWeight: '700',
        color: COLORS.text.primary,
        fontFamily: 'Georgia',
        letterSpacing: -0.5,
    },

    // Segmented Control
    segmentedContainer: {
        flexDirection: 'row',
        marginHorizontal: SPACING.l,
        backgroundColor: '#F5E6D0',
        borderRadius: RADIUS.s,
        padding: 4,
        marginBottom: SPACING.m,
    },
    segmentBtn: {
        flex: 1,
        paddingVertical: 10,
        alignItems: 'center',
        borderRadius: RADIUS.s - 2,
    },
    segmentBtnActive: {
        backgroundColor: COLORS.card,
    },
    segmentText: {
        fontSize: 14,
        fontWeight: '600',
        color: COLORS.text.secondary,
    },
    segmentTextActive: {
        color: COLORS.text.primary,
    },

    // Week Navigation
    weekNav: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: SPACING.l,
        marginBottom: SPACING.m,
    },
    navArrow: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: COLORS.card,
        alignItems: 'center',
        justifyContent: 'center',
    },
    navArrowDisabled: {
        opacity: 0.4,
    },
    weekRange: {
        fontSize: 14,
        fontWeight: '600',
        color: COLORS.text.primary,
        textAlign: 'center',
        flex: 1,
    },

    // Day Selector
    dayRow: {
        paddingHorizontal: SPACING.m,
        gap: 8,
        marginBottom: SPACING.m,
    },
    dayItem: {
        width: 52,
        paddingVertical: 10,
        alignItems: 'center',
        borderRadius: RADIUS.m,
        backgroundColor: '#F5E6D0',
    },
    dayItemActive: {
        backgroundColor: COLORS.primary,
    },
    dayItemPast: {
        opacity: 0.5,
    },
    dayTextPast: {
        color: COLORS.text.secondary,
    },
    dayName: {
        fontSize: 11,
        fontWeight: '700',
        color: COLORS.text.secondary,
        marginBottom: 4,
        letterSpacing: 0.5,
    },
    dayNameActive: {
        color: COLORS.secondary,
    },
    dayNum: {
        fontSize: 18,
        fontWeight: '700',
        color: COLORS.text.primary,
        marginBottom: 6,
    },
    dayNumActive: {
        color: COLORS.secondary,
    },
    dayDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    dayDotActive: {
        backgroundColor: COLORS.primary,
    },
    dayDotEmpty: {
        backgroundColor: 'transparent',
    },

    // Slots
    slotsContainer: {
        paddingHorizontal: SPACING.l,
        paddingBottom: SPACING.xl,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 60,
    },

    // Filled Slot
    slotCardFilled: {
        flexDirection: 'row',
        backgroundColor: COLORS.card,
        borderRadius: RADIUS.m,
        padding: SPACING.s,
        marginBottom: SPACING.s,
        alignItems: 'center',
    },
    slotImage: {
        width: 64,
        height: 64,
        borderRadius: RADIUS.s,
    },
    slotImagePlaceholder: {
        backgroundColor: '#F5E6D0',
        alignItems: 'center',
        justifyContent: 'center',
    },
    slotInfo: {
        flex: 1,
        marginLeft: SPACING.s,
    },
    slotMealLabel: {
        fontSize: 11,
        fontWeight: '700',
        color: COLORS.text.secondary,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 2,
    },
    slotRecipeTitle: {
        fontSize: 15,
        fontWeight: '600',
        color: COLORS.text.primary,
        lineHeight: 20,
    },
    slotPrepTime: {
        fontSize: 12,
        color: COLORS.text.secondary,
        marginTop: 2,
    },
    slotRemoveBtn: {
        padding: SPACING.s,
    },

    // Empty Slot
    slotCardEmpty: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.card,
        borderRadius: RADIUS.m,
        borderWidth: 1.5,
        borderStyle: 'dashed',
        borderColor: '#D4C4A8',
        padding: SPACING.m,
        marginBottom: SPACING.s,
    },
    slotEmptyInfo: {
        flex: 1,
        marginLeft: SPACING.s,
    },
    slotMealLabelEmpty: {
        fontSize: 14,
        fontWeight: '600',
        color: COLORS.text.primary,
    },
    slotEmptyText: {
        fontSize: 12,
        color: COLORS.text.secondary,
    },
    slotAddBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#FFF0D6',
        alignItems: 'center',
        justifyContent: 'center',
    },

    // Shopping View
    shoppingHeader: {
        paddingHorizontal: SPACING.l,
        marginBottom: SPACING.m,
    },
    generateBtn: {
        backgroundColor: COLORS.primary,
        borderRadius: RADIUS.m,
        paddingVertical: 14,
        alignItems: 'center',
    },
    generateBtnDisabled: {
        opacity: 0.7,
    },
    generateBtnContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    generateBtnText: {
        fontSize: 16,
        fontWeight: '600',
        color: COLORS.secondary,
    },
    shoppingListContainer: {
        paddingHorizontal: SPACING.l,
    },
    categoryGroup: {
        marginBottom: SPACING.m,
    },
    categoryPill: {
        backgroundColor: '#F5E6D0',
        borderRadius: 20,
        paddingHorizontal: 14,
        paddingVertical: 5,
        alignSelf: 'flex-start',
        marginBottom: SPACING.s,
    },
    categoryPillText: {
        fontSize: 12,
        fontWeight: '700',
        color: COLORS.text.secondary,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    shoppingItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 4,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: '#E8D9C5',
    },
    checkbox: {
        width: 24,
        height: 24,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: '#D4C4A8',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: SPACING.s,
    },
    checkboxChecked: {
        backgroundColor: COLORS.success,
        borderColor: COLORS.success,
    },
    checkmark: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '700',
    },
    itemName: {
        flex: 1,
        fontSize: 15,
        color: COLORS.text.primary,
    },
    itemNameChecked: {
        textDecorationLine: 'line-through',
        color: COLORS.text.secondary,
    },
    itemQty: {
        fontSize: 13,
        color: COLORS.text.secondary,
        fontWeight: '500',
        marginLeft: SPACING.s,
    },
    itemQtyChecked: {
        textDecorationLine: 'line-through',
    },

    // Empty State
    emptyState: {
        alignItems: 'center',
        paddingTop: 60,
        paddingHorizontal: SPACING.xl,
    },
    emptyIconContainer: {
        backgroundColor: 'rgba(239, 159, 39, 0.1)',
        padding: SPACING.l,
        borderRadius: 50,
        marginBottom: SPACING.l,
        borderWidth: 1,
        borderColor: 'rgba(239, 159, 39, 0.2)',
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: COLORS.text.primary,
        textAlign: 'center',
        marginBottom: SPACING.s,
    },
    emptySubtitle: {
        fontSize: 14,
        color: COLORS.text.secondary,
        textAlign: 'center',
        lineHeight: 20,
    },

    // Draft slot indicator
    slotCardDraft: {
        borderWidth: 2,
        borderColor: COLORS.primary,
        borderStyle: 'dashed',
    },

    // Save / Discard bar
    saveBar: {
        flexDirection: 'row',
        paddingHorizontal: SPACING.l,
        gap: 10,
        marginTop: SPACING.m,
    },
    discardBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 12,
        paddingHorizontal: SPACING.m,
        borderRadius: RADIUS.m,
        backgroundColor: '#F5E6D0',
    },
    discardBtnText: {
        fontSize: 14,
        fontWeight: '600',
        color: COLORS.text.secondary,
    },
    saveBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 12,
        borderRadius: RADIUS.m,
        backgroundColor: COLORS.primary,
    },
    saveBtnDisabled: {
        opacity: 0.7,
    },
    saveBtnText: {
        fontSize: 15,
        fontWeight: '700',
        color: COLORS.secondary,
    },

    // Add item bar
    addItemBar: {
        flexDirection: 'row',
        paddingHorizontal: SPACING.l,
        gap: 8,
        marginBottom: SPACING.m,
    },
    addItemInput: {
        flex: 1,
        backgroundColor: COLORS.card,
        borderRadius: RADIUS.s,
        paddingHorizontal: SPACING.m,
        paddingVertical: 10,
        fontSize: 14,
        color: COLORS.text.primary,
        borderWidth: 1,
        borderColor: 'rgba(168, 144, 112, 0.2)',
    },
    addItemQtyInput: {
        width: 70,
        backgroundColor: COLORS.card,
        borderRadius: RADIUS.s,
        paddingHorizontal: SPACING.s,
        paddingVertical: 10,
        fontSize: 14,
        color: COLORS.text.primary,
        textAlign: 'center',
        borderWidth: 1,
        borderColor: 'rgba(168, 144, 112, 0.2)',
    },
    addItemBtn: {
        width: 40,
        height: 40,
        borderRadius: RADIUS.s,
        backgroundColor: COLORS.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },

    // Expanded Panel
    expandedPanel: {
        backgroundColor: '#FFF8F0',
        padding: SPACING.m,
        borderBottomLeftRadius: RADIUS.m,
        borderBottomRightRadius: RADIUS.m,
        borderTopWidth: 1,
        borderTopColor: '#F0E4D0',
        marginBottom: SPACING.s,
        marginTop: -1,
        borderLeftWidth: 1,
        borderRightWidth: 1,
        borderBottomWidth: 1,
        borderColor: '#E8D5B8',
    },
    shoppingItemExpandedTop: {
        backgroundColor: '#FFF8F0',
        borderTopLeftRadius: RADIUS.m,
        borderTopRightRadius: RADIUS.m,
        borderTopWidth: 1,
        borderLeftWidth: 1,
        borderRightWidth: 1,
        borderColor: '#E8D5B8',
        borderBottomWidth: 0,
        paddingHorizontal: SPACING.s,
    },
    expandedInputsRow: {
        flexDirection: 'row',
        marginBottom: SPACING.s,
    },
    expandedInput: {
        backgroundColor: '#FFF',
        borderWidth: 1,
        borderColor: '#E8D5B8',
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 8,
        color: '#633806',
        fontSize: 14,
    },
    expandedActionsRow: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
    },
    deleteBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 6,
        paddingHorizontal: 10,
        borderRadius: 4,
    },
    deleteBtnConfirm: {
        backgroundColor: '#C0392B',
    },
    deleteBtnText: {
        color: '#C0392B',
        fontSize: 13,
        fontWeight: '600',
    },
    deleteBtnTextConfirm: {
        color: '#FFF',
    },
});
