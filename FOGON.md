# Fogón — Recetario Inteligente con IA

> Documentación técnica completa del proyecto. Diseñada para que un desarrollador o agente de IA sin contexto previo pueda leer este documento y comenzar a desarrollar inmediatamente.

---

## 1. Visión General del Producto

**Fogón** es un recetario personal inteligente que permite importar, crear, organizar y escalar recetas de cocina. Su diferenciador principal es la capacidad de **importar recetas automáticamente desde videos, audio, texto libre y blogs usando IA** (Gemini Flash).

El nombre "Fogón" evoca la cocina hogareña latinoamericana. La estética busca transmitir calidez, como un cuaderno de recetas familiar digitalizado.

**Estado actual:** MVP funcional en desarrollo activo. Proyecto personal con posibilidad de monetización futura.

---

## 2. Identidad Visual

### Paleta de Colores

| Token           | Hex       | Uso                                          |
|-----------------|-----------|----------------------------------------------|
| `fogon-brown`   | `#633806` | Títulos, headers, acentos pesados            |
| `fogon-amber`   | `#EF9F27` | Botones principales, CTA, acentos            |
| `fogon-cream`   | `#FAEEDA` | Fondos principales                           |
| `fogon-green`   | `#3B6D11` | Éxito, etiquetas de importación              |
| `fogon-white`   | `#FFF8F0` | Fondos de tarjetas, modales, cards           |
| `fogon-gray`    | `#A89070` | Subtítulos, placeholders, bordes sutiles     |
| `danger`        | `#FF3B30` | Validaciones críticas, botón eliminar        |

### Tipografía

- **Títulos:** Serif (objetivo: Lora o Playfair Display). Actualmente se usa `font-serif` de NativeWind (fuente serif del sistema).
- **Cuerpo:** Sans-serif del sistema (objetivo: Inter o DM Sans). No se han cargado fuentes custom aún.

### Tono de Voz

Cercano, cálido, como si una persona real te hablara. Ejemplos reales usados en la app:
- `"¿Qué se te antoja hoy?"` — placeholder de búsqueda
- `"Tu recetario está vacío por ahora."` — estado vacío
- `"¡Animate y agregá tu primera receta al fogón!"` — CTA estado vacío
- `"Cocinando la magia..."` — loading de IA
- `"Los datos no coinciden. ¿Probamos de nuevo?"` — error de login
- `"La receta de la abuela, a tu manera"` — opción manual

### Logo e Isotipo

Pendiente. Actualmente se usa el ícono `Flame` de Lucide como placeholder.

---

## 3. Stack Técnico

### Backend

| Componente        | Tecnología                                  |
|-------------------|---------------------------------------------|
| Framework         | Django 5.2 + Django REST Framework          |
| Auth              | JWT via `djangorestframework-simplejwt`      |
| Filtros           | `django-filters`                            |
| CORS              | `django-cors-headers` (allow all en dev)    |
| Config            | `python-decouple` (`.env`)                  |
| DB                | SQLite (desarrollo), pendiente migrar       |
| IA - Audio + Texto| Google Gemini Flash (`gemini-flash-latest`) — procesa audio nativo + estructura recetas |
| Descarga video    | `yt-dlp` + `ffmpeg`                         |
| Scraping web      | `requests` + `BeautifulSoup4`               |

### Frontend

| Componente        | Tecnología                                  |
|-------------------|---------------------------------------------|
| Framework         | React Native con Expo SDK 54                |
| Router            | Expo Router 6 (file-based, App Router)      |
| Estilos           | NativeWind 4 (Tailwind CSS 3 para RN)       |
| Navegación        | Bottom Tabs (`expo-router` + `Tabs`)        |
| Estado global     | React Context API (`AppContext`)             |
| Iconos            | `lucide-react-native`                       |
| Imágenes          | `expo-image`, `expo-image-picker`, `expo-image-manipulator` |
| Persistencia auth | `@react-native-async-storage/async-storage` |
| Animaciones       | `react-native-reanimated`                   |
| Gestos            | `react-native-gesture-handler`              |
| Gradientes        | `expo-linear-gradient`                      |
| Archivos          | `expo-document-picker`                      |
| Linking           | `expo-linking`, `expo-web-browser`           |
| TypeScript        | v5.9                                        |

> **NOTA IMPORTANTE:** El contexto del usuario menciona "Next.js 14+" como stack frontend, pero el código real del repositorio usa **Expo (React Native)** con Expo Router. La app es mobile-first con soporte web via `react-native-web`. No hay proyecto Next.js en el repositorio.

---

## 4. Estructura del Proyecto

```
recipeApp/
├── .gitignore
├── backend/
│   ├── .env                          # Variables de entorno (NO commitear)
│   ├── manage.py
│   ├── db.sqlite3                    # Base de datos local
│   ├── media/                        # Imágenes subidas (recipes/YYYY/MM/)
│   ├── config/                       # Proyecto Django
│   │   ├── settings.py               # Configuración principal
│   │   ├── urls.py                   # Rutas raíz (router DRF + endpoints)
│   │   ├── wsgi.py
│   │   └── asgi.py
│   ├── recetas/                      # App principal Django
│   │   ├── models.py                 # Modelos: Category, Recipe, Ingredient, Step, Favorite, UserUsage, GlobalUsage
│   │   ├── views.py                  # ViewSets + vistas de importación IA
│   │   ├── serializers.py            # Serializers con lógica de create/update
│   │   ├── utils.py                  # Lógica IA: descarga, transcripción, extracción
│   │   ├── admin.py                  # Registro en Django Admin
│   │   └── migrations/
│   └── venv/                         # Entorno virtual Python
│
└── frontend/
    ├── package.json
    ├── app.json                      # Config Expo
    ├── tailwind.config.js            # Tokens de color Fogón
    ├── global.css                    # CSS global (Tailwind base)
    ├── tsconfig.json
    ├── babel.config.js
    ├── metro.config.js
    ├── app/                          # Expo Router (file-based routing)
    │   ├── _layout.tsx               # Root layout: AppProvider + AuthGuard + Modales
    │   ├── login.tsx                  # Ruta /login
    │   └── (tabs)/                   # Tab group (autenticado)
    │       ├── _layout.tsx            # Tab bar config (Home, +, Settings)
    │       ├── index.tsx              # Tab Home → HomeScreen
    │       ├── create.tsx             # Tab Crear (solo trigger del menú modal)
    │       └── settings.tsx           # Tab Ajustes → SettingsScreen
    └── src/
        ├── components/
        │   ├── CreateMenuModal.tsx     # Bottom sheet: opciones de creación
        │   ├── recipes/
        │   │   ├── RecipeCard.tsx      # Card en grid con gradiente y metadata
        │   │   ├── RecipeDetailModal.tsx # Modal full-screen de detalle
        │   │   └── RecipeFormModal.tsx  # Modal de creación/edición/importación
        │   └── ui/
        │       ├── Button.tsx          # Botón reutilizable (primary/outline/ghost)
        │       └── Input.tsx           # Input reutilizable con label/icon/error
        ├── constants/
        │   └── index.ts               # SERVER_URL y API_BASE
        ├── context/
        │   └── AppContext.tsx          # Estado global: auth, recetas, categorías, modales
        ├── screens/
        │   ├── HomeScreen.tsx          # Pantalla principal: grid, búsqueda, filtros
        │   ├── LoginScreen.tsx         # Login con email/password + Google (placeholder)
        │   └── SettingsScreen.tsx      # Ajustes, logout
        ├── services/
        │   └── api.ts                  # Todas las llamadas HTTP al backend
        ├── theme/
        │   └── index.ts               # Design tokens: COLORS, SPACING, RADIUS, globalStyles
        ├── types/
        │   └── index.tsx               # Interfaces TS: Recipe, Ingredient, Step, Category
        └── utils/
            └── index.ts                # formatQuantity, scaleQuantity, getRecipeImage
```

---

## 5. Modelo de Datos

### Diagrama de Relaciones

```
User (Django auth)
 ├── 1:N → Recipe
 │            ├── N:M → Category (con parent → subcategorías jerárquicas)
 │            ├── 1:N → Ingredient (ordenados por `order`)
 │            └── 1:N → Step (ordenados por `order`)
 ├── 1:N → Favorite (user, recipe) — likes/favoritos
 ├── 1:1 → UserUsage — límite diario por usuario
 └── GlobalUsage — límite diario global de Gemini API
```

### Models (`backend/recetas/models.py`)

#### `Category`
| Campo    | Tipo                  | Notas                                        |
|----------|-----------------------|----------------------------------------------|
| `name`   | CharField(100)        | Nombre de la categoría                       |
| `parent` | FK a self (nullable)  | Permite subcategorías jerárquicas            |

#### `Recipe`
| Campo          | Tipo                   | Notas                                     |
|----------------|------------------------|-------------------------------------------|
| `uuid`         | UUIDField (auto)       | Para compartir recetas sin exponer PK     |
| `title`        | CharField(100)         | **Obligatorio**                           |
| `description`  | TextField (nullable)   | Descripción libre                         |
| `categories`   | M2M → Category         | Múltiples categorías por receta           |
| `image`        | ImageField             | Sube a `media/recipes/YYYY/MM/`           |
| `original_url` | URLField (nullable)    | URL fuente si fue importada               |
| `servings`     | PositiveIntegerField   | Porciones base (para escalado)            |
| `user`         | FK → User              | Dueño de la receta                        |
| `is_public`    | BooleanField (False)   | Para futuro módulo social                 |
| `prep_time`    | PositiveIntegerField   | Tiempo de preparación en minutos (nullable)|
| `created_at`   | DateTimeField (auto)   |                                           |
| `updated_at`   | DateTimeField (auto)   |                                           |

#### `Ingredient`
| Campo      | Tipo                | Notas                                    |
|------------|---------------------|------------------------------------------|
| `recipe`   | FK → Recipe         | `related_name='ingredients'`             |
| `name`     | CharField(100)      | Nombre del ingrediente                   |
| `quantity` | DecimalField(8,2)   | Cantidad numérica (nullable)             |
| `unit`     | CharField(50)       | Unidad: "g", "ml", "taza", "unidad", etc.|
| `order`    | PositiveIntegerField| Orden de display (default=0)             |

> **Meta de Ingredient:** `ordering = ['order']`

#### `Step`
| Campo         | Tipo              | Notas                                    |
|---------------|-------------------|------------------------------------------|
| `recipe`      | FK → Recipe       | `related_name='steps'`                   |
| `order`       | PositiveInteger   | Orden del paso                           |
| `instruction` | TextField         | Texto del paso                           |

> **Meta de Step:** `ordering = ['order']`

#### `Favorite`
| Campo        | Tipo              | Notas                                    |
|--------------|-------------------|------------------------------------------|
| `user`       | FK → User         | `related_name='favorites'`               |
| `recipe`     | FK → Recipe       | `related_name='favorited_by'`            |
| `created_at` | DateTimeField     | Cuándo se marcó como favorito            |

> **unique_together:** `(user, recipe)` — un usuario solo puede marcar una receta una vez.

#### `UserUsage`
| Campo          | Tipo              | Notas                                   |
|----------------|-------------------|-----------------------------------------|
| `user`         | OneToOne → User   | Un registro por usuario                 |
| `import_count` | PositiveInteger   | Importaciones IA del día                |
| `last_reset`   | DateField         | Última fecha de reseteo                 |

> Métodos: `reset_if_new_day()`, `can_import(max)`, `record_import()`

#### `GlobalUsage`
| Campo             | Tipo            | Notas                                  |
|-------------------|-----------------|-----------------------------------------|
| `date`            | DateField       | Único por día                           |
| `gemini_requests` | PositiveInteger | Requests a Gemini API hoy               |

> Método: `get_today()` (class method, get_or_create)

---

## 6. API REST — Endpoints

**Base URL:** `http://<SERVER_IP>:8000/api/`

### Autenticación (JWT)

| Método | Endpoint            | Body                        | Respuesta                    |
|--------|---------------------|-----------------------------|------------------------------|
| POST   | `/api/token/`       | `{username, password}`      | `{access, refresh}`         |
| POST   | `/api/token/refresh/`| `{refresh}`                | `{access}`                   |

El token `access` se envía como `Authorization: Bearer <token>` en todas las requests autenticadas.

### Recetas (CRUD) — Requieren Auth

| Método | Endpoint                  | Descripción                              |
|--------|---------------------------|------------------------------------------|
| GET    | `/api/recetas/`           | Listar recetas del usuario autenticado   |
| GET    | `/api/recetas/?search=X`  | Buscar por título, descripción, ingrediente |
| GET    | `/api/recetas/?categories=ID` | Filtrar por categoría                |
| GET    | `/api/recetas/?favorites=true` | Filtrar solo favoritos              |
| POST   | `/api/recetas/`           | Crear receta (body: JSON con nested ingredients/steps) |
| PUT    | `/api/recetas/{id}/`      | Editar receta completa                   |
| DELETE | `/api/recetas/{id}/`      | Eliminar receta                          |
| POST   | `/api/recetas/{id}/favorite/` | Toggle favorito (like/unlike)        |

### Recetas Compartidas — Público

| Método | Endpoint                       | Descripción                       |
|--------|--------------------------------|-----------------------------------|
| GET    | `/api/compartidas/<uuid>/`     | Obtener receta pública por UUID   |

### Categorías — Público

| Método | Endpoint              | Descripción           |
|--------|-----------------------|-----------------------|
| GET    | `/api/categorias/`    | Listar categorías     |
| POST   | `/api/categorias/`    | Crear categoría       |

### Importación IA — Requieren Auth + Rate Limited (5/min) + Límite Diario

| Método | Endpoint                | Input                      | Pipeline                                   |
|--------|-------------------------|----------------------------|--------------------------------------------|
| POST   | `/api/importar/`        | `{url}`                   | URL whitelist → yt-dlp → Gemini Flash (audio nativo) → JSON |
| POST   | `/api/importar-archivo/`| FormData con `file` (audio)| Gemini Flash (audio nativo) → JSON          |
| POST   | `/api/importar-texto/`  | `{text}`                  | Gemini directo → JSON                      |
| POST   | `/api/importar-web/`    | `{url}`                   | SSRF check → requests+BS4 → limpieza → Gemini → JSON |

**Protecciones:**
- Rate limiting: 5 requests/minuto por usuario (DRF `ImportRateThrottle`)
- Límite diario por usuario: 10 importaciones/día (configurable `FOGON_MAX_IMPORTS_PER_USER_PER_DAY`)
- Límite diario global Gemini: 15 requests/día (configurable `FOGON_MAX_GEMINI_REQUESTS_PER_DAY`)
- Video import: URL whitelist (YouTube, TikTok, Instagram)
- Web import: SSRF protection (HTTPS only, DNS resolve, block private IPs, 5MB content limit)

### Formato JSON de Receta (entrada/salida de IA)

```json
{
  "title": "Título atractivo",
  "description": "Breve resumen",
  "ingredients": [
    {"name": "harina", "quantity": 200, "unit": "g"},
    {"name": "huevos", "quantity": 3, "unit": "unidad"},
    {"name": "sal a gusto", "quantity": null, "unit": ""}
  ],
  "steps": [
    {"order": 1, "instruction": "Paso detallado"}
  ],
  "image_url": "https://... (thumbnail, si aplica)"
}
```

### Formato JSON para Crear/Editar Receta (POST/PUT `/api/recetas/`)

```json
{
  "title": "Tarta de Manzanas",
  "description": "La receta de la abuela",
  "servings": 4,
  "categories": [1, 3],
  "original_url": "https://...",
  "ingredients": [
    {"name": "Harina", "quantity": 200, "unit": "g", "order": 0},
    {"name": "Huevos", "quantity": 3, "unit": "unidad", "order": 1},
    {"name": "Canela", "quantity": null, "unit": "", "order": 2}
  ],
  "steps": [
    {"order": 1, "instruction": "Precalentar el horno a 180°C"},
    {"order": 2, "instruction": "Mezclar los ingredientes secos"}
  ],
  "image_base64": "data:image/jpeg;base64,...",
  "image_url": "https://... (alternativa a base64)",
  "remove_image": false
}
```

**Lógica de imágenes en el serializer:**
1. Si viene `image_base64` → decodifica y guarda como archivo
2. Si viene `image_url` (y no base64) → descarga desde URL y guarda
3. Si `remove_image: true` → elimina la imagen existente

**Lógica de update de Steps:**
- Steps con `id` existente → se actualizan
- Steps sin `id` → se crean nuevos
- Steps que no aparecen en el payload → se eliminan

---

## 7. Pipeline de Importación con IA

### Flujo: Video (YouTube/TikTok/Instagram)

```
1. Usuario pega URL          
2. Backend: yt-dlp descarga audio (.mp3) + extrae metadata (título, descripción, thumbnail)
3. Backend: Audio se sube a Gemini Flash (procesamiento nativo, sin transcripción intermedia)
4. Backend: Gemini recibe [audio + descripción] → genera JSON estructurado
5. Frontend recibe JSON → muestra formulario pre-llenado para revisión
6. Usuario revisa, edita si necesita, y guarda
   → Si Gemini falla con audio (cuota agotada), reintenta solo con texto de descripción
```

### Flujo: Audio (archivo subido)

```
1. Usuario sube archivo de audio desde el dispositivo (DocumentPicker)
2. Backend: archivo temporal se sube a Gemini Flash (audio nativo) → JSON
3. Se elimina archivo temporal
4. Frontend muestra formulario pre-llenado
```

### Flujo: Texto libre

```
1. Usuario escribe/pega texto libre describiendo la receta
2. Backend: envía texto directo a Gemini
3. Gemini infiere cantidades, pasos e ingredientes faltantes
4. Frontend muestra formulario pre-llenado
```

### Flujo: Blog/URL web

```
1. Usuario pega URL de blog de cocina
2. Backend: requests descarga HTML → BeautifulSoup limpia (quita scripts, headers, footers)
3. Texto limpio (max 100k chars) → Gemini extrae receta ignorando publicidades/historias
4. Si hay og:image → se inyecta como image_url
5. Frontend muestra formulario pre-llenado
```

### Reintentos y Manejo de Errores

- Gemini: 3 reintentos con 10s de espera entre cada uno
- Maneja `ResourceExhausted`, `InternalServerError`, `ServiceUnavailable`
- Archivos `.mp3` temporales se eliminan en `finally` blocks

---

## 8. Frontend — Arquitectura

### Navegación (Expo Router)

```
app/
├── _layout.tsx          → RootLayout: AppProvider wrapper
│   └── MainLayout       → AuthGuard + Modales globales (CreateMenuModal + RecipeFormModal)
├── login.tsx            → LoginScreen (ruta pública)
└── (tabs)/
    ├── _layout.tsx      → TabBar: Home | + (botón flotante) | Settings
    ├── index.tsx        → HomeScreen
    ├── create.tsx       → Pantalla dummy (el tab "+" abre modal, no navega)
    └── settings.tsx     → SettingsScreen
```

**Auth Guard** (en `_layout.tsx`):
- Si autenticado y fuera de `(tabs)` → redirect a `/(tabs)`
- Si no autenticado y fuera de `/login` → redirect a `/login`

### Estado Global (`AppContext`)

El `AppContext` centraliza:

| Estado / Función          | Descripción                                           |
|---------------------------|-------------------------------------------------------|
| `recipes`, `categories`   | Datos cargados del backend                            |
| `selectedCategory`        | Filtro activo (null = "Todas")                        |
| `searchQuery`             | Texto de búsqueda                                     |
| `showFavorites`           | Filtro de favoritos activo                            |
| `loading`                 | Estado de carga                                       |
| `isAuthenticated`         | Sesión activa (persiste en AsyncStorage)              |
| `isAuthLoading`           | Verificación inicial de token                         |
| `fetchRecipes()`          | Recarga lista desde API (con filtros)                 |
| `saveRecipe()`            | Crear o editar (detecta por presencia de `id`)        |
| `deleteRecipe()`          | Eliminar por ID                                       |
| `toggleFavorite(id)`      | Toggle like/unlike (optimistic UI)                    |
| `importRecipeAI(url)`     | Importar desde video                                  |
| `importRecipeAIAudio()`   | Importar desde archivo de audio                       |
| `importRecipeAIText()`    | Importar desde texto libre                            |
| `importRecipeAIWeb(url)`  | Importar desde blog/web                               |
| `login()`, `logout()`     | Manejo de sesión JWT                                  |
| `createCategory()`        | Crear categoría nueva                                 |
| `createMode`              | Modo actual: `'manual'|'video'|'audio'|'text'|'link-web'|null` |
| Modal states              | `isCreateMenuVisible`, `formModalVisible`, `editingRecipe` |

**Filtrado server-side**: Los filtros `showFavorites`, `selectedCategory` y `searchQuery` se envían como query params al backend. Al cambiar cualquier filtro, se recarga la primera página. La búsqueda tiene un debounce de 400ms para no hacer un request por cada tecla. El listado soporta **infinite scroll** con cursor-based pagination (12 recetas por página).

### Componentes Principales

#### `HomeScreen`
- Header fijo con título "Fogón" + avatar placeholder
- Barra de búsqueda con ícono y botón clear
- Pills de filtro: ❤️ Favoritos + "Todas" + categorías dinámicas (mutuamente excluyentes: favoritos deselecciona categoría y viceversa)
- Grid responsivo de RecipeCards (2-6 columnas según ancho)
- Estado vacío adaptativo (mensaje diferente si estás en favoritos)
- RecipeDetailModal al tocar una card

#### `RecipeCard`
- Imagen con aspect ratio 4:5
- Gradiente oscuro sobre imagen para legibilidad del título
- Badge de categoría (top-left)
- Botón corazón favorito (top-right) con toggle y fill rojo
- Título y servings sobre la imagen (bottom)
- Placeholder con ícono si no hay imagen

#### `RecipeDetailModal`
- Modal full-screen slide-up
- Header flotante con botones: favorito (❤️), compartir, editar, eliminar
- Imagen portada con bordes redondeados inferiores
- Escalador de porciones (+/-) que recalcula cantidades proporcionalmente usando `scaleQuantity()`
- Lista de ingredientes con bullets ámbar — display: `"{quantity} {unit} {name}"`
- Pasos con cards numeradas y borde lateral ámbar
- Link a receta original si existe

#### `RecipeFormModal`
- **Fase 1 (sin draftRecipe):** Pantalla de importación según `createMode`
  - Video: input URL + botón "Extraer con IA"
  - Web: input URL + botón "Analizar Blog"
  - Texto: textarea + botón "Analizar Texto"
  - Audio: botón "Seleccionar Audio" (DocumentPicker)
  - Separador "o" + opción "Crear Manual"
- **Fase 2 (con draftRecipe):** Formulario completo
  - Título, foto de portada (pick/cambiar/eliminar)
  - Descripción, categorías (pills toggleables + crear nueva inline)
  - Ingredientes: 3 campos por fila (cantidad numérica + unidad + nombre), agregar/eliminar
  - Pasos: textarea por paso con número, agregar/eliminar
  - Botón "Guardar Receta en el Fogón"

#### `CreateMenuModal`
- Bottom sheet con overlay oscuro
- Sección "Importar con IA": 4 botones circulares (Web, Video, Audio, Texto)
- Sección "Tradicional": opción manual con ícono y descripción

#### `LoginScreen`
- Fondo crema, ícono Flame, título "Fogón"
- Card blanca con inputs email + password (con toggle visibilidad)
- Botón "Ingresar" + separador + "Continuar con Google" (placeholder)
- Link "¿No tenés cuenta? Registrate" (sin funcionalidad)

#### `SettingsScreen`
- Información de usuario
- Botón "Cerrar Sesión" con confirmación
- Footer con branding "Fogón" + versión
- Usa NativeWind (migrado desde StyleSheet)

### Componentes UI Reutilizables

#### `Button`
- Variantes: `primary` (ámbar), `secondary` (marrón), `outline`, `ghost`
- Props: `title`, `variant`, `loading`, `icon`, `disabled`

#### `Input`
- Props: `label`, `error`, `leftIcon`, `rightIcon`
- Estilo consistente con bordes redondeados y colores Fogón

### Utilidades (`src/utils/`)

- `formatQuantity(value, unit)` → string formateado con redondeo a 2 decimales. Ej: `formatQuantity(200, "g")` → `"200 g"`
- `scaleQuantity(value, originalServings, currentServings)` → número escalado proporcionalmente
- `getRecipeImage(recipe)` → Resuelve la fuente de imagen priorizando: backend → localImage → null

### Configuración de Tailwind (`tailwind.config.js`)

Los colores de Fogón están registrados como tokens personalizados:
```js
colors: {
  fogon: {
    brown: '#633806',
    amber: '#EF9F27',
    cream: '#FAEEDA',
    green: '#3B6D11',
    white: '#FFF8F0',
    gray: '#A89070',
  }
}
```
Se usan como `text-fogon-brown`, `bg-fogon-amber`, etc. en todo el frontend.

---

## 9. Variables de Entorno

### Backend (`backend/.env`)

```env
SECRET_KEY=<django-secret-key>
DEBUG=True
GENAI_API_KEY=<google-gemini-api-key>
GROQ_API_KEY=<groq-api-key>
```

### Frontend (`frontend/src/constants/index.ts`)

```ts
export const SERVER_URL = 'http://192.168.31.254:8000';  // IP local del backend
export const API_BASE = `${SERVER_URL}/api`;
```

> ⚠️ La IP del servidor está hardcodeada. Para desarrollo local, cambiar a la IP de la máquina corriendo Django.

---

## 10. Cómo Correr el Proyecto

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt     # Si existe, sino instalar manualmente
python manage.py migrate
python manage.py createsuperuser    # Para acceder al admin
python manage.py runserver 0.0.0.0:8000
```

**Dependencias del sistema:** `ffmpeg` (requerido por yt-dlp para conversión de audio).

### Frontend

```bash
cd frontend
npm install
npx expo start
```

- iOS: `npx expo start --ios`
- Android: `npx expo start --android`
- Web: `npx expo start --web`

---

## 11. Decisiones de UX

1. **Home muestra recetas directamente** — no hay chat, no hay onboarding, se entra directo al grid.
2. **Búsqueda y categorías siempre visibles** — desde el arranque, sin scroll.
3. **El botón "+" no navega** — intercepta el tap y abre `CreateMenuModal` (bottom sheet).
4. **Favoritos como pill de filtro** — ❤️ al inicio de la barra de categorías. Mutuamente excluyente con categorías.
5. **Corazón en la card** — toggle rápido sin abrir el detalle.
6. **Pasos se agregan uno por uno** — con botón "+ Agregar Paso". Drag & drop planificado pero no implementado.
7. **Escalado de porciones** funciona client-side con multiplicación directa (`quantity` es numérico).
8. **La web/desktop no es producto separado** — Expo Web responsive cubre ambos.
9. **Grid responsivo**: 2 columnas en mobile, hasta 6 en pantallas anchas (>1536px).

---

## 12. Pendientes antes de Deploy

### Prioridad Alta

| #  | Tarea                                                    | Estado    |
|----|----------------------------------------------------------|-----------|
| 1  | ~~Agregar `is_public` y `prep_time` a Recipe~~           | ✅ Hecho  |
| 2  | ~~Migrar `quantity` a `DecimalField` + `unit` + `order`~~| ✅ Hecho  |
| 3  | ~~`.env.example`~~                                       | ✅ Hecho  |
| 4  | ~~Rate limiting (5/min DRF Throttling)~~                 | ✅ Hecho  |
| 5  | ~~Límite diario (UserUsage + GlobalUsage)~~              | ✅ Hecho  |
| 6  | ~~Validación whitelist URLs video~~                      | ✅ Hecho  |
| 7  | ~~Protección SSRF para web import~~                      | ✅ Hecho  |
| 8  | Configurar Cloudflare R2 para imágenes                   | ⏳ Pendiente |
| 9  | Borrado automático de archivos `.mp3` temporales         | ✅ Parcial (se hace en `finally` blocks) |

### Bugs / Deuda Técnica Conocida

- ~~`SettingsScreen` mostraba "ChefAI App"~~ → ✅ corregido a "Fogón"
- ~~`SettingsScreen` usaba `StyleSheet`~~ → ✅ migrado a NativeWind
- Falta token refresh automático (si el access token expira, se hace logout)
- `ALLOWED_HOSTS = ['*']` y `CORS_ALLOW_ALL_ORIGINS = True` — inseguro para producción
- No hay registro de usuario desde el frontend (solo login con usuario creado via `createsuperuser`)
- Google OAuth está como placeholder (botón sin funcionalidad)
- ~~No hay manejo de paginación en el listado de recetas~~ → ✅ Implementado cursor-based pagination (DRF CursorPagination) con infinite scroll
- ~~El filtrado por búsqueda se hace client-side después de cargar todas las recetas~~ → ✅ Migrado a búsqueda server-side con debounce 400ms

---

## 13. Funcionalidades Futuras Planificadas

| Funcionalidad                              | Prioridad |
|--------------------------------------------|-----------|
| ~~Favoritos como pill de filtro~~          | ✅ Hecho  |
| Drag & drop para reordenar pasos          | Media     |
| Registro de usuario desde la app           | Alta      |
| Google OAuth funcional                     | Media     |
| Módulo Social (feed, recetas públicas, `favorite_count` ya preparado) | Futura |
| Chatbot RAG ("¿Qué puedo cocinar con...?")| Futura    |
| Planificación semanal de comidas           | Futura    |
| Perfil nutricional automático              | Futura    |
| Adaptación por restricciones dietarias     | Futura    |

---

## 14. Convenciones y Patrones del Código

### Backend
- **Idioma:** Nombres de endpoints y modelos en español (`recetas`, `categorias`, `importar`)
- **Serializers:** Manejan lógica compleja de create/update (nested ingredients, steps, imágenes)
- **Views:** ViewSets para CRUD, `@api_view` para endpoints de importación IA
- **Utils:** Toda la lógica de IA está aislada en `recetas/utils.py`
- **Prompts de IA:** Embebidos como f-strings en Python, en español

### Frontend
- **Idioma UI:** Español (textos, placeholders, alertas, mensajes)
- **Idioma código:** Inglés para nombres de variables, funciones y componentes
- **Estilos:** NativeWind (Tailwind classes) como estándar en toda la app.
- **Estado:** Un solo contexto global (`AppContext`). No hay Redux ni Zustand.
- **API calls:** Centralizadas en `src/services/api.ts`
- **Tipos:** Definidos en `src/types/index.tsx`
- **Componentes:** Separados en `recipes/` (dominio) y `ui/` (genéricos)
- **Screens:** En `src/screens/`, importados por las rutas en `app/`

### Patrones comunes
- Las funciones de importación IA retornan `data.recipe || data` (el backend wrappea en `{message, recipe}`)
- Las imágenes tienen 3 posibles fuentes: `image` (backend), `localImage` (selección local), `image_url` (thumbnail de IA)
- El serializer de Recipe acepta `image_base64` (write-only) para uploads y `image` (read-only) para lectura

---

## 15. Guía Rápida para Agentes de IA

### Si necesitas agregar un nuevo campo a Recipe:

1. Agregar campo en `backend/recetas/models.py` → `Recipe`
2. Correr `python manage.py makemigrations && python manage.py migrate`
3. Agregar campo en `backend/recetas/serializers.py` → `RecipeSerializer.Meta.fields`
4. Si es editable, agregar lógica en `create()` y `update()` del serializer
5. Agregar en `frontend/src/types/index.tsx` → interface `Recipe`
6. Agregar en el formulario `RecipeFormModal.tsx` si es editable por el usuario
7. Agregar en `RecipeDetailModal.tsx` si es visible en el detalle

### Si necesitas agregar un nuevo endpoint:

1. Crear vista en `backend/recetas/views.py`
2. Agregar ruta en `backend/config/urls.py`
3. Crear función de servicio en `frontend/src/services/api.ts`
4. Exponer vía `AppContext` si necesita estado global
5. Consumir desde el componente correspondiente

### Si necesitas agregar una nueva pantalla:

1. Crear componente en `frontend/src/screens/NombreScreen.tsx`
2. Crear archivo de ruta en `frontend/app/(tabs)/nombre.tsx` (o fuera de tabs si no requiere tab)
3. Si requiere tab, agregar en `frontend/app/(tabs)/_layout.tsx`
4. Si necesita datos del backend, usar `useApp()` hook

### Si necesitas modificar la lógica de IA:

- Todo está en `backend/recetas/utils.py`
- Los prompts son f-strings en español que piden JSON como output
- Gemini se configura con `response_mime_type: "application/json"` para forzar JSON válido
- Gemini Flash procesa el audio de forma nativa (sin transcripción intermedia). Si falla por cuota, reintenta solo con el texto de descripción como fallback.

### Si necesitas cambiar colores/estilos:

- Tokens de color: `frontend/tailwind.config.js` (para NativeWind) y `frontend/src/theme/index.ts` (para StyleSheet)
- Ambos deben mantenerse sincronizados
- Preferir NativeWind classes sobre StyleSheet para nuevo código
