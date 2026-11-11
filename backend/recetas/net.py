"""
Descargas desde URLs que manda el usuario (fotos, páginas de recetas).

Todo lo que baja de internet a pedido de un cliente pasa por `fetch_public`:
- Solo hosts cuyas IPs son todas públicas (nada de red interna, loopback ni metadata de la nube).
- Cada redirección se vuelve a revisar, así un 302 no puede saltar a una IP interna.
- Se corta mientras baja si pasa de `max_bytes`, aunque el server no mande Content-Length.
"""
import ipaddress
import socket
from urllib.parse import urljoin, urlparse

import requests

MAX_REDIRECTS = 3
TIMEOUT = 10
USER_AGENT = 'Mozilla/5.0 (compatible; Pizca/1.0)'


class FetchError(Exception):
    """No se pudo bajar la URL. El mensaje se le puede mostrar al usuario."""


def is_public_host(hostname: str) -> bool:
    """True si TODAS las IPs del host son públicas."""
    try:
        infos = socket.getaddrinfo(hostname, None)
    except (socket.gaierror, UnicodeError):
        return False
    for info in infos:
        ip = ipaddress.ip_address(info[4][0].split('%')[0])
        if not ip.is_global or ip.is_multicast:
            return False
    return bool(infos)


def fetch_public(url: str, max_bytes: int, schemes=('http', 'https')) -> bytes:
    """Baja `url` respetando las reglas de arriba. Tira FetchError si algo no cierra."""
    for _ in range(MAX_REDIRECTS + 1):
        parsed = urlparse(url)
        if parsed.scheme not in schemes:
            raise FetchError('Solo se permiten links con HTTPS.' if schemes == ('https',) else 'El link no es válido.')
        if not parsed.hostname or not is_public_host(parsed.hostname):
            raise FetchError('No pudimos acceder a ese link.')
        try:
            with requests.get(url, timeout=TIMEOUT, stream=True, allow_redirects=False,
                              headers={'User-Agent': USER_AGENT}) as response:
                if response.is_redirect:
                    url = urljoin(url, response.headers.get('Location', ''))
                    continue
                if response.status_code != 200:
                    raise FetchError(f'El sitio respondió con un error ({response.status_code}).')
                declared = response.headers.get('Content-Length')
                if declared and declared.isdigit() and int(declared) > max_bytes:
                    raise FetchError('El archivo es demasiado grande.')
                buf = bytearray()
                for chunk in response.iter_content(64 * 1024):
                    buf.extend(chunk)
                    if len(buf) > max_bytes:
                        raise FetchError('El archivo es demasiado grande.')
                return bytes(buf)
        except requests.RequestException as e:
            raise FetchError('No pudimos acceder a ese link.') from e
    raise FetchError('El link redirige demasiadas veces.')
