import json

import httpx
import pytest

from pizca_mcp import server
from pizca_mcp.client import PizcaClient, PizcaError

RECETA = {
    'id': 7, 'uuid': 'u-7', 'title': 'Tortilla', 'description': '', 'servings': 2, 'prep_time': 30,
    'categories_details': [{'id': 1, 'name': 'Cenas', 'parent': None}],
    'ingredients': [
        {'id': 2, 'name': 'Huevos', 'quantity': 4.0, 'unit': '', 'order': 2},
        {'id': 1, 'name': 'Papas', 'quantity': 500.0, 'unit': 'g', 'order': 1},
    ],
    'steps': [{'id': 1, 'order': 1, 'instruction': 'Freír las papas.'}],
    'original_url': '', 'is_favorite': True, 'is_public': False,
}


@pytest.fixture
def api(monkeypatch):
    """Instala un cliente con una API de mentira y devuelve la lista de requests que recibió."""
    calls: list[httpx.Request] = []
    pages = {
        None: {'next': 'https://api.test/api/recetas/?cursor=abc&search=papa', 'results': [RECETA]},
        'abc': {'next': None, 'results': [{**RECETA, 'id': 8, 'title': 'Tortilla 2'}]},
    }

    def handler(request: httpx.Request) -> httpx.Response:
        calls.append(request)
        path = request.url.path
        if path == '/api/token/':
            return httpx.Response(200, json={'access': 'a', 'refresh': 'r'})
        if path == '/api/recetas/' and request.method == 'GET':
            return httpx.Response(200, json=pages[request.url.params.get('cursor')])
        if path == '/api/recetas/' and request.method == 'POST':
            body = json.loads(request.content)
            return httpx.Response(201, json={**RECETA, 'title': body['title']})
        if path == '/api/recetas/7/':
            return httpx.Response(200, json=RECETA)
        if path == '/api/planner/':
            body = json.loads(request.content)
            return httpx.Response(201, json={'id': 1, 'date': body['date'], 'meal_type': body['meal_type']})
        if path == '/api/importar/':
            return httpx.Response(201, json={'message': 'ok', 'recipe': {
                'title': 'Reel', 'ingredients': [{'name': 'Sal', 'quantity': None, 'unit': ''}],
                'steps': [{'order': 2, 'instruction': 'B'}, {'order': 1, 'instruction': 'A'}],
                'image_url': 'https://img.test/x.jpg',
            }})
        return httpx.Response(404, json={'detail': 'No encontrado.'})

    client = PizcaClient('https://api.test', 'yo', 'clave', transport=httpx.MockTransport(handler))
    monkeypatch.setattr(server, '_client', client)
    return calls


def test_buscar_sigue_el_cursor(api):
    found = server.buscar_recetas(texto='papa')
    assert [r['id'] for r in found] == [7, 8]
    assert found[0] == {'id': 7, 'titulo': 'Tortilla', 'minutos': 30, 'porciones': 2, 'categorias': ['Cenas'], 'favorita': True}
    gets = [r for r in api if r.url.path == '/api/recetas/']
    assert gets[1].url.params['cursor'] == 'abc' and gets[1].url.params['search'] == 'papa'


def test_buscar_respeta_el_maximo(api):
    assert len(server.buscar_recetas(maximo=1)) == 1


def test_ver_receta_ordena_ingredientes(api):
    r = server.ver_receta(7)
    assert [i['nombre'] for i in r['ingredientes']] == ['Papas', 'Huevos']
    assert r['pasos'] == ['Freír las papas.']


def test_crear_receta_mapea_campos(api):
    server.crear_receta(
        titulo=' Guiso ', ingredientes=[server.Ingrediente(nombre='Arroz', cantidad=0.5, unidad='taza')],
        pasos=['Hervir', ' '], tiempo_min=40, categoria_ids=[1],
    )
    body = json.loads(api[-1].content)
    assert body == {
        'title': 'Guiso', 'description': '', 'categories': [1], 'prep_time': 40,
        'ingredients': [{'name': 'Arroz', 'quantity': 0.5, 'unit': 'taza', 'order': 1}],
        'steps': [{'order': 1, 'instruction': 'Hervir'}],
    }


def test_editar_sin_campos(api):
    with pytest.raises(PizcaError):
        server.editar_receta(7)


def test_planificar_usa_el_uuid(api):
    out = server.planificar_comida('2026-11-20', 'cena', 7)
    assert json.loads(api[-1].content) == {'date': '2026-11-20', 'meal_type': 'dinner', 'recipe': 'u-7'}
    assert out == {'fecha': '2026-11-20', 'momento': 'cena', 'receta': 'Tortilla'}


def test_importar_video_devuelve_borrador(api):
    draft = server.importar_desde_url('https://www.instagram.com/reel/abc/')
    assert api[-1].url.path == '/api/importar/'
    assert draft['pasos'] == ['A', 'B']
    assert draft['link_original'] == 'https://www.instagram.com/reel/abc/'
    assert draft['imagen_url'] == 'https://img.test/x.jpg'


def test_lunes():
    assert server._lunes('2026-11-13') == '2026-11-09'  # viernes → lunes
    with pytest.raises(PizcaError):
        server._lunes('13/11')
