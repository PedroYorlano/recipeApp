import React, { useState, useEffect, useRef } from 'react';
import { View, Modal, TouchableOpacity, FlatList, ActivityIndicator, Pressable } from 'react-native';
import { Text, TextInput } from '../ui/Typography';
import { getRecipesService } from '../../services/api';
import { getRecipeImage } from '../../utils';
import { Recipe } from '../../types';
import { Search, X } from 'lucide-react-native';
import { RecipeCover } from '../brand/RecipeCover';
import { recipeMeta } from '../recipes/RecipeCard';
import { DialogHost } from '../ui/DialogHost';
import { closeDialogOr } from '../../utils/dialogs';

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
            onRequestClose={closeDialogOr(handleClose)}
        >
            <View className="flex-1 bg-pizca-fondo">
                <View className="flex-row items-center justify-between px-5 pt-5 pb-3">
                    <Text className="font-display text-[26px] text-pizca-marron" accessibilityRole="header">Elegí una receta</Text>
                    <TouchableOpacity onPress={handleClose} className="w-11 h-11 rounded-full bg-pizca-crema items-center justify-center" accessibilityLabel="Cerrar">
                        <X size={20} color="#3F3128" strokeWidth={2.4} />
                    </TouchableOpacity>
                </View>

                <View className="mx-5 mb-3 flex-row items-center gap-2.5 bg-white rounded-[16px] px-4 h-[52px] border border-pizca-linea">
                    <Search size={20} color="#6B5A4E" strokeWidth={2.2} />
                    <TextInput
                        className="flex-1 h-full text-[15px] text-pizca-marron"
                        placeholder="Buscá por nombre o ingrediente"
                        placeholderTextColor="#8C7E70"
                        value={search}
                        onChangeText={setSearch}
                        autoCapitalize="none"
                        accessibilityLabel="Buscar receta"
                    />
                    {search.length > 0 && (
                        <TouchableOpacity onPress={() => setSearch('')} accessibilityLabel="Borrar búsqueda">
                            <X size={18} color="#6B5A4E" />
                        </TouchableOpacity>
                    )}
                </View>

                {loading ? (
                    <View className="flex-1 items-center justify-center">
                        <ActivityIndicator size="large" color="#BE9F00" />
                    </View>
                ) : (
                    <FlatList
                        data={recipes}
                        numColumns={2}
                        keyExtractor={(item) => item.uuid || String(item.id)}
                        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32 }}
                        columnWrapperStyle={{ gap: 12 }}
                        showsVerticalScrollIndicator={false}
                        onEndReached={loadMore}
                        onEndReachedThreshold={0.5}
                        keyboardShouldPersistTaps="handled"
                        ListFooterComponent={loadingMore ? <ActivityIndicator style={{ marginVertical: 16 }} color="#BE9F00" /> : null}
                        ListEmptyComponent={
                            <View className="items-center py-12 gap-2">
                                <Text className="text-lg font-extrabold text-pizca-marron">{search ? 'No encontramos recetas' : 'Todavía no tenés recetas'}</Text>
                                <Text className="text-sm text-pizca-texto2 text-center">{search ? 'Probá con otro nombre o ingrediente.' : 'Agregá una desde el botón + del Inicio.'}</Text>
                            </View>
                        }
                        renderItem={({ item }) => (
                            <Pressable
                                className="flex-1 bg-white rounded-[20px] overflow-hidden mb-3 max-w-[50%]"
                                style={{ boxShadow: '0 2px 10px rgba(63,49,40,0.08)' }}
                                onPress={() => handleSelect(item)}
                                accessibilityRole="button"
                                accessibilityLabel={item.title}
                            >
                                <RecipeCover source={getRecipeImage(item)} seed={item.uuid || item.id} className="h-[100px]" illustrationSize={48} />
                                <View className="px-3 pt-2 pb-3 gap-0.5">
                                    <Text className="text-sm font-extrabold text-pizca-marron leading-[18px]" numberOfLines={2}>{item.title}</Text>
                                    {recipeMeta(item) ? <Text className="text-xs font-bold text-pizca-texto2">{recipeMeta(item)}</Text> : null}
                                </View>
                            </Pressable>
                        )}
                    />
                )}
            </View>
          <DialogHost />
        </Modal>
    );
}
