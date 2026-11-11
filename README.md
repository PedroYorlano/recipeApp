# 🧂 Pizca — Recetario Inteligente

**Pizca** es una aplicación full-stack de gestión de recetas potenciada por Inteligencia Artificial. Permite a los usuarios guardar, organizar y planificar sus recetas semanales, con la capacidad única de importar recetas automáticamente desde videos de YouTube, TikTok e Instagram, archivos de audio, o texto libre mediante la API de Google Gemini.

Disponible como aplicación móvil nativa (iOS y Android) y web, todo desde el mismo codebase.

---

## Índice

- [Características](#características)
- [Stack tecnológico](#stack-tecnológico)
- [Arquitectura](#arquitectura)
- [Estructura del proyecto](#estructura-del-proyecto)
- [Configuración e instalación](#configuración-e-instalación)
  - [Backend](#backend-django)
  - [Frontend](#frontend-expo)
  - [Docker (modo completo)](#docker-modo-completo)
- [Variables de entorno](#variables-de-entorno)
- [API Reference](#api-reference)
- [Seguridad](#seguridad)
- [Despliegue en producción](#despliegue-en-producción)

---

## Características

| Módulo | Funcionalidades |
|---|---|
| **Autenticación** | Registro, login con JWT (Access + Refresh token), auto-refresh transparente |
| **Recetas** | CRUD completo, búsqueda full-text, filtros por categoría y favoritos, imágenes en cloud |
| **Importación con IA** | Desde video (YouTube/TikTok/IG), archivo de audio, texto libre y URL de blog |
| **Ideas** | Asistente de cocina conversacional que recomienda recetas propias del usuario |
| **Planificador** | Armar menú semanal por desayuno/almuerzo/cena |
| **Lista de compras** | Generación automática consolidando los ingredientes del plan semanal |
| **Compartir** | Recetas públicas con URL única accesible sin login |
| **Multi-plataforma** | iOS · Android · Web desde un mismo codebase |

---

## Stack tecnológico

### Backend
| Capa | Tecnología |
|---|---|
| Framework | Django 5.2 + Django REST Framework |
| Autenticación | JWT via `djangorestframework-simplejwt` |
| Base de datos | PostgreSQL (prod) / SQLite (dev) |
| IA | Google Gemini 3.5 Flash-Lite (`google-genai`, configurable con `GEMINI_MODEL`) |
| Descarga de video | `yt-dlp` + `ffmpeg` |
| Storage de imágenes | Cloudflare R2 (S3-compatible) via `django-storages` |
| Scraping web | `beautifulsoup4` |
| Servidor HTTP | Gunicorn + Whitenoise (archivos estáticos) |
| Contenerización | Docker + Docker Compose |

### Frontend
| Capa | Tecnología |
|---|---|
| Framework | React Native (Expo SDK 54) |
| Routing | Expo Router (file-based, análogo a Next.js) |
| Estilos | NativeWind (Tailwind CSS para React Native) |
| Estado global | React Context API |
| Almacenamiento local | AsyncStorage |
| Lenguaje | TypeScript |

---

## Arquitectura

```
┌─────────────────────────────────────────────────┐
│                  CLIENTE                        │
│                                                 │
│   React Native + Expo Router (iOS/Android/Web)  │
│   ┌──────────┐ ┌──────────┐ ┌───────────────┐  │
│   │ AppCtx   │ │PlannerCtx│ │  api.ts       │  │
│   │ (Auth,   │ │(MealPlan,│ │  (fetch +     │  │
│   │  Recipes)│ │Shopping) │ │  JWT refresh) │  │
│   └──────────┘ └──────────┘ └───────────────┘  │
└──────────────────────┬──────────────────────────┘
                       │ HTTPS / REST JSON
┌──────────────────────▼──────────────────────────┐
│                  BACKEND                        │
│                                                 │
│   Django REST Framework                         │
│   ┌──────────┐ ┌──────────┐ ┌───────────────┐  │
│   │  Views   │ │Serializ. │ │  JWT Auth     │  │
│   │ (APIView │ │(Validac.)│ │  Middleware   │  │
│   │ ViewSet) │ │          │ │               │  │
│   └────┬─────┘ └──────────┘ └───────────────┘  │
│        │                                        │
│   ┌────▼──────┐    ┌─────────┐   ┌──────────┐  │
│   │ Models    │    │ Gemini  │   │  yt-dlp  │  │
│   │ (ORM)     │    │  API    │   │  ffmpeg  │  │
│   └────┬──────┘    └─────────┘   └──────────┘  │
└────────┼────────────────────────────────────────┘
         │
┌────────▼────────────────────────────────────────┐
│   PostgreSQL         Cloudflare R2               │
│   (datos)            (imágenes)                  │
└─────────────────────────────────────────────────┘
```

### Flujo de autenticación JWT

1. El usuario hace login → el backend emite un **access token** (30 min) y un **refresh token** (7 días).
2. El frontend guarda ambos tokens en `AsyncStorage`.
3. Cada request autenticada incluye el access token en el header `Authorization: Bearer <token>`.
4. Si el servidor responde `401`, el cliente intercepta automáticamente la respuesta, refresca el token usando el refresh token, y **reintenta la request original** de forma transparente (patrón mutex para evitar race conditions con requests paralelas).
5. Si el refresh token también expiró, el usuario es redirigido al login.

---

## Estructura del proyecto

```
recipeApp/
├── backend/
│   ├── config/
│   │   ├── settings.py        # Configuración Django
│   │   └── urls.py            # Rutas principales
│   ├── recetas/               # App principal
│   │   ├── models.py          # Modelos de datos
│   │   ├── serializers.py     # Validación y transformación
│   │   ├── views.py           # Endpoints REST
│   │   ├── utils.py           # Integración con Gemini y yt-dlp
│   │   └── pagination.py      # Cursor pagination
│   ├── .env.example           # Plantilla de variables de entorno
│   ├── requirements.in        # Dependencias directas (sin fijar versiones)
│   ├── requirements.txt       # Dependencias resueltas y fijadas
│   └── Dockerfile
│
├── frontend/
│   ├── app/                   # Rutas (Expo Router, file-based)
│   │   ├── _layout.tsx        # Layout raíz + Auth Guard + Modales globales
│   │   ├── login.tsx
│   │   ├── register.tsx
│   │   └── (tabs)/            # Rutas con barra de navegación
│   │       ├── index.tsx      # Recetario (Home)
│   │       ├── explore.tsx    # Explorar / Favoritos
│   │       ├── planner.tsx    # Planificador semanal
│   │       └── settings.tsx   # Configuración
│   ├── src/
│   │   ├── context/           # Estado global (React Context)
│   │   │   ├── AppContext.tsx  # Auth, recetas, categorías
│   │   │   └── PlannerContext.tsx
│   │   ├── services/
│   │   │   └── api.ts         # Capa de comunicación con el backend
│   │   ├── components/        # Componentes reutilizables
│   │   ├── screens/           # Pantallas (LoginScreen, HomeScreen, etc.)
│   │   ├── types/             # Tipos TypeScript
│   │   └── constants/         # API_BASE_URL y constantes
│   └── Dockerfile
│
└── docker-compose.yml         # Orquestación local (backend + PostgreSQL)
```

---

## Configuración e instalación

### Prerequisitos

- **Python** 3.12+
- **Node.js** 20+
- **ffmpeg** (para la importación de audio/video)
- **Docker** y **Docker Compose** (opcional, para modo completo)

---

### Backend (Django)

```bash
cd backend

# 1. Crear entorno virtual e instalar dependencias
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt

# 2. Configurar variables de entorno
cp .env.example .env
# Editar .env con tus valores (al menos SECRET_KEY y GENAI_API_KEY)

# 3. Migrar base de datos
python manage.py migrate

# 4. Crear superusuario (opcional, para acceder al admin)
python manage.py createsuperuser

# 5. Iniciar servidor de desarrollo
python manage.py runserver
```

El backend queda disponible en `http://localhost:8000`.

---

### Frontend (Expo)

```bash
cd frontend

# 1. Instalar dependencias
npm install

# 2. Iniciar servidor de desarrollo
npx expo start

# Luego: presionar 'i' para iOS, 'a' para Android, 'w' para web
```

> **Nota:** la constante `API_BASE` en `src/constants/index.ts` detecta automáticamente la IP del servidor de Expo en desarrollo y apunta al backend en el puerto 8000. Para producción, reemplazar con la URL real del backend.

---

### Docker (modo completo)

Levanta el backend y una base de datos PostgreSQL con un solo comando:

```bash
# Desde la raíz del proyecto
docker-compose up --build
```

El backend estará disponible en `http://localhost:8000`.

> **Nota:** el `docker-compose.yml` está configurado para desarrollo. Para producción, reemplazar `runserver` por `gunicorn` y configurar un proxy reverso (Nginx/Caddy).

---

## Variables de entorno

Ver [`backend/.env.example`](./backend/.env.example) para la lista completa. Las variables obligatorias son:

| Variable | Descripción |
|---|---|
| `SECRET_KEY` | Clave secreta de Django. Generar con `python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"` |
| `GENAI_API_KEY` | API key de Google AI Studio para Gemini |
| `DEBUG` | `True` en desarrollo, `False` en producción |
| `ALLOWED_HOSTS` | Hosts permitidos, separados por coma (ej: `api.pizca.app`) |
| `DATABASE_URL` | URL de conexión a la base de datos |

Opcional: `GEMINI_MODEL` (por defecto `gemini-3.5-flash-lite`). Antes de cambiarlo, correr `python manage.py check_ai`, que prueba texto, audio e Ideas con una llamada real.

Variables opcionales (para storage en la nube):

| Variable | Descripción |
|---|---|
| `R2_BUCKET_NAME` | Nombre del bucket de Cloudflare R2 |
| `R2_ACCESS_KEY_ID` | Access Key ID de R2 |
| `R2_SECRET_ACCESS_KEY` | Secret Access Key de R2 |
| `R2_ENDPOINT_URL` | Endpoint del bucket R2 |
| `R2_PUBLIC_DOMAIN` | Dominio público para servir imágenes |

Si las variables de R2 no están configuradas, las imágenes se almacenan en disco local en `/media/`. Con R2 la región se fuerza a `auto`: si no, boto3 toma la región de AWS de la máquina (`~/.aws/config`) y R2 rechaza el pedido.

Las fotos de portada se validan con Pillow, se achican a 1600 px y se guardan en WebP sin EXIF (`recetas/images.py`).

---

## API Reference

Todos los endpoints (excepto `/api/token/`, `/api/token/refresh/`, `/api/register/` y `/api/compartidas/<uuid>/`) requieren el header:

```
Authorization: Bearer <access_token>
```

### Autenticación

| Método | Endpoint | Descripción |
|---|---|---|
| `POST` | `/api/token/` | Login. Body: `{ username, password }` |
| `POST` | `/api/token/refresh/` | Renovar access token. Body: `{ refresh }` |
| `POST` | `/api/register/` | Registro. Body: `{ username, email, password }` |
| `GET` | `/api/me/` | Datos del usuario autenticado |

### Recetas

| Método | Endpoint | Descripción |
|---|---|---|
| `GET` | `/api/recetas/` | Listar recetas (paginación por cursor, 12/página) |
| `POST` | `/api/recetas/` | Crear receta |
| `GET` | `/api/recetas/<id>/` | Detalle de una receta |
| `PUT` | `/api/recetas/<id>/` | Editar receta |
| `DELETE` | `/api/recetas/<id>/` | Eliminar receta |
| `POST` | `/api/recetas/<id>/favorite/` | Toggle favorito |
| `GET` | `/api/compartidas/<uuid>/` | Ver receta pública (sin auth) |

**Filtros disponibles en `GET /api/recetas/`:**
- `?search=pollo` — búsqueda full-text en título, descripción e ingredientes
- `?categories=3` — filtrar por categoría
- `?favorites=true` — solo recetas marcadas como favoritas

### Importación con IA

| Método | Endpoint | Descripción | Límite |
|---|---|---|---|
| `POST` | `/api/importar/` | Importar desde URL de video (YouTube/TikTok/IG). Body: `{ url }` | 5/min, 10/día |
| `POST` | `/api/importar-archivo/` | Importar desde archivo de audio (multipart/form-data, max 20MB) | 5/min, 10/día |
| `POST` | `/api/importar-texto/` | Importar desde texto libre. Body: `{ text }` | 5/min, 10/día |
| `POST` | `/api/importar-web/` | Importar desde URL de blog/web. Body: `{ url }` | 5/min, 10/día |

### Categorías

| Método | Endpoint | Descripción |
|---|---|---|
| `GET` | `/api/categorias/` | Listar categorías |
| `POST` | `/api/categorias/` | Crear categoría. Body: `{ name }` |

### Planificador

| Método | Endpoint | Descripción |
|---|---|---|
| `GET` | `/api/planner/week/?week_start=YYYY-MM-DD` | Plan de la semana |
| `POST` | `/api/planner/` | Agregar receta al plan |
| `DELETE` | `/api/planner/<id>/` | Eliminar del plan |
| `POST` | `/api/planner/generate_shopping_list/` | Generar lista de compras |

### Lista de compras

| Método | Endpoint | Descripción |
|---|---|---|
| `GET` | `/api/shopping/?week_start=YYYY-MM-DD` | Ver lista de la semana |
| `POST` | `/api/shopping/` | Agregar ítem manualmente |
| `PATCH` | `/api/shopping/<id>/` | Actualizar ítem (ej: marcar como comprado) |
| `DELETE` | `/api/shopping/<id>/` | Eliminar ítem |

### Ideas (asistente IA)

| Método | Endpoint | Descripción | Límite |
|---|---|---|---|
| `POST` | `/api/ideas/` | Enviar mensaje. Body: `{ message }` | 10/min |

---

## Seguridad

### Medidas implementadas

**Autenticación y tokens**
- JWT con access tokens de corta duración (30 min) y refresh tokens rotantes (7 días)
- Tokens almacenados en `AsyncStorage` (no en cookies, evita CSRF)
- Auto-refresh transparente con mutex para evitar race conditions

**Autorización**
- Todos los endpoints protegidos con `IsAuthenticated`
- Los usuarios solo acceden a sus propios recursos (filtrado por `user=request.user`)
- Validación en `MealPlanSerializer`: solo se pueden planificar recetas propias

**Rate limiting (Throttling)**
- Usuarios anónimos: 20 req/min
- Usuarios autenticados: 60 req/min (CRUD general)
- Importaciones IA: 5 req/min + 10/día por usuario
- Límite global de Gemini: 490 req/día (configurable en settings)
- Fotos de portada: 50 por usuario por día (`PIZCA_MAX_IMAGES_PER_USER_PER_DAY`)

**Protección SSRF**
- Las URLs de video se validan contra una whitelist de hosts permitidos (YouTube, TikTok, Instagram)
- La importación desde web y la descarga de imágenes verifican que la IP resuelta sea pública (no privada, loopback ni link-local) antes de hacer la request

**Validación de inputs**
- Tamaño máximo de request: 10MB
- Tamaño máximo de archivos subidos: 20MB
- Tamaño máximo de imágenes base64: ~5MB
- Formatos de imagen permitidos: jpeg, jpg, png, webp, gif
- Longitud máxima de texto importado: 50.000 caracteres
- Máximo 50 ingredientes y 100 pasos por receta

**Headers de seguridad (producción)**

Cuando `DEBUG=False`, Django activa automáticamente:
- `SECURE_SSL_REDIRECT = True` — redirige todo el tráfico a HTTPS
- `SECURE_HSTS_SECONDS = 31536000` — HSTS por 1 año con subdominios y preload
- `SESSION_COOKIE_SECURE = True`
- `CSRF_COOKIE_SECURE = True`
- `SECURE_PROXY_SSL_HEADER` — compatible con proxies como Nginx

**CORS**
- En desarrollo: abierto (`CORS_ALLOW_ALL_ORIGINS=True`)
- En producción: restringido a los orígenes configurados en `CORS_ALLOWED_ORIGINS`

**Storage de imágenes**
- Las imágenes se eliminan de R2/disco automáticamente al editar o eliminar una receta (señales `pre_save` y `post_delete`)

### Checklist de seguridad para producción

- [ ] `DEBUG=False` en `.env`
- [ ] `ALLOWED_HOSTS` apunta solo a tu dominio
- [ ] `CORS_ALLOW_ALL_ORIGINS=False` y `CORS_ALLOWED_ORIGINS` configurado
- [ ] `SECRET_KEY` es un valor largo y aleatorio, nunca commiteado
- [ ] Base de datos PostgreSQL con credenciales únicas (no las del `docker-compose.yml`)
- [ ] Servidor detrás de Nginx/Caddy con HTTPS (Let's Encrypt)
- [ ] Variables de entorno configuradas en el servidor, no en el código
- [ ] `GENAI_API_KEY` con permisos mínimos necesarios

---

## Despliegue en producción

### Backend

El `Dockerfile` del backend genera una imagen lista para producción usando Gunicorn:

```bash
# Build
docker build -t pizca-backend ./backend

# Run (ejemplo con variables de entorno)
docker run -p 8000:8000 \
  -e SECRET_KEY=... \
  -e DEBUG=False \
  -e DATABASE_URL=postgres://... \
  -e GENAI_API_KEY=... \
  pizca-backend
```

Se recomienda colocar un proxy reverso (Nginx o Caddy) delante de Gunicorn para manejar HTTPS y servir archivos estáticos.

### Frontend — Web

```bash
cd frontend

# Generar build estático de Expo para web
npx expo export -p web

# El output queda en la carpeta /dist
# Se puede servir con cualquier servidor estático (Nginx, Vercel, Cloudflare Pages, etc.)
```

El `Dockerfile` del frontend automatiza este proceso usando un build multi-etapa (Node para compilar, Nginx para servir).

### Frontend — Móvil

Usar [EAS Build](https://docs.expo.dev/build/introduction/) de Expo para generar los binarios:

```bash
npx eas build --platform ios
npx eas build --platform android
```

---

## Licencia

MIT © Pedro Yorlano
