"""
Descargas desde URLs que manda el usuario (fotos, páginas de recetas).

Todo lo que baja de internet a pedido de un cliente pasa por `fetch_public`:
- Solo hosts cuyas IPs son todas públicas (nada de red interna, loopback ni metadata de la nube).
- Cada redirección se vuelve a revisar, así un 302 no puede saltar a una IP interna.
- La conexión va a la IP que se revisó, sin volver a resolver el nombre: si no, un DNS que
  contesta distinto la segunda vez (rebinding) se saltea el chequeo.
- Se corta mientras baja si pasa de `max_bytes`, aunque el server no mande Content-Length.
"""
import ipaddress
import socket
from contextlib import contextmanager
from urllib.parse import urljoin, urlparse

import requests
from requests.adapters import HTTPAdapter

MAX_REDIRECTS = 3
TIMEOUT = 10
USER_AGENT = 'Mozilla/5.0 (compatible; Pizca/1.0)'


class FetchError(Exception):
    """No se pudo bajar la URL. El mensaje se le puede mostrar al usuario."""


def public_ips(hostname: str) -> list[str]:
    """Las IPs del host, o [] si no resuelve o si alguna no es pública."""
    try:
        infos = socket.getaddrinfo(hostname, None)
    except (socket.gaierror, UnicodeError):
        return []
    ips = []
    for info in infos:
        ip = ipaddress.ip_address(info[4][0].split('%')[0])
        if not ip.is_global or ip.is_multicast:
            return []
        if str(ip) not in ips:
            ips.append(str(ip))
    # IPv4 primero: muchos hosts no tienen salida por IPv6 y se conecta a una sola IP.
    return sorted(ips, key=lambda ip: ':' in ip)


class _PinnedHostAdapter(HTTPAdapter):
    """HTTPS contra una IP: el SNI y la validación del certificado siguen usando el nombre del sitio."""

    def __init__(self, hostname: str):
        self._hostname = hostname
        super().__init__()

    def init_poolmanager(self, *args, **kwargs):
        kwargs['server_hostname'] = self._hostname
        kwargs['assert_hostname'] = self._hostname
        super().init_poolmanager(*args, **kwargs)


@contextmanager
def _open(parsed, ip: str):
    """GET a `parsed` conectando a `ip` (ya validada). No sigue redirecciones ni usa proxies del entorno."""
    host = f'[{ip}]' if ':' in ip else ip
    port = f':{parsed.port}' if parsed.port else ''
    pinned_url = parsed._replace(netloc=host + port).geturl()
    with requests.Session() as session:
        session.trust_env = False
        if parsed.scheme == 'https':
            session.mount('https://', _PinnedHostAdapter(parsed.hostname))
        headers = {'Host': parsed.hostname + port, 'User-Agent': USER_AGENT}
        with session.get(pinned_url, timeout=TIMEOUT, stream=True, allow_redirects=False,
                         headers=headers) as response:
            yield response


def fetch_public(url: str, max_bytes: int, schemes=('http', 'https')) -> bytes:
    """Baja `url` respetando las reglas de arriba. Tira FetchError si algo no cierra."""
    for _ in range(MAX_REDIRECTS + 1):
        parsed = urlparse(url)
        if parsed.scheme not in schemes:
            raise FetchError('Solo se permiten links con HTTPS.' if schemes == ('https',) else 'El link no es válido.')
        try:
            parsed.port  # tira ValueError si el puerto no es un número
            ips = public_ips(parsed.hostname) if parsed.hostname else []
        except ValueError:
            ips = []
        if not ips:
            raise FetchError('No pudimos acceder a ese link.')
        try:
            with _open(parsed, ips[0]) as response:
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
