import Constants from 'expo-constants';
import { Platform } from 'react-native';
import * as Linking from 'expo-linking';

/**
 * Resuelve la IP del servidor de desarrollo automáticamente.
 *
 * En desarrollo, Expo expone `hostUri` (ej: "192.168.31.254:8081").
 * Extraemos la IP y apuntamos al backend en el puerto 8000.
 *
 * Para producción, reemplazar con la URL real del backend.
 */
const getServerUrl = (): string => {
    // Producción: descomentar y poner la URL real
    // return 'https://api.fogon.app';

    const hostUri = Constants.expoConfig?.hostUri;
    if (hostUri) {
        const host = hostUri.split(':')[0];
        return `http://${host}:8000`;
    }

    // Fallback: localhost (para web o si hostUri no está disponible)
    return 'http://localhost:8000';
};

export const SERVER_URL = getServerUrl();
export const API_BASE = `${SERVER_URL}/api`;

/**
 * URL pública de la web (para links que se comparten). En web es el origin actual;
 * en nativo hace falta EXPO_PUBLIC_WEB_URL (si no, cae a un deep link fogon://).
 */
export const WEB_URL: string | null =
    process.env.EXPO_PUBLIC_WEB_URL ||
    (Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.origin : null);

/** Link público de una receta: /receta/<uuid>. */
export const getShareUrl = (uuid: string): string =>
    WEB_URL ? `${WEB_URL.replace(/\/$/, '')}/receta/${uuid}` : Linking.createURL(`/receta/${uuid}`);
