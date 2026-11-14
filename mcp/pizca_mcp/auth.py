"""
Valida los tokens OAuth que manda Claude, preguntándole a Django (/o/introspect/, RFC 7662).

Un token sirve si está activo y fue emitido para este MCP: su "aud" incluye la URL pública del
MCP (RFC 8707). Si no, Claude podría usar acá un token pedido para otro recurso.
"""
from __future__ import annotations

import hashlib
import logging
import time

import httpx
from mcp.server.auth.provider import AccessToken

logger = logging.getLogger(__name__)

# Cuánto se recuerda la respuesta de Django. Un token revocado sigue sirviendo hasta este tiempo.
CACHE_SECONDS = 60
CACHE_MAX = 1000


def _normalizar(url: str) -> str:
    return url.strip().rstrip('/')


class IntrospectionTokenVerifier:
    def __init__(
        self,
        introspection_url: str,
        client_id: str,
        client_secret: str,
        resource: str,
        *,
        transport: httpx.AsyncBaseTransport | None = None,
    ):
        self._url = introspection_url
        self._auth = (client_id, client_secret)
        self._resource = _normalizar(resource)
        self._http = httpx.AsyncClient(timeout=httpx.Timeout(10.0), transport=transport)
        self._cache: dict[str, tuple[float, AccessToken | None]] = {}

    async def verify_token(self, token: str) -> AccessToken | None:
        key = hashlib.sha256(token.encode()).hexdigest()
        now = time.time()
        hit = self._cache.get(key)
        if hit and hit[0] > now:
            return hit[1]

        try:
            response = await self._http.post(self._url, data={'token': token}, auth=self._auth)
        except httpx.HTTPError as exc:
            # Sin cachear: es un problema de red, no del token.
            logger.warning('No se pudo introspeccionar el token: %s', exc.__class__.__name__)
            return None
        if response.status_code != 200:
            logger.error('La introspección respondió %s: revisar MCP_INTROSPECTION_CLIENT_*', response.status_code)
            return None

        data = response.json()
        result = self._access_token(token, data)
        expira = min(now + CACHE_SECONDS, data.get('exp') or now + CACHE_SECONDS)
        if len(self._cache) >= CACHE_MAX:
            self._cache = {k: v for k, v in self._cache.items() if v[0] > now}
            if len(self._cache) >= CACHE_MAX:
                self._cache.clear()
        self._cache[key] = (expira, result)
        return result

    def _access_token(self, token: str, data: dict) -> AccessToken | None:
        if not data.get('active'):
            return None
        aud = data.get('aud') or []
        if isinstance(aud, str):
            aud = [aud]
        if self._resource not in {_normalizar(a) for a in aud}:
            logger.info('Token rechazado: no fue emitido para este MCP.')
            return None
        return AccessToken(
            token=token,
            client_id=data.get('client_id') or '',
            scopes=(data.get('scope') or '').split(),
            expires_at=data.get('exp'),
            resource=self._resource,
            subject=data.get('username'),
        )
