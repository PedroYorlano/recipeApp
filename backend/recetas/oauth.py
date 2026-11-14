"""
OAuth para el conector de Claude (MCP remoto). Django es el servidor de autorización
(django-oauth-toolkit). Este módulo tiene lo que DOT no trae o hace distinto: la regla de
audiencia para el MCP, la pantalla de login con límite de intentos y una introspección más cerrada.
"""
import base64
from urllib.parse import unquote_plus, urlparse

from django.conf import settings
from django.contrib.auth import views as auth_views
from django.contrib.auth.hashers import check_password
from django.http import HttpResponse, JsonResponse
from django.utils.decorators import method_decorator
from django.views import View
from django.views.decorators.csrf import csrf_exempt
from oauth2_provider.models import get_application_model
from oauth2_provider.oauth2_validators import validate_resource_as_url_prefix
from oauth2_provider.views import IntrospectTokenView as DOTIntrospectTokenView
from rest_framework.throttling import SimpleRateThrottle


def validate_resource(request_uri, audiences):
    """
    Regla de audiencia (RFC 8707) para los tokens que llegan a la API.

    Claude pide los tokens para el MCP remoto (resource = PIZCA_MCP_RESOURCE), y el MCP los
    reenvía a /api/ para actuar como el usuario. Por eso un token emitido para el MCP también vale
    en /api/. El MCP es parte de Pizca, no un tercero. Fuera de ese caso aplica la regla de DOT:
    la URL del request tiene que empezar con alguna de las audiencias del token.
    """
    if validate_resource_as_url_prefix(request_uri, audiences):
        return True
    mcp = settings.PIZCA_MCP_RESOURCE.rstrip('/')
    return (
        bool(mcp)
        and any(isinstance(a, str) and a.rstrip('/') == mcp for a in audiences)
        and urlparse(request_uri).path.startswith('/api/')
    )


class LoginRateThrottle(SimpleRateThrottle):
    """Usa el mismo límite por IP que el registro y los códigos (scope 'auth' de DRF)."""

    scope = 'auth'

    def get_cache_key(self, request, view):
        return self.cache_format % {'scope': self.scope, 'ident': self.get_ident(request)}


class LoginView(auth_views.LoginView):
    """Login con usuario o mail (EmailOrUsernameModelBackend) para autorizar a Claude."""

    template_name = 'cuenta/login.html'
    redirect_authenticated_user = True

    def post(self, request, *args, **kwargs):
        if not LoginRateThrottle().allow_request(request, self):
            return HttpResponse('Demasiados intentos. Esperá un minuto y probá de nuevo.', status=429)
        return super().post(request, *args, **kwargs)

    def get_context_data(self, **kwargs):
        return {**super().get_context_data(**kwargs), 'web_url': settings.PIZCA_WEB_URL}


@method_decorator(csrf_exempt, name='dispatch')
class IntrospectTokenView(View):
    """
    Introspección (RFC 7662) solo para clientes confidenciales con HTTP Basic, o sea, el MCP.
    La de DOT también deja pasar a un cliente público que mande solo su client_id, y cualquier
    conector registrado por CIMD es público.
    """

    def post(self, request):
        if not _confidential_client(request.META.get('HTTP_AUTHORIZATION', '')):
            response = JsonResponse({'error': 'invalid_client'}, status=401)
            response['WWW-Authenticate'] = 'Basic realm="pizca"'
            return response
        return DOTIntrospectTokenView.get_token_response(request.POST.get('token'))


def _confidential_client(header):
    scheme, _, encoded = header.partition(' ')
    if scheme.lower() != 'basic':
        return None
    try:
        client_id, _, secret = base64.b64decode(encoded).decode().partition(':')
    except (ValueError, UnicodeDecodeError):
        return None
    client_id, secret = unquote_plus(client_id), unquote_plus(secret)
    Application = get_application_model()
    app = Application.objects.filter(client_id=client_id, client_type=Application.CLIENT_CONFIDENTIAL).first()
    if app and secret and check_password(secret, app.client_secret):
        return app
    return None
