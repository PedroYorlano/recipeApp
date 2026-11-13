"""
Tools de Pizca para Claude. Solo consumen la API REST con el token del usuario: nunca tocan
la base, así cada uno ve y modifica solo lo suyo.
"""
from __future__ import annotations

import logging
from datetime import date, timedelta
from typing import Annotated, Any, Literal
from urllib.parse import parse_qs, urlparse

from mcp.server.auth.middleware.auth_context import get_access_token
from mcp.server.mcpserver import MCPServer
from pydantic import BaseModel, Field

from .client import PizcaClient, PizcaError

INSTRUCCIONES = (
    'Pizca es el recetario personal del usuario. Hablale en español rioplatense. '
    'Antes de crear una receta, buscá si ya existe. Las cantidades van como número '
    '(0.5, no "1/2") y la unidad aparte ("g", "taza", "cda"); si no hay cantidad, dejala vacía.'
)

# httpx loguea cada request en INFO: en Claude Desktop eso llena el log del servidor.
logging.getLogger('httpx').setLevel(logging.WARNING)

TOOLS: list = []


def tool(fn):
    """Registra una tool. Se agregan al servidor en crear_servidor, para stdio o HTTP."""
    TOOLS.append(fn)
    return fn


def crear_servidor(*, excluir: frozenset[str] = frozenset(), **kwargs: Any) -> MCPServer:
    server = MCPServer('pizca', instructions=INSTRUCCIONES, **kwargs)
    for fn in TOOLS:
        if fn.__name__ not in excluir:
            server.add_tool(fn)
    return server


_client: PizcaClient | None = None


def client() -> PizcaClient:
    """
    En el MCP remoto, un cliente con el token OAuth de quien llama. En local, uno solo con
    usuario y contraseña de las variables de entorno, creado en la primera tool y no al arrancar:
    si faltan las credenciales, Claude ve el error en la respuesta en vez de un servidor caído.
    """
    token = get_access_token()
    if token is not None:
        return PizcaClient.for_token(token.token)
    global _client
    if _client is None:
        _client = PizcaClient.from_env()
    return _client


# --- Formato ------------------------------------------------------------------

MOMENTOS = {
    'desayuno': 'breakfast', 'breakfast': 'breakfast',
    'almuerzo': 'lunch', 'lunch': 'lunch',
    'cena': 'dinner', 'dinner': 'dinner',
}
MOMENTOS_ES = {'breakfast': 'desayuno', 'lunch': 'almuerzo', 'dinner': 'cena'}

VIDEO_HOSTS = ('tiktok.com', 'instagram.com', 'youtube.com', 'youtu.be', 'facebook.com', 'fb.watch')


class Ingrediente(BaseModel):
    nombre: str
    cantidad: float | None = Field(None, description='Número (0.5, 200). Vacío si es "a gusto".')
    unidad: str = Field('', description='"g", "ml", "taza", "cda", "unidad"... Vacío si no aplica.')


def _ingredientes_api(ingredientes: list[Ingrediente]) -> list[dict]:
    return [
        {'name': i.nombre.strip(), 'quantity': i.cantidad, 'unit': i.unidad.strip(), 'order': n}
        for n, i in enumerate(ingredientes, start=1)
    ]


def _pasos_api(pasos: list[str]) -> list[dict]:
    return [{'order': n, 'instruction': p.strip()} for n, p in enumerate(pasos, start=1) if p.strip()]


def _resumen(r: dict) -> dict:
    return {
        'id': r['id'],
        'titulo': r['title'],
        'minutos': r.get('prep_time'),
        'porciones': r.get('servings'),
        'categorias': [c['name'] for c in r.get('categories_details', [])],
        'favorita': r.get('is_favorite', False),
    }


def _receta(r: dict) -> dict:
    return {
        **_resumen(r),
        'uuid': r['uuid'],
        'descripcion': r.get('description') or '',
        'ingredientes': [
            {'nombre': i['name'], 'cantidad': i.get('quantity'), 'unidad': i.get('unit') or ''}
            for i in sorted(r.get('ingredients', []), key=lambda i: i.get('order') or 0)
        ],
        'pasos': [s['instruction'] for s in sorted(r.get('steps', []), key=lambda s: s.get('order') or 0)],
        'link_original': r.get('original_url') or None,
        'publica': r.get('is_public', False),
    }


def _lunes(semana: str | None) -> str:
    """Cualquier fecha AAAA-MM-DD (o nada = hoy) → el lunes de esa semana."""
    try:
        dia = date.fromisoformat(semana) if semana else date.today()
    except ValueError as exc:
        raise PizcaError(f'Fecha inválida: "{semana}". Usá AAAA-MM-DD.') from exc
    return (dia - timedelta(days=dia.weekday())).isoformat()


# --- Recetas ------------------------------------------------------------------

@tool
def buscar_recetas(
    texto: Annotated[str | None, Field(description='Busca en título, descripción e ingredientes.')] = None,
    categoria_id: Annotated[int | None, Field(description='Id de listar_categorias.')] = None,
    solo_favoritas: bool = False,
    maximo: Annotated[int, Field(ge=1, le=100)] = 30,
) -> list[dict]:
    """Busca recetas del usuario (las más nuevas primero). Sin filtros, lista las últimas.
    Devuelve un resumen; para ingredientes y pasos usá ver_receta con el id."""
    params: dict[str, Any] = {
        'search': texto or None,
        'categories': categoria_id,
        'favorites': 'true' if solo_favoritas else None,
    }
    encontradas: list[dict] = []
    while len(encontradas) < maximo:
        page = client().get('/api/recetas/', **params)
        encontradas += [_resumen(r) for r in page.get('results', [])]
        cursor = parse_qs(urlparse(page.get('next') or '').query).get('cursor')
        if not cursor:
            break
        params['cursor'] = cursor[0]
    return encontradas[:maximo]


@tool
def ver_receta(id: int) -> dict:
    """Receta completa: ingredientes, pasos, categorías y link original."""
    return _receta(client().get(f'/api/recetas/{id}/'))


@tool
def crear_receta(
    titulo: str,
    ingredientes: list[Ingrediente],
    pasos: Annotated[list[str], Field(description='Un string por paso, en orden, sin numerar.')],
    porciones: int | None = None,
    tiempo_min: Annotated[int | None, Field(description='Tiempo total en minutos.')] = None,
    descripcion: str = '',
    categoria_ids: Annotated[list[int] | None, Field(description='Ids de listar_categorias.')] = None,
    link_original: str | None = None,
    imagen_url: Annotated[str | None, Field(description='URL pública de una foto (por ejemplo, la miniatura que trae importar_desde_url).')] = None,
) -> dict:
    """Guarda una receta nueva en Pizca. Antes de crear, usá buscar_recetas para ver que no exista.
    Si la receta viene de una foto o un texto, pasá los ingredientes separados en nombre,
    cantidad y unidad."""
    payload: dict[str, Any] = {
        'title': titulo.strip(),
        'description': descripcion.strip(),
        'ingredients': _ingredientes_api(ingredientes),
        'steps': _pasos_api(pasos),
        'categories': categoria_ids or [],
    }
    if porciones is not None:
        payload['servings'] = porciones
    if tiempo_min is not None:
        payload['prep_time'] = tiempo_min
    if link_original:
        payload['original_url'] = link_original
    if imagen_url:
        payload['image_url'] = imagen_url
    return _receta(client().post('/api/recetas/', payload))


@tool
def editar_receta(
    id: int,
    titulo: str | None = None,
    descripcion: str | None = None,
    porciones: int | None = None,
    tiempo_min: int | None = None,
    ingredientes: Annotated[list[Ingrediente] | None, Field(description='Reemplaza la lista entera: mandá todos, no solo los que cambian.')] = None,
    pasos: Annotated[list[str] | None, Field(description='Reemplaza la lista entera de pasos.')] = None,
    categoria_ids: Annotated[list[int] | None, Field(description='Reemplaza las categorías.')] = None,
    link_original: str | None = None,
) -> dict:
    """Cambia los campos que le pases de una receta; los demás quedan igual.
    Para cambiar un ingrediente o un paso, primero ver_receta y después mandá la lista completa."""
    payload: dict[str, Any] = {}
    if titulo is not None:
        payload['title'] = titulo.strip()
    if descripcion is not None:
        payload['description'] = descripcion.strip()
    if porciones is not None:
        payload['servings'] = porciones
    if tiempo_min is not None:
        payload['prep_time'] = tiempo_min
    if ingredientes is not None:
        payload['ingredients'] = _ingredientes_api(ingredientes)
    if pasos is not None:
        payload['steps'] = _pasos_api(pasos)
    if categoria_ids is not None:
        payload['categories'] = categoria_ids
    if link_original is not None:
        payload['original_url'] = link_original
    if not payload:
        raise PizcaError('No pasaste ningún campo para cambiar.')
    return _receta(client().patch(f'/api/recetas/{id}/', payload))


@tool
def importar_desde_url(url: str) -> dict:
    """Arma un BORRADOR de receta a partir de un link (video de TikTok, Instagram o YouTube,
    o una página de recetas) usando la IA de Pizca. NO la guarda: mostrale el borrador al
    usuario, corregí lo que haga falta y después llamá a crear_receta.
    Gasta una de las importaciones diarias del usuario (son pocas): no la uses para links
    que no sean recetas, y puede tardar hasta un par de minutos."""
    host = (urlparse(url).hostname or '').lower()
    if not host:
        raise PizcaError('Eso no parece un link. Pasá la URL completa, con https://.')
    es_video = any(host == h or host.endswith('.' + h) for h in VIDEO_HOSTS)
    data = client().post('/api/importar/' if es_video else '/api/importar-web/', {'url': url})
    r = data.get('recipe') or {}
    return {
        'titulo': r.get('title', ''),
        'descripcion': r.get('description', ''),
        'porciones': r.get('servings'),
        'tiempo_min': r.get('prep_time'),
        'ingredientes': [
            {'nombre': i.get('name', ''), 'cantidad': i.get('quantity'), 'unidad': i.get('unit') or ''}
            for i in r.get('ingredients', [])
        ],
        'pasos': [
            s.get('instruction', '') if isinstance(s, dict) else str(s)
            for s in sorted(r.get('steps', []), key=lambda s: s.get('order', 0) if isinstance(s, dict) else 0)
        ],
        'link_original': url,
        'imagen_url': r.get('image_url'),
    }


# --- Categorías ---------------------------------------------------------------

@tool
def listar_categorias() -> list[dict]:
    """Categorías disponibles (las generales de Pizca y las que creó el usuario), con su id."""
    return [{'id': c['id'], 'nombre': c['name']} for c in client().get('/api/categorias/')]


@tool
def crear_categoria(nombre: str) -> dict:
    """Crea una categoría propia. Antes fijate en listar_categorias que no exista una parecida."""
    c = client().post('/api/categorias/', {'name': nombre.strip()})
    return {'id': c['id'], 'nombre': c['name']}


# --- Planificador y compras ---------------------------------------------------

@tool
def ver_plan_semanal(
    semana: Annotated[str | None, Field(description='Cualquier día de la semana, AAAA-MM-DD. Vacío = esta semana.')] = None,
) -> dict:
    """Qué hay planificado para comer en la semana (de lunes a domingo)."""
    lunes = _lunes(semana)
    planes = client().get('/api/planner/week/', week_start=lunes)
    return {
        'semana_del': lunes,
        'comidas': [
            {
                'fecha': p['date'],
                'momento': MOMENTOS_ES.get(p['meal_type'], p['meal_type']),
                'receta': (p.get('recipe_detail') or {}).get('title'),
            }
            for p in planes
            if p.get('recipe_detail')
        ],
    }


@tool
def planificar_comida(
    fecha: Annotated[str, Field(description='AAAA-MM-DD, de hoy a 4 semanas.')],
    momento: Literal['desayuno', 'almuerzo', 'cena'],
    receta_id: int,
) -> dict:
    """Pone una receta del usuario en el planificador. Cada momento de cada día admite una sola receta."""
    receta = client().get(f'/api/recetas/{receta_id}/')
    plan = client().post('/api/planner/', {'date': fecha, 'meal_type': MOMENTOS[momento], 'recipe': receta['uuid']})
    return {'fecha': plan['date'], 'momento': momento, 'receta': receta['title']}


@tool
def ver_lista_de_compras(
    semana: Annotated[str | None, Field(description='Cualquier día de la semana, AAAA-MM-DD. Vacío = esta semana.')] = None,
) -> dict:
    """La lista de compras de la semana, agrupada por góndola. Se genera desde el planificador de la app."""
    lunes = _lunes(semana)
    items = client().get('/api/shopping/', week_start=lunes)
    por_gondola: dict[str, list[dict]] = {}
    for item in items:
        por_gondola.setdefault(item.get('category') or 'Otros', []).append({
            'item': item['ingredient_name'],
            'cantidad': item.get('quantity') or '',
            'comprado': item.get('is_checked', False),
        })
    return {'semana_del': lunes, 'gondolas': por_gondola} if items else {
        'semana_del': lunes,
        'gondolas': {},
        'nota': 'No hay lista para esa semana. Se arma desde Planificar, en la app.',
    }


def main() -> None:
    crear_servidor().run()


if __name__ == '__main__':
    main()
