import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, ScrollView, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';
import { Text } from '../ui/Typography';
import { Button } from '../ui/Button';
import { ICONS } from '../../constants/brand';
import { MealPlan, Recipe } from '../../types';
import { addDays, getCurrentMonday, getTodayISO, parseISODate } from '../../utils/dates';
import { createMealPlan, deleteMealPlan, getWeekPlans } from '../../services/api';
import { usePlanner } from '../../context/PlannerContext';
import { notify, getErrorMessage, closeDialogOr } from '../../utils/dialogs';
import { DialogHost } from '../ui/DialogHost';

export const MEALS = [
  { key: 'breakfast', label: 'Desayuno', icon: ICONS.desayuno },
  { key: 'lunch', label: 'Almuerzo', icon: ICONS.almuerzo },
  { key: 'dinner', label: 'Cena', icon: ICONS.cena },
] as const;

const DAY_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

interface Props {
  visible: boolean;
  recipe: Recipe;
  onClose: () => void;
}

/**
 * Hoja para sumar una receta al plan desde su detalle: elegís día (de hoy a
 * 7 días) y comida. Si el lugar ya tenía receta, la reemplaza.
 */
export function AddToWeekSheet({ visible, recipe, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const { hasUnsavedChanges, refreshPlans } = usePlanner();
  const days = useMemo(() => {
    const today = getTodayISO();
    return Array.from({ length: 7 }, (_, i) => addDays(today, i));
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const [day, setDay] = useState(days[0]);
  const [meal, setMeal] = useState<string>('dinner');
  const [plans, setPlans] = useState<MealPlan[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Planes de esta semana y la próxima, para mostrar qué lugares ya están ocupados.
  useEffect(() => {
    if (!visible) return;
    setDay(days[0]);
    setLoading(true);
    const monday = getCurrentMonday();
    Promise.all([getWeekPlans(monday), getWeekPlans(addDays(monday, 7))])
      .then(([a, b]) => setPlans([...a, ...b]))
      .catch(() => setPlans([]))
      .finally(() => setLoading(false));
  }, [visible, days]);

  const taken = (date: string, mealType: string) => plans.find(p => p.date === date && p.meal_type === mealType);
  const current = taken(day, meal);

  const handleAdd = async () => {
    setSaving(true);
    try {
      if (current) await deleteMealPlan(current.id);
      await createMealPlan({ date: day, meal_type: meal, recipe: recipe.uuid });
      // Si el planificador tiene cambios sin guardar no lo recargamos, para no perderlos.
      if (!hasUnsavedChanges) await refreshPlans();
      const d = parseISODate(day);
      const mealLabel = MEALS.find(m => m.key === meal)!.label.toLowerCase();
      notify('Listo', `"${recipe.title}" quedó para el ${DAY_SHORT[d.getDay()].toLowerCase()} ${d.getDate()} (${mealLabel}).`);
      onClose();
    } catch (e) {
      notify('Error', getErrorMessage(e, 'No pudimos agregarla al plan.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={closeDialogOr(onClose)}>
      <Pressable className="flex-1 bg-[#3F3128]/45" onPress={onClose} accessibilityLabel="Cerrar" />
      <View className="bg-pizca-fondo rounded-t-[28px] px-5 pt-5 gap-5" style={{ paddingBottom: Math.max(insets.bottom, 16) + 8 }}>
        <View className="flex-row items-center justify-between">
          <Text className="font-display text-[26px] text-pizca-marron">Agregar a la semana</Text>
          <TouchableOpacity onPress={onClose} className="w-10 h-10 rounded-full bg-white items-center justify-center" accessibilityLabel="Cerrar">
            <X size={20} color="#3F3128" strokeWidth={2.4} />
          </TouchableOpacity>
        </View>
        <Text className="text-[15px] text-pizca-texto2 -mt-3" numberOfLines={1}>{recipe.title}</Text>

        <View className="gap-2">
          <Text className="text-[13px] font-extrabold text-pizca-marron">Día</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {days.map((d, i) => {
              const date = parseISODate(d);
              const active = d === day;
              return (
                <TouchableOpacity
                  key={d}
                  onPress={() => setDay(d)}
                  className={`w-[56px] h-[64px] rounded-[16px] items-center justify-center ${active ? 'bg-pizca-marron' : 'bg-pizca-crema'}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                >
                  <Text className={`text-xs font-bold ${active ? 'text-pizca-crema' : 'text-pizca-texto2'}`}>
                    {i === 0 ? 'Hoy' : DAY_SHORT[date.getDay()]}
                  </Text>
                  <Text className={`text-lg font-extrabold ${active ? 'text-pizca-fondo' : 'text-pizca-marron'}`}>{date.getDate()}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        <View className="gap-2">
          <Text className="text-[13px] font-extrabold text-pizca-marron">Comida</Text>
          {MEALS.map(m => {
            const active = m.key === meal;
            const busy = taken(day, m.key);
            return (
              <TouchableOpacity
                key={m.key}
                onPress={() => setMeal(m.key)}
                className={`flex-row items-center gap-3 p-3 rounded-[16px] bg-white border-[1.5px] ${active ? 'border-pizca-mostaza' : 'border-pizca-linea'}`}
                accessibilityRole="radio"
                accessibilityState={{ checked: active }}
              >
                <Image source={m.icon} style={{ width: 28, height: 28 }} />
                <View className="flex-1">
                  <Text className="text-[15px] font-extrabold text-pizca-marron">{m.label}</Text>
                  {loading ? null : (
                    <Text className="text-xs font-bold text-pizca-texto2" numberOfLines={1}>
                      {busy ? `Ahora: ${busy.recipe_detail?.title ?? 'otra receta'}` : 'Libre'}
                    </Text>
                  )}
                </View>
                <View className={`w-[22px] h-[22px] rounded-full items-center justify-center border-[1.5px] ${active ? 'border-pizca-mostaza' : 'border-pizca-linea'}`}>
                  {active ? <View className="w-3 h-3 rounded-full bg-pizca-mostaza" /> : null}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {loading ? <ActivityIndicator color="#BE9F00" /> : null}
        <Button
          variant="cook"
          title={current ? 'Reemplazar' : 'Agregar'}
          loading={saving}
          disabled={loading}
          onPress={handleAdd}
        />
      </View>
      <DialogHost />
    </Modal>
  );
}
