"""MCP remoto: verificador de tokens, cliente en modo token y la app HTTP con OAuth."""
import json

import anyio
import httpx
import pytest
from starlette.testclient import TestClient

from pizca_mcp import auth, client as client_mod, http as http_mod, server
from pizca_mcp.auth import IntrospectionTokenVerifier
from pizca_mcp.client import PizcaClient, PizcaError

MCP_URL = 'https://mcp.pizca.test/mcp'
API = 'https://api.pizca.test'


class FakeIntrospection:
    def __init__(self):
        self.calls = 0
        self.tokens = {
            'bueno': {'active': True, 'aud': [MCP_URL + '/'], 'scope': 'pizca', 'client_id': 'https://claude.ai/x',
                      'username': 'ana', 'exp': 4_000_000_000},
            'otro-recurso': {'active': True, 'aud': ['https://otro.test/mcp'], 'scope': 'pizca'},
            'sin-aud': {'active': True, 'scope': 'pizca'},
        }

    def __call__(self, request: httpx.Request) -> httpx.Response:
        self.calls += 1
        assert request.headers['Authorization'].startswith('Basic ')
        token = dict(httpx.QueryParams(request.content.decode()))['token']
        return httpx.Response(200, json=self.tokens.get(token, {'active': False}))


def verificar(token, fake=None):
    fake = fake or FakeIntrospection()
    verifier = IntrospectionTokenVerifier(f'{API}/o/introspect/', 'pizca-mcp', 's', MCP_URL,
                                          transport=httpx.MockTransport(fake))
    return anyio.run(verifier.verify_token, token), verifier, fake


def test_token_valido():
    access, _, _ = verificar('bueno')
    assert access.subject == 'ana'
    assert access.scopes == ['pizca']
    assert access.resource == MCP_URL


@pytest.mark.parametrize('token', ['otro-recurso', 'sin-aud', 'inexistente'])
def test_tokens_rechazados(token):
    access, _, _ = verificar(token)
    assert access is None


def test_cachea_la_respuesta():
    fake = FakeIntrospection()
    _, verifier, _ = verificar('bueno', fake)
    anyio.run(verifier.verify_token, 'bueno')
    assert fake.calls == 1


def test_error_de_red_no_se_cachea():
    def caido(request):
        raise httpx.ConnectError('caído')
    verifier = IntrospectionTokenVerifier(f'{API}/o/introspect/', 'a', 'b', MCP_URL, transport=httpx.MockTransport(caido))
    assert anyio.run(verifier.verify_token, 'bueno') is None
    assert verifier._cache == {}


def test_cliente_en_modo_token_no_reintenta_login():
    calls = []

    def api(request):
        calls.append(request)
        return httpx.Response(401, json={'detail': 'Authentication credentials were not provided.'})

    c = PizcaClient(API, access_token='vencido', transport=httpx.MockTransport(api))
    with pytest.raises(PizcaError, match='volvé a conectar'):
        c.get('/api/categorias/')
    assert [r.url.path for r in calls] == ['/api/categorias/']
    assert calls[0].headers['Authorization'] == 'Bearer vencido'


@pytest.fixture
def app(monkeypatch):
    """La app HTTP real, con la introspección y la API de Pizca de mentira."""
    fake = FakeIntrospection()
    api_calls = []

    def api(request):
        api_calls.append(request)
        return httpx.Response(200, json=[{'id': 1, 'name': 'Cenas', 'parent': None}])

    monkeypatch.setenv('MCP_PUBLIC_URL', MCP_URL)
    monkeypatch.setenv('PIZCA_API_URL', API)
    monkeypatch.setenv('MCP_INTROSPECTION_CLIENT_ID', 'pizca-mcp')
    monkeypatch.setenv('MCP_INTROSPECTION_CLIENT_SECRET', 's')
    original = auth.IntrospectionTokenVerifier.__init__

    def init(self, *args, **kwargs):
        original(self, *args, transport=httpx.MockTransport(fake))
    monkeypatch.setattr(auth.IntrospectionTokenVerifier, '__init__', init)
    monkeypatch.setattr(client_mod, '_shared_http', httpx.Client(base_url=API, transport=httpx.MockTransport(api)))
    monkeypatch.setattr(server, '_client', None)
    with TestClient(http_mod.crear_app(), base_url='https://mcp.pizca.test') as tc:
        yield tc, api_calls


HEADERS = {'Accept': 'application/json, text/event-stream', 'Content-Type': 'application/json'}


def rpc(method, params=None, id=1):
    return {'jsonrpc': '2.0', 'id': id, 'method': method, 'params': params or {}}


def mensajes(response):
    if response.headers['content-type'].startswith('application/json'):
        return [response.json()]
    return [json.loads(line[5:]) for line in response.text.splitlines() if line.startswith('data:')]


def test_sin_token_responde_401_con_la_metadata(app):
    tc, _ = app
    r = tc.post('/mcp', json=rpc('tools/list'), headers=HEADERS)
    assert r.status_code == 401
    challenge = r.headers['WWW-Authenticate']
    assert 'resource_metadata="https://mcp.pizca.test/.well-known/oauth-protected-resource/mcp"' in challenge

    meta = tc.get('/.well-known/oauth-protected-resource/mcp').json()
    assert meta['resource'] == MCP_URL
    assert meta['authorization_servers'] == [API]


def test_token_de_otro_recurso_da_401(app):
    tc, _ = app
    r = tc.post('/mcp', json=rpc('tools/list'), headers={**HEADERS, 'Authorization': 'Bearer otro-recurso'})
    assert r.status_code == 401


def test_con_token_llama_a_la_api_como_el_usuario(app):
    tc, api_calls = app
    auth_headers = {**HEADERS, 'Authorization': 'Bearer bueno', 'MCP-Protocol-Version': '2025-06-18'}
    init = tc.post('/mcp', headers=auth_headers, json=rpc('initialize', {
        'protocolVersion': '2025-06-18', 'capabilities': {}, 'clientInfo': {'name': 'test', 'version': '1'},
    }))
    assert init.status_code == 200, init.text

    tools = mensajes(tc.post('/mcp', headers=auth_headers, json=rpc('tools/list', id=2)))[0]
    nombres = {t['name'] for t in tools['result']['tools']}
    assert len(nombres) == 9 and 'importar_desde_url' not in nombres

    r = tc.post('/mcp', headers=auth_headers, json=rpc('tools/call', {'name': 'listar_categorias', 'arguments': {}}, id=3))
    result = mensajes(r)[0]['result']
    assert not result.get('isError'), result
    assert api_calls[-1].url.path == '/api/categorias/'
    assert api_calls[-1].headers['Authorization'] == 'Bearer bueno'
