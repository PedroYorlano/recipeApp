# Fogón — Tests Manuales Documentados

> Tests reutilizables con `curl`. Asegurate de tener el servidor corriendo en `localhost:8000`.  
> Reemplazá `<TOKEN>` con un JWT válido obtenido del endpoint de login.

---

## 0. Setup — Obtener Token

```bash
# Login (obtener access token)
curl -s -X POST http://localhost:8000/api/token/ \
  -H "Content-Type: application/json" \
  -d '{"username": "tu_usuario", "password": "tu_password"}' | python3 -m json.tool

# Copiar el campo "access" y usarlo como <TOKEN> en los siguientes tests
export TOKEN="<pegar_access_token_aquí>"
```

---

## 1. CRUD Recetas

### Crear receta manual
```bash
curl -s -X POST http://localhost:8000/api/recetas/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test: Tarta de Manzana",
    "description": "Receta de prueba",
    "servings": 4,
    "categories": [],
    "ingredients": [
      {"name": "Harina", "quantity": 200, "unit": "g", "order": 0},
      {"name": "Manzanas", "quantity": 3, "unit": "unidad", "order": 1},
      {"name": "Canela", "quantity": null, "unit": "", "order": 2}
    ],
    "steps": [
      {"order": 1, "instruction": "Precalentar el horno a 180°C"},
      {"order": 2, "instruction": "Mezclar la harina con manteca"}
    ]
  }' | python3 -m json.tool
```

### Listar recetas
```bash
curl -s http://localhost:8000/api/recetas/ \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
```

### Buscar receta
```bash
curl -s "http://localhost:8000/api/recetas/?search=manzana" \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
```

### Editar receta (reemplazar ID)
```bash
curl -s -X PUT http://localhost:8000/api/recetas/1/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Tarta de Manzana Editada",
    "description": "Ahora con más azúcar",
    "servings": 6,
    "ingredients": [
      {"name": "Harina", "quantity": 300, "unit": "g", "order": 0}
    ],
    "steps": [
      {"order": 1, "instruction": "Precalentar a 200°C"}
    ]
  }' | python3 -m json.tool
```

### Eliminar receta
```bash
curl -s -X DELETE http://localhost:8000/api/recetas/1/ \
  -H "Authorization: Bearer $TOKEN" -w "\nHTTP Status: %{http_code}\n"
```

---

## 2. Favoritos

### Toggle favorito (marcaria como favorita, volver a ejecutar la desmarca)
```bash
curl -s -X POST http://localhost:8000/api/recetas/1/favorite/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" | python3 -m json.tool
```
**Esperado:** `{"is_favorite": true, "message": "¡Agregado a favoritos!"}` la primera vez,  
`{"is_favorite": false, "message": "Eliminado de favoritos"}` la segunda.

### Filtrar solo favoritos
```bash
curl -s "http://localhost:8000/api/recetas/?favorites=true" \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
```

---

## 3. Rate Limiting — Importaciones

### Test: Exceder 5 importaciones por minuto
```bash
# Ejecutar 6 veces rápidamente. La 6ta debería devolver 429.
for i in {1..6}; do
  echo "=== Request $i ==="
  curl -s -X POST http://localhost:8000/api/importar-texto/ \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"text": "Receta simple de prueba número '$i': mezclar 100g harina con 1 huevo"}' \
    -w "\nHTTP Status: %{http_code}\n\n"
done
```
**Esperado:** Las primeras 5 devuelven 201, la 6ta devuelve **429 Too Many Requests**.

> ⚠️ IMPORTANTE: Cada request de este test consume 1 RPD de Gemini. No ejecutar más de lo necesario.

---

## 4. Límite Diario

### Verificar estado del uso global (admin)
```bash
# Desde Django Admin: http://localhost:8000/admin/recetas/globalusage/
# O directamente en SQLite:
cd backend && source venv/bin/activate
python manage.py shell -c "
from recetas.models import GlobalUsage, UserUsage
g = GlobalUsage.get_today()
print(f'Gemini requests hoy: {g.gemini_requests}')
for u in UserUsage.objects.all():
    print(f'{u.user.username}: {u.import_count} imports (reset: {u.last_reset})')
"
```

---

## 5. Validación de URLs

### URL de video válida
```bash
curl -s -X POST http://localhost:8000/api/importar/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"}' \
  -w "\nHTTP Status: %{http_code}\n"
```
**Esperado:** 201 (o error de IA, pero no error de validación)

### URL de video inválida (host no permitido)
```bash
curl -s -X POST http://localhost:8000/api/importar/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.example.com/video"}' \
  -w "\nHTTP Status: %{http_code}\n"
```
**Esperado:** 400 con mensaje "Solo se permiten links de YouTube, TikTok e Instagram."

---

## 6. Protección SSRF — Web Import

### URL web válida (HTTPS pública)
```bash
curl -s -X POST http://localhost:8000/api/importar-web/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.recetasgratis.net/receta-de-bizcocho-casero-50694.html"}' \
  -w "\nHTTP Status: %{http_code}\n"
```
**Esperado:** 201 con receta extraída

### URL con HTTP (debe fallar)
```bash
curl -s -X POST http://localhost:8000/api/importar-web/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"url": "http://www.recetasgratis.net/algo"}' \
  -w "\nHTTP Status: %{http_code}\n"
```
**Esperado:** 400 con "Solo se permiten URLs con HTTPS por seguridad."

### URL con IP privada (intento SSRF)
```bash
curl -s -X POST http://localhost:8000/api/importar-web/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://192.168.1.1/admin"}' \
  -w "\nHTTP Status: %{http_code}\n"
```
**Esperado:** 400 con "No se permite acceder a direcciones IP privadas o reservadas."

### URL con localhost (intento SSRF)
```bash
curl -s -X POST http://localhost:8000/api/importar-web/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://localhost:8000/api/recetas/"}' \
  -w "\nHTTP Status: %{http_code}\n"
```
**Esperado:** 400 bloqueado por IP privada/loopback

### URL de metadata cloud (intento SSRF)
```bash
curl -s -X POST http://localhost:8000/api/importar-web/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://169.254.169.254/latest/meta-data/"}' \
  -w "\nHTTP Status: %{http_code}\n"
```
**Esperado:** 400 bloqueado por IP link-local/reservada

---

## 7. Acceso sin autenticación

### Recetas sin token (debe fallar)
```bash
curl -s http://localhost:8000/api/recetas/ -w "\nHTTP Status: %{http_code}\n"
```
**Esperado:** 401 Unauthorized

### Importar sin token (debe fallar)
```bash
curl -s -X POST http://localhost:8000/api/importar-texto/ \
  -H "Content-Type: application/json" \
  -d '{"text": "algo"}' -w "\nHTTP Status: %{http_code}\n"
```
**Esperado:** 401 Unauthorized

### Receta compartida sin token (debe funcionar)
```bash
# Reemplazar UUID con uno válido
curl -s http://localhost:8000/api/compartidas/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx/ \
  -w "\nHTTP Status: %{http_code}\n"
```
**Esperado:** 200 (pública)

---

## 8. Categorías

### Listar categorías (público)
```bash
curl -s http://localhost:8000/api/categorias/ | python3 -m json.tool
```

### Crear categoría
```bash
curl -s -X POST http://localhost:8000/api/categorias/ \
  -H "Content-Type: application/json" \
  -d '{"name": "Postres"}' | python3 -m json.tool
```
