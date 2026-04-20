from rest_framework.pagination import CursorPagination


class RecipeCursorPagination(CursorPagination):
    """
    Paginación por cursor para recetas.
    - page_size = 12: múltiplo de 2, 3, 4, 6 (columnas posibles del grid responsive)
    - ordering = '-created_at': más recientes primero
    - cursor_query_param = 'cursor': parámetro de URL para el cursor
    """
    page_size = 12
    ordering = '-created_at'
    cursor_query_param = 'cursor'
