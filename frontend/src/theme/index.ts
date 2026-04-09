// src/theme/index.ts

import { StyleSheet } from 'react-native';

// 1. PALETA DE COLORES
export const COLORS = {
    primary: '#007AFF',      // Azul iOS moderno (Botones principales, Links)
    secondary: '#5AC8FA',    // Azul claro (Acentos suaves)
    success: '#34C759',      // Verde (Guardado exitoso)
    danger: '#FF3B30',       // Rojo (Borrar, Errores, Cerrar sesión)
    warning: '#FF9500',      // Naranja

    background: '#F2F2F7',   // Fondo general (Gris muy suave estilo iOS)
    card: '#FFFFFF',         // Fondo de tarjetas/modales

    text: {
        primary: '#000000',    // Títulos
        secondary: '#8E8E93',  // Subtítulos, descripciones
        light: '#FFFFFF',      // Texto sobre botones oscuros
    },

    border: '#C6C6C8',       // Líneas separadoras
    inputBackground: '#E5E5EA' // Fondo de inputs
};

// 2. ESPACIADO Y BORDES
export const SPACING = {
    xs: 4,
    s: 8,
    m: 16,
    l: 24,
    xl: 32,
};

export const RADIUS = {
    s: 8,
    m: 12,
    l: 20, // Para tarjetas y modales
    xl: 50, // Para botones redondos
};

// 3. ESTILOS GLOBALES REUTILIZABLES
export const globalStyles = StyleSheet.create({
    // Contenedores
    screenContainer: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    card: {
        backgroundColor: COLORS.card,
        borderRadius: RADIUS.m,
        padding: SPACING.m,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 3, // Sombra en Android
        marginBottom: SPACING.m,
    },

    // Tipografía
    title: {
        fontSize: 24,
        fontWeight: '700',
        color: COLORS.text.primary,
        marginBottom: SPACING.s,
    },
    subtitle: {
        fontSize: 18,
        fontWeight: '600',
        color: COLORS.text.primary,
        marginBottom: SPACING.xs,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: COLORS.text.secondary,
        marginBottom: SPACING.xs,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },

    // Inputs
    input: {
        backgroundColor: COLORS.card,
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: RADIUS.s,
        padding: SPACING.m,
        fontSize: 16,
        color: COLORS.text.primary,
        marginBottom: SPACING.m,
    },

    // Botones
    primaryButton: {
        backgroundColor: COLORS.primary,
        paddingVertical: SPACING.m,
        paddingHorizontal: SPACING.l,
        borderRadius: RADIUS.m,
        alignItems: 'center',
        justifyContent: 'center',
    },
    primaryButtonText: {
        color: COLORS.text.light,
        fontWeight: '600',
        fontSize: 16,
    },
    secondaryButton: {
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderColor: COLORS.primary,
        paddingVertical: SPACING.m,
        paddingHorizontal: SPACING.l,
        borderRadius: RADIUS.m,
        alignItems: 'center',
    },
    secondaryButtonText: {
        color: COLORS.primary,
        fontWeight: '600',
        fontSize: 16,
    }
});