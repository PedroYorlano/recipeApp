/**
 * Utilidades del modo cocina guiada: detección de tiempos de espera en el
 * texto de cada paso ("hornear 40 minutos", "reposar 1 hora y media").
 */

export interface StepTimer {
  /** Duración del temporizador en segundos. */
  seconds: number;
  /** Texto para mostrar, ej. "40 min" o "10–15 min". */
  label: string;
}

const NUM = String.raw`\d+(?:[.,]\d+)?`;
const UNIT = String.raw`(segundos?|segs?|minutos?|mins?|horas?|hrs?|hs|h)`;
// "40 minutos", "10 a 15 min", "1-2 horas", "1 hora y media"
const NUMERIC_RE = new RegExp(
  String.raw`(${NUM})(?:\s*(?:a|-|–|o)\s*(${NUM}))?\s*${UNIT}(?![a-záéíóúñ])(\s+y\s+media)?`,
  'gi',
);
// "media hora", "una hora", "un minuto", "un par de minutos"
const WORDS: [RegExp, number][] = [
  [/\bhora\s+y\s+media\b/i, 90 * 60],
  [/\bmedia\s+hora\b/i, 30 * 60],
  [/\buna\s+hora\b/i, 60 * 60],
  [/\bun\s+par\s+de\s+minutos\b/i, 2 * 60],
  [/\bun\s+minuto\b/i, 60],
];

const MAX_SECONDS = 24 * 60 * 60;

const toNumber = (s: string) => parseFloat(s.replace(',', '.'));

const unitSeconds = (unit: string): number => {
  const u = unit.toLowerCase();
  if (u.startsWith('h')) return 3600;
  if (u.startsWith('s')) return 1;
  return 60;
};

/** Formatea segundos como duración corta: "45 s", "10 min", "1 h 30 min". */
export const formatDuration = (total: number): string => {
  if (total < 60) return `${Math.round(total)} s`;
  const h = Math.floor(total / 3600);
  const m = Math.round((total % 3600) / 60);
  if (!h) return `${m} min`;
  return m ? `${h} h ${m} min` : `${h} h`;
};

/** Formatea segundos restantes como reloj: "04:05" o "1:02:30". */
export const formatClock = (total: number): string => {
  const t = Math.max(0, Math.ceil(total));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
};

/**
 * Busca los tiempos de espera mencionados en un paso. Si hay un rango
 * ("10 a 15 minutos") el temporizador usa el mínimo, para revisar a tiempo.
 */
export const detectTimers = (text: string): StepTimer[] => {
  const found: StepTimer[] = [];
  const seen = new Set<number>();
  const add = (seconds: number, label: string) => {
    if (seconds <= 0 || seconds > MAX_SECONDS || seen.has(seconds)) return;
    seen.add(seconds);
    found.push({ seconds: Math.round(seconds), label });
  };

  for (const m of text.matchAll(NUMERIC_RE)) {
    const [, from, to, unit, half] = m;
    const factor = unitSeconds(unit);
    const extra = half && factor === 3600 ? 1800 : 0;
    const min = toNumber(from) * factor + extra;
    if (to) {
      const max = toNumber(to) * factor + extra;
      const lo = formatDuration(Math.min(min, max));
      const hi = formatDuration(Math.max(min, max));
      // "10–15 min" en vez de "10 min–15 min"
      const sameUnit = lo.split(' ').length === 2 && lo.split(' ')[1] === hi.split(' ').slice(-1)[0];
      add(Math.min(min, max), sameUnit && hi.split(' ').length === 2 ? `${lo.split(' ')[0]}–${hi}` : `${lo}–${hi}`);
    } else {
      add(min, formatDuration(min));
    }
  }

  if (!found.length) {
    for (const [re, seconds] of WORDS) {
      if (re.test(text)) {
        add(seconds, formatDuration(seconds));
        break;
      }
    }
  }
  return found;
};
