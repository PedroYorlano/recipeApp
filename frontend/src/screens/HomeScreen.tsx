import React, { useState } from 'react';
import { View, FlatList, ActivityIndicator, Text, StyleSheet, TouchableOpacity, ScrollView, StatusBar as RNStatusBar, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp } from '../context/AppContext';
import { RecipeCard } from '../components/recipes/RecipeCard';
import { RecipeDetailModal } from '../components/recipes/RecipeDetailModal';
import { LoginScreen } from './LoginScreen';
import { Recipe } from '../types';

// IMPORTAMOS EL TEMA
import { COLORS, SPACING, RADIUS, globalStyles } from '../theme';

export default function HomeScreen() {
    const {
        recipes,
        categories,
        selectedCategory,
        setSelectedCategory,
        searchQuery,
        setSearchQuery,
        loading,
        isAuthenticated,
        isAuthLoading,
        setEditingRecipe,
        setFormModalVisible,
        deleteRecipe
    } = useApp();

    const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);

    // AUTH CHECKS RESTORED
    if (isAuthLoading) return (
        <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
    );

    if (!isAuthenticated) return <LoginScreen />;

    // Componente interno para Categorías (Chips)
    const renderCategoryItem = (category: any) => {
        const isAll = category === null;
        const isActive = isAll ? selectedCategory === null : selectedCategory === category.id;

        return (
            <TouchableOpacity
                key={isAll ? 'all' : category.id}
                style={[
                    styles.categoryChip,
                    isActive && styles.categoryChipActive // Estilo condicional
                ]}
                onPress={() => setSelectedCategory(isAll ? null : category.id)}
            >
                <Text style={[
                    styles.categoryText,
                    isActive && styles.categoryTextActive
                ]}>
                    {isAll ? 'Todas' : category.name}
                </Text>
            </TouchableOpacity>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <RNStatusBar barStyle="dark-content" backgroundColor={COLORS.card} />

            {/* 1. HEADER Y BÚSQUEDA */}
            <View style={styles.header}>
                <View style={styles.headerTitleContainer}>
                    <Text style={styles.greeting}>Hola, Chef 👋</Text>
                    <Text style={styles.title}>¿Qué cocinamos hoy?</Text>
                </View>
                
                <View style={styles.searchContainer}>
                    <Text style={styles.searchIcon}>🔍</Text>
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Buscar por nombre..."
                        placeholderTextColor={COLORS.text.secondary}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                    {searchQuery.length > 0 && (
                        <TouchableOpacity onPress={() => setSearchQuery('')}>
                            <Text style={styles.clearSearchText}>✕</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            {/* 2. FILTROS DE CATEGORÍA */}
            <View style={styles.categoriesWrapper}>
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.categoriesContent}
                >
                    {renderCategoryItem(null)}
                    {categories.map((cat) => renderCategoryItem(cat))}
                </ScrollView>
            </View>

            {/* 3. LISTA DE RECETAS */}
            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={COLORS.primary} />
                </View>
            ) : (
                <FlatList
                    data={recipes}
                    key={2}
                    numColumns={2}
                    keyExtractor={(item) => item.id?.toString() || Math.random().toString()}
                    contentContainerStyle={styles.listContent}
                    columnWrapperStyle={styles.columnWrapper}
                    showsVerticalScrollIndicator={false}
                    renderItem={({ item }) => (
                        <RecipeCard
                            item={item}
                            onPress={(recipe) => setSelectedRecipe(recipe)}
                        />
                    )}
                    ListEmptyComponent={
                        <View style={styles.emptyState}>
                            <Text style={{ fontSize: 40 }}>🍳</Text>
                            <Text style={styles.emptyText}>No hay recetas aquí.</Text>
                            <Text style={styles.emptySubtext}>Intenta con otra categoría.</Text>
                        </View>
                    }
                />
            )}

            {/* MODAL DE DETALLE (Mantenemos la lógica igual) */}
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

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background // Gris suave profesional
    },

    // Header
    header: {
        paddingHorizontal: SPACING.l,
        paddingVertical: SPACING.m,
        backgroundColor: COLORS.card,
        borderBottomWidth: 1,
        borderColor: 'transparent',
    },
    headerTitleContainer: {
        marginBottom: SPACING.m,
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.background,
        borderRadius: RADIUS.m,
        paddingHorizontal: SPACING.m,
        paddingVertical: 8,
    },
    searchIcon: {
        marginRight: 8,
        fontSize: 16,
    },
    searchInput: {
        flex: 1,
        fontSize: 15,
        color: COLORS.text.primary,
        paddingVertical: 4,
    },
    clearSearchText: {
        color: COLORS.text.secondary,
        fontSize: 16,
        padding: 4,
        fontWeight: 'bold',
    },
    greeting: {
        fontSize: 14,
        color: COLORS.text.secondary,
        fontWeight: '600',
        marginBottom: 4
    },
    title: {
        fontSize: 26,
        fontWeight: '800',
        color: COLORS.text.primary,
        letterSpacing: -0.5
    },

    // Categorías
    categoriesWrapper: {
        paddingVertical: SPACING.m,
    },
    categoriesContent: {
        paddingHorizontal: SPACING.l,
    },
    categoryChip: {
        paddingHorizontal: SPACING.m,
        paddingVertical: 8,
        backgroundColor: COLORS.card,
        borderRadius: RADIUS.xl, // Completamente redondo
        marginRight: SPACING.s,
        borderWidth: 1,
        borderColor: COLORS.border,
        // Sombra suave
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 2,
    },
    categoryChipActive: {
        backgroundColor: COLORS.primary, // Azul Activo
        borderColor: COLORS.primary,
    },
    categoryText: {
        fontSize: 14,
        fontWeight: '600',
        color: COLORS.text.secondary,
    },
    categoryTextActive: {
        color: COLORS.text.light, // Blanco
    },

    // Lista
    listContent: {
        paddingHorizontal: SPACING.l,
        paddingBottom: 100,
        paddingTop: SPACING.l,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center'
    },
    columnWrapper: {
        justifyContent: 'space-between',
        gap: SPACING.m,
    },

    // Empty State
    emptyState: {
        alignItems: 'center',
        marginTop: 50,
        opacity: 0.6
    },
    emptyText: {
        fontSize: 18,
        fontWeight: 'bold',
        color: COLORS.text.primary,
        marginTop: SPACING.m
    },
    emptySubtext: {
        fontSize: 14,
        color: COLORS.text.secondary
    }
});