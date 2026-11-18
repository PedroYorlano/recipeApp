import React, { useMemo } from 'react';
import { Platform, useWindowDimensions } from 'react-native';
import { SafeAreaInsetsContext, useSafeAreaInsets } from 'react-native-safe-area-context';

/** Alto de la barra de estado en los iPhone con Dynamic Island (los de notch usan ~47). */
const STATUS_BAR_FALLBACK = 59;

/**
 * Bug de iOS en las apps agregadas a la pantalla de inicio (WebKit 301994, abierto en iOS 26.5 y 27):
 * iOS dibuja una barra translúcida esmerilada arriba, encima de la página, pero
 * `env(safe-area-inset-top)` devuelve 0. Sin esto, el encabezado queda debajo de esa barra y se
 * ve borroso.
 *
 * Solo se corrige si la app está instalada en un iPhone, en vertical, el margen de arriba
 * informado es 0 y la página ocupa toda la pantalla (si iOS ya la corrió hacia abajo, no hace falta).
 */
function needsFallback(top: number, width: number, height: number): boolean {
    if (Platform.OS !== 'web' || typeof window === 'undefined' || top > 0) return false;
    const standalone = (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (!standalone || width > height) return false;
    return window.screen.height - window.innerHeight < 20;
}

export function IosPwaInsets({ children }: { children: React.ReactNode }) {
    const insets = useSafeAreaInsets();
    const { width, height } = useWindowDimensions();
    const fix = needsFallback(insets.top, width, height);
    const value = useMemo(() => (fix ? { ...insets, top: STATUS_BAR_FALLBACK } : insets), [fix, insets]);
    // Siempre el mismo árbol: si cambiara de Fragment a Provider al rotar, se remontaría toda la app.
    return <SafeAreaInsetsContext.Provider value={value}>{children}</SafeAreaInsetsContext.Provider>;
}
