from django.contrib.auth import get_user_model
from django.contrib.auth.backends import ModelBackend
from django.db.models import Q


class EmailOrUsernameModelBackend(ModelBackend):
    """Permite iniciar sesión con el nombre de usuario o con el email (sin distinguir mayúsculas)."""

    def authenticate(self, request, username=None, password=None, **kwargs):
        User = get_user_model()
        if username is None:
            username = kwargs.get(User.USERNAME_FIELD)
        if not username or password is None:
            return None

        username = username.strip()
        user = (
            User.objects.filter(Q(username__iexact=username) | Q(email__iexact=username))
            .order_by('id')
            .first()
        )
        if user is None:
            # Igual que ModelBackend: hashear para no revelar por timing si el usuario existe.
            User().set_password(password)
            return None

        if user.check_password(password) and self.user_can_authenticate(user):
            return user
        return None
