import json

import httpx
import pytest

from pizca_mcp.client import PizcaClient, PizcaError, error_message


class FakeApi:
    """API de mentira: guarda las requests y responde según el path."""

    def __init__(self):
        self.calls: list[tuple[str, str, str | None]] = []
        self.valid_access = {'access-1'}
        self.refresh_ok = True
        self.login_ok = True
        self.logins = 0
        self.refreshes = 0
        self.refresh_sent: list[str] = []

    def __call__(self, request: httpx.Request) -> httpx.Response:
        auth = request.headers.get('Authorization')
        self.calls.append((request.method, request.url.path, auth))
        if request.url.path == '/api/token/':
            if not self.login_ok:
                return httpx.Response(401, json={'detail': 'No active account found'})
            self.logins += 1
            token = f'access-{self.logins}'
            self.valid_access.add(token)
            return httpx.Response(200, json={'access': token, 'refresh': f'refresh-{self.logins}'})
        if request.url.path == '/api/token/refresh/':
            self.refreshes += 1
            if not self.refresh_ok:
                return httpx.Response(401, json={'detail': 'Token is invalid or expired'})
            sent = json.loads(request.content)['refresh']
            self.refresh_sent.append(sent)
            token = f'access-r{self.refreshes}'
            self.valid_access.add(token)
            return httpx.Response(200, json={'access': token, 'refresh': f'{sent}-rotado'})
        if auth not in {f'Bearer {t}' for t in self.valid_access}:
            return httpx.Response(401, json={'detail': 'Given token not valid'})
        return httpx.Response(200, json={'ok': True})


def make_client(api: FakeApi) -> PizcaClient:
    return PizcaClient('https://api.test', 'yo', 'clave', transport=httpx.MockTransport(api))


def test_login_en_la_primera_request():
    api = FakeApi()
    assert make_client(api).get('/api/recetas/') == {'ok': True}
    assert [c[1] for c in api.calls] == ['/api/token/', '/api/recetas/']
    assert api.calls[1][2] == 'Bearer access-1'


def test_401_renueva_con_refresh_y_guarda_el_rotado():
    api = FakeApi()
    client = make_client(api)
    client.get('/api/recetas/')
    api.valid_access.clear()  # venció el access

    assert client.get('/api/recetas/') == {'ok': True}
    assert api.refreshes == 1 and api.logins == 1
    assert api.calls[-1][2] == 'Bearer access-r1'

    api.valid_access.clear()
    client.get('/api/recetas/')
    assert api.refresh_sent == ['refresh-1', 'refresh-1-rotado']


def test_si_falla_el_refresh_vuelve_a_loguearse():
    api = FakeApi()
    client = make_client(api)
    client.get('/api/recetas/')
    api.valid_access.clear()
    api.refresh_ok = False

    assert client.get('/api/recetas/') == {'ok': True}
    assert api.logins == 2
    assert api.calls[-1][2] == 'Bearer access-2'


def test_credenciales_incorrectas():
    api = FakeApi()
    api.login_ok = False
    with pytest.raises(PizcaError, match='PIZCA_USERNAME'):
        make_client(api).get('/api/recetas/')


def test_from_env_sin_credenciales(monkeypatch):
    monkeypatch.delenv('PIZCA_USERNAME', raising=False)
    monkeypatch.delenv('PIZCA_PASSWORD', raising=False)
    with pytest.raises(PizcaError, match='Faltan'):
        PizcaClient.from_env()


@pytest.mark.parametrize('status, body, expected', [
    (400, {'error': 'No pudimos bajar el video.'}, 'No pudimos bajar el video.'),
    (400, {'title': ['Este campo es requerido.']}, 'title: Este campo es requerido.'),
    (400, {'ingredients': [{}, {'name': ['No puede estar vacío.']}]}, 'ingredients[2].name: No puede estar vacío.'),
    (400, {'non_field_errors': ['Ya tenés una receta en ese slot.']}, 'Ya tenés una receta en ese slot.'),
    (404, {'detail': 'No encontrado.'}, 'No encontrado.'),
    (429, {'error': 'Llegaste al límite de 10 importaciones por día.'}, 'Llegaste al límite de 10 importaciones por día.'),
    (429, {'detail': 'Request was throttled.'}, 'límite de uso'),
    (502, None, 'falló (502)'),
])
def test_mensajes_de_error(status, body, expected):
    response = httpx.Response(status, json=body) if body is not None else httpx.Response(status, text='<html>')
    assert expected in error_message(response)
