/** Link compartido mientras no había sesión; se retoma después del login. */
export const PENDING_IMPORT_KEY = 'pendingImportUrl';

// Los mismos que acepta el backend en /api/importar/ (ALLOWED_VIDEO_DOMAINS).
const VIDEO_DOMAINS = ['youtube.com', 'youtu.be', 'tiktok.com', 'instagram.com', 'facebook.com', 'fb.watch'];

/** Modo del formulario para un link que llega de afuera: video si es de una red de videos, si no una página web. */
export const importModeForUrl = (url: string): 'video' | 'link-web' => {
  const host = url.match(/^https?:\/\/(?:[^/?#@]*@)?([^/?#:]+)/i)?.[1].toLowerCase() ?? '';
  return VIDEO_DOMAINS.some(d => host === d || host.endsWith(`.${d}`)) ? 'video' : 'link-web';
};

/**
 * Links que pueden ser una colección: colecciones de TikTok, playlists de YouTube y los links
 * cortos de TikTok (vt./vm.), que no dicen si son un video o una colección hasta resolverlos.
 * Un video abierto desde una playlist (watch?v=…&list=…) cuenta como video suelto.
 */
export const mightBeCollection = (url: string): boolean => {
  let parsed: URL;
  try { parsed = new URL(url); } catch { return false; }
  const host = parsed.hostname.toLowerCase();
  if (host === 'tiktok.com' || host.endsWith('.tiktok.com')) {
    return /\/collection\//.test(parsed.pathname) || host === 'vt.tiktok.com' || host === 'vm.tiktok.com';
  }
  if (host === 'youtube.com' || host.endsWith('.youtube.com')) {
    return parsed.pathname === '/playlist' && parsed.searchParams.has('list');
  }
  return false;
};

const URL_REGEX = /https?:\/\/[^\s<>"']+/i;

/** Devuelve la primera URL http(s) que aparezca en el valor (string o array de params). */
export const extractUrl = (value?: string | string[] | null): string | null => {
  const text = Array.isArray(value) ? value.join(' ') : value;
  if (!text) return null;
  const match = text.match(URL_REGEX);
  // Saca puntuación final que suele quedar pegada al link ("...mirá esto: https://x.com/a).")
  return match ? match[0].replace(/[).,;!?]+$/, '') : null;
};
