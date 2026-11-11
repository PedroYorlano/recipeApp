/** @type {import('tailwindcss').Config} */
const plugin = require('tailwindcss/plugin');

// Nunito Sans se carga con un archivo por peso (ver app/_layout.tsx), así que
// cada clase de peso elige la familia correspondiente en vez de usar
// fontWeight, que en Android con fuentes custom no funciona.
const WEIGHTS = {
  normal: 'NunitoSans_400Regular',
  medium: 'NunitoSans_600SemiBold',
  semibold: 'NunitoSans_700Bold',
  bold: 'NunitoSans_700Bold',
  extrabold: 'NunitoSans_800ExtraBold',
  black: 'NunitoSans_900Black',
};

module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  corePlugins: { fontWeight: false },
  theme: {
    extend: {
      colors: {
        // Paleta PIZCA (ver el canvas "Pizca rediseño").
        pizca: {
          mostaza: '#BE9F00',        // marca, botón principal (texto marrón encima)
          'mostaza-texto': '#7A6500', // textos y links en mostaza
          marron: '#3F3128',         // texto, íconos, chip activo
          tomate: '#F95421',         // favoritos, alertas
          'tomate-texto': '#B23A12', // mensajes de error
          ambar: '#FFAA00',          // resaltados
          albahaca: '#0C4B20',       // cocinar, éxito
          crema: '#FAECD2',          // campos, chips
          fondo: '#FFF9EC',          // fondo de pantalla
          texto2: '#6B5A4E',         // texto secundario
          linea: '#EADFC8',          // bordes y separadores
          apagado: '#8C7E70',        // texto deshabilitado
        },
      },
      fontFamily: {
        display: ['Ranchers_400Regular'],
        sans: ['NunitoSans_400Regular'],
      },
    },
  },
  plugins: [
    plugin(({ addUtilities }) => {
      addUtilities(
        Object.fromEntries(
          Object.entries(WEIGHTS).map(([name, family]) => [`.font-${name}`, { fontFamily: family }]),
        ),
      );
    }),
  ],
};
