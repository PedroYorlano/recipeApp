"""
Crea o actualiza el cliente OAuth con el que el MCP remoto llama a /o/introspect/.

Toma las credenciales de MCP_INTROSPECTION_CLIENT_ID y MCP_INTROSPECTION_CLIENT_SECRET (las
mismas que tiene el servicio del MCP). Si faltan, no hace nada. Así puede correr en cada
arranque, junto con migrate.
"""
import os

from django.contrib.auth.hashers import check_password
from django.core.management.base import BaseCommand
from oauth2_provider.models import get_application_model

NOMBRE = 'Pizca MCP (introspección)'


class Command(BaseCommand):
    help = 'Crea o actualiza el cliente OAuth del MCP remoto a partir de las variables de entorno.'

    def handle(self, *args, **options):
        client_id = os.environ.get('MCP_INTROSPECTION_CLIENT_ID', '').strip()
        secret = os.environ.get('MCP_INTROSPECTION_CLIENT_SECRET', '').strip()
        if not client_id or not secret:
            self.stdout.write('Sin MCP_INTROSPECTION_CLIENT_ID/SECRET: no hay cliente del MCP que crear.')
            return

        Application = get_application_model()
        app = Application.objects.filter(client_id=client_id).first() or Application(client_id=client_id)
        if app.pk and check_password(secret, app.client_secret):
            self.stdout.write('El cliente del MCP ya está al día.')
            return
        app.name = NOMBRE
        app.client_type = Application.CLIENT_CONFIDENTIAL
        app.authorization_grant_type = Application.GRANT_CLIENT_CREDENTIALS
        app.client_secret = secret  # DOT lo guarda hasheado
        app.save()
        self.stdout.write('Cliente del MCP guardado.')
