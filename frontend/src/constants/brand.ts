/**
 * Assets de marca de PIZCA (íconos de color e ilustraciones de la diseñadora).
 * Los íconos de color van en contenido; para navegación y acciones chicas se
 * usan íconos de línea (lucide) en marrón.
 */
export const ICONS = {
  desayuno: require('../../assets/pizca/ic-desayuno.png'),
  almuerzo: require('../../assets/pizca/ic-almuerzo.png'),
  snacks: require('../../assets/pizca/ic-snacks.png'),
  cena: require('../../assets/pizca/ic-cena.png'),
  compras: require('../../assets/pizca/ic-compras.png'),
  web: require('../../assets/pizca/ic-web.png'),
  video: require('../../assets/pizca/ic-video.png'),
  audio: require('../../assets/pizca/ic-audio.png'),
  texto: require('../../assets/pizca/ic-texto.png'),
  timer: require('../../assets/pizca/ic-timer.png'),
  guardado: require('../../assets/pizca/ic-guardado.png'),
  ingredientes: require('../../assets/pizca/ic-ingredientes.png'),
  pasos: require('../../assets/pizca/ic-pasos.png'),
  categorias: require('../../assets/pizca/ic-categorias.png'),
  favoritos: require('../../assets/pizca/ic-favoritos.png'),
} as const;

export const ILLUSTRATIONS = {
  hongo: require('../../assets/pizca/il-hongo.png'),
  tomate: require('../../assets/pizca/il-tomate.png'),
  tomate2: require('../../assets/pizca/il-tomate2.png'),
  zanahoria: require('../../assets/pizca/il-zanahoria.png'),
  naranja: require('../../assets/pizca/il-naranja.png'),
  remolacha: require('../../assets/pizca/il-remolacha.png'),
  morron: require('../../assets/pizca/il-morron.png'),
  frutilla: require('../../assets/pizca/il-frutilla.png'),
  nabo: require('../../assets/pizca/il-nabo.png'),
  berenjena: require('../../assets/pizca/il-berenjena.png'),
} as const;

export const LOGO = require('../../assets/pizca/logo.png');
export const ISOLOGO = require('../../assets/pizca/isologo.png');

/** Fondos pastel de las portadas sin foto. */
const COVER_BGS = ['#EFE3B0', '#FDD9C8', '#D5E4D3', '#FFE6B3'];
const COVER_ILLUSTRATIONS = Object.values(ILLUSTRATIONS);

/** Portada estable para una receta sin foto: misma receta, misma ilustración. */
export const coverFor = (key: string | number | undefined) => {
  const s = String(key ?? '');
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return {
    background: COVER_BGS[h % COVER_BGS.length],
    illustration: COVER_ILLUSTRATIONS[Math.floor(h / COVER_BGS.length) % COVER_ILLUSTRATIONS.length],
  };
};
