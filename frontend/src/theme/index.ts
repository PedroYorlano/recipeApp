// src/theme/index.ts

// 1. PALETA DE COLORES (PIZCA). Mismos valores que tailwind.config.js.
export const COLORS = {
    primary: '#BE9F00',      // mostaza: botón principal (con texto marrón)
    primaryText: '#7A6500',  // mostaza para textos y links
    secondary: '#3F3128',    // marrón: texto, íconos
    success: '#0C4B20',      // albahaca: cocinar, éxito
    danger: '#F95421',       // tomate: favoritos, alertas
    dangerText: '#B23A12',   // tomate oscuro para mensajes de error
    warning: '#FFAA00',      // ámbar: resaltados

    background: '#FFF9EC',   // fondo de pantalla
    card: '#FFFFFF',         // tarjetas y modales
    cream: '#FAECD2',        // campos y chips

    text: {
        primary: '#3F3128',
        secondary: '#6B5A4E',
        light: '#FFF9EC',     // texto sobre fondos oscuros
        disabled: '#8C7E70',
    },

    border: '#EADFC8',
    inputBackground: '#FAECD2'
};
