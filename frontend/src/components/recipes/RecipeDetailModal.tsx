import * as Linking from 'expo-linking';
import React, { useEffect, useState } from 'react';
import { Image, Modal, Platform, ScrollView, Share, Text, TouchableOpacity, View } from 'react-native';
import { Recipe } from '../../types';
import { formatQuantity, scaleQuantity, getRecipeImage } from '../../utils';
import { useApp } from '../../context/AppContext';
import { Share as ShareIcon, Edit2, Trash2, X, Plus, Minus, ExternalLink, Heart, Clock, Users, ArrowLeft } from 'lucide-react-native';
import { notify, confirmAction, getErrorMessage } from '../../utils/dialogs';
import { setRecipePublicService } from '../../services/api';
import { getShareUrl } from '../../constants';

interface Props {
  visible: boolean;
  recipe: Recipe | null;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

/** Modal de detalle de una receta propia (con favoritos, compartir, editar y borrar). */
export const RecipeDetailModal = ({ visible, recipe, onClose, onEdit, onDelete }: Props) => {
  const { toggleFavorite, markRecipePublic } = useApp();

  if (!recipe) return null;

  const handleShare = async () => {
    if (!recipe.uuid || !recipe.id) return;

    // El link público solo funciona si la receta es pública: lo avisamos una vez.
    if (!recipe.is_public) {
      const ok = await confirmAction({
        title: 'Compartir receta',
        message: 'Cualquiera que tenga el link va a poder ver esta receta (no editarla).',
        confirmText: 'Compartir',
      });
      if (!ok) return;
      try {
        await setRecipePublicService(recipe.id, true);
        markRecipePublic(recipe.id);
      } catch (e) {
        notify('Error', getErrorMessage(e, 'No pudimos generar el link para compartir.'));
        return;
      }
    }

    const link = getShareUrl(recipe.uuid);
    const message = `¡Mirá esta receta de ${recipe.title}!\n${link}`;
    try {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && !navigator.share) {
        await navigator.clipboard.writeText(link);
        notify('Link copiado', 'Pegalo donde quieras compartir la receta.');
        return;
      }
      await Share.share({ message });
    } catch (error) {
      console.error(error);
    }
  };

  const handleToggleFavorite = async () => {
    if (recipe.id) await toggleFavorite(recipe.id);
  };

  return (
    <Modal animationType="slide" visible={visible} onRequestClose={onClose}>
      <RecipeDetailView
        recipe={recipe}
        onBack={onClose}
        actions={
          <>
            <RoundButton onPress={handleToggleFavorite} className={recipe.is_favorite ? 'bg-red-50' : 'bg-fogon-white/95'}>
              <Heart size={18} color={recipe.is_favorite ? '#EF4444' : '#633806'} fill={recipe.is_favorite ? '#EF4444' : 'none'} />
            </RoundButton>
            <RoundButton onPress={handleShare}>
              <ShareIcon size={18} color="#633806" />
            </RoundButton>
            <RoundButton onPress={onEdit}>
              <Edit2 size={18} color="#633806" />
            </RoundButton>
            <RoundButton onPress={onDelete} className="bg-red-50 border border-red-100" last>
              <Trash2 size={18} color="#EF4444" />
            </RoundButton>
          </>
        }
      />
    </Modal>
  );
};

const RoundButton = ({
  onPress, children, className = 'bg-fogon-white/95', last,
}: { onPress: () => void; children: React.ReactNode; className?: string; last?: boolean }) => (
  <TouchableOpacity
    onPress={onPress}
    className={`w-10 h-10 rounded-full items-center justify-center shadow-sm ${last ? '' : 'mr-2'} ${className}`}
  >
    {children}
  </TouchableOpacity>
);

interface ViewProps {
  recipe: Recipe;
  onBack: () => void;
  /** 'close' (X, modal) o 'back' (flecha, página). */
  backIcon?: 'close' | 'back';
  actions?: React.ReactNode;
  footer?: React.ReactNode;
}

/** Cuerpo del detalle. Lo usan el modal y la página pública /receta/[uuid]. */
export const RecipeDetailView = ({ recipe, onBack, backIcon = 'close', actions, footer }: ViewProps) => {
  const [currentServings, setCurrentServings] = useState(recipe.servings || 1);
  // Ingredientes tachados mientras se cocina (no se guarda).
  const [checked, setChecked] = useState<Set<number>>(new Set());

  useEffect(() => {
    setCurrentServings(recipe.servings || 1);
    setChecked(new Set());
  }, [recipe.uuid, recipe.servings]);

  const toggleChecked = (index: number) =>
    setChecked(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });

  const image = getRecipeImage(recipe);

  return (
    <View className="flex-1 bg-fogon-cream">
      {/* HEADER FLOTANTE */}
      <View className="absolute top-12 left-0 right-0 z-50 flex-row justify-between px-6">
        <TouchableOpacity
          onPress={onBack}
          className="w-10 h-10 bg-fogon-white/95 rounded-full items-center justify-center shadow-sm"
        >
          {backIcon === 'back' ? <ArrowLeft size={20} color="#633806" /> : <X size={20} color="#633806" />}
        </TouchableOpacity>
        {actions ? <View className="flex-row">{actions}</View> : null}
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* IMAGEN PORTADA */}
        <View className="w-full h-80 bg-fogon-white overflow-hidden rounded-b-[40px] shadow-sm relative">
          {image ? (
            <Image source={image} className="w-full h-full" resizeMode="cover" />
          ) : (
            <View className="w-full h-full bg-fogon-gray/10 items-center justify-center">
              <Text className="text-6xl opacity-50">🍳</Text>
            </View>
          )}
        </View>

        <View className="px-6 mt-6 pb-24 w-full max-w-3xl mx-auto">
          <Text className="text-3xl font-bold font-serif text-fogon-brown mb-2 tracking-tight">{recipe.title}</Text>

          {/* PORCIONES / TIEMPO */}
          {(recipe.prep_time || recipe.servings) ? (
            <View className="flex-row items-center mb-3">
              {recipe.prep_time ? (
                <View className="flex-row items-center mr-4">
                  <Clock size={14} color="#A89070" />
                  <Text className="text-sm text-fogon-gray ml-1 font-medium">{recipe.prep_time} min</Text>
                </View>
              ) : null}
              {recipe.servings ? (
                <View className="flex-row items-center">
                  <Users size={14} color="#A89070" />
                  <Text className="text-sm text-fogon-gray ml-1 font-medium">
                    {recipe.servings} {recipe.servings === 1 ? 'porción' : 'porciones'}
                  </Text>
                </View>
              ) : null}
            </View>
          ) : null}

          {recipe.description ? (
            <Text className="text-base text-fogon-gray leading-6 mb-4">{recipe.description}</Text>
          ) : null}

          {/* URL ORIGINAL */}
          {recipe.original_url ? (
            <TouchableOpacity className="flex-row items-center mb-6 py-2" onPress={() => Linking.openURL(recipe.original_url!)}>
              <ExternalLink size={16} color="#EF9F27" />
              <Text className="text-fogon-amber font-semibold text-[15px] ml-2">Ver receta original</Text>
            </TouchableOpacity>
          ) : null}

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

            {recipe.ingredients?.length ? (
              <Text className="text-xs text-fogon-gray mb-3">Tocá un ingrediente para tacharlo.</Text>
            ) : null}

            <View>
              {recipe.ingredients?.map((ing, index) => {
                const scaled = recipe.servings && currentServings !== recipe.servings
                  ? scaleQuantity(ing.quantity, recipe.servings, currentServings)
                  : ing.quantity;
                const displayQuantity = formatQuantity(scaled, ing.unit);
                const isChecked = checked.has(index);

                return (
                  <TouchableOpacity key={index} className="flex-row items-center mb-3" onPress={() => toggleChecked(index)} activeOpacity={0.6}>
                    <View className={`w-2 h-2 rounded-full mr-3 ${isChecked ? 'bg-fogon-gray/40' : 'bg-fogon-amber'}`} />
                    <Text className={`text-base flex-1 ${isChecked ? 'text-fogon-gray line-through' : 'text-fogon-brown'}`}>
                      {displayQuantity ? <Text className="font-bold">{displayQuantity} </Text> : null}
                      {ing.name}
                    </Text>
                  </TouchableOpacity>
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
                    <Text className="text-fogon-brown font-bold text-xs">{index + 1}</Text>
                  </View>
                  <Text className="font-bold text-base text-fogon-brown">Paso {index + 1}</Text>
                </View>
                <Text className="text-base text-fogon-gray leading-6 ml-9">{step.instruction}</Text>
              </View>
            ))}
          </View>

          {footer}
        </View>
      </ScrollView>
    </View>
  );
};
