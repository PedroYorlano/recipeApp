import React, { useState, useEffect, useRef } from 'react';
import {
    View, Text, Modal, TouchableOpacity, FlatList,
    TextInput, ActivityIndicator, StyleSheet, Pressable,
} from 'react-native';
import { Image } from 'expo-image';
import { getRecipesService } from '../../services/api';
import { COLORS, SPACING, RADIUS } from '../../theme';
import { getRecipeImage } from '../../utils';
import { Recipe } from '../../types';
import { Search, X, UtensilsCrossed } from 'lucide-react-native';

interface Props {
    visible: boolean;
    onClose: () => void;
    onSelect: (recipe: Recipe) => void;
}

export function RecipePickerModal({ visible, onClose, onSelect }: Props) {
    // Lista propia: la del Inicio depende de sus filtros (categoría, favoritos) y está paginada.
    const [search, setSearch] = useState('');
    const [recipes, setRecipes] = useState<Recipe[]>([]);
    const [nextCursor, setNextCursor] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const requestId = useRef(0);

    useEffect(() => {
        if (!visible) return;
        const id = ++requestId.current;
        const timer = setTimeout(async () => {
            setLoading(true);
            try {
                const data = await getRecipesService(null, search.trim() || undefined);
                if (id !== requestId.current) return; // llegó tarde, hay una búsqueda más nueva
                setRecipes(data.results);
                setNextCursor(data.next);
            } catch {
                if (id === requestId.current) setRecipes([]);
            } finally {
                if (id === requestId.current) setLoading(false);
            }
        }, search ? 300 : 0);
        return () => clearTimeout(timer);
    }, [visible, search]);

    const loadMore = async () => {
        if (!nextCursor || loadingMore || loading) return;
        setLoadingMore(true);
        try {
            const data = await getRecipesService(null, undefined, undefined, nextCursor);
            setRecipes(prev => [...prev, ...data.results]);
            setNextCursor(data.next);
        } catch {
            // se reintenta al volver a llegar al final
        } finally {
            setLoadingMore(false);
        }
    };

    const handleSelect = (recipe: Recipe) => {
        if (!recipe.uuid) return;
        onSelect(recipe);
        setSearch('');
    };

    const handleClose = () => {
        setSearch('');
        onClose();
    };


    return (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={handleClose}
        >
            <View style={styles.container}>
                {/* Header */}
                <View style={styles.header}>
                    <Text style={styles.title}>Elegí una receta</Text>
                    <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
                        <X size={22} color={COLORS.text.secondary} />
                    </TouchableOpacity>
                </View>

                {/* Search */}
                <View style={styles.searchContainer}>
                    <Search size={18} color={COLORS.text.secondary} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Buscar receta..."
                        placeholderTextColor={COLORS.text.secondary}
                        value={search}
                        onChangeText={setSearch}
                        autoCapitalize="none"
                    />
                    {search.length > 0 && (
                        <TouchableOpacity onPress={() => setSearch('')}>
                            <X size={16} color={COLORS.text.secondary} />
                        </TouchableOpacity>
                    )}
                </View>


                {/* Recipe Grid */}
                {loading ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color={COLORS.primary} />
                    </View>
                ) : (
                    <FlatList
                        data={recipes}
                        numColumns={2}
                        keyExtractor={(item) => item.uuid || item.id?.toString() || Math.random().toString()}
                        contentContainerStyle={styles.listContent}
                        columnWrapperStyle={styles.columnWrapper}
                        showsVerticalScrollIndicator={false}
                        onEndReached={loadMore}
                        onEndReachedThreshold={0.5}
                        ListFooterComponent={loadingMore ? <ActivityIndicator style={{ marginVertical: 16 }} color={COLORS.primary} /> : null}
                        renderItem={({ item }) => {
                            const imageSource = getRecipeImage(item);
                            return (
                                <Pressable
                                    style={styles.recipeCard}
                                    onPress={() => handleSelect(item)}
                                >
                                    {imageSource ? (
                                        <Image
                                            source={{ uri: imageSource.uri }}
                                            style={styles.recipeImage}
                                            contentFit="cover"
                                        />
                                    ) : (
                                        <View style={[styles.recipeImage, styles.recipeImagePlaceholder]}>
                                            <UtensilsCrossed size={28} color={COLORS.text.secondary} />
                                        </View>
                                    )}
                                    <Text style={styles.recipeName} numberOfLines={2}>
                                        {item.title}
                                    </Text>
                                    {item.prep_time ? (
                                        <Text style={styles.recipeMeta}>⏱ {item.prep_time} min</Text>
                                    ) : null}
                                </Pressable>
                            );
                        }}
                        ListEmptyComponent={
                            <View style={styles.emptyContainer}>
                                <UtensilsCrossed size={40} color={COLORS.text.secondary} />
                                <Text style={styles.emptyText}>
                                    {search ? 'No encontramos recetas con ese nombre' : 'Aún no tenés recetas'}
                                </Text>
                            </View>
                        }
                    />
                )}
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: SPACING.l,
        paddingTop: SPACING.l,
        paddingBottom: SPACING.m,
    },
    title: {
        fontSize: 22,
        fontWeight: '700',
        color: COLORS.text.primary,
        fontFamily: 'Georgia',
    },
    closeBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: COLORS.card,
        alignItems: 'center',
        justifyContent: 'center',
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.card,
        borderRadius: RADIUS.s,
        marginHorizontal: SPACING.l,
        paddingHorizontal: SPACING.m,
        marginBottom: SPACING.m,
        height: 44,
        borderWidth: 1,
        borderColor: 'rgba(168, 144, 112, 0.2)',
    },
    searchInput: {
        flex: 1,
        fontSize: 15,
        color: COLORS.text.primary,
        marginLeft: SPACING.s,
    },
    listContent: {
        paddingHorizontal: SPACING.l,
        paddingBottom: SPACING.xl,
    },
    columnWrapper: {
        justifyContent: 'space-between',
        gap: 12,
    },
    recipeCard: {
        flex: 1,
        backgroundColor: COLORS.card,
        borderRadius: RADIUS.m,
        overflow: 'hidden',
        marginBottom: 12,
        maxWidth: '48%',
    },
    recipeImage: {
        width: '100%',
        height: 120,
    },
    recipeImagePlaceholder: {
        backgroundColor: '#F5E6D0',
        alignItems: 'center',
        justifyContent: 'center',
    },
    recipeName: {
        fontSize: 14,
        fontWeight: '600',
        color: COLORS.text.primary,
        paddingHorizontal: SPACING.s,
        paddingTop: SPACING.s,
        lineHeight: 18,
    },
    recipeMeta: {
        fontSize: 12,
        color: COLORS.text.secondary,
        paddingHorizontal: SPACING.s,
        paddingBottom: SPACING.s,
        marginTop: 2,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    submittingOverlay: {
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(250, 238, 218, 0.9)',
        zIndex: 10,
        justifyContent: 'center',
        alignItems: 'center',
    },
    submittingText: {
        marginTop: SPACING.m,
        fontSize: 16,
        fontWeight: '600',
        color: COLORS.text.primary,
    },
    emptyContainer: {
        alignItems: 'center',
        paddingTop: 60,
    },
    emptyText: {
        marginTop: SPACING.m,
        fontSize: 15,
        color: COLORS.text.secondary,
        textAlign: 'center',
    },
});
