"""
URL configuration for config project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.contrib.auth.views import LogoutView
from django.urls import path, include
from oauth2_provider import urls as oauth2_urls
from recetas.oauth import IntrospectTokenView, LoginView
from rest_framework.routers import DefaultRouter
from recetas.views import (
    RecipeViewSet, CategoryViewSet, MealPlanViewSet, ShoppingListItemViewSet,
    import_collection_item_view, import_recipe_view, import_recipe_from_file_view, import_recipe_from_text_view,
    list_collection_view,
    import_recipe_from_web_view, SharedRecipeView, RegisterView, RegisterVerifyView,
    RegisterResendView, PasswordResetRequestView, PasswordResetVerifyView, current_user_view, ideas
)
from django.conf import settings
from django.conf.urls.static import static
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)

router = DefaultRouter()
router.register(r'recetas', RecipeViewSet, basename='receta')
router.register(r'categorias', CategoryViewSet, basename='categoria')
router.register(r'planner', MealPlanViewSet, basename='mealplan')
router.register(r'shopping', ShoppingListItemViewSet, basename='shoppinglistitem')

oauth_patterns = (oauth2_urls.base_urlpatterns, oauth2_urls.app_name)

urlpatterns = [
    path('admin/', admin.site.urls),
    # OAuth del conector de Claude: authorize, token, revoke e introspect bajo /o/, la metadata
    # (RFC 8414) en la raíz, y el login propio. Sin las vistas de gestión de apps ni OIDC.
    path('o/introspect/', IntrospectTokenView.as_view()),  # antes que la de DOT: ver la vista
    path('o/', include(oauth_patterns, namespace='oauth2_provider')),
    path('', include((oauth2_urls.metadata_urlpatterns[:2], 'oauth2_metadata'))),
    path('cuenta/login/', LoginView.as_view(), name='login'),
    path('cuenta/logout/', LogoutView.as_view(), name='logout'),
    path('api/', include(router.urls)),
    path('api/importar/', import_recipe_view, name='importar_receta'),
    path('api/importar/coleccion/', list_collection_view, name='importar_coleccion'),
    path('api/importar/coleccion/receta/', import_collection_item_view, name='importar_coleccion_receta'),
    path('api/importar-archivo/', import_recipe_from_file_view, name='importar_receta_archivo'),
    path('api/importar-texto/', import_recipe_from_text_view, name='importar_receta_texto'),
    path('api/importar-web/', import_recipe_from_web_view, name='importar_receta_web'),
    path('api/compartidas/<uuid:uuid>/', SharedRecipeView.as_view(), name='shared_recipe'),
    path('api/register/', RegisterView.as_view(), name='auth_register'),
    path('api/register/verify/', RegisterVerifyView.as_view(), name='auth_register_verify'),
    path('api/register/resend/', RegisterResendView.as_view(), name='auth_register_resend'),
    path('api/password-reset/request/', PasswordResetRequestView.as_view(), name='password_reset_request'),
    path('api/password-reset/verify/', PasswordResetVerifyView.as_view(), name='password_reset_verify'),
    path('api/me/', current_user_view, name='current_user'),
    path('api/token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('api/ideas/', ideas, name='ideas'),
]

if settings.DEBUG and hasattr(settings, 'MEDIA_ROOT'):
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)