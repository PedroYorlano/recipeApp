import React, { useState, useCallback } from 'react';
import { View, FlatList, ActivityIndicator, Text, TouchableOpacity, ScrollView, StatusBar as RNStatusBar, TextInput, Image, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp } from '../context/AppContext';
import { RecipeCard } from '../components/recipes/RecipeCard';
import { RecipeDetailModal } from '../components/recipes/RecipeDetailModal';
import { LoginScreen } from './LoginScreen';
import { Recipe } from '../types';
import { Search, X, UtensilsCrossed, Heart } from 'lucide-react-native';

export default function HomeScreen() {
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
        setCreateMenuVisible
    } = useApp();

    const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);

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
    // paddingHorizontal 24 a cada lado = 48 total. Gap de 16 entre columnas.
    const cardMaxWidth = (width - 48 - ((numCols - 1) * 16)) / numCols;

    if (isAuthLoading) return (
        <View className="flex-1 justify-center items-center bg-fogon-cream">
            <ActivityIndicator size="large" color="#EF9F27" />
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

    const renderCategoryItem = (category: any) => {
        const isAll = category === null;
        const isActive = isAll 
            ? selectedCategory === null && !showFavorites 
            : selectedCategory === category.id;

        return (
            <TouchableOpacity
                key={isAll ? 'all' : category.id}
                className={`px-5 py-2 mr-3 rounded-full border ${isActive ? 'bg-fogon-amber border-fogon-amber' : 'bg-fogon-white border-fogon-gray/30'} shadow-sm flex-row items-center`}
                onPress={() => handleCategorySelect(isAll ? null : category.id)}
            >
                <Text className={`font-semibold ${isActive ? 'text-fogon-brown' : 'text-fogon-gray'}`}>
                    {isAll ? 'Todas' : category.name}
                </Text>
            </TouchableOpacity>
        );
    };

    return (
        <SafeAreaView className="flex-1 bg-fogon-cream">
            <RNStatusBar barStyle="dark-content" backgroundColor="#FAEEDA" />

            {/* 1. HEADER FIJO */}
            <View className="px-6 py-4 bg-fogon-cream z-10 border-b border-fogon-gray/10">
                <View className="flex-row justify-between items-center mb-4">
                    <Text className="text-[32px] font-bold text-fogon-brown tracking-tight">Fogón</Text>
                    {/* Placeholder Avatar */}
                    <View className="w-10 h-10 rounded-full bg-fogon-amber/20 items-center justify-center border border-fogon-amber overflow-hidden">
                        <Text className="text-xl">👨‍🍳</Text>
                    </View>
                </View>
                
                {/* BARRA DE BÚSQUEDA */}
                <View className="flex-row items-center bg-fogon-white rounded-[12px] px-4 min-h-[48px] shadow-sm border border-fogon-gray/20">
                    <Search size={20} color="#A89070" className="mr-2" />
                    <TextInput
                        className="flex-1 text-fogon-brown text-base"
                        placeholder="¿Qué se te antoja hoy?"
                        placeholderTextColor="#A89070"
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                    {searchQuery.length > 0 && (
                        <TouchableOpacity onPress={() => setSearchQuery('')} className="p-1">
                            <X size={18} color="#A89070" />
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            {/* 2. FILTROS DE CATEGORÍA + FAVORITOS */}
            <View className="py-4">
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ paddingHorizontal: 24 }}
                >
                    {/* Pill de Favoritos */}
                    <TouchableOpacity
                        className={`px-5 py-2 mr-3 rounded-full border flex-row items-center ${showFavorites ? 'bg-red-50 border-red-300' : 'bg-fogon-white border-fogon-gray/30'} shadow-sm`}
                        onPress={handleFavoritesToggle}
                    >
                        <Heart size={14} color={showFavorites ? "#EF4444" : "#A89070"} fill={showFavorites ? "#EF4444" : "none"} />
                        <Text className={`font-semibold ml-1.5 ${showFavorites ? 'text-red-500' : 'text-fogon-gray'}`}>
                            Favoritos
                        </Text>
                    </TouchableOpacity>

                    {renderCategoryItem(null)}
                    {categories.map((cat) => renderCategoryItem(cat))}
                </ScrollView>
            </View>

            {/* 3. LISTA DE RECETAS */}
            {loading ? (
                <View className="flex-1 justify-center items-center">
                    <ActivityIndicator size="large" color="#EF9F27" />
                </View>
            ) : (
                <FlatList
                    data={recipes}
                    key={numCols} // key change re-renders list correctly when numCols changes
                    numColumns={numCols}
                    keyExtractor={(item) => item.id?.toString() || Math.random().toString()}
                    contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 120 }}
                    columnWrapperStyle={{ justifyContent: 'flex-start', gap: 16 }}
                    showsVerticalScrollIndicator={false}
                    onEndReached={fetchMoreRecipes}
                    onEndReachedThreshold={0.5}
                    renderItem={({ item }) => (
                        <RecipeCard
                            item={item}
                            onPress={(recipe) => setSelectedRecipe(recipe)}
                            maxWidth={cardMaxWidth}
                        />
                    )}
                    ListFooterComponent={
                        loadingMore ? (
                            <View className="py-4 items-center">
                                <ActivityIndicator size="small" color="#EF9F27" />
                            </View>
                        ) : null
                    }
                    ListEmptyComponent={
                        <View className="items-center mt-20 opacity-80 px-8">
                            <View className="bg-fogon-white/50 p-6 rounded-full border border-fogon-amber/20 mb-6">
                                {showFavorites ? (
                                    <Heart size={48} color="#EF4444" strokeWidth={1} />
                                ) : (
                                    <UtensilsCrossed size={48} color="#EF9F27" strokeWidth={1} />
                                )}
                            </View>
                            <Text className="text-xl font-bold text-fogon-brown text-center mb-2">
                                {showFavorites 
                                    ? 'Aún no tenés favoritos.' 
                                    : 'Tu recetario está vacío por ahora.'}
                            </Text>
                            <Text className="text-base text-fogon-gray items-center text-center">
                                {showFavorites
                                    ? 'Marcá recetas con el ❤️ para encontrarlas rápido.'
                                    : '¡Animate y agregá tu primera receta al fogón!'}
                            </Text>
                        </View>
                    }
                />
            )}



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
                onDelete={() => {
                    if (selectedRecipe?.id) {
                        deleteRecipe(selectedRecipe.id);
                        setSelectedRecipe(null);
                    }
                }}
            />
        </SafeAreaView>
    );
}