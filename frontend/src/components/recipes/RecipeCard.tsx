import React from 'react';
import { View, Text, Image, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Recipe } from '../../types';
import { getRecipeImage } from '../../utils';
import { Users, UtensilsCrossed, Heart } from 'lucide-react-native';
import { useApp } from '../../context/AppContext';

interface Props {
  item: Recipe;
  onPress: (recipe: Recipe) => void;
  maxWidth?: number;
}

export const RecipeCard = ({ item, onPress, maxWidth }: Props) => {
  const imageSource = getRecipeImage(item);
  const categoryName = item.categories && item.categories.length > 0 ? item.categories_details[0]?.name : '';
  const { toggleFavorite } = useApp();

  const handleToggleFavorite = async (e: any) => {
    e.stopPropagation?.();
    if (item.id) {
      await toggleFavorite(item.id);
    }
  };

  return (
    <TouchableOpacity
      className="bg-fogon-white rounded-[16px] overflow-hidden mb-6 shadow-sm border border-fogon-gray/10"
      style={{ flex: 1, minWidth: 150, maxWidth: maxWidth || '100%' }} // Allows filling the web grid cleanly without overstretching on incomplete rows
      activeOpacity={0.9}
      onPress={() => onPress(item)}
    >
      <View className="w-full aspect-[4/5] relative bg-fogon-cream">
        {imageSource ? (
          <Image
            source={imageSource}
            className="w-full h-full"
            resizeMode="cover"
          />
        ) : (
          <View className="w-full h-full bg-[#f4ebd9] items-center justify-center">
            <UtensilsCrossed size={48} color="#A89070" opacity={0.4} />
          </View>
        )}

        <LinearGradient
          colors={['transparent', 'rgba(99, 56, 6, 0.9)']}
          className="absolute bottom-0 left-0 right-0 h-1/2"
        />

        {categoryName ? (
          <View className="absolute top-3 left-3 bg-fogon-white/95 px-3 py-1 rounded-full shadow-sm max-w-[70%]">
            <Text className="text-[11px] font-bold text-fogon-brown uppercase tracking-wider" numberOfLines={1}>{categoryName}</Text>
          </View>
        ) : null}

        {/* Botón de Favorito */}
        <TouchableOpacity 
          onPress={handleToggleFavorite}
          className="absolute top-3 right-3 w-8 h-8 bg-fogon-white/90 rounded-full items-center justify-center shadow-sm"
          activeOpacity={0.7}
        >
          <Heart 
            size={16} 
            color={item.is_favorite ? "#EF4444" : "#A89070"} 
            fill={item.is_favorite ? "#EF4444" : "none"} 
          />
        </TouchableOpacity>

        <View className="absolute bottom-4 left-4 right-4">
          <Text className="text-[20px] font-bold text-fogon-white mb-2 leading-tight shadow-sm" numberOfLines={2}>
            {item.title}
          </Text>
          
          {item.servings ? (
            <View className="flex-row items-center space-x-3 mt-1">
              <View className="flex-row items-center">
                <Users size={12} color="#FAEEDA" className="mr-1 opacity-80" />
                <Text className="text-xs text-fogon-cream/80 font-medium">{item.servings} p</Text>
              </View>
            </View>
          ) : null}
        </View>
      </View>
    </TouchableOpacity>
  );
};