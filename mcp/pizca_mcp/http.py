"""
MCP remoto: el conector de Pizca para Claude (web, Desktop y celu).

Transporte Streamable HTTP en /mcp, sin estado. Django es el servidor de autorización: el SDK
responde 401 con la metadata del recurso (RFC 9728) apuntando a Django, Claude hace el login
OAuth ahí, y cada request llega con el token del usuario, que las tools reenvían a la API.

Variables de entorno:
- MCP_PUBLIC_URL: URL pública del endpoint, p. ej. https://pizca-mcp-....run.app/mcp. Es el
  "resource" de los tokens y tiene que coincidir con PIZCA_MCP_RESOURCE del backend.
- PIZCA_API_URL: el backend, que también es el emisor OAuth (OAUTH_ISSUER).
- MCP_INTROSPECTION_CLIENT_ID / MCP_INTROSPECTION_CLIENT_SECRET: para /o/introspect/.
- PORT: lo pone Cloud Run (8080 por defecto).
"""
from __future__ import annotations

import logging
import os
import sys

from mcp.server.auth.settings import AuthSettings

from .auth import IntrospectionTokenVerifier
from .client import api_url
from .server import crear_servidor


# Tools que el conector no expone. importar_desde_url baja videos y páginas que elige quien llama
# y gasta la cuota de Gemini, que es de todos. Además, lo que devuelve es texto de terceros que le
# llega a Claude (posible prompt injection). Para cargar recetas desde Claude no hace falta: Claude
# ya lee el texto o la foto. Sigue disponible en la app y en el MCP local.
SOLO_LOCAL = frozenset({'importar_desde_url'})


def _requerida(nombre: str) -> str:
    valor = os.environ.get(nombre, '').strip()
    if not valor:
        sys.exit(f'Falta la variable de entorno {nombre}.')
    return valor


def crear_app():
    public_url = _requerida('MCP_PUBLIC_URL').rstrip('/')
    issuer = api_url().rstrip('/')
    verifier = IntrospectionTokenVerifier(
        f'{issuer}/o/introspect/',
        _requerida('MCP_INTROSPECTION_CLIENT_ID'),
        _requerida('MCP_INTROSPECTION_CLIENT_SECRET'),
        public_url,
    )
    server = crear_servidor(
        excluir=SOLO_LOCAL,
        token_verifier=verifier,
        auth=AuthSettings(
            issuer_url=issuer,
            resource_server_url=public_url,
            required_scopes=['pizca'],
            # La audiencia la chequea IntrospectionTokenVerifier, normalizando la barra final.
            validate_token_resource=False,
        ),
    )
    # Cloud Run termina el TLS y reenvía con su propio Host: sin protección de DNS rebinding,
    # que es para servidores locales. Acá la protección es OAuth.
    return server.streamable_http_app(stateless_http=True, host='0.0.0.0')


def main() -> None:
    import uvicorn

    logging.basicConfig(level=logging.INFO, format='%(levelname)s %(name)s: %(message)s')
    uvicorn.run(
        crear_app(),
        host='0.0.0.0',
        port=int(os.environ.get('PORT', '8080')),
        proxy_headers=True,
        forwarded_allow_ips='*',
    )
