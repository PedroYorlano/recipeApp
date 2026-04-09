# ChefAI - Frontend (React Native / Expo)

Esta es la aplicación móvil de ChefAI, construida con React Native y Expo.

## Requisitos Previos

- [Node.js](https://nodejs.org/) instalado.
- [Expo Go](https://expo.dev/go) instalado en tu dispositivo físico iOS/Android, o tener un emulador/simulador configurado.
- El servidor **Backend (Django)** debe estar siendo ejecutado en paralelo.

---

## 🏃 Pasos para Ejecutar el Proyecto

Para que la aplicación móvil funcione correctamente y el "Login" pueda comunicarse con el servidor, debes levantar el sistema siguiendo este paso a paso:

### 1. Iniciar el Backend (Django) a nivel de red
Para que tu dispositivo móvil (o emulador) pueda hacer peticiones al servidor, **el backend tiene que estar escuchando en las direcciones de tu red local**, no solo de forma interna (`127.0.0.1`).

Abre una terminal, dirígete a la carpeta del backend y ejecuta el servidor de la siguiente manera:

```bash
# 1. Entrar la carpeta de tu backend (desde la raíz de tu proyecto)
cd backend

# 2. Activar tu entorno virtual
source venv/bin/activate

# 3. Ejecutar el servidor exponiendo el puerto 8000 a toda la red:
python manage.py runserver 0.0.0.0:8000
```
*(⚠️ **Crucial**: No uses solo `python manage.py runserver`. Si omites el `0.0.0.0:8000`, la terminal rechazará las peticiones del frontend en dispositivos externos y fallará silenciosamente).*

### 2. Verificar la IP en el Frontend
Asegúrate de que la IP configurada en tu app móvil coincida con la dirección actual de tu computadora en tu red de WiFi.

1. Averigua tu IP local (ejecuta `ifconfig` en Mac/Linux).
2. Ve al archivo `src/constants/index.ts` en este proyecto Frontend.
3. Verifica que la variable const base tenga tu IP exacta. Por ejemplo:
   ```typescript
   export const SERVER_URL = 'http://192.168.31.254:8000';
   export const API_BASE = `${SERVER_URL}/api`;
   ```

### 3. Iniciar el Frontend (Expo)
Abre una nueva pestaña de tu terminal, asegúrate de estar dentro de la carpeta del frontend (`frontend/mi-recetario-app`), y ejecuta:

```bash
# Instalar dependencias si fue clonado recientemente
npm install

# Iniciar el Metro Bundler de Expo
npx expo start
```

### 4. Probar la App
- Escanea el código QR que se genera en tu terminal utilizando la cámara de tu iPhone o directamente desde la aplicación **Expo Go** en Android.
- Al abrir la app, deberías poder llegar al Login y conectarte al backend exitosamente.

---

## 🛑 Resolución de Problemas Frecuentes

- **"El login no le pega al backend" / Network Request Failed:** Revisar el Paso 1. Cierra el servidor de Python e inicialo sin olvidar `0.0.0.0:8000`. También asegúrate de que tu celular y la computadora estén conectados a la misma red WiFi.
- **Fallos en Expo Web (CORS):** Si testeas la plataforma presionando "w" en la consola para usarla en formato web desde tu computadora, el explorador bloqueará las peticiones por seguridad. Requerirás instalar en el backend la librería `django-cors-headers` y autorizar tu origen (`CORS_ALLOW_ALL_ORIGINS = True`).
