import * as Linking from 'expo-linking';
import React, { useEffect, useMemo, useState } from 'react';
import { Image, Modal, Platform, ScrollView, Share, TouchableOpacity, View } from 'react-native';
import { Text } from '../ui/Typography';
import { Recipe } from '../../types';
import { formatQuantity, scaleQuantity, getRecipeImage } from '../../utils';
import { useApp } from '../../context/AppContext';
import { Share as ShareIcon, Pencil, Trash2, X, Plus, Minus, ExternalLink, Heart, Users, ArrowLeft, Play, ChevronRight, Check, CalendarPlus } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RecipeCover } from '../brand/RecipeCover';
import { ICONS } from '../../constants/brand';
import { Button } from '../ui/Button';
import { AddToWeekSheet } from '../planner/AddToWeekSheet';
import { CookingModeModal, CookingIngredient } from './CookingModeModal';
import { detectTimers } from '../../utils/cooking';
import { notify, confirmAction, getErrorMessage, closeDialogOr } from '../../utils/dialogs';
import { setRecipePublicService } from '../../services/api';
import { getShareUrl } from '../../constants';
import { DialogHost } from '../ui/DialogHost';

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
  const [addingToWeek, setAddingToWeek] = useState(false);

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
    <Modal animationType="slide" visible={visible} onRequestClose={closeDialogOr(onClose)}>
      <RecipeDetailView
        recipe={recipe}
        onBack={onClose}
        actions={
          <>
            <RoundButton
              onPress={handleToggleFavorite}
              label={recipe.is_favorite ? 'Quitar de favoritas' : 'Marcar como favorita'}
            >
              {recipe.is_favorite
                ? <Image source={ICONS.favoritos} style={{ width: 20, height: 20 }} />
                : <Heart size={20} color="#3F3128" strokeWidth={2.2} />}
            </RoundButton>
            <RoundButton onPress={handleShare} label="Compartir">
              <ShareIcon size={20} color="#3F3128" strokeWidth={2.2} />
            </RoundButton>
            <RoundButton onPress={onEdit} label="Editar">
              <Pencil size={19} color="#3F3128" strokeWidth={2.2} />
            </RoundButton>
            <RoundButton onPress={onDelete} label="Borrar">
              <Trash2 size={19} color="#B23A12" strokeWidth={2.2} />
            </RoundButton>
          </>
        }
        bottomBar={
          <Button
            variant="cook"
            title="Agregar a la semana"
            icon={<CalendarPlus size={20} color="#FFFFFF" strokeWidth={2.2} />}
            onPress={() => setAddingToWeek(true)}
          />
        }
      />
      <AddToWeekSheet visible={addingToWeek} recipe={recipe} onClose={() => setAddingToWeek(false)} />
      <DialogHost />
    </Modal>
  );
};

const RoundButton = ({ onPress, children, label }: { onPress: () => void; children: React.ReactNode; label: string }) => (
  <TouchableOpacity
    onPress={onPress}
    className="w-11 h-11 rounded-full items-center justify-center bg-white"
    accessibilityRole="button"
    accessibilityLabel={label}
  >
    {children}
  </TouchableOpacity>
);

/** "Ver receta original en Instagram" si reconocemos el sitio. */
const sourceName = (url: string) => {
  const host = url.replace(/^https?:\/\//, '').split('/')[0].replace(/^www\./, '');
  if (/instagram\./.test(host)) return 'Instagram';
  if (/tiktok\./.test(host)) return 'TikTok';
  if (/youtu(\.be|be\.)/.test(host)) return 'YouTube';
  if (/facebook\.|fb\.watch/.test(host)) return 'Facebook';
  return host || null;
};

interface ViewProps {
  recipe: Recipe;
  onBack: () => void;
  /** 'close' (X, modal) o 'back' (flecha, página). */
  backIcon?: 'close' | 'back';
  actions?: React.ReactNode;
  footer?: React.ReactNode;
  /** Acción fija abajo de todo (ej. "Agregar a la semana"). */
  bottomBar?: React.ReactNode;
  /**
   * Barra de marca arriba (página pública sin sesión). Si está, la portada va
   * recuadrada debajo y no se muestran los botones flotantes.
   */
  brandHeader?: React.ReactNode;
}

/** Cuerpo del detalle. Lo usan el modal y la página pública /receta/[uuid]. */
export const RecipeDetailView = ({ recipe, onBack, backIcon = 'close', actions, footer, bottomBar, brandHeader }: ViewProps) => {
  const insets = useSafeAreaInsets();
  const [currentServings, setCurrentServings] = useState(recipe.servings || 1);
  // Ingredientes tachados mientras se cocina (no se guarda).
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [cooking, setCooking] = useState(false);

  const scaledIngredients: CookingIngredient[] = useMemo(
    () => (recipe.ingredients ?? []).map(ing => {
      const scaled = recipe.servings && currentServings !== recipe.servings
        ? scaleQuantity(ing.quantity, recipe.servings, currentServings)
        : ing.quantity;
      return { quantity: formatQuantity(scaled, ing.unit), name: ing.name };
    }),
    [recipe.ingredients, recipe.servings, currentServings],
  );
  const timerCount = useMemo(
    () => (recipe.steps ?? []).reduce((n, s) => n + detectTimers(s.instruction ?? '').length, 0),
    [recipe.steps],
  );

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
  const source = recipe.original_url ? sourceName(recipe.original_url) : null;
  const steps = recipe.steps ?? [];
  const ingredientCount = scaledIngredients.length;

  return (
    <View className="flex-1 bg-pizca-fondo">
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Portada: foto o ilustración */}
        {brandHeader ? (
          <View style={{ paddingTop: insets.top }} className="w-full max-w-3xl mx-auto">
            {brandHeader}
            <RecipeCover
              source={image}
              seed={recipe.uuid || recipe.id}
              illustrationSize={110}
              className="mx-4 mt-2 h-[230px] rounded-[28px]"
            />
          </View>
        ) : (
          <RecipeCover
            source={image}
            seed={recipe.uuid || recipe.id}
            illustrationSize={120}
            className="w-full h-[300px] rounded-b-[36px]"
          />
        )}

        <View className="px-5 pt-5 gap-[18px] w-full max-w-3xl mx-auto" style={{ paddingBottom: bottomBar ? 24 : 40 }}>
          <View className="gap-2">
            {recipe.categories_details?.length ? (
              <View className="flex-row flex-wrap gap-1.5">
                {recipe.categories_details.map(c => (
                  <View key={c.id} className="px-2.5 py-1 rounded-full bg-pizca-crema">
                    <Text className="text-xs font-extrabold text-pizca-marron">{c.name}</Text>
                  </View>
                ))}
              </View>
            ) : null}

            <Text className="font-display text-[32px] leading-[36px] text-pizca-marron" accessibilityRole="header">
              {recipe.title}
            </Text>

            {(recipe.prep_time || recipe.servings) ? (
              <View className="flex-row items-center gap-4">
                {recipe.prep_time ? (
                  <View className="flex-row items-center gap-1.5">
                    <Image source={ICONS.timer} style={{ width: 18, height: 18 }} />
                    <Text className="text-sm font-bold text-pizca-texto2">{recipe.prep_time} min</Text>
                  </View>
                ) : null}
                {recipe.servings ? (
                  <View className="flex-row items-center gap-1.5">
                    <Users size={18} color="#6B5A4E" strokeWidth={2} />
                    <Text className="text-sm font-bold text-pizca-texto2">
                      {recipe.servings} {recipe.servings === 1 ? 'porción' : 'porciones'}
                    </Text>
                  </View>
                ) : null}
              </View>
            ) : null}

            {recipe.description ? (
              <Text className="text-[15px] text-pizca-texto2 leading-[22px]">{recipe.description}</Text>
            ) : null}

            {recipe.original_url ? (
              <TouchableOpacity
                className="flex-row items-center gap-1.5 py-1 self-start"
                onPress={() => Linking.openURL(recipe.original_url!)}
                accessibilityRole="link"
              >
                <ExternalLink size={16} color="#7A6500" strokeWidth={2.2} />
                <Text className="text-pizca-mostaza-texto font-extrabold text-sm">
                  Ver receta original{source ? ` en ${source}` : ''}
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Ingredientes */}
          <View className="bg-white rounded-[24px] p-[18px] gap-3">
            <View className="flex-row justify-between items-center">
              <View className="flex-row items-center gap-2">
                <Image source={ICONS.ingredientes} style={{ width: 24, height: 24 }} />
                <Text className="text-[19px] font-extrabold text-pizca-marron">Ingredientes</Text>
              </View>

              {recipe.servings ? (
                <View className="flex-row items-center gap-1 bg-pizca-crema rounded-full p-1">
                  <TouchableOpacity
                    onPress={() => setCurrentServings(p => Math.max(1, p - 1))}
                    className="w-8 h-8 bg-white rounded-full items-center justify-center"
                    accessibilityLabel="Menos porciones"
                  >
                    <Minus size={16} color="#3F3128" strokeWidth={2.6} />
                  </TouchableOpacity>
                  <Text className="text-base font-extrabold text-pizca-marron min-w-[24px] text-center">{currentServings}</Text>
                  <TouchableOpacity
                    onPress={() => setCurrentServings(p => p + 1)}
                    className="w-8 h-8 bg-white rounded-full items-center justify-center"
                    accessibilityLabel="Más porciones"
                  >
                    <Plus size={16} color="#3F3128" strokeWidth={2.6} />
                  </TouchableOpacity>
                </View>
              ) : null}
            </View>

            {ingredientCount ? (
              <Text className="text-xs font-bold text-pizca-texto2">
                Tocá un ingrediente para tacharlo · {checked.size} de {ingredientCount} listos
              </Text>
            ) : (
              <Text className="text-sm text-pizca-texto2">Esta receta no tiene ingredientes cargados.</Text>
            )}

            <View className="gap-1">
              {scaledIngredients.map((ing, index) => {
                const isChecked = checked.has(index);
                return (
                  <TouchableOpacity
                    key={index}
                    className="flex-row items-center gap-2.5 min-h-[40px] py-1"
                    onPress={() => toggleChecked(index)}
                    activeOpacity={0.6}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: isChecked }}
                  >
                    {isChecked ? (
                      <View className="w-[22px] h-[22px] rounded-[7px] bg-pizca-albahaca items-center justify-center">
                        <Check size={14} color="#FFFFFF" strokeWidth={3.2} />
                      </View>
                    ) : (
                      <View className="w-[22px] h-[22px] rounded-[7px] border-[1.5px] border-pizca-marron" />
                    )}
                    <Text className={`text-[15px] flex-1 ${isChecked ? 'text-pizca-apagado line-through' : 'text-pizca-marron'}`}>
                      {ing.quantity ? <Text className={isChecked ? '' : 'font-extrabold'}>{ing.quantity} </Text> : null}
                      {ing.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Cocina guiada */}
          {steps.length ? (
            <TouchableOpacity
              onPress={() => setCooking(true)}
              activeOpacity={0.85}
              className="flex-row items-center gap-3.5 bg-pizca-albahaca rounded-[24px] p-4"
              accessibilityRole="button"
            >
              <View className="w-12 h-12 rounded-full bg-pizca-fondo items-center justify-center">
                <Play size={22} color="#0C4B20" fill="#0C4B20" />
              </View>
              <View className="flex-1 gap-0.5">
                <Text className="text-white font-extrabold text-[17px]">Cocinar paso a paso</Text>
                <Text className="text-[#D5E4D3] font-bold text-[13px]">
                  {steps.length} {steps.length === 1 ? 'paso' : 'pasos'}
                  {timerCount ? ` · ${timerCount} ${timerCount === 1 ? 'temporizador' : 'temporizadores'}` : ''}
                </Text>
              </View>
              <ChevronRight size={20} color="#FFFFFF" strokeWidth={2.4} />
            </TouchableOpacity>
          ) : null}

          {/* Pasos */}
          {steps.length ? (
            <View className="gap-2.5">
              <View className="flex-row items-center gap-2">
                <Image source={ICONS.pasos} style={{ width: 20, height: 20 }} />
                <Text className="text-[19px] font-extrabold text-pizca-marron">Pasos</Text>
              </View>
              {steps.map((step, index) => (
                <View key={index} className="flex-row gap-3 bg-white rounded-[20px] p-3.5">
                  <View className="w-7 h-7 bg-pizca-mostaza rounded-full items-center justify-center">
                    <Text className="text-pizca-marron font-extrabold text-sm">{index + 1}</Text>
                  </View>
                  <Text className="text-[15px] text-pizca-marron leading-[22px] flex-1">{step.instruction}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {footer}
        </View>
      </ScrollView>

      {/* Botones sobre la portada */}
      {brandHeader ? null : <View
        className="absolute left-0 right-0 flex-row justify-between px-4"
        style={{ top: Math.max(insets.top, 12) + 4 }}
        pointerEvents="box-none"
      >
        <TouchableOpacity
          onPress={onBack}
          className="w-11 h-11 bg-white rounded-full items-center justify-center"
          accessibilityRole="button"
          accessibilityLabel={backIcon === 'back' ? 'Volver' : 'Cerrar'}
        >
          {backIcon === 'back'
            ? <ArrowLeft size={20} color="#3F3128" strokeWidth={2.4} />
            : <X size={20} color="#3F3128" strokeWidth={2.4} />}
        </TouchableOpacity>
        {actions ? <View className="flex-row gap-2">{actions}</View> : null}
      </View>}

      {bottomBar ? (
        <View
          className="px-5 pt-3.5 bg-pizca-fondo border-t border-pizca-linea"
          style={{ paddingBottom: Math.max(insets.bottom, 14) + 14 }}
        >
          <View className="w-full max-w-3xl mx-auto">{bottomBar}</View>
        </View>
      ) : null}

      <CookingModeModal
        visible={cooking}
        recipe={recipe}
        ingredients={scaledIngredients}
        servings={recipe.servings ? currentServings : undefined}
        onClose={() => setCooking(false)}
      />
    </View>
  );
};
