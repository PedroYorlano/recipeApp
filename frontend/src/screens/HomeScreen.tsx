import React, { useCallback, useState } from 'react';
import { View, FlatList, ActivityIndicator, TouchableOpacity, ScrollView, StatusBar as RNStatusBar, Image, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { Text, TextInput } from '../components/ui/Typography';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp } from '../context/AppContext';
import { RecipeCard } from '../components/recipes/RecipeCard';
import { RecipeDetailModal } from '../components/recipes/RecipeDetailModal';
import { LoginScreen } from './LoginScreen';
import { Recipe } from '../types';
import { Search, X, ChevronRight } from 'lucide-react-native';
import { usePlanner } from '../context/PlannerContext';
import { getTodayISO } from '../utils/dates';
import { ICONS, ILLUSTRATIONS, ISOLOGO } from '../constants/brand';
import { Button } from '../components/ui/Button';
import { notify, confirmAction } from '../utils/dialogs';
import { useTabBarSpace } from '../components/FloatingTabBar';

export default function HomeScreen() {
    const tabBarSpace = useTabBarSpace();
    const {
        recipes,
        categories,
        selectedCategory,
        setSelectedCategory,
        searchQuery,
        setSearchQuery,
        showFavorites,
        setShowFavorites,
        loading,
        loadingMore,
        hasMore,
        fetchMoreRecipes,
        isAuthenticated,
        isAuthLoading,
        setEditingRecipe,
        setFormModalVisible,
        deleteRecipe,
        setCreateMenuVisible,
        toggleFavorite,
        user,
    } = useApp();
    const { getPlansForDate } = usePlanner();
    const router = useRouter();

    const [selectedRecipeSnapshot, setSelectedRecipe] = useState<Recipe | null>(null);
    // Siempre mostramos la versión de la lista: así el corazón, la edición, etc. se reflejan en el detalle.
    const selectedRecipe = selectedRecipeSnapshot
        ? recipes.find(r => r.id === selectedRecipeSnapshot.id) ?? selectedRecipeSnapshot
        : null;

    const { width } = useWindowDimensions();
    // Determinamos número de columnas dinámico según ancho de pantalla (para web/tablets)
    const getNumColumns = () => {
        if (width >= 1536) return 6;
        if (width >= 1280) return 5;
        if (width >= 1024) return 4;
        if (width >= 768) return 3;
        return 2;
    };
    const numCols = getNumColumns();

    // Calculamos el ancho máximo que debería tener la tarjeta para no estirarse cuando hay 1 solo resultado.
    // paddingHorizontal 20 a cada lado. Gap de 14 entre columnas.
    const cardMaxWidth = (Math.min(width, 1280) - 40 - ((numCols - 1) * 14)) / numCols;

    const renderItem = useCallback(
        ({ item }: { item: Recipe }) => (
            <RecipeCard item={item} onPress={setSelectedRecipe} onToggleFavorite={toggleFavorite} maxWidth={cardMaxWidth} />
        ),
        [toggleFavorite, cardMaxWidth],
    );

    if (isAuthLoading) return (
        <View className="flex-1 justify-center items-center bg-pizca-fondo">
            <ActivityIndicator size="large" color="#BE9F00" />
        </View>
    );

    if (!isAuthenticated) return <LoginScreen />;

    const handleFavoritesToggle = () => {
        if (showFavorites) {
            setShowFavorites(false);
        } else {
            setShowFavorites(true);
            setSelectedCategory(null); // Deseleccionar categoría al filtrar por favoritos
        }
    };

    const handleCategorySelect = (catId: number | null) => {
        setSelectedCategory(catId);
        setShowFavorites(false); // Deseleccionar favoritos al filtrar por categoría
    };

    // Comida de hoy en el plan: la próxima según la hora (desayuno, almuerzo o cena).
    const todayPlans = getPlansForDate(getTodayISO());
    const hour = new Date().getHours();
    const mealOrder = hour < 11 ? ['breakfast', 'lunch', 'dinner'] : hour < 16 ? ['lunch', 'dinner'] : ['dinner'];
    const nextMealType = mealOrder.find(t => todayPlans.some(p => p.meal_type === t));
    const nextMeal = nextMealType ? todayPlans.find(p => p.meal_type === nextMealType) : undefined;
    const nextMealTitle = nextMeal && ('recipeTitle' in nextMeal ? nextMeal.recipeTitle : nextMeal.recipe_detail?.title);
    const MEAL_LABEL: Record<string, string> = { breakfast: 'Hoy en el desayuno', lunch: 'Hoy al mediodía', dinner: 'Hoy a la noche' };
    const MEAL_ICON: Record<string, any> = { breakfast: ICONS.desayuno, lunch: ICONS.almuerzo, dinner: ICONS.cena };

    const chip = (key: string, label: string, active: boolean, onPress: () => void, icon?: React.ReactNode) => (
        <TouchableOpacity
            key={key}
            onPress={onPress}
            className={`h-9 px-4 mr-2 rounded-full flex-row items-center ${active ? 'bg-pizca-marron' : 'bg-pizca-crema'}`}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
        >
            {icon}
            <Text className={`text-sm ${active ? 'font-extrabold text-pizca-fondo' : 'font-bold text-pizca-marron'}`}>{label}</Text>
        </TouchableOpacity>
    );

    const initial = (user?.username || '?').charAt(0).toUpperCase();

    const header = (
        <View className="pt-4 pb-4 gap-4">
            {/* Encabezado */}
            <View className="flex-row items-center justify-between">
                <View className="gap-0.5 flex-1">
                    <View className="flex-row items-center gap-1.5">
                        <Image source={ISOLOGO} style={{ height: 22, width: 27 }} resizeMode="contain" />
                        <Text className="font-display text-xl text-pizca-mostaza leading-[22px]">PIZCA</Text>
                    </View>
                    <Text className="font-display text-[30px] text-pizca-marron mt-1.5 leading-[34px]" numberOfLines={1}>
                        ¡Hola{user?.username ? `, ${user.username}` : ''}!
                    </Text>
                    <Text className="text-[15px] text-pizca-texto2">¿Qué cocinamos hoy?</Text>
                </View>
                <TouchableOpacity
                    onPress={() => router.push('/(tabs)/settings')}
                    className="w-12 h-12 rounded-full bg-pizca-crema items-center justify-center"
                    accessibilityRole="button"
                    accessibilityLabel="Perfil"
                >
                    <Text className="font-extrabold text-lg text-pizca-marron">{initial}</Text>
                </TouchableOpacity>
            </View>

            {/* Buscador */}
            <View className="flex-row items-center gap-2.5 bg-white rounded-[16px] px-4 h-[52px] border border-pizca-linea">
                <Search size={20} color="#6B5A4E" strokeWidth={2.2} />
                <TextInput
                    className="flex-1 text-pizca-marron text-[15px] h-full"
                    placeholder="Buscá por nombre o ingrediente"
                    placeholderTextColor="#8C7E70"
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    accessibilityLabel="Buscar recetas"
                />
                {searchQuery.length > 0 && (
                    <TouchableOpacity onPress={() => setSearchQuery('')} className="p-1" accessibilityLabel="Borrar búsqueda">
                        <X size={18} color="#6B5A4E" />
                    </TouchableOpacity>
                )}
            </View>

            {/* Lo que toca hoy según el plan */}
            {nextMealTitle && nextMealType ? (
                <TouchableOpacity
                    onPress={() => router.push('/(tabs)/planner')}
                    className="flex-row items-center gap-3 px-3.5 py-3 rounded-[18px] bg-pizca-albahaca"
                    accessibilityRole="button"
                >
                    <View className="w-11 h-11 rounded-[12px] bg-pizca-fondo items-center justify-center">
                        <Image source={MEAL_ICON[nextMealType]} style={{ width: 28, height: 28 }} />
                    </View>
                    <View className="flex-1 gap-0.5">
                        <Text className="text-xs font-extrabold text-[#CFE0CC] uppercase tracking-wider">{MEAL_LABEL[nextMealType]}</Text>
                        <Text className="text-base font-extrabold text-white" numberOfLines={1}>{nextMealTitle}</Text>
                    </View>
                    <ChevronRight size={20} color="#FFFFFF" strokeWidth={2.4} />
                </TouchableOpacity>
            ) : null}

            {/* Filtros */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mr-5" contentContainerStyle={{ paddingRight: 20 }}>
                {chip('all', 'Todas', selectedCategory === null && !showFavorites, () => handleCategorySelect(null))}
                {chip('fav', 'Favoritas', showFavorites, handleFavoritesToggle,
                    <Image source={ICONS.favoritos} style={{ width: 15, height: 15, marginRight: 6 }} />)}
                {categories.map(cat => chip(String(cat.id), cat.name, selectedCategory === cat.id, () => handleCategorySelect(cat.id)))}
            </ScrollView>

            <View className="flex-row items-baseline justify-between">
                <Text className="text-[19px] font-extrabold text-pizca-marron">{showFavorites ? 'Tus favoritas' : 'Tus recetas'}</Text>
                {!loading && !hasMore && recipes.length > 0 ? (
                    <Text className="text-[13px] font-bold text-pizca-texto2">
                        {recipes.length} {recipes.length === 1 ? 'guardada' : 'guardadas'}
                    </Text>
                ) : null}
            </View>
        </View>
    );

    return (
        <SafeAreaView className="flex-1 bg-pizca-fondo" edges={['top']}>
            <RNStatusBar barStyle="dark-content" backgroundColor="#FFF9EC" />

            <FlatList
                data={loading ? [] : recipes}
                key={numCols}
                numColumns={numCols}
                keyExtractor={(item) => item.id?.toString() || item.uuid}
                ListHeaderComponent={header}
                contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: tabBarSpace + 8, maxWidth: 1280, width: '100%', alignSelf: 'center' }}
                columnWrapperStyle={numCols > 1 ? { gap: 14 } : undefined}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                onEndReached={fetchMoreRecipes}
                onEndReachedThreshold={0.5}
                renderItem={renderItem}
                ListFooterComponent={
                    loadingMore ? (
                        <View className="py-4 items-center">
                            <ActivityIndicator size="small" color="#BE9F00" />
                        </View>
                    ) : null
                }
                ListEmptyComponent={
                    loading ? (
                        <View className="py-16 items-center">
                            <ActivityIndicator size="large" color="#BE9F00" />
                        </View>
                    ) : (
                        <View className="items-center mt-10 px-8 gap-2">
                            <Image
                                source={showFavorites ? ICONS.favoritos : ILLUSTRATIONS.zanahoria}
                                style={{ width: 72, height: 72, marginBottom: 8 }}
                                resizeMode="contain"
                            />
                            <Text className="text-xl font-extrabold text-pizca-marron text-center">
                                {showFavorites
                                    ? 'Todavía no tenés favoritas'
                                    : searchQuery
                                        ? 'No encontramos recetas'
                                        : 'Tu recetario está vacío'}
                            </Text>
                            <Text className="text-[15px] text-pizca-texto2 text-center">
                                {showFavorites
                                    ? 'Tocá el corazón de una receta para tenerla a mano.'
                                    : searchQuery
                                        ? 'Probá con otro nombre o ingrediente.'
                                        : 'Agregá tu primera receta con el botón +.'}
                            </Text>
                            {!showFavorites && !searchQuery ? (
                                <Button title="Agregar receta" className="mt-4" onPress={() => setCreateMenuVisible(true)} />
                            ) : null}
                        </View>
                    )
                }
            />

            {/* MODAL DE DETALLE */}
            <RecipeDetailModal
                visible={!!selectedRecipe}
                recipe={selectedRecipe}
                onClose={() => setSelectedRecipe(null)}
                onEdit={() => {
                    setSelectedRecipe(null);
                    setEditingRecipe(selectedRecipe);
                    setFormModalVisible(true);
                }}
                onDelete={async () => {
                    if (!selectedRecipe?.id) return;
                    const ok = await confirmAction({
                        title: 'Borrar receta',
                        message: `¿Borramos "${selectedRecipe.title}"? No se puede deshacer.`,
                        confirmText: 'Borrar',
                        destructive: true,
                    });
                    if (!ok) return;
                    try {
                        await deleteRecipe(selectedRecipe.id);
                        setSelectedRecipe(null);
                    } catch {
                        notify('Error', 'No pudimos borrar la receta.');
                    }
                }}
            />
        </SafeAreaView>
    );
}