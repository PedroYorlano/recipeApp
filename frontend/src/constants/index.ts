import Constants from 'expo-constants';

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