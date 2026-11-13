# pizca-mcp

Servidor MCP local para usar Pizca desde Claude Desktop: buscar, ver, crear y editar recetas, importarlas desde un link, y consultar el planificador y la lista de compras.

Solo habla con la API REST de Pizca (por defecto, la de producción) con tu usuario. Nunca toca la base, así que ves y cambiás solo lo tuyo.

## Instalación

Necesita Python 3.12 o más nuevo.

```bash
cd mcp
python3 -m venv .venv
.venv/bin/pip install -e .
```

Con `uv` alcanza con `uv sync`, y se corre con `uv run pizca-mcp`.

## Claude Desktop

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

## Login

El login con usuario y contraseña es provisorio. En la fase 5 (MCP remoto) se reemplaza por OAuth, y solo cambia `client.py`: las tools quedan igual.
