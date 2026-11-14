"""
Cliente HTTP de la API de Pizca. Tiene dos modos, y las tools de server.py no saben cuál se usa:
- local (Claude Desktop por stdio): login con usuario y contraseña, y renovación del JWT;
- remoto (conector de Claude): el token OAuth del usuario que llama, que ya validó el MCP.
"""
from __future__ import annotations

import os
from typing import Any

import httpx

DEFAULT_API_URL = 'https://pizca-250031710115.us-east5.run.app'

# Las importaciones con IA bajan el video y lo pasan por Gemini: pueden tardar más de un minuto.
TIMEOUT = httpx.Timeout(150.0, connect=10.0)


class PizcaError(Exception):
    """Error con un mensaje listo para mostrarle a Claude (y al usuario)."""


def _flatten(errors: Any, prefix: str = '') -> list[str]:
    """Aplana los errores de validación de DRF: {"ingredients": [{"name": ["..."]}]} → ["ingredients[1].name: ..."]."""
    if isinstance(errors, dict):
        out = []
        for key, value in errors.items():
            name = key if key != 'non_field_errors' else ''
            out += _flatten(value, f'{prefix}.{name}' if prefix and name else (name or prefix))
        return out
    if isinstance(errors, list):
        if all(isinstance(item, str) for item in errors):
            return [f'{prefix}: {" ".join(errors)}' if prefix else ' '.join(errors)]
        out = []
        for index, item in enumerate(errors, start=1):
            if item:  # DRF deja {} en los elementos de una lista que no tienen errores
                out += _flatten(item, f'{prefix}[{index}]')
        return out
    return [f'{prefix}: {errors}' if prefix else str(errors)]


def error_message(response: httpx.Response) -> str:
    """Traduce una respuesta de error de la API a un mensaje legible."""
    try:
        body = response.json()
    except ValueError:
        body = None

    if isinstance(body, dict) and isinstance(body.get('error'), str):
        return body['error']
    if isinstance(body, dict) and isinstance(body.get('detail'), str):
        detail = body['detail']
    elif body:
        detail = '; '.join(_flatten(body))
    else:
        detail = ''

    if response.status_code == 429:
        return 'Pizca está frenando las solicitudes por ahora (límite de uso). Probá de nuevo en un rato.' + (f' ({detail})' if detail else '')
    if response.status_code == 404:
        return detail or 'No existe (o no es tuyo).'
    if response.status_code >= 500:
        return f'La API de Pizca falló ({response.status_code}). Probá de nuevo en un rato.'
    return detail or f'La API de Pizca respondió {response.status_code}.'


SESION_VENCIDA = 'Tu sesión de Pizca venció o se revocó. Desconectá y volvé a conectar Pizca en Claude.'

_shared_http: httpx.Client | None = None


def api_url() -> str:
    return os.environ.get('PIZCA_API_URL', '').strip() or DEFAULT_API_URL


class PizcaClient:
    def __init__(
        self,
        base_url: str,
        username: str = '',
        password: str = '',
        *,
        access_token: str | None = None,
        transport: httpx.BaseTransport | None = None,
        http: httpx.Client | None = None,
    ):
        self._username = username
        self._password = password
        # Con access_token (modo remoto) no hay login ni renovación: eso lo maneja Claude.
        self._token_mode = access_token is not None
        self._access: str | None = access_token
        self._refresh: str | None = None
        self._http = http or httpx.Client(base_url=base_url.rstrip('/'), timeout=TIMEOUT, transport=transport)

    @classmethod
    def for_token(cls, access_token: str) -> PizcaClient:
        """Cliente por request del MCP remoto. Comparte el pool de conexiones entre usuarios."""
        global _shared_http
        if _shared_http is None:
            _shared_http = httpx.Client(base_url=api_url().rstrip('/'), timeout=TIMEOUT)
        return cls(api_url(), access_token=access_token, http=_shared_http)

    @classmethod
    def from_env(cls) -> PizcaClient:
        username = os.environ.get('PIZCA_USERNAME', '').strip()
        password = os.environ.get('PIZCA_PASSWORD', '')
        if not username or not password:
            raise PizcaError('Faltan PIZCA_USERNAME y PIZCA_PASSWORD en la configuración del servidor MCP.')
        return cls(api_url(), username, password)

    # --- Tokens -------------------------------------------------------------

    def _post_token(self, path: str, payload: dict) -> httpx.Response:
        try:
            return self._http.post(path, json=payload)
        except httpx.HTTPError as exc:
            raise PizcaError(f'No se pudo conectar con Pizca ({exc.__class__.__name__}).') from exc

    def _login(self) -> None:
        response = self._post_token('/api/token/', {'username': self._username, 'password': self._password})
        if response.status_code == 401:
            raise PizcaError('Usuario o contraseña incorrectos: revisá PIZCA_USERNAME y PIZCA_PASSWORD.')
        if response.is_error:
            raise PizcaError(error_message(response))
        data = response.json()
        self._access, self._refresh = data['access'], data.get('refresh')

    def _renew(self) -> None:
        """Renueva el access con el refresh; si no hay o ya venció, vuelve a loguearse."""
        if self._refresh:
            response = self._post_token('/api/token/refresh/', {'refresh': self._refresh})
            if response.is_success:
                data = response.json()
                self._access = data['access']
                # El backend rota el refresh (ROTATE_REFRESH_TOKENS): el viejo deja de servir.
                self._refresh = data.get('refresh', self._refresh)
                return
        self._login()

    # --- Requests -----------------------------------------------------------

    def _send(self, method: str, path: str, **kwargs: Any) -> httpx.Response:
        try:
            return self._http.request(method, path, headers={'Authorization': f'Bearer {self._access}'}, **kwargs)
        except httpx.TimeoutException as exc:
            raise PizcaError('Pizca tardó demasiado en responder. Probá de nuevo.') from exc
        except httpx.HTTPError as exc:
            raise PizcaError(f'No se pudo conectar con Pizca ({exc.__class__.__name__}).') from exc

    def request(self, method: str, path: str, **kwargs: Any) -> Any:
        """Llama a la API con el token del usuario. Devuelve el JSON, o None si no hay cuerpo."""
        if not self._access:
            self._login()
        response = self._send(method, path, **kwargs)
        if response.status_code == 401:
            if self._token_mode:
                raise PizcaError(SESION_VENCIDA)
            self._renew()
            response = self._send(method, path, **kwargs)
        if response.is_error:
            raise PizcaError(error_message(response))
        return response.json() if response.content else None

    def get(self, path: str, **params: Any) -> Any:
        return self.request('GET', path, params={k: v for k, v in params.items() if v is not None})

    def post(self, path: str, payload: dict) -> Any:
        return self.request('POST', path, json=payload)

    def patch(self, path: str, payload: dict) -> Any:
        return self.request('PATCH', path, json=payload)
