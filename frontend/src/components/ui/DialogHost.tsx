import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Animated, BackHandler, Easing, Platform, Pressable, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Check, CircleAlert, Info, TriangleAlert } from 'lucide-react-native';
import { Text } from './Typography';
import { dialogStore, DialogTone } from '../../utils/dialogs';

const TONES: Record<DialogTone, { bg: string; color: string; Icon: typeof Info }> = {
  info: { bg: '#FFF1C7', color: '#7A6500', Icon: Info },
  success: { bg: '#D5E4D3', color: '#0C4B20', Icon: Check },
  warning: { bg: '#FFE6B3', color: '#8A5A00', Icon: CircleAlert },
  error: { bg: '#FFE3D8', color: '#B23A12', Icon: CircleAlert },
  danger: { bg: '#FFE3D8', color: '#B23A12', Icon: TriangleAlert },
};

const useNative = Platform.OS !== 'web';

/**
 * Dibuja los avisos y confirmaciones de `notify` / `confirmAction` como una capa
 * encima de todo. Va como último hijo de la raíz y de cada Modal; solo el host
 * montado más recientemente (el que está arriba) muestra el diálogo.
 */
export function DialogHost() {
  const [hostId, setHostId] = useState<number>();
  const { current, topHost } = useSyncExternalStore(dialogStore.subscribe, dialogStore.getSnapshot, dialogStore.getSnapshot);

  useEffect(() => {
    const id = dialogStore.registerHost();
    setHostId(id);
    return () => dialogStore.unregisterHost(id);
  }, []);

  const active = !!current && hostId !== undefined && hostId === topHost;
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.92)).current;

  useEffect(() => {
    if (!active) return;
    opacity.setValue(0);
    scale.setValue(0.92);
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 160, easing: Easing.out(Easing.quad), useNativeDriver: useNative }),
      Animated.spring(scale, { toValue: 1, friction: 7, tension: 120, useNativeDriver: useNative }),
    ]).start();
  }, [active, current?.id, opacity, scale]);

  // Android: el botón atrás cierra el diálogo (cancela) en vez de navegar.
  useEffect(() => {
    if (!active || !current) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      dialogStore.resolve(current.id, false);
      return true;
    });
    return () => sub.remove();
  }, [active, current]);

  if (!active || !current) return null;

  const tone = TONES[current.tone];
  const isConfirm = !!current.cancelText;
  const destructive = current.tone === 'danger';
  const close = (confirmed: boolean) => dialogStore.resolve(current.id, confirmed);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none" accessibilityViewIsModal>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(63,49,40,0.5)', opacity }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => close(false)} accessibilityLabel="Cerrar" />
      </Animated.View>
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none" className="items-center justify-center px-6">
        <Animated.View
          style={{ opacity, transform: [{ scale }], width: '100%', maxWidth: 340, boxShadow: '0 12px 40px rgba(63,49,40,0.25)' }}
          className="bg-pizca-fondo rounded-[28px] px-6 pt-7 pb-5 items-center"
          accessibilityRole="alert"
        >
          <View className="w-14 h-14 rounded-full items-center justify-center mb-4" style={{ backgroundColor: tone.bg }}>
            <tone.Icon size={28} color={tone.color} strokeWidth={2.4} />
          </View>
          <Text className="font-display text-[24px] leading-[28px] text-pizca-marron text-center">{current.title}</Text>
          {current.message ? (
            <Text className="text-[15px] leading-[21px] text-pizca-texto2 text-center mt-2">{current.message}</Text>
          ) : null}

          <View className={`w-full mt-6 gap-2.5 ${isConfirm ? 'flex-row' : ''}`}>
            {isConfirm ? (
              <TouchableOpacity
                onPress={() => close(false)}
                activeOpacity={0.8}
                className="flex-1 h-[50px] rounded-[16px] bg-pizca-crema items-center justify-center"
                accessibilityRole="button"
              >
                <Text className="text-base font-extrabold text-pizca-marron">{current.cancelText}</Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity
              onPress={() => close(true)}
              activeOpacity={0.8}
              className={`h-[50px] rounded-[16px] items-center justify-center ${isConfirm ? 'flex-1' : 'w-full'} ${destructive ? 'bg-pizca-tomate-texto' : 'bg-pizca-mostaza'}`}
              accessibilityRole="button"
            >
              <Text className={`text-base font-extrabold ${destructive ? 'text-white' : 'text-pizca-marron'}`}>{current.confirmText}</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </View>
  );
}
