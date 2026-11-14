import Constants from 'expo-constants';
import { Platform } from 'react-native';
import * as Linking from 'expo-linking';

/**
 * URL del backend.
 *
 * - Producción: EXPO_PUBLIC_API_URL (ej: "https://api.pizca.app"), se fija al compilar.
 * - Desarrollo: Expo expone `hostUri` (ej: "192.168.31.254:8081"); se usa esa IP con el puerto 8000,
 *   así el celu con Expo Go llega a la compu sin configurar nada.
 */
const getServerUrl = (): string => {
    const configured = process.env.EXPO_PUBLIC_API_URL;
    if (configured) return configured.replace(/\/$/, '');

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
 * en nativo hace falta EXPO_PUBLIC_WEB_URL (si no, cae a un deep link pizca://).
 */
export const WEB_URL: string | null =
    process.env.EXPO_PUBLIC_WEB_URL ||
    (Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.origin : null);

/** Link público de una receta: /receta/<uuid>. */
export const getShareUrl = (uuid: string): string =>
    WEB_URL ? `${WEB_URL.replace(/\/$/, '')}/receta/${uuid}` : Linking.createURL(`/receta/${uuid}`);

/**
 * Conector de Claude (el MCP remoto), p. ej. https://pizca-mcp-….run.app/mcp.
 * Sin EXPO_PUBLIC_MCP_URL, Perfil no muestra la guía del conector.
 */
export const MCP_URL: string | null = process.env.EXPO_PUBLIC_MCP_URL?.trim() || null;
