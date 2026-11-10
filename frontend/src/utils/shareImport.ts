/** Link compartido mientras no había sesión; se retoma después del login. */
export const PENDING_IMPORT_KEY = 'pendingImportUrl';

const URL_REGEX = /https?:\/\/[^\s<>"']+/i;

/** Devuelve la primera URL http(s) que aparezca en el valor (string o array de params). */
export const extractUrl = (value?: string | string[] | null): string | null => {
  const text = Array.isArray(value) ? value.join(' ') : value;
  if (!text) return null;
  const match = text.match(URL_REGEX);
  // Saca puntuación final que suele quedar pegada al link ("...mirá esto: https://x.com/a).")
  return match ? match[0].replace(/[).,;!?]+$/, '') : null;
};
