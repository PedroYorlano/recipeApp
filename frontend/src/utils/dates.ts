/**
 * Fechas en hora local como 'YYYY-MM-DD'.
 * No usar toISOString(): convierte a UTC y en Argentina después de las 21 hs ya da el día siguiente.
 */
export const toISODate = (d: Date): string => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
};

/** 'YYYY-MM-DD' → Date a medianoche local. */
export const parseISODate = (iso: string): Date => new Date(iso + 'T00:00:00');

export const getTodayISO = (): string => toISODate(new Date());

export const addDays = (iso: string, days: number): string => {
    const d = parseISODate(iso);
    d.setDate(d.getDate() + days);
    return toISODate(d);
};

export const addWeeks = (iso: string, weeks: number): string => addDays(iso, weeks * 7);

/** Lunes de la semana actual. */
export const getCurrentMonday = (): string => {
    const today = new Date();
    const day = today.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    return addDays(toISODate(today), diff);
};
