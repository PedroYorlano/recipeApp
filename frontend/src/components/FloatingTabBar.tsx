import React, { useEffect, useRef, useState } from 'react';
import { Animated, Platform, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import * as Haptics from 'expo-haptics';
import { CalendarDays, Compass, Home, Plus, User, type LucideIcon } from 'lucide-react-native';
import { COLORS } from '../theme';
import { FONT, Text } from './ui/Typography';

const TABS: Record<string, { label: string; Icon: LucideIcon }> = {
  index: { label: 'Inicio', Icon: Home },
  explore: { label: 'Explorar', Icon: Compass },
  planner: { label: 'Planificar', Icon: CalendarDays },
  settings: { label: 'Perfil', Icon: User },
};

const PAD = 5;
const ITEM_HEIGHT = 52;
const BAR_HEIGHT = ITEM_HEIGHT + PAD * 2;
const GAP = 10;
const SIDE = 16;
const MAX_ITEM_WIDTH = 66;
const SPRING = { damping: 22, stiffness: 260, mass: 0.9, useNativeDriver: false } as const;

/** Distancia del borde de abajo de la pantalla al borde de abajo de la barra. */
const bottomOffset = (insetBottom: number) => Math.max(insetBottom, 8) + 8;

/**
 * Lo que una pantalla de pestaña tiene que dejar libre abajo para que la barra flotante
 * no le tape el contenido (el final de una lista, un input fijo abajo, etc.).
 */
export function useTabBarSpace() {
  const insets = useSafeAreaInsets();
  return bottomOffset(insets.bottom) + BAR_HEIGHT + 12;
}

const tap = () => {
  if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
};

/**
 * Barra de pestañas flotante: una pastilla translúcida con una píldora que se desliza hasta
 * la pestaña activa, y el "+" de crear receta en un botón redondo aparte.
 *
 * Flota sobre el contenido (no reserva lugar en el layout): cada pantalla deja el espacio
 * con `useTabBarSpace()`. Va todo por `style` y Animated de RN: `className` no se aplica
 * a un Animated.View en web.
 */
export function FloatingTabBar({ state, navigation, onCreate }: BottomTabBarProps & { onCreate: () => void }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const routes = state.routes.filter(route => TABS[route.name]);
  const activeKey = state.routes[state.index]?.key;
  const activeSlot = Math.max(0, routes.findIndex(route => route.key === activeKey));

  // Ancho de cada pestaña: lo que entre en la pantalla, con tope. En pantallas angostas
  // (320 px) se achican los márgenes y la letra para que los nombres no se toquen.
  const narrow = width < 360;
  const side = narrow ? 10 : SIDE;
  const gap = narrow ? 6 : GAP;
  const available = width - side * 2 - BAR_HEIGHT - gap - PAD * 2;
  const itemWidth = Math.min(MAX_ITEM_WIDTH, Math.floor(available / routes.length));

  const x = useRef(new Animated.Value(activeSlot * itemWidth)).current;
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!ready) {
      x.setValue(activeSlot * itemWidth);
      setReady(true);
      return;
    }
    Animated.spring(x, { toValue: activeSlot * itemWidth, ...SPRING }).start();
  }, [activeSlot, itemWidth]); // eslint-disable-line react-hooks/exhaustive-deps

  const press = (routeKey: string, routeName: string, focused: boolean) => {
    tap();
    const event = navigation.emit({ type: 'tabPress', target: routeKey, canPreventDefault: true });
    if (!focused && !event.defaultPrevented) navigation.navigate(routeName);
  };

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom: bottomOffset(insets.bottom), gap, paddingHorizontal: side }]}>
      <View style={[styles.bar, styles.glass]} accessibilityRole="tablist">
        <Animated.View
          pointerEvents="none"
          style={[styles.indicator, { width: itemWidth, transform: [{ translateX: x }] }]}
        />
        {routes.map(route => {
          const { label, Icon } = TABS[route.name];
          const focused = route.key === activeKey;
          return (
            <Pressable
              key={route.key}
              onPress={() => press(route.key, route.name, focused)}
              onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={label}
              style={[styles.item, { width: itemWidth }]}
            >
              <Icon
                size={22}
                color={focused ? COLORS.secondary : COLORS.text.secondary}
                strokeWidth={focused ? 2.3 : 2}
                fill={focused ? COLORS.primary : 'transparent'}
              />
              <Text
                numberOfLines={1}
                maxFontSizeMultiplier={1.2}
                style={[styles.label, narrow && { fontSize: 10 }, { color: focused ? COLORS.secondary : COLORS.text.secondary, fontFamily: focused ? FONT.extrabold : FONT.bold }]}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Pressable
        onPress={() => { tap(); onCreate(); }}
        accessibilityRole="button"
        accessibilityLabel="Agregar receta"
        style={({ pressed }) => [styles.create, pressed && { transform: [{ scale: 0.94 }] }]}
      >
        <Plus size={28} color={COLORS.secondary} strokeWidth={2.6} />
      </Pressable>
    </View>
  );
}

const shadow = Platform.select({
  web: { boxShadow: '0 10px 28px rgba(63,49,40,0.16), 0 2px 6px rgba(63,49,40,0.06)' },
  default: { shadowColor: '#3F3128', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.16, shadowRadius: 20, elevation: 8 },
}) as object;

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bar: {
    flexDirection: 'row',
    padding: PAD,
    height: BAR_HEIGHT,
    borderRadius: BAR_HEIGHT / 2,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...shadow,
  },
  // En web, vidrio esmerilado; en el celu, blanco casi opaco (sin expo-blur).
  glass: Platform.select({
    web: { backgroundColor: 'rgba(255,255,255,0.78)', backdropFilter: 'blur(16px) saturate(1.4)' },
    default: { backgroundColor: 'rgba(255,255,255,0.96)' },
  }) as object,
  indicator: {
    position: 'absolute',
    top: PAD,
    left: PAD,
    height: ITEM_HEIGHT,
    borderRadius: ITEM_HEIGHT / 2,
    backgroundColor: 'rgba(190,159,0,0.16)',
  },
  item: {
    height: ITEM_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  label: {
    fontSize: 11,
    lineHeight: 14,
  },
  create: {
    width: BAR_HEIGHT,
    height: BAR_HEIGHT,
    borderRadius: BAR_HEIGHT / 2,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow,
  },
});
