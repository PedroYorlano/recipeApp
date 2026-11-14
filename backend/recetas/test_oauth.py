"""OAuth del conector de Claude: metadata, flujo con PKCE, tokens en la API, introspección y login."""
import base64
import hashlib
import os
import secrets
from unittest import mock
from urllib.parse import parse_qs, urlparse

from django.contrib.auth.models import User
from django.core.cache import cache
from django.core.management import call_command
from django.test import TestCase, override_settings
from oauth2_provider.models import get_application_model

from .models import Recipe

Application = get_application_model()

MCP = 'https://mcp.pizca.test/mcp'
CALLBACK = 'https://claude.ai/api/mcp/auth_callback'


def pkce():
    verifier = secrets.token_urlsafe(48)
    challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).rstrip(b'=').decode()
    return verifier, challenge


class MetadataTests(TestCase):
    def test_anuncia_lo_que_necesita_claude(self):
        data = self.client.get('/.well-known/oauth-authorization-server').json()
        self.assertTrue(data['client_id_metadata_document_supported'])
        self.assertIn('none', data['token_endpoint_auth_methods_supported'])
        self.assertEqual(data['code_challenge_methods_supported'], ['S256'])
        self.assertEqual(data['response_types_supported'], ['code'])
        self.assertNotIn('password', data['grant_types_supported'])
        self.assertTrue(data['authorization_response_iss_parameter_supported'])
        for key in ('authorization_endpoint', 'token_endpoint', 'introspection_endpoint'):
            self.assertTrue(data[key].startswith(data['issuer']), key)
        self.assertNotIn('registration_endpoint', data)


@override_settings(PIZCA_MCP_RESOURCE=MCP)
class FlujoOAuthTests(TestCase):
    def setUp(self):
        cache.clear()
        self.ana = User.objects.create_user('ana', 'ana@example.com', 'contraseña-segura')
        beto = User.objects.create_user('beto', 'beto@example.com', 'contraseña-segura')
        Recipe.objects.create(user=self.ana, title='Tortilla de Ana')
        Recipe.objects.create(user=beto, title='Guiso de Beto')
        # Como lo registraría CIMD: cliente público con el callback de Claude.
        self.claude = Application.objects.create(
            name='Claude', client_id='https://claude.ai/oauth/test-metadata',
            client_type=Application.CLIENT_PUBLIC,
            authorization_grant_type=Application.GRANT_AUTHORIZATION_CODE,
            redirect_uris=CALLBACK, client_secret='',
        )

    def autorizar(self, resource=MCP):
        verifier, challenge = pkce()
        params = {
            'response_type': 'code', 'client_id': self.claude.client_id, 'redirect_uri': CALLBACK,
            'scope': 'pizca', 'state': 'xyz', 'code_challenge': challenge, 'code_challenge_method': 'S256',
            'resource': resource,
        }
        page = self.client.get('/o/authorize/', params)
        self.assertEqual(page.status_code, 200)
        self.assertContains(page, 'quiere acceder a tu Pizca')
        form = {k: v for k, v in page.context['form'].initial.items() if v is not None}
        r = self.client.post('/o/authorize/', {**form, 'allow': 'Authorize'})
        self.assertEqual(r.status_code, 302)
        query = parse_qs(urlparse(r['Location']).query)
        self.assertEqual(query['state'], ['xyz'])
        self.assertIn('iss', query)
        token = self.client.post('/o/token/', {
            'grant_type': 'authorization_code', 'code': query['code'][0], 'redirect_uri': CALLBACK,
            'client_id': self.claude.client_id, 'code_verifier': verifier, 'resource': resource,
        })
        self.assertEqual(token.status_code, 200, token.content)
        return token.json()

    def test_sin_login_manda_a_la_pantalla_de_login(self):
        r = self.client.get('/o/authorize/', {'client_id': self.claude.client_id})
        self.assertEqual(r.status_code, 302)
        self.assertTrue(r['Location'].startswith('/cuenta/login/?next='))

    def test_token_del_mcp_ve_solo_las_recetas_del_usuario(self):
        self.client.force_login(self.ana)
        tokens = self.autorizar()
        self.assertIn('refresh_token', tokens)
        self.client.logout()
        r = self.client.get('/api/recetas/', HTTP_AUTHORIZATION=f"Bearer {tokens['access_token']}")
        self.assertEqual(r.status_code, 200, r.content)
        self.assertEqual([x['title'] for x in r.json()['results']], ['Tortilla de Ana'])

    def test_token_para_otro_recurso_no_entra_a_la_api(self):
        self.client.force_login(self.ana)
        tokens = self.autorizar(resource='https://otro.example.com/mcp')
        self.client.logout()
        r = self.client.get('/api/recetas/', HTTP_AUTHORIZATION=f"Bearer {tokens['access_token']}")
        self.assertEqual(r.status_code, 401)

    def test_pkce_es_obligatorio(self):
        self.client.force_login(self.ana)
        r = self.client.get('/o/authorize/', {
            'response_type': 'code', 'client_id': self.claude.client_id, 'redirect_uri': CALLBACK, 'scope': 'pizca',
        })
        self.assertIn('error=invalid_request', r.get('Location', ''))

    def test_introspeccion(self):
        self.client.force_login(self.ana)
        access = self.autorizar()['access_token']
        self.client.logout()
        with mock.patch.dict(os.environ, {
            'MCP_INTROSPECTION_CLIENT_ID': 'pizca-mcp', 'MCP_INTROSPECTION_CLIENT_SECRET': 'secreto-de-prueba',
        }):
            call_command('crear_cliente_mcp', stdout=open(os.devnull, 'w'))
            call_command('crear_cliente_mcp', stdout=open(os.devnull, 'w'))  # idempotente
        self.assertEqual(Application.objects.filter(client_id='pizca-mcp').count(), 1)

        basic = base64.b64encode(b'pizca-mcp:secreto-de-prueba').decode()
        r = self.client.post('/o/introspect/', {'token': access}, HTTP_AUTHORIZATION=f'Basic {basic}')
        self.assertEqual(r.status_code, 200)
        data = r.json()
        self.assertTrue(data['active'])
        self.assertEqual(data['aud'], [MCP])
        self.assertEqual(data['username'], 'ana')

        # Un cliente público (sin secreto) no puede introspeccionar.
        r = self.client.post('/o/introspect/', {'token': access, 'client_id': self.claude.client_id})
        self.assertNotEqual(r.status_code, 200)
        malo = base64.b64encode(b'pizca-mcp:otro').decode()
        r = self.client.post('/o/introspect/', {'token': access}, HTTP_AUTHORIZATION=f'Basic {malo}')
        self.assertNotEqual(r.status_code, 200)


class LoginTests(TestCase):
    def setUp(self):
        cache.clear()
        User.objects.create_user('caro', 'caro@example.com', 'contraseña-segura')

    def test_entra_con_el_mail(self):
        r = self.client.post('/cuenta/login/', {'username': 'CARO@example.com', 'password': 'contraseña-segura', 'next': '/o/authorize/?x=1'})
        self.assertEqual(r.status_code, 302)
        self.assertEqual(r['Location'], '/o/authorize/?x=1')

    def test_rechaza_usuarios_inactivos(self):
        User.objects.filter(username='caro').update(is_active=False)
        r = self.client.post('/cuenta/login/', {'username': 'caro', 'password': 'contraseña-segura'})
        self.assertEqual(r.status_code, 200)
        self.assertContains(r, 'Usuario o contraseña incorrectos')

    def test_no_redirige_afuera(self):
        r = self.client.post('/cuenta/login/', {'username': 'caro', 'password': 'contraseña-segura', 'next': 'https://malo.example.com/'})
        self.assertEqual(r.status_code, 302)
        self.assertFalse(r['Location'].startswith('https://malo'))

    def test_limite_de_intentos(self):
        for _ in range(10):
            self.client.post('/cuenta/login/', {'username': 'caro', 'password': 'mal'})
        r = self.client.post('/cuenta/login/', {'username': 'caro', 'password': 'contraseña-segura'})
        self.assertEqual(r.status_code, 429)


class JWTSigueAndandoTests(TestCase):
    def test_la_app_sigue_con_jwt_y_un_jwt_roto_da_401(self):
        User.objects.create_user('dani', 'dani@example.com', 'contraseña-segura')
        access = self.client.post('/api/token/', {'username': 'dani', 'password': 'contraseña-segura'}).json()['access']
        self.assertEqual(self.client.get('/api/me/', HTTP_AUTHORIZATION=f'Bearer {access}').status_code, 200)
        self.assertEqual(self.client.get('/api/me/', HTTP_AUTHORIZATION=f'Bearer {access}x').status_code, 401)
        self.assertEqual(self.client.get('/api/me/', HTTP_AUTHORIZATION='Bearer token-opaco-que-no-existe').status_code, 401)
