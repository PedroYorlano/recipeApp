import * as Linking from 'expo-linking';
import React, { useEffect, useState } from 'react';
import { Image, Modal, ScrollView, Share, Text, TouchableOpacity, View } from 'react-native';
import { Recipe } from '../../types';
import { formatQuantity, scaleQuantity, getRecipeImage } from '../../utils';
import { useApp } from '../../context/AppContext';
import { Share as ShareIcon, Edit2, Trash2, X, Plus, Minus, ExternalLink, Heart } from 'lucide-react-native';

interface Props {
  visible: boolean;
  recipe: Recipe | null;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export const RecipeDetailModal = ({ visible, recipe, onClose, onEdit, onDelete }: Props) => {
  const [currentServings, setCurrentServings] = useState(1);
  const { toggleFavorite } = useApp();

  useEffect(() => {
    if (recipe) {
      setCurrentServings(recipe.servings || 1);
    }
  }, [recipe]);

  if (!recipe) return null;

  const handleShare = async () => {
    if (!recipe?.uuid) return;
    const link = Linking.createURL("", { queryParams: { share: recipe.uuid } });
    try {
      await Share.share({ message: `¡Mira esta receta de ${recipe.title}!\nVer aquí: ${link}` });
    } catch (error) {
      console.error(error);
    }
  };

  const handleToggleFavorite = async () => {
    if (recipe?.id) {
      await toggleFavorite(recipe.id);
    }
  };

  return (
    <Modal animationType="slide" visible={visible} onRequestClose={onClose}>
      <View className="flex-1 bg-fogon-cream">
        {/* HEADER FLOTANTE */}
        <View className="absolute top-12 left-0 right-0 z-50 flex-row justify-between px-6">
          <TouchableOpacity 
            onPress={onClose} 
            className="w-10 h-10 bg-fogon-white/95 rounded-full items-center justify-center shadow-sm"
          >
            <X size={20} color="#633806" />
          </TouchableOpacity>

          <View className="flex-row space-x-3">
            <TouchableOpacity onPress={handleToggleFavorite} className={`w-10 h-10 rounded-full items-center justify-center shadow-sm mr-2 ${recipe.is_favorite ? 'bg-red-50' : 'bg-fogon-white/95'}`}>
              <Heart size={18} color={recipe.is_favorite ? "#EF4444" : "#633806"} fill={recipe.is_favorite ? "#EF4444" : "none"} />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleShare} className="w-10 h-10 bg-fogon-white/95 rounded-full items-center justify-center shadow-sm mr-2">
              <ShareIcon size={18} color="#633806" />
            </TouchableOpacity>
            <TouchableOpacity onPress={onEdit} className="w-10 h-10 bg-fogon-white/95 rounded-full items-center justify-center shadow-sm mr-2">
              <Edit2 size={18} color="#633806" />
            </TouchableOpacity>
            <TouchableOpacity onPress={onDelete} className="w-10 h-10 bg-red-50 rounded-full items-center justify-center shadow-sm border border-red-100">
              <Trash2 size={18} color="#EF4444" />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
          {/* IMAGEN PORTADA */}
          <View className="w-full h-80 bg-fogon-white overflow-hidden rounded-b-[40px] shadow-sm relative">
            {getRecipeImage(recipe) ? (
              <Image source={getRecipeImage(recipe)!} className="w-full h-full" resizeMode="cover" />
            ) : (
              <View className="w-full h-full bg-fogon-gray/10 items-center justify-center">
                <Text className="text-6xl opacity-50">🍳</Text>
              </View>
            )}
            {/* Gradiente sutil para mejorar la integración visual */}
            <View className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-black/20 to-transparent" />
          </View>

          <View className="px-6 mt-6 pb-24">
            <Text className="text-3xl font-bold font-serif text-fogon-brown mb-2 tracking-tight">{recipe.title}</Text>

            {recipe.description ? (
              <Text className="text-base text-fogon-gray leading-6 mb-4">{recipe.description}</Text>
            ) : null}

            {/* URL ORIGINAL */}
            {recipe.original_url && (
              <TouchableOpacity className="flex-row items-center mb-6 py-2" onPress={() => Linking.openURL(recipe.original_url!)}>
                <ExternalLink size={16} color="#EF9F27" className="mr-2" />
                <Text className="text-fogon-amber font-semibold text-[15px]">Ver receta original</Text>
              </TouchableOpacity>
            )}

            {/* INGREDIENTES Y PORCIONES CARD */}
            <View className="bg-fogon-white rounded-[24px] p-6 mb-6 shadow-sm border border-fogon-gray/10">
              <View className="flex-row justify-between items-center mb-4">
                <Text className="text-xl font-bold text-fogon-brown">Ingredientes</Text>
                
                {recipe.servings ? (
                  <View className="flex-row items-center bg-fogon-cream rounded-full p-1 border border-fogon-gray/20">
                    <TouchableOpacity onPress={() => setCurrentServings(p => Math.max(1, p - 1))} className="w-8 h-8 bg-fogon-white rounded-full items-center justify-center shadow-sm">
                      <Minus size={16} color="#EF9F27" />
                    </TouchableOpacity>
                    <Text className="text-base font-bold text-fogon-brown min-w-[32px] text-center">{currentServings}</Text>
                    <TouchableOpacity onPress={() => setCurrentServings(p => p + 1)} className="w-8 h-8 bg-fogon-white rounded-full items-center justify-center shadow-sm">
                      <Plus size={16} color="#EF9F27" />
                    </TouchableOpacity>
                  </View>
                ) : null}
              </View>

              <View className="h-[1px] w-full bg-fogon-gray/10 mb-4" />

              <View>
                {recipe.ingredients?.map((ing, index) => {
                  let displayQuantity: string;
                  
                  if (recipe.servings && currentServings !== recipe.servings && ing.quantity !== null) {
                    // Escalar proporcionalmente
                    const scaled = scaleQuantity(ing.quantity, recipe.servings, currentServings);
                    displayQuantity = formatQuantity(scaled, ing.unit);
                  } else {
                    displayQuantity = formatQuantity(ing.quantity, ing.unit);
                  }

                  return (
                    <View key={index} className="flex-row items-center mb-3">
                      <View className="w-2 h-2 rounded-full bg-fogon-amber mr-3" />
                      <Text className="text-base text-fogon-brown flex-1">
                         {displayQuantity ? <Text className="font-bold">{displayQuantity} </Text> : null}
                         {ing.name}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>

            {/* PASOS */}
            <View>
              <Text className="text-xl font-bold text-fogon-brown mb-4 px-2">Instrucciones</Text>
              {recipe.steps?.map((step, index) => (
                <View key={index} className="bg-fogon-white rounded-[20px] p-5 mb-4 shadow-sm border border-fogon-amber/10 border-l-4 border-l-fogon-amber">
                  <View className="flex-row items-center mb-2">
                    <View className="w-6 h-6 bg-fogon-amber rounded-full items-center justify-center mr-3">
                      <Text className="text-fogon-brown font-bold text-xs">{step.order}</Text>
                    </View>
                    <Text className="font-bold text-base text-fogon-brown">Paso {step.order}</Text>
                  </View>
                  <Text className="text-base text-fogon-gray leading-6 ml-9">{step.instruction}</Text>
                </View>
              ))}
            </View>

          </View>
        </ScrollView>
      </View>
    </Modal>
  );
};