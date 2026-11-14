import React, { useState, useMemo } from 'react';
import {
    View, TouchableOpacity, ScrollView, ActivityIndicator, StatusBar as RNStatusBar,
    LayoutAnimation, Platform, UIManager, Keyboard, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import Svg, { Circle } from 'react-native-svg';
import { ChevronLeft, ChevronRight, Plus, Trash2, X, Check, RefreshCw } from 'lucide-react-native';
import { Text, TextInput } from '../../src/components/ui/Typography';
import { Button } from '../../src/components/ui/Button';
import { usePlanner, DraftSlot } from '../../src/context/PlannerContext';
import { MealPlan, Recipe, ShoppingListItem } from '../../src/types';
import { RecipePickerModal } from '../../src/components/planner/RecipePickerModal';
import { IdeasChat } from '../../src/components/planner/IdeasChat';
import { MEALS } from '../../src/components/planner/AddToWeekSheet';
import { notify, confirmAction } from '../../src/utils/dialogs';
import { addDays, getTodayISO, parseISODate } from '../../src/utils/dates';
import { ICONS, ILLUSTRATIONS } from '../../src/constants/brand';
import { AISLES, OTHER_AISLE } from '../../src/constants/aisles';
import { useTabBarSpace } from '../../src/components/FloatingTabBar';

if (Platform.OS === 'android') {
    UIManager.setLayoutAnimationEnabledExperimental?.(true);
}

// --- Constantes ---

const DAY_NAMES = ['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM'];
const DAY_LONG = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MONTH_NAMES = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];
const MONTH_SHORT = ['ene.', 'feb.', 'mar.', 'abr.', 'may.', 'jun.', 'jul.', 'ago.', 'sep.', 'oct.', 'nov.', 'dic.'];

type TabView = 'week' | 'shopping' | 'ideas';
const TABS: { key: TabView; label: string }[] = [
    { key: 'week', label: 'Semana' },
    { key: 'shopping', label: 'Compras' },
    { key: 'ideas', label: 'Ideas' },
];

// --- Helpers ---

const getWeekDays = (weekStart: string) =>
    DAY_NAMES.map((name, i) => {
        const iso = addDays(weekStart, i);
        return { date: iso, dayName: name, dayNum: parseISODate(iso).getDate() };
    });

/** "9 – 15 de noviembre" o "29 de dic. – 4 de enero". */
const formatWeekRange = (weekStart: string): string => {
    const start = parseISODate(weekStart);
    const end = parseISODate(addDays(weekStart, 6));
    if (start.getMonth() === end.getMonth()) {
        return `${start.getDate()} – ${end.getDate()} de ${MONTH_NAMES[end.getMonth()]}`;
    }
    return `${start.getDate()} de ${MONTH_SHORT[start.getMonth()]} – ${end.getDate()} de ${MONTH_NAMES[end.getMonth()]}`;
};

/** "Semana del 9 al 15 de nov." */
const formatWeekShort = (weekStart: string): string => {
    const start = parseISODate(weekStart);
    const end = parseISODate(addDays(weekStart, 6));
    if (start.getMonth() === end.getMonth()) {
        return `Semana del ${start.getDate()} al ${end.getDate()} de ${MONTH_SHORT[end.getMonth()]}`;
    }
    return `Semana del ${start.getDate()} de ${MONTH_SHORT[start.getMonth()]} al ${end.getDate()} de ${MONTH_SHORT[end.getMonth()]}`;
};

/** "Hoy, martes 10" / "Mañana, miércoles 11" / "Jueves 12". */
const formatDayTitle = (iso: string): string => {
    const d = parseISODate(iso);
    const name = `${DAY_LONG[d.getDay()]} ${d.getDate()}`;
    const today = getTodayISO();
    if (iso === today) return `Hoy, ${name}`;
    if (iso === addDays(today, 1)) return `Mañana, ${name}`;
    return name.charAt(0).toUpperCase() + name.slice(1);
};

function isDraft(plan: any): plan is DraftSlot {
    return plan && 'recipeUuid' in plan;
}

const slotTitle = (plan?: MealPlan | DraftSlot) =>
    !plan ? '' : isDraft(plan) ? plan.recipeTitle : plan.recipe_detail?.title || '';

const slotPrepTime = (plan?: MealPlan | DraftSlot) =>
    !plan ? null : isDraft(plan) ? plan.recipePrepTime : plan.recipe_detail?.prep_time || null;

// --- Pantalla ---

export default function PlannerScreen() {
    const tabBarSpace = useTabBarSpace();
    const [activeTab, setActiveTab] = useState<TabView>('week');

    return (
        <SafeAreaView className="flex-1 bg-pizca-fondo" edges={['top']}>
            <RNStatusBar barStyle="dark-content" backgroundColor="#FFF9EC" />

            <View className="px-5 pt-4 gap-4 w-full max-w-3xl self-center">
                <Text className="font-display text-[32px] leading-[34px] text-pizca-marron" accessibilityRole="header">Planificar</Text>

                <View className="flex-row p-1 rounded-[16px] bg-pizca-crema" accessibilityRole="tablist">
                    {TABS.map(tab => {
                        const active = activeTab === tab.key;
                        return (
                            <TouchableOpacity
                                key={tab.key}
                                onPress={() => setActiveTab(tab.key)}
                                className={`flex-1 h-10 items-center justify-center rounded-[12px] ${active ? 'bg-white' : ''}`}
                                style={active ? { boxShadow: '0 1px 4px rgba(63,49,40,0.12)' } : undefined}
                                accessibilityRole="tab"
                                accessibilityState={{ selected: active }}
                            >
                                <Text className={`text-sm ${active ? 'font-extrabold text-pizca-marron' : 'font-bold text-pizca-texto2'}`}>{tab.label}</Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>
            </View>

            {/* Lo de abajo (guardar, agregar ítem, el chat) queda arriba de la barra flotante. */}
            <View className="flex-1 w-full max-w-3xl self-center" style={{ paddingBottom: tabBarSpace }}>
                {activeTab === 'week' && <WeekView onSwitchTab={setActiveTab} />}
                {activeTab === 'shopping' && <ShoppingView />}
                {activeTab === 'ideas' && <IdeasChat />}
            </View>
        </SafeAreaView>
    );
}

// ============================================================
// SEMANA
// ============================================================

function WeekView({ onSwitchTab }: { onSwitchTab: (tab: TabView) => void }) {
    const {
        weekStart, isLoadingPlans, isSaving, hasUnsavedChanges, serverPlans, draftSlots, removedIds,
        canGoBack, canGoForward, goToPreviousWeek, goToNextWeek,
        getPlansForDate, getMergedPlanForSlot, removeFromPlan,
        assignRecipe, savePlan, discardChanges, refreshPlans,
    } = usePlanner();

    // Al volver a la pestaña, traer el plan actualizado (recetas editadas o borradas desde el Inicio).
    // Si hay cambios sin guardar no se pisa nada.
    const unsavedRef = React.useRef(hasUnsavedChanges);
    unsavedRef.current = hasUnsavedChanges;
    const refreshRef = React.useRef(refreshPlans);
    refreshRef.current = refreshPlans;
    useFocusEffect(
        React.useCallback(() => {
            if (!unsavedRef.current) refreshRef.current();
        }, [])
    );

    const weekDays = useMemo(() => getWeekDays(weekStart), [weekStart]);
    const todayISO = getTodayISO();
    const [selectedDate, setSelectedDate] = useState(weekDays[0].date);
    const [pickerSlot, setPickerSlot] = useState<{ date: string; mealType: string } | null>(null);

    React.useEffect(() => {
        const days = getWeekDays(weekStart);
        const today = getTodayISO();
        setSelectedDate(days.find(d => d.date === today) ? today : days[0].date);
    }, [weekStart]);

    // Un reemplazo (borrar + agregar en el mismo lugar) cuenta como un solo cambio.
    const draftKeys = new Set(Object.keys(draftSlots));
    const changeCount = draftKeys.size + serverPlans.filter(
        p => removedIds.has(p.id) && !draftKeys.has(`${p.date}|${p.meal_type}`),
    ).length;

    const handleRemove = async (date: string, mealType: string, title: string) => {
        const ok = await confirmAction({
            title: 'Quitar del plan',
            message: `¿Sacamos "${title}" de este día?`,
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
                title: '¡Plan guardado!',
                message: '¿Querés ir a Compras para armar la lista?',
                confirmText: 'Ir a Compras',
                cancelText: 'Ahora no',
            });
            if (goShopping) onSwitchTab('shopping');
        } else {
            notify('Error', 'No pudimos guardar el plan. Probá de nuevo.');
        }
    };

    const isPastDay = selectedDate < todayISO;

    return (
        <View className="flex-1">
            <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 16, gap: 16, paddingBottom: hasUnsavedChanges ? 110 : 32 }} showsVerticalScrollIndicator={false}>
                {/* Semana */}
                <View className="flex-row items-center justify-between">
                    <WeekArrow dir="left" disabled={!canGoBack} onPress={goToPreviousWeek} />
                    <Text className="text-base font-extrabold text-pizca-marron">{formatWeekRange(weekStart)}</Text>
                    <WeekArrow dir="right" disabled={!canGoForward} onPress={goToNextWeek} />
                </View>

                {/* Días */}
                <View className="flex-row gap-1.5">
                    {weekDays.map(day => {
                        const isActive = day.date === selectedDate;
                        const hasPlans = getPlansForDate(day.date).length > 0;
                        const isPast = day.date < todayISO;
                        return (
                            <TouchableOpacity
                                key={day.date}
                                onPress={() => setSelectedDate(day.date)}
                                className={`flex-1 h-16 rounded-[14px] items-center justify-center gap-0.5 ${isActive ? 'bg-pizca-marron' : isPast ? '' : 'bg-white'}`}
                                accessibilityRole="button"
                                accessibilityState={{ selected: isActive }}
                                accessibilityLabel={`${formatDayTitle(day.date)}${hasPlans ? ', con comidas' : ''}`}
                            >
                                <Text className={`text-xs font-extrabold ${isActive ? 'text-pizca-fondo' : isPast ? 'text-pizca-apagado' : 'text-pizca-marron'}`}>{day.dayName}</Text>
                                <Text className={`text-[17px] font-extrabold ${isActive ? 'text-pizca-fondo' : isPast ? 'text-pizca-apagado' : 'text-pizca-marron'}`}>{day.dayNum}</Text>
                                <View className={`w-[5px] h-[5px] rounded-full ${hasPlans ? (isActive ? 'bg-pizca-ambar' : 'bg-pizca-mostaza') : ''}`} />
                            </TouchableOpacity>
                        );
                    })}
                </View>

                <Text className="text-lg font-extrabold text-pizca-marron mt-1">{formatDayTitle(selectedDate)}</Text>

                {/* Comidas */}
                {isLoadingPlans ? (
                    <View className="py-10 items-center"><ActivityIndicator size="large" color="#BE9F00" /></View>
                ) : (
                    <View className="gap-2.5">
                        {MEALS.map(meal => {
                            const plan = getMergedPlanForSlot(selectedDate, meal.key);
                            return (
                                <MealSlotCard
                                    key={meal.key}
                                    meal={meal}
                                    plan={plan}
                                    isPast={isPastDay}
                                    onAdd={() => setPickerSlot({ date: selectedDate, mealType: meal.key })}
                                    onRemove={() => handleRemove(selectedDate, meal.key, slotTitle(plan))}
                                />
                            );
                        })}
                    </View>
                )}
            </ScrollView>

            {/* Cambios sin guardar */}
            {hasUnsavedChanges && (
                <View
                    className="absolute left-3 right-3 bottom-3 pl-4 pr-2.5 py-2.5 rounded-[18px] bg-pizca-marron flex-row items-center gap-2"
                    style={{ boxShadow: '0 10px 24px rgba(63,49,40,0.25)' }}
                >
                    <Text className="flex-1 text-sm font-bold text-pizca-fondo">
                        {changeCount} {changeCount === 1 ? 'cambio sin guardar' : 'cambios sin guardar'}
                    </Text>
                    <TouchableOpacity onPress={discardChanges} className="h-10 px-3 justify-center" accessibilityRole="button">
                        <Text className="text-sm font-extrabold text-pizca-fondo">Descartar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={handleSave}
                        disabled={isSaving}
                        className="h-10 px-3.5 rounded-[12px] bg-pizca-ambar justify-center min-w-[110px] items-center"
                        accessibilityRole="button"
                    >
                        {isSaving
                            ? <ActivityIndicator size="small" color="#3F3128" />
                            : <Text className="text-sm font-extrabold text-pizca-marron">Guardar plan</Text>}
                    </TouchableOpacity>
                </View>
            )}

            <RecipePickerModal visible={!!pickerSlot} onClose={() => setPickerSlot(null)} onSelect={handleAssign} />
        </View>
    );
}

const WeekArrow = ({ dir, disabled, onPress }: { dir: 'left' | 'right'; disabled: boolean; onPress: () => void }) => {
    const Icon = dir === 'left' ? ChevronLeft : ChevronRight;
    return (
        <TouchableOpacity
            onPress={onPress}
            disabled={disabled}
            className={`w-11 h-11 rounded-full bg-white border border-pizca-linea items-center justify-center ${disabled ? 'opacity-40' : ''}`}
            accessibilityRole="button"
            accessibilityLabel={dir === 'left' ? 'Semana anterior' : 'Semana siguiente'}
            accessibilityState={{ disabled }}
        >
            <Icon size={20} color="#3F3128" strokeWidth={2.4} />
        </TouchableOpacity>
    );
};

// --- Tarjeta de comida ---

interface MealSlotProps {
    meal: typeof MEALS[number];
    plan: MealPlan | DraftSlot | undefined;
    isPast?: boolean;
    onAdd: () => void;
    onRemove: () => void;
}

function MealSlotCard({ meal, plan, isPast, onAdd, onRemove }: MealSlotProps) {
    const title = slotTitle(plan);
    const prepTime = slotPrepTime(plan);
    const draft = !!plan && isDraft(plan);
    const filled = !!plan && !!title;

    return (
        <View
            className={`flex-row items-center gap-3 p-3 rounded-[20px] bg-white ${draft ? 'border-2 border-pizca-mostaza' : 'border border-pizca-linea'} ${isPast && !filled ? 'opacity-60' : ''}`}
        >
            <View className="w-12 h-12 rounded-[14px] bg-pizca-crema items-center justify-center">
                <Image source={meal.icon} style={{ width: 30, height: 30 }} />
            </View>
            <View className="flex-1 gap-0.5">
                <Text className="text-xs font-extrabold text-pizca-texto2 uppercase tracking-wider">
                    {meal.label}{draft ? ' · nuevo' : ''}
                </Text>
                {filled ? (
                    <>
                        <Text className="text-[15px] font-extrabold text-pizca-marron" numberOfLines={2}>{title}</Text>
                        {prepTime ? <Text className="text-xs font-bold text-pizca-texto2">{prepTime} min</Text> : null}
                    </>
                ) : (
                    <Text className="text-[15px] text-pizca-texto2">{isPast ? 'Día pasado' : 'Sin planificar'}</Text>
                )}
            </View>
            {filled && !isPast ? (
                <TouchableOpacity onPress={onRemove} className="w-10 h-10 rounded-[12px] items-center justify-center" accessibilityLabel={`Quitar de ${meal.label.toLowerCase()}`}>
                    <X size={20} color="#3F3128" strokeWidth={2.2} />
                </TouchableOpacity>
            ) : null}
            {!filled && !isPast ? (
                <TouchableOpacity onPress={onAdd} className="h-10 px-3.5 rounded-[12px] bg-pizca-crema justify-center" accessibilityRole="button" accessibilityLabel={`Elegir ${meal.label.toLowerCase()}`}>
                    <Text className="text-sm font-extrabold text-pizca-marron">+ Elegir</Text>
                </TouchableOpacity>
            ) : null}
        </View>
    );
}

// ============================================================
// COMPRAS
// ============================================================

/** Anillo de progreso (ítems tachados / total). */
const ProgressRing = ({ done, total }: { done: number; total: number }) => {
    const size = 52, stroke = 7, r = (size - stroke) / 2, c = 2 * Math.PI * r;
    const pct = total ? done / total : 0;
    return (
        <View className="w-[52px] h-[52px] items-center justify-center">
            <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
                <Circle cx={size / 2} cy={size / 2} r={r} stroke="#FAECD2" strokeWidth={stroke} fill="none" />
                <Circle
                    cx={size / 2} cy={size / 2} r={r} stroke="#0C4B20" strokeWidth={stroke} fill="none"
                    strokeDasharray={`${c * pct} ${c}`} strokeLinecap={pct > 0 && pct < 1 ? 'round' : 'butt'}
                />
            </Svg>
            <Text className="text-xs font-extrabold text-pizca-marron">{done}/{total}</Text>
        </View>
    );
};

const sectionIcon = (category: string) =>
    /verdu|fruta/i.test(category) ? ICONS.ingredientes : ICONS.categorias;

function ShoppingView() {
    const {
        weekStart, shoppingList, isLoadingShoppingList, isGeneratingList, serverPlans,
        generateList, fetchShoppingList, toggleItem,
        addShoppingItem, editShoppingItem, removeShoppingItem,
    } = usePlanner();

    const [newItemName, setNewItemName] = useState('');
    const [expandedId, setExpandedId] = useState<number | null>(null);
    const [editValues, setEditValues] = useState({ ingredient_name: '', quantity: '' });
    const [originalValues, setOriginalValues] = useState({ ingredient_name: '', quantity: '' });
    const [deleteConfirming, setDeleteConfirming] = useState(false);

    // eslint-disable-next-line react-hooks/exhaustive-deps
    React.useEffect(() => { fetchShoppingList(); }, [weekStart]);

    const grouped = useMemo(() => {
        const map: Record<string, ShoppingListItem[]> = {};
        for (const item of shoppingList) {
            (map[item.category || OTHER_AISLE] ??= []).push(item);
        }
        // En el orden en que se recorre el súper; una góndola desconocida (datos viejos) va al final.
        const rank = (aisle: string) => {
            const i = (AISLES as readonly string[]).indexOf(aisle);
            return i === -1 ? AISLES.length : i;
        };
        return Object.entries(map).sort(([a], [b]) => rank(a) - rank(b));
    }, [shoppingList]);

    const checkedCount = shoppingList.filter(i => i.is_checked).length;
    const mealCount = serverPlans.filter(p => p.recipe_detail).length;

    const handleGenerate = async () => {
        if (shoppingList.length > 0) {
            const ok = await confirmAction({
                title: 'Regenerar lista',
                message: 'Se arma de nuevo a partir del plan de esta semana. Los ítems tachados se borran; lo que agregaste vos queda.',
                confirmText: 'Regenerar',
            });
            if (!ok) return;
        }
        try { await generateList(); }
        catch { notify('Error', 'No pudimos armar la lista.'); }
    };

    // El alta puede tardar (el backend le pregunta la góndola a la IA): un segundo toque no lo duplica.
    const addingRef = React.useRef(false);
    const handleAdd = async () => {
        const name = newItemName.trim();
        if (!name || addingRef.current) return;
        addingRef.current = true;
        try {
            await addShoppingItem(name, '');
            setNewItemName('');
        } catch { notify('Error', 'No pudimos agregar el ítem.'); }
        finally { addingRef.current = false; }
    };

    const collapseAndSave = async () => {
        if (expandedId === null) return;
        const id = expandedId;
        const values = { ...editValues };
        const hasChanges =
            values.ingredient_name.trim() !== originalValues.ingredient_name ||
            values.quantity.trim() !== originalValues.quantity;

        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setExpandedId(null);
        setDeleteConfirming(false);
        Keyboard.dismiss();
        if (!hasChanges || !values.ingredient_name.trim()) return;
        try {
            await editShoppingItem(id, { ingredient_name: values.ingredient_name.trim(), quantity: values.quantity.trim() });
        } catch {
            notify('Error', 'No pudimos guardar el cambio.');
        }
    };

    const moveToAisle = async (item: ShoppingListItem, category: string) => {
        if (category === item.category) return;
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        try {
            // El backend se acuerda: la próxima vez este ingrediente ya cae en esta góndola.
            await editShoppingItem(item.id, { category });
        } catch {
            notify('Error', 'No pudimos moverlo de góndola.');
        }
    };

    const expandItem = (item: ShoppingListItem) => {
        if (expandedId === item.id) return;
        if (expandedId !== null) collapseAndSave();
        const values = { ingredient_name: item.ingredient_name, quantity: item.quantity || '' };
        setEditValues(values);
        setOriginalValues(values);
        setDeleteConfirming(false);
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setExpandedId(item.id);
    };

    return (
        <View className="flex-1">
            <ScrollView
                contentContainerStyle={{ padding: 20, paddingTop: 16, gap: 16, paddingBottom: 96 }}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                onScrollBeginDrag={collapseAndSave}
            >
                {/* Resumen */}
                <View className="flex-row items-center gap-3.5 p-3.5 rounded-[20px] bg-white border border-pizca-linea">
                    {shoppingList.length ? <ProgressRing done={checkedCount} total={shoppingList.length} /> : (
                        <View className="w-[52px] h-[52px] rounded-full bg-pizca-crema items-center justify-center">
                            <Image source={ICONS.compras} style={{ width: 30, height: 30 }} />
                        </View>
                    )}
                    <View className="flex-1 gap-0.5">
                        <Text className="text-[15px] font-extrabold text-pizca-marron">{formatWeekShort(weekStart)}</Text>
                        <Text className="text-[13px] text-pizca-texto2">
                            {mealCount
                                ? `Sale de ${mealCount === 1 ? 'la comida' : `las ${mealCount} comidas`} de tu plan`
                                : 'Todavía no hay comidas en el plan'}
                        </Text>
                    </View>
                    {shoppingList.length ? (
                        <TouchableOpacity
                            onPress={handleGenerate}
                            disabled={isGeneratingList}
                            className="w-11 h-11 rounded-[12px] bg-pizca-crema items-center justify-center"
                            accessibilityRole="button"
                            accessibilityLabel="Regenerar lista"
                        >
                            {isGeneratingList ? <ActivityIndicator size="small" color="#3F3128" /> : <RefreshCw size={20} color="#3F3128" strokeWidth={2.2} />}
                        </TouchableOpacity>
                    ) : null}
                </View>

                {isLoadingShoppingList ? (
                    <View className="py-10 items-center"><ActivityIndicator size="large" color="#BE9F00" /></View>
                ) : shoppingList.length === 0 ? (
                    <View className="items-center px-6 py-8 gap-2">
                        <Image source={ILLUSTRATIONS.morron} style={{ width: 64, height: 68, marginBottom: 8 }} resizeMode="contain" />
                        <Text className="text-xl font-extrabold text-pizca-marron text-center">Tu lista está vacía</Text>
                        <Text className="text-[15px] text-pizca-texto2 text-center mb-3">
                            Armala con los ingredientes de las comidas de la semana, o agregá cosas abajo.
                        </Text>
                        <Button title="Armar la lista" onPress={handleGenerate} loading={isGeneratingList} disabled={!mealCount} />
                    </View>
                ) : (
                    <View className="gap-3.5">
                        {grouped.map(([category, items]) => (
                            <View key={category} className="gap-1.5">
                                <View className="flex-row items-center gap-2">
                                    <Image source={sectionIcon(category)} style={{ width: 18, height: 18 }} />
                                    <Text className="text-[13px] font-extrabold tracking-wider uppercase text-pizca-texto2">{category}</Text>
                                </View>
                                <View className="bg-white rounded-[18px] px-3.5 py-1">
                                    {items.map((item, idx) => {
                                        const isExpanded = expandedId === item.id;
                                        const last = idx === items.length - 1;
                                        return (
                                            <View key={item.id} className={last ? '' : 'border-b border-[#F3EAD8]'}>
                                                <TouchableOpacity
                                                    className="min-h-[46px] flex-row items-center gap-3"
                                                    onPress={() => expandItem(item)}
                                                    activeOpacity={0.7}
                                                    accessibilityHint="Tocá para editar"
                                                >
                                                    <TouchableOpacity
                                                        onPress={() => toggleItem(item.id, !item.is_checked)}
                                                        hitSlop={10}
                                                        accessibilityRole="checkbox"
                                                        accessibilityState={{ checked: item.is_checked }}
                                                        accessibilityLabel={item.ingredient_name}
                                                    >
                                                        {item.is_checked ? (
                                                            <View className="w-[22px] h-[22px] rounded-[7px] bg-pizca-albahaca items-center justify-center">
                                                                <Check size={14} color="#FFFFFF" strokeWidth={3.2} />
                                                            </View>
                                                        ) : (
                                                            <View className="w-[22px] h-[22px] rounded-[7px] border-[1.5px] border-pizca-marron" />
                                                        )}
                                                    </TouchableOpacity>
                                                    <Text className={`flex-1 text-[15px] ${item.is_checked ? 'text-pizca-apagado line-through' : 'text-pizca-marron'}`}>
                                                        {item.ingredient_name}
                                                    </Text>
                                                    {item.quantity ? (
                                                        <Text className={`text-sm ${item.is_checked ? 'text-pizca-apagado' : 'font-extrabold text-pizca-marron'}`}>{item.quantity}</Text>
                                                    ) : null}
                                                </TouchableOpacity>

                                                {isExpanded && (
                                                    <View className="pb-3 gap-2">
                                                        <View className="flex-row gap-2">
                                                            <TextInput
                                                                className="flex-[2] h-11 px-3 rounded-[12px] bg-pizca-crema text-pizca-marron text-[15px]"
                                                                value={editValues.ingredient_name}
                                                                onChangeText={text => setEditValues(v => ({ ...v, ingredient_name: text }))}
                                                                placeholder="Nombre"
                                                                placeholderTextColor="#8C7E70"
                                                                accessibilityLabel="Nombre"
                                                            />
                                                            <TextInput
                                                                className="flex-1 h-11 px-3 rounded-[12px] bg-pizca-crema text-pizca-marron text-[15px]"
                                                                value={editValues.quantity}
                                                                onChangeText={text => setEditValues(v => ({ ...v, quantity: text }))}
                                                                placeholder="Cant."
                                                                placeholderTextColor="#8C7E70"
                                                                accessibilityLabel="Cantidad"
                                                            />
                                                        </View>
                                                        <View className="gap-1.5">
                                                            <Text className="text-xs font-extrabold text-pizca-texto2">Góndola</Text>
                                                            <ScrollView
                                                                horizontal
                                                                showsHorizontalScrollIndicator={false}
                                                                keyboardShouldPersistTaps="handled"
                                                                contentContainerStyle={{ gap: 6 }}
                                                                accessibilityRole="radiogroup"
                                                                accessibilityLabel="Góndola"
                                                            >
                                                                {AISLES.map(aisle => {
                                                                    const selected = (item.category || OTHER_AISLE) === aisle;
                                                                    return (
                                                                        <TouchableOpacity
                                                                            key={aisle}
                                                                            onPress={() => moveToAisle(item, aisle)}
                                                                            className={`h-8 px-3 rounded-full justify-center ${selected ? 'bg-pizca-marron' : 'bg-pizca-crema'}`}
                                                                            accessibilityRole="radio"
                                                                            accessibilityState={{ checked: selected }}
                                                                        >
                                                                            <Text className={`text-[13px] font-bold ${selected ? 'text-pizca-fondo' : 'text-pizca-marron'}`}>{aisle}</Text>
                                                                        </TouchableOpacity>
                                                                    );
                                                                })}
                                                            </ScrollView>
                                                        </View>
                                                        <View className="flex-row justify-between items-center">
                                                            <TouchableOpacity
                                                                className={`flex-row items-center gap-1.5 h-9 px-3 rounded-[10px] ${deleteConfirming ? 'bg-pizca-tomate-texto' : 'bg-[#FFF1EB]'}`}
                                                                onPress={() => {
                                                                    if (deleteConfirming) {
                                                                        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                                                                        setExpandedId(null);
                                                                        setDeleteConfirming(false);
                                                                        removeShoppingItem(item.id).catch(() => notify('Error', 'No pudimos borrar el ítem.'));
                                                                    } else {
                                                                        setDeleteConfirming(true);
                                                                        setTimeout(() => setDeleteConfirming(false), 2500);
                                                                    }
                                                                }}
                                                            >
                                                                <Trash2 size={15} color={deleteConfirming ? '#FFFFFF' : '#B23A12'} />
                                                                <Text className={`text-[13px] font-extrabold ${deleteConfirming ? 'text-white' : 'text-pizca-tomate-texto'}`}>
                                                                    {deleteConfirming ? '¿Seguro?' : 'Borrar'}
                                                                </Text>
                                                            </TouchableOpacity>
                                                            <TouchableOpacity onPress={collapseAndSave} className="h-9 px-3.5 rounded-[10px] bg-pizca-mostaza justify-center">
                                                                <Text className="text-[13px] font-extrabold text-pizca-marron">Listo</Text>
                                                            </TouchableOpacity>
                                                        </View>
                                                    </View>
                                                )}
                                            </View>
                                        );
                                    })}
                                </View>
                            </View>
                        ))}
                    </View>
                )}
            </ScrollView>

            {/* Agregar ítem */}
            <View className="absolute left-4 right-4 bottom-1 flex-row gap-2">
                <View
                    className="flex-1 h-[52px] flex-row items-center px-3.5 rounded-[16px] bg-white border-[1.5px] border-pizca-linea"
                    style={{ boxShadow: '0 6px 16px rgba(63,49,40,0.08)' }}
                >
                    <TextInput
                        className="flex-1 h-full text-[15px] text-pizca-marron"
                        placeholder="Agregar algo más a la lista"
                        placeholderTextColor="#8C7E70"
                        value={newItemName}
                        onChangeText={setNewItemName}
                        onSubmitEditing={handleAdd}
                        returnKeyType="done"
                        accessibilityLabel="Agregar algo más a la lista"
                    />
                </View>
                <TouchableOpacity
                    onPress={handleAdd}
                    disabled={!newItemName.trim()}
                    className={`w-[52px] h-[52px] rounded-[16px] items-center justify-center ${newItemName.trim() ? 'bg-pizca-mostaza' : 'bg-pizca-linea'}`}
                    accessibilityRole="button"
                    accessibilityLabel="Agregar a la lista"
                >
                    <Plus size={24} color={newItemName.trim() ? '#3F3128' : '#8C7E70'} strokeWidth={2.6} />
                </TouchableOpacity>
            </View>
        </View>
    );
}
