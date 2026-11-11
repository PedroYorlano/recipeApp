import React, { memo } from 'react';
import { View, TouchableOpacity, Image } from 'react-native';
import { Text } from '../ui/Typography';
import { Recipe } from '../../types';
import { getRecipeImage } from '../../utils';
import { RecipeCover } from '../brand/RecipeCover';
import { ICONS } from '../../constants/brand';
import { Heart } from 'lucide-react-native';

interface Props {
  item: Recipe;
  onPress: (recipe: Recipe) => void;
  onToggleFavorite: (recipeId: number) => void;
  maxWidth?: number;
}

/** "35 min · 4 porc." con lo que haya. */
export const recipeMeta = (r: { prep_time?: number | null; servings?: number | null }) =>
  [r.prep_time ? `${r.prep_time} min` : null, r.servings ? `${r.servings} porc.` : null].filter(Boolean).join(' · ');

/** Memo: en una lista larga, solo se vuelve a dibujar la tarjeta que cambió. */
export const RecipeCard = memo(function RecipeCard({ item, onPress, onToggleFavorite, maxWidth }: Props) {
  const meta = recipeMeta(item);

  const handleToggleFavorite = (e: { stopPropagation?: () => void }) => {
    e.stopPropagation?.();
    if (item.id) onToggleFavorite(item.id);
  };

  return (
    <TouchableOpacity
      className="bg-white rounded-[20px] overflow-hidden mb-3.5"
      style={{
        flex: 1,
        minWidth: 150,
        maxWidth: maxWidth || '100%',
        boxShadow: '0 2px 10px rgba(63,49,40,0.08)',
      }}
      activeOpacity={0.9}
      onPress={() => onPress(item)}
      accessibilityRole="button"
      accessibilityLabel={`${item.title}${meta ? `, ${meta}` : ''}`}
    >
      <RecipeCover source={getRecipeImage(item)} seed={item.uuid || item.id} className="h-[120px]">
        <TouchableOpacity
          onPress={handleToggleFavorite}
          className="absolute top-2 right-2 w-[30px] h-[30px] bg-white rounded-full items-center justify-center"
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={item.is_favorite ? 'Quitar de favoritas' : 'Marcar como favorita'}
          hitSlop={8}
        >
          {item.is_favorite ? (
            <Image source={ICONS.favoritos} style={{ width: 15, height: 15 }} />
          ) : (
            <Heart size={15} color="#6B5A4E" strokeWidth={2.2} />
          )}
        </TouchableOpacity>
      </RecipeCover>

      <View className="px-3 pt-2.5 pb-3 gap-[3px]">
        <Text className="text-sm font-extrabold text-pizca-marron leading-[18px]" numberOfLines={2}>
          {item.title}
        </Text>
        {meta ? <Text className="text-xs font-bold text-pizca-texto2">{meta}</Text> : null}
      </View>
    </TouchableOpacity>
  );
});
