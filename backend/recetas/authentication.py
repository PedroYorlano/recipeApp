from rest_framework_simplejwt.authentication import JWTAuthentication


class PizcaJWTAuthentication(JWTAuthentication):
    """
    JWT de la app. Si el bearer no tiene forma de JWT (los tokens OAuth del conector de Claude son
    opacos), no responde 401: devuelve None para que pruebe OAuth2Authentication.
    """

    def get_raw_token(self, header):
        raw = super().get_raw_token(header)
        if raw is not None and raw.count(b'.') != 2:
            return None
        return raw
