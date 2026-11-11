import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Image, Modal, NativeScrollEvent, NativeSyntheticEvent, Platform, ScrollView, TouchableOpacity, useWindowDimensions, Vibration, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '../ui/Typography';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import * as Haptics from 'expo-haptics';
import { Check, ChevronLeft, ChevronRight, Pause, Play, RotateCcw, Timer, X } from 'lucide-react-native';
import { Button } from '../ui/Button';
import { ICONS, ILLUSTRATIONS } from '../../constants/brand';
import { Recipe } from '../../types';
import { detectTimers, formatClock, StepTimer } from '../../utils/cooking';
import { confirmAction, notify, closeDialogOr } from '../../utils/dialogs';
import { DialogHost } from '../ui/DialogHost';

export interface CookingIngredient {
  quantity: string;
  name: string;
}

interface Props {
  visible: boolean;
  recipe: Recipe;
  /** Ingredientes ya escalados a las porciones elegidas en el detalle. */
  ingredients: CookingIngredient[];
  /** Porciones elegidas en el detalle (para "Para 4" en la hoja de ingredientes). */
  servings?: number;
  onClose: () => void;
}

interface TimerState {
  step: number;
  label: string;
  duration: number;
  /** Segundos que quedaban la última vez que se pausó. */
  remaining: number;
  /** Momento (ms) en que termina, si está corriendo. */
  endAt: number | null;
  done: boolean;
}

const KEEP_AWAKE_TAG = 'cooking-mode';
const timerKey = (step: number, index: number) => `${step}-${index}`;

const remainingOf = (t: TimerState, now: number) =>
  t.endAt ? Math.max(0, (t.endAt - now) / 1000) : t.remaining;

/** Modo cocina guiada: un paso por tarjeta, con temporizadores detectados del texto. */
export const CookingModeModal = ({ visible, recipe, ingredients, servings, onClose }: Props) => {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList<number>>(null);
  const [index, setIndex] = useState(0);
  const [timers, setTimers] = useState<Record<string, TimerState>>({});
  const [now, setNow] = useState(Date.now());
  const [showIngredients, setShowIngredients] = useState(false);
  const [checkedIngredients, setCheckedIngredients] = useState<Set<number>>(new Set());

  const steps = useMemo(() => recipe.steps ?? [], [recipe.steps]);
  const stepTimers = useMemo<StepTimer[][]>(
    () => steps.map(s => detectTimers(s.instruction ?? '')),
    [steps],
  );
  // Una tarjeta por paso más la tarjeta final.
  const pages = useMemo(() => Array.from({ length: steps.length + 1 }, (_, i) => i), [steps.length]);
  const isFinal = index === steps.length;

  // Reinicio al abrir.
  useEffect(() => {
    if (!visible) return;
    setIndex(0);
    setTimers({});
    setShowIngredients(false);
    setCheckedIngredients(new Set());
    requestAnimationFrame(() => listRef.current?.scrollToOffset({ offset: 0, animated: false }));
  }, [visible, recipe.uuid]);

  // Al cerrar (por cualquier camino) se cancelan los temporizadores: si no, suenan con la cocina guiada cerrada.
  useEffect(() => {
    if (!visible) setTimers({});
  }, [visible]);

  // Pantalla siempre encendida mientras se cocina.
  useEffect(() => {
    if (!visible) return;
    activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(() => {});
    return () => {
      try { deactivateKeepAwake(KEEP_AWAKE_TAG); } catch { /* web sin Wake Lock */ }
    };
  }, [visible]);

  const anyRunning = Object.values(timers).some(t => t.endAt && !t.done);

  // Reloj: solo late si hay algún temporizador corriendo.
  useEffect(() => {
    if (!anyRunning) return;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [anyRunning]);

  // Avisar cuando un temporizador llega a cero.
  useEffect(() => {
    const finished = Object.entries(timers).filter(
      ([, t]) => t.endAt && !t.done && t.endAt <= now,
    );
    if (!finished.length) return;
    setTimers(prev => {
      const next = { ...prev };
      finished.forEach(([k]) => {
        next[k] = { ...next[k], endAt: null, remaining: 0, done: true };
      });
      return next;
    });
    try { Vibration.vibrate([0, 600, 300, 600, 300, 600]); } catch { /* sin vibración */ }
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
    const [, first] = finished[0];
    notify('¡Tiempo!', `Terminó el temporizador de ${first.label} del paso ${first.step + 1}.`);
  }, [now, timers]);

  const goTo = useCallback((i: number) => {
    const target = Math.max(0, Math.min(pages.length - 1, i));
    setIndex(target);
    listRef.current?.scrollToOffset({ offset: target * width, animated: true });
  }, [pages.length, width]);

  // Si cambia el ancho (rotación, ventana en web), mantenemos la tarjeta actual.
  useEffect(() => {
    listRef.current?.scrollToOffset({ offset: index * width, animated: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width]);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / width);
    if (i !== index && i >= 0 && i < pages.length) setIndex(i);
  };

  const startTimer = (step: number, i: number) => {
    const key = timerKey(step, i);
    const def = stepTimers[step][i];
    setTimers(prev => {
      const current = prev[key];
      const remaining = current && !current.done ? current.remaining : def.seconds;
      return {
        ...prev,
        [key]: {
          step, label: def.label, duration: def.seconds, remaining,
          endAt: Date.now() + remaining * 1000, done: false,
        },
      };
    });
    setNow(Date.now());
  };

  const pauseTimer = (key: string) =>
    setTimers(prev => {
      const t = prev[key];
      if (!t?.endAt) return prev;
      return { ...prev, [key]: { ...t, remaining: remainingOf(t, Date.now()), endAt: null } };
    });

  const resetTimer = (key: string) =>
    setTimers(prev => {
      const next = { ...prev };
      delete next[key];
      return next;
    });

  const handleClose = async () => {
    if (anyRunning) {
      const ok = await confirmAction({
        title: 'Salir de la cocina guiada',
        message: 'Tenés temporizadores andando. Si salís, se cancelan.',
        confirmText: 'Salir',
        destructive: true,
      });
      if (!ok) return;
    }
    onClose();
  };

  const toggleIngredient = (i: number) =>
    setCheckedIngredients(prev => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });

  // Temporizadores de otros pasos que ya se usaron (para no perderlos de vista).
  const otherTimers = Object.entries(timers).filter(([, t]) => t.step !== index);
  const doneCount = checkedIngredients.size;

  const chipStyle = (t: TimerState) =>
    t.done
      ? { box: 'bg-pizca-mostaza', text: 'text-pizca-marron', icon: '#3F3128' }
      : t.endAt
        ? { box: 'bg-pizca-albahaca', text: 'text-white', icon: '#FFFFFF' }
        : { box: 'bg-pizca-crema', text: 'text-pizca-marron', icon: '#3F3128' };

  const renderTimer = (stepIndex: number, def: StepTimer, i: number) => {
    const key = timerKey(stepIndex, i);
    const state = timers[key];
    const running = !!state?.endAt;
    const done = !!state?.done;
    const remaining = state ? remainingOf(state, now) : def.seconds;
    const progress = state ? 1 - remaining / state.duration : 0;

    if (done) {
      return (
        <View key={key} className="rounded-[22px] bg-pizca-albahaca px-4 py-[18px] flex-row items-center gap-3" accessibilityLiveRegion="polite">
          <View className="w-12 h-12 rounded-full bg-pizca-fondo items-center justify-center">
            <Check size={26} color="#0C4B20" strokeWidth={3} />
          </View>
          <View className="flex-1 gap-0.5">
            <Text className="font-display text-[26px] leading-[28px] text-white">¡Tiempo!</Text>
            <Text className="text-sm font-bold text-white">Pasaron {def.label}.</Text>
          </View>
          <TouchableOpacity onPress={() => resetTimer(key)} className="h-11 px-3.5 rounded-[12px] bg-pizca-fondo items-center justify-center" accessibilityRole="button">
            <Text className="text-sm font-extrabold text-pizca-albahaca">Otra vez</Text>
          </TouchableOpacity>
        </View>
      );
    }

    const status = running ? 'Corriendo' : state ? 'En pausa' : 'Listo para arrancar';
    return (
      <View key={key} className="rounded-[22px] bg-pizca-crema p-4 gap-3">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-2 flex-1">
            <Image source={ICONS.timer} style={{ width: 22, height: 22 }} />
            <Text className="text-sm font-extrabold text-pizca-marron">Temporizador · {def.label}</Text>
          </View>
          <Text className="text-xs font-extrabold text-pizca-texto2">{status}</Text>
        </View>
        <Text
          className="font-display text-[60px] leading-[64px] text-pizca-marron text-center"
          style={{ fontVariant: ['tabular-nums'] }}
          accessibilityLabel={`Quedan ${formatClock(remaining)}`}
        >
          {formatClock(remaining)}
        </Text>
        <View className="h-2 rounded-full bg-pizca-linea overflow-hidden">
          <View className="h-2 rounded-full bg-pizca-albahaca" style={{ width: `${Math.min(100, Math.max(0, progress * 100))}%` }} />
        </View>
        <View className="flex-row gap-2">
          {running ? (
            <TouchableOpacity onPress={() => pauseTimer(key)} className="flex-1 h-12 rounded-[14px] bg-pizca-marron flex-row items-center justify-center gap-2" accessibilityRole="button">
              <Pause size={18} color="#FFF9EC" fill="#FFF9EC" />
              <Text className="text-base font-extrabold text-pizca-fondo">Pausar</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={() => startTimer(stepIndex, i)} className="flex-1 h-12 rounded-[14px] bg-pizca-albahaca flex-row items-center justify-center gap-2" accessibilityRole="button">
              <Play size={18} color="#FFFFFF" fill="#FFFFFF" />
              <Text className="text-base font-extrabold text-white">{state ? 'Seguir' : 'Iniciar'}</Text>
            </TouchableOpacity>
          )}
          {state ? (
            <TouchableOpacity
              onPress={() => resetTimer(key)}
              className="w-12 h-12 rounded-[14px] bg-white border-[1.5px] border-pizca-linea items-center justify-center"
              accessibilityRole="button"
              accessibilityLabel="Reiniciar temporizador"
            >
              <RotateCcw size={20} color="#3F3128" strokeWidth={2.2} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    );
  };

  const renderStep = (stepIndex: number) => {
    if (stepIndex === steps.length) {
      return (
        <View className="flex-1 px-4">
          <View className="flex-1 w-full max-w-2xl self-center bg-pizca-crema rounded-[28px] px-[22px] py-7 items-center justify-center gap-3.5">
            <View className="w-[148px] h-[148px] rounded-full bg-[#EFE3B0] items-center justify-center">
              <Image source={ILLUSTRATIONS.hongo} style={{ width: 99, height: 88 }} resizeMode="contain" />
            </View>
            <Text className="font-display text-[44px] leading-[48px] text-pizca-marron text-center">¡A comer!</Text>
            <Text className="text-base leading-6 text-pizca-texto2 text-center max-w-[260px]">
              Terminaste {steps.length === 1 ? 'el paso' : `los ${steps.length} pasos`}. Que lo disfrutes.
            </Text>
          </View>
        </View>
      );
    }

    const step = steps[stepIndex];
    const defs = stepTimers[stepIndex] ?? [];
    return (
      <View className="flex-1 px-4">
        <View
          className="flex-1 w-full max-w-2xl self-center bg-white rounded-[28px] border border-pizca-linea overflow-hidden"
          style={{ boxShadow: '0 10px 24px rgba(63,49,40,0.06)' }}
        >
          <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 22, paddingTop: 24, gap: 18 }}>
            <View className="w-12 h-12 rounded-full bg-pizca-mostaza items-center justify-center">
              <Text className="font-display text-[26px] text-pizca-marron">{stepIndex + 1}</Text>
            </View>
            <Text className="text-[23px] leading-[33px] font-bold text-pizca-marron">{step.instruction}</Text>
            <View className="flex-1" />
            {defs.length ? (
              <View className="gap-3">{defs.map((def, i) => renderTimer(stepIndex, def, i))}</View>
            ) : (
              <View className="flex-row justify-center items-end gap-3.5 pb-1.5" accessible={false}>
                <Image source={ILLUSTRATIONS.hongo} style={{ width: 63, height: 56, transform: [{ rotate: '-10deg' }] }} resizeMode="contain" />
                <Image source={ILLUSTRATIONS.nabo} style={{ width: 38, height: 44 }} resizeMode="contain" />
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={closeDialogOr(handleClose)}>
      <View className="flex-1 bg-pizca-fondo gap-3.5" style={{ paddingTop: Math.max(insets.top, 16) + 8, paddingBottom: Math.max(insets.bottom, 16) + 12 }}>
        {/* Encabezado */}
        <View className="px-4 gap-3.5 w-full max-w-2xl self-center">
          <View className="flex-row items-center gap-2.5">
            <TouchableOpacity
              onPress={handleClose}
              accessibilityLabel="Salir de la cocina guiada"
              className="w-11 h-11 bg-white border border-pizca-linea rounded-full items-center justify-center"
            >
              <X size={20} color="#3F3128" strokeWidth={2.4} />
            </TouchableOpacity>
            <View className="flex-1 items-center gap-px">
              <Text className="text-xs font-extrabold text-pizca-texto2 uppercase tracking-wider">Cocina guiada</Text>
              <Text className="text-base font-extrabold text-pizca-marron" numberOfLines={1}>{recipe.title}</Text>
            </View>
            <TouchableOpacity
              onPress={() => setShowIngredients(true)}
              accessibilityLabel="Ver ingredientes"
              className="w-11 h-11 bg-white border border-pizca-linea rounded-full items-center justify-center"
            >
              <Image source={ICONS.ingredientes} style={{ width: 24, height: 24 }} />
            </TouchableOpacity>
          </View>

          {/* Progreso: un segmento por paso más el final */}
          {steps.length ? (
            <View className="flex-row gap-1.5">
              {pages.map(i => (
                <TouchableOpacity
                  key={i}
                  onPress={() => goTo(i)}
                  accessibilityLabel={i === steps.length ? 'Ir al final' : `Ir al paso ${i + 1}`}
                  className="flex-1 h-7 justify-center"
                >
                  <View className={`h-2 rounded-full ${i === index ? 'bg-pizca-marron' : i < index ? 'bg-pizca-mostaza' : 'bg-pizca-linea'}`} />
                </TouchableOpacity>
              ))}
            </View>
          ) : null}

          {/* Paso actual y temporizadores de otros pasos */}
          {steps.length ? (
            <View className="flex-row items-center justify-between gap-2 min-h-[36px]">
              <Text className="text-sm font-extrabold text-pizca-texto2">
                {isFinal ? '¡Listo!' : `Paso ${index + 1} de ${steps.length}`}
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }} className="flex-grow-0">
                {otherTimers.map(([key, t]) => {
                  const c = chipStyle(t);
                  return (
                    <TouchableOpacity
                      key={key}
                      onPress={() => goTo(t.step)}
                      className={`h-9 rounded-full px-3 flex-row items-center gap-1.5 ${c.box}`}
                      accessibilityRole="button"
                      accessibilityLabel={`Ir al paso ${t.step + 1}`}
                    >
                      <Timer size={15} color={c.icon} strokeWidth={2.4} />
                      <Text className={`text-[13px] font-extrabold ${c.text}`} style={{ fontVariant: ['tabular-nums'] }}>
                        Paso {t.step + 1} · {t.done ? '¡Listo!' : formatClock(remainingOf(t, now))}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          ) : null}
        </View>

        {/* Tarjetas */}
        {steps.length ? (
          <FlatList
            ref={listRef}
            data={pages}
            keyExtractor={i => String(i)}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={onScroll}
            scrollEventThrottle={32}
            getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
            extraData={{ timers, now, width }}
            renderItem={({ item }) => <View style={{ width, flex: 1 }}>{renderStep(item)}</View>}
            className="flex-1"
            contentContainerStyle={{ flexGrow: 1 }}
          />
        ) : (
          <View className="flex-1 items-center justify-center px-8 gap-4">
            <Image source={ICONS.pasos} style={{ width: 56, height: 56 }} />
            <Text className="text-base text-pizca-texto2 text-center">Esta receta no tiene pasos cargados.</Text>
          </View>
        )}

        {/* Navegación */}
        {steps.length ? (
          <View className="flex-row gap-2.5 px-4 w-full max-w-2xl self-center">
            <TouchableOpacity
              onPress={() => goTo(index - 1)}
              disabled={index === 0}
              className="flex-1 h-14 flex-row items-center justify-center gap-1.5 rounded-[16px] bg-white border-[1.5px] border-pizca-linea"
              accessibilityRole="button"
              accessibilityState={{ disabled: index === 0 }}
            >
              <ChevronLeft size={20} color={index === 0 ? '#8C7E70' : '#3F3128'} strokeWidth={2.4} />
              <Text className={`text-base font-extrabold ${index === 0 ? 'text-pizca-apagado' : 'text-pizca-marron'}`}>Anterior</Text>
            </TouchableOpacity>
            {isFinal ? (
              <TouchableOpacity
                onPress={onClose}
                className="flex-[1.4] h-14 items-center justify-center rounded-[16px] bg-pizca-albahaca"
                accessibilityRole="button"
              >
                <Text className="text-base font-extrabold text-white">Terminar</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                onPress={() => goTo(index + 1)}
                className="flex-[1.4] h-14 flex-row items-center justify-center gap-1.5 rounded-[16px] bg-pizca-mostaza"
                accessibilityRole="button"
              >
                <Text className="text-base font-extrabold text-pizca-marron">
                  {index === steps.length - 1 ? 'Terminar' : 'Siguiente'}
                </Text>
                <ChevronRight size={20} color="#3F3128" strokeWidth={2.4} />
              </TouchableOpacity>
            )}
          </View>
        ) : null}

        {/* Hoja de ingredientes */}
        {showIngredients ? (
          <View className="absolute inset-0 bg-[#3F3128]/45 justify-end">
            <TouchableOpacity className="flex-1" onPress={() => setShowIngredients(false)} accessibilityLabel="Cerrar ingredientes" />
            <View
              className="bg-white rounded-t-[28px] px-5 pt-2.5 gap-2.5 max-h-[80%] w-full max-w-2xl self-center"
              style={{ paddingBottom: Math.max(insets.bottom, 16) + 12 }}
            >
              <View className="self-center w-10 h-[5px] rounded-full bg-pizca-linea" />
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center gap-2">
                  <Image source={ICONS.ingredientes} style={{ width: 24, height: 24 }} />
                  <Text className="text-[19px] font-extrabold text-pizca-marron">Ingredientes</Text>
                </View>
                {ingredients.length ? (
                  <Text className="text-[13px] font-bold text-pizca-texto2">
                    {servings ? `Para ${servings} · ` : ''}{doneCount} de {ingredients.length} listos
                  </Text>
                ) : null}
              </View>
              <ScrollView>
                {ingredients.length ? ingredients.map((ing, i) => {
                  const checked = checkedIngredients.has(i);
                  return (
                    <TouchableOpacity
                      key={i}
                      onPress={() => toggleIngredient(i)}
                      className="flex-row items-center gap-2.5 min-h-[44px] py-1"
                      activeOpacity={0.6}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked }}
                    >
                      {checked ? (
                        <View className="w-[22px] h-[22px] rounded-[7px] bg-pizca-albahaca items-center justify-center">
                          <Check size={14} color="#FFFFFF" strokeWidth={3.2} />
                        </View>
                      ) : (
                        <View className="w-[22px] h-[22px] rounded-[7px] border-[1.5px] border-pizca-marron" />
                      )}
                      <Text className={`text-[15px] flex-1 ${checked ? 'text-pizca-apagado line-through' : 'text-pizca-marron'}`}>
                        {ing.quantity ? <Text className={checked ? '' : 'font-extrabold'}>{ing.quantity} </Text> : null}
                        {ing.name}
                      </Text>
                    </TouchableOpacity>
                  );
                }) : (
                  <Text className="text-base text-pizca-texto2">Esta receta no tiene ingredientes cargados.</Text>
                )}
              </ScrollView>
              <Button title="Volver al paso" onPress={() => setShowIngredients(false)} />
            </View>
          </View>
        ) : null}
      </View>
      <DialogHost />
    </Modal>
  );
};
