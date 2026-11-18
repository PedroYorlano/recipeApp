from django.apps import AppConfig

# Grants que Claude declara en su CIMD y que Pizca no ofrece. DOT 3.4.1 exige exactamente un grant
# además de refresh_token; desde 2026-11 Claude también declara jwt-bearer y DOT lo rechazaba
# ("Invalid client_id parameter value"). Ignorarlo no lo habilita: la Application queda con
# authorization_code y el endpoint de token no acepta jwt-bearer.
CIMD_GRANTS_IGNORADOS = {'urn:ietf:params:oauth:grant-type:jwt-bearer'}


class RecetasConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'recetas'

    def ready(self):
        from oauth2_provider import cimd

        cimd.IGNORED_GRANT_TYPES.update(CIMD_GRANTS_IGNORADOS)
