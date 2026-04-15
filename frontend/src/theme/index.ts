// src/theme/index.ts

import { StyleSheet } from 'react-native';

// 1. PALETA DE COLORES (Fogón Identity)
export const COLORS = {
    primary: '#EF9F27',      // fogon-amber (Botones principales, acentos)
    secondary: '#633806',    // fogon-brown (Headers, acentos pesados)
    success: '#3B6D11',      // fogon-green (Guardado exitoso, etiquetas)
    danger: '#FF3B30',       // Mantenemos rojo para validaciones críticas
    warning: '#FF9500',      

    background: '#FAEEDA',   // fogon-cream (Fondos principales)
    card: '#FFF8F0',         // fogon-white (Fondos de tarjetas/modales)

    text: {
        primary: '#633806',    // fogon-brown (Títulos)
        secondary: '#A89070',  // fogon-gray (Subtítulos, placeholders)
        light: '#FFF8F0',      // fogon-white (Texto sobre botones oscuros)
    },

    border: '#A89070',       // fogon-gray (Líneas sutiles)
    inputBackground: '#FFFFFF' 
};

// 2. ESPACIADO Y BORDES (Diseño Cálido)
export const SPACING = {
    xs: 4,
    s: 8,
    m: 16,
    l: 24,
    xl: 32,
};

export const RADIUS = {
    s: 12, // Para inputs
    m: 16, // Para tarjetas y modales
    l: 24, 
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