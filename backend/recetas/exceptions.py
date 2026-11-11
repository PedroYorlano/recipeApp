from django.http import Http404
from rest_framework.exceptions import NotFound
from rest_framework.views import exception_handler as drf_exception_handler


def exception_handler(exc, context):
    """Igual al de DRF, pero el 404 de get_object_or_404 sale en castellano.

    Django arma ese mensaje a mano ("No Recipe matches the given query.") y no lo traduce.
    Los NotFound con mensaje propio se respetan.
    """
    if isinstance(exc, Http404):
        exc = NotFound('No encontramos lo que buscabas.')
    return drf_exception_handler(exc, context)
