import { Alert, Platform } from 'react-native';

/**
 * Diálogos cross-platform. En react-native-web `Alert.alert` no hace nada,
 * así que en web usamos `window.alert` / `window.confirm`.
 */

const joinMessage = (title: string, message?: string) =>
    message ? `${title}\n\n${message}` : title;

/** Muestra un aviso simple. `onClose` se llama cuando el usuario lo cierra. */
export const notify = (title: string, message?: string, onClose?: () => void): void => {
    if (Platform.OS === 'web') {
        window.alert(joinMessage(title, message));
        onClose?.();
        return;
    }
    Alert.alert(title, message, [{ text: 'OK', onPress: onClose }], {
        cancelable: true,
        onDismiss: onClose,
    });
};

type ConfirmOptions = {
    title: string;
    message?: string;
    confirmText?: string;
    cancelText?: string;
    destructive?: boolean;
};

/** Pide confirmación. Resuelve `true` si el usuario acepta. */
export const confirmAction = ({
    title,
    message,
    confirmText = 'Aceptar',
    cancelText = 'Cancelar',
    destructive = false,
}: ConfirmOptions): Promise<boolean> => {
    if (Platform.OS === 'web') {
        return Promise.resolve(window.confirm(joinMessage(title, message)));
    }
    return new Promise((resolve) => {
        Alert.alert(
            title,
            message,
            [
                { text: cancelText, style: 'cancel', onPress: () => resolve(false) },
                {
                    text: confirmText,
                    style: destructive ? 'destructive' : 'default',
                    onPress: () => resolve(true),
                },
            ],
            { cancelable: true, onDismiss: () => resolve(false) }
        );
    });
};

/**
 * Saca un mensaje legible de un error de la API. Los services tiran `Error(JSON.stringify(body))`,
 * con `{error: "..."}` o con errores de DRF por campo (`{title: ["..."]}`).
 */
export const getErrorMessage = (e: unknown, fallback: string): string => {
    const raw = e instanceof Error ? e.message : typeof e === 'string' ? e : '';
    if (!raw) return fallback;
    try {
        const body = JSON.parse(raw);
        if (typeof body === 'string') return body;
        if (body?.error) return String(body.error);
        if (body?.detail) return String(body.detail);
        const first = Object.values(body ?? {}).flat()[0];
        if (typeof first === 'string') return first;
        if (first && typeof first === 'object') {
            const nested = Object.values(first).flat()[0];
            if (typeof nested === 'string') return nested;
        }
        return fallback;
    } catch {
        // No era JSON: si parece un mensaje para humanos lo mostramos tal cual.
        return raw.length < 200 ? raw : fallback;
    }
};
