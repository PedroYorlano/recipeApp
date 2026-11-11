import { ApiError, SessionExpiredError } from '../services/api';
import { Alert, Platform } from 'react-native';

/**
 * Diálogos de la app. Se dibujan con `DialogHost` (cartel propio con el estilo PIZCA).
 * Hay un host en la raíz y otro dentro de cada Modal, porque en iOS un Modal no se
 * puede presentar encima de otro que ya está abierto: el diálogo lo dibuja el host
 * montado más recientemente, que es el que está arriba de todo.
 * Si no hay ningún host montado (p. ej. la share extension) se usa el Alert del sistema.
 */

export type DialogTone = 'info' | 'success' | 'error' | 'warning' | 'danger';

export type DialogRequest = {
    id: number;
    title: string;
    message?: string;
    tone: DialogTone;
    confirmText: string;
    /** Si está, es una confirmación con dos botones. */
    cancelText?: string;
    /** `true` si tocó el botón principal. */
    onDone: (confirmed: boolean) => void;
};

let nextId = 1;
let queue: DialogRequest[] = [];
let hosts: number[] = [];
const listeners = new Set<() => void>();
let snapshot = { current: undefined as DialogRequest | undefined, topHost: undefined as number | undefined };

const emit = () => {
    snapshot = { current: queue[0], topHost: hosts[hosts.length - 1] };
    listeners.forEach(l => l());
};

export const dialogStore = {
    subscribe(listener: () => void) {
        listeners.add(listener);
        return () => { listeners.delete(listener); };
    },
    getSnapshot: () => snapshot,
    registerHost(): number {
        const id = nextId++;
        hosts = [...hosts, id];
        emit();
        return id;
    },
    unregisterHost(id: number) {
        hosts = hosts.filter(h => h !== id);
        emit();
    },
    /** Cierra el diálogo actual y pasa al siguiente de la cola. */
    resolve(id: number, confirmed: boolean) {
        const req = queue.find(r => r.id === id);
        if (!req) return;
        queue = queue.filter(r => r.id !== id);
        emit();
        req.onDone(confirmed);
    },
};

/**
 * Para el `onRequestClose` de los Modal. En Android el botón atrás va al Modal y no al
 * BackHandler, así que sin esto cerraba el Modal con el diálogo abierto encima.
 * Si hay un diálogo abierto lo cancela; si no, cierra el Modal.
 */
export const closeDialogOr = (onClose: () => void) => () => {
    const open = snapshot.current;
    if (open) dialogStore.resolve(open.id, false);
    else onClose();
};

const push = (req: Omit<DialogRequest, 'id'>) => {
    queue = [...queue, { ...req, id: nextId++ }];
    emit();
};

/** Tono por defecto según el título, para no tener que pasarlo en cada llamada. */
const inferTone = (title: string): DialogTone => {
    const t = title.toLowerCase();
    if (t.startsWith('error') || t.startsWith('sin permiso')) return 'error';
    if (/^¡?listo|copiado|enviado|guardado/.test(t)) return 'success';
    if (t.startsWith('falta') || t.includes('incompleto') || t.includes('muy corta')) return 'warning';
    return 'info';
};

const joinMessage = (title: string, message?: string) =>
    message ? `${title}\n\n${message}` : title;

/** Muestra un aviso simple. `onClose` se llama cuando el usuario lo cierra. */
export const notify = (title: string, message?: string, onClose?: () => void, tone?: DialogTone): void => {
    if (hosts.length > 0) {
        push({ title, message, tone: tone ?? inferTone(title), confirmText: 'Entendido', onDone: () => onClose?.() });
        return;
    }
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
    if (hosts.length > 0) {
        return new Promise((resolve) => {
            push({ title, message, tone: destructive ? 'danger' : 'info', confirmText, cancelText, onDone: resolve });
        });
    }
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
 * Mensaje para mostrarle al usuario a partir de cualquier error.
 * Los de la API (`ApiError`) ya traen el texto del backend; si vino vacío se usa `fallback`.
 */
export const getErrorMessage = (e: unknown, fallback: string): string => {
    if (e instanceof ApiError) return e.message || fallback;
    if (e instanceof SessionExpiredError) return e.message;
    // fetch tira TypeError cuando no hay red ("Failed to fetch" / "Network request failed").
    if (e instanceof TypeError) return 'No pudimos conectarnos. Revisá tu conexión y probá de nuevo.';
    if (e instanceof Error && e.message && e.message.length < 200) return e.message;
    return fallback;
};
