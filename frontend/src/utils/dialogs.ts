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
