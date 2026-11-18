# pizca-mcp

Servidor MCP para usar Pizca desde Claude: buscar, ver, crear y editar recetas, importarlas desde un link, y consultar el planificador y la lista de compras.

Hay dos modos, con las mismas tools (salvo `importar_desde_url`, que es solo local):

- **Remoto (conector):** cualquiera lo agrega en Claude (web, Desktop o celu) y entra con su cuenta de Pizca por OAuth. No instala nada.
- **Local (stdio):** para desarrollo. Claude Desktop lo lanza en tu compu, con usuario y contraseña en la config.

En los dos casos solo habla con la API REST de Pizca con el usuario que entró. Nunca toca la base, así que cada uno ve y cambia solo lo suyo.

## Conector remoto

En Claude: **Configuración → Conectores → Agregar conector personalizado**, con la URL del MCP (`https://<servicio pizca-mcp>/mcp`). Claude abre la pantalla de login de Pizca, pide permiso, y listo. Anda en web, Desktop y celu. En el plan Free de Claude se puede tener un solo conector personalizado.

Cómo funciona:

1. Claude llama a `/mcp` sin token. El MCP responde 401 con la metadata del recurso (RFC 9728), que apunta al backend de Pizca como servidor de autorización.
2. Claude lee la metadata del backend (`/.well-known/oauth-authorization-server`) y se registra solo: su `client_id` es una URL de claude.ai (CIMD). Solo se aceptan clientes de los hosts en `OAUTH_CIMD_ALLOWED_HOSTS`.
3. El usuario entra en `/cuenta/login/` y autoriza en `/o/authorize/`. Es authorization code con PKCE S256, y el token sale atado al MCP (`resource`, RFC 8707).
4. En cada request, el MCP valida el token con `/o/introspect/` (tiene que estar activo y emitido para este MCP) y lo reenvía a `/api/`. El backend acepta los tokens del MCP en `/api/` (`recetas.oauth.validate_resource`).

Variables del servicio (`pizca-mcp-http`):

| Variable | Para qué |
|---|---|
| `MCP_PUBLIC_URL` | URL pública del endpoint, con `/mcp`. Tiene que ser igual a `PIZCA_MCP_RESOURCE` del backend. |
| `PIZCA_API_URL` | El backend, que también es el emisor OAuth (igual a `OAUTH_ISSUER`). |
| `MCP_INTROSPECTION_CLIENT_ID` / `MCP_INTROSPECTION_CLIENT_SECRET` | Credenciales para la introspección. Las mismas van en el backend, que crea el cliente al arrancar (`crear_cliente_mcp`). |

Probarlo en local con Claude Code (backend con `DEBUG=True`, que acepta el callback a localhost):

```bash
# backend, con PIZCA_MCP_RESOURCE=http://127.0.0.1:8766/mcp y las MCP_INTROSPECTION_* en el entorno
python manage.py crear_cliente_mcp && python manage.py runserver 127.0.0.1:8765
# mcp
MCP_PUBLIC_URL=http://127.0.0.1:8766/mcp PIZCA_API_URL=http://127.0.0.1:8765 PORT=8766 \
  MCP_INTROSPECTION_CLIENT_ID=... MCP_INTROSPECTION_CLIENT_SECRET=... .venv/bin/pizca-mcp-http
claude mcp add --transport http pizca-local http://127.0.0.1:8766/mcp
```

## Instalación

Necesita Python 3.12 o más nuevo.

```bash
cd mcp
python3 -m venv .venv
.venv/bin/pip install -e .
```

Con `uv` alcanza con `uv sync`, y se corre con `uv run pizca-mcp`.

## Local en Claude Desktop

En `~/Library/Application Support/Claude/claude_desktop_config.json` (en macOS):

```json
{
  "mcpServers": {
    "pizca": {
      "command": "/ruta/al/repo/mcp/.venv/bin/pizca-mcp",
      "env": {
        "PIZCA_USERNAME": "tu usuario o mail",
        "PIZCA_PASSWORD": "tu contraseña"
      }
    }
  }
}
```

La contraseña queda solo en ese archivo, que es local: nunca la subas al repo. Después de editarlo, reiniciá Claude Desktop.

| Variable | Para qué |
|---|---|
| `PIZCA_USERNAME` / `PIZCA_PASSWORD` | Tu cuenta de Pizca (usuario o mail). |
| `PIZCA_API_URL` | Opcional. Por ejemplo, `http://localhost:8000` para probar contra el backend local. |

## Tools

| Tool | Qué hace |
|---|---|
| `buscar_recetas` | Busca por texto, categoría o favoritas. Devuelve un resumen. |
| `ver_receta` | Muestra la receta completa. |
| `crear_receta` | Guarda una receta nueva. |
| `editar_receta` | Cambia solo los campos que le pases. Las listas de ingredientes y de pasos se reemplazan enteras. |
| `importar_desde_url` | Arma un borrador con la IA a partir de un link de TikTok, Instagram, YouTube o una web de recetas. **No lo guarda.** Consume la cuota diaria. |
| `listar_categorias` / `crear_categoria` | Lista las categorías o crea una. |
| `ver_plan_semanal` / `planificar_comida` | Muestra el planificador o agrega una comida. |
| `ver_lista_de_compras` | Muestra la lista de la semana, por góndola. |

## Probar

```bash
.venv/bin/pip install -e '.[dev]'
.venv/bin/pytest

# Inspector interactivo, contra la API real:
PIZCA_USERNAME=... PIZCA_PASSWORD=... npx @modelcontextprotocol/inspector .venv/bin/pizca-mcp
```
