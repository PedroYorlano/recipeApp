import base64
from io import BytesIO
from unittest import mock

from django.contrib.auth.models import User
from django.test import TestCase, override_settings
from PIL import Image
from rest_framework.test import APIClient

from .images import InvalidImage, image_from_base64, image_from_url, process_image
from .models import Recipe

# Los tests nunca tocan el bucket real.
IN_MEMORY = {
    'default': {'BACKEND': 'django.core.files.storage.InMemoryStorage'},
    'staticfiles': {'BACKEND': 'django.contrib.staticfiles.storage.StaticFilesStorage'},
}


def make_image(fmt='JPEG', size=(3000, 2000), mode='RGB', exif=None):
    buf = BytesIO()
    img = Image.new(mode, size, (200, 80, 40) if mode == 'RGB' else (200, 80, 40, 128))
    kwargs = {'exif': exif} if exif else {}
    img.save(buf, format=fmt, **kwargs)
    return buf.getvalue()


def data_uri(raw, mime='image/jpeg'):
    return f'data:{mime};base64,' + base64.b64encode(raw).decode()


class ProcessImageTests(TestCase):
    def test_achica_y_convierte_a_webp(self):
        out = process_image(make_image())
        img = Image.open(BytesIO(out.read()))
        self.assertEqual(img.format, 'WEBP')
        self.assertEqual(max(img.size), 1600)
        self.assertTrue(out.name.endswith('.webp'))

    def test_saca_el_exif(self):
        exif = Image.Exif()
        exif[0x010F] = 'CamaraConGPS'  # Make
        exif[0x0112] = 6               # Orientation: rotada 90°
        out = process_image(make_image(size=(400, 200), exif=exif.tobytes()))
        img = Image.open(BytesIO(out.read()))
        self.assertFalse(img.getexif())
        self.assertEqual(img.size, (200, 400))  # se aplicó la rotación antes de tirar el EXIF

    def test_mantiene_transparencia(self):
        out = process_image(make_image('PNG', (100, 100), 'RGBA'))
        self.assertEqual(Image.open(BytesIO(out.read())).mode, 'RGBA')

    def test_rechaza_lo_que_no_es_imagen(self):
        for raw in (b'<html><script>alert(1)</script></html>', b'', b'GIF89a' + b'\0' * 50):
            with self.assertRaises(InvalidImage):
                process_image(raw)

    def test_rechaza_formatos_no_permitidos(self):
        with self.assertRaises(InvalidImage):
            process_image(make_image('BMP', (50, 50)))

    def test_rechaza_bomba_de_pixeles(self):
        buf = BytesIO()
        Image.new('1', (8000, 8000)).save(buf, format='PNG')  # 64 MP que pesan pocos KB
        with self.assertRaises(InvalidImage):
            process_image(buf.getvalue())

    def test_base64_danado(self):
        with self.assertRaises(InvalidImage):
            image_from_base64('data:image/jpeg;base64,esto no es base64!!')

    def test_base64_miente_el_tipo(self):
        # Dice ser JPEG pero es HTML: antes se guardaba tal cual en el bucket.
        with self.assertRaises(InvalidImage):
            image_from_base64(data_uri(b'<html>hola</html>'))


class FakeResponse:
    def __init__(self, status=200, headers=None, body=b''):
        self.status_code = status
        self.headers = headers or {}
        self.body = body
        self.is_redirect = status in (301, 302, 303, 307, 308)

    def iter_content(self, size):
        for i in range(0, len(self.body), size):
            yield self.body[i:i + size]

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False


PUBLIC = [(2, 1, 6, '', ('93.184.216.34', 0))]
PRIVATE = [(2, 1, 6, '', ('169.254.169.254', 0))]


class ImageFromUrlTests(TestCase):
    @mock.patch('recetas.images.socket.getaddrinfo', return_value=PUBLIC)
    @mock.patch('recetas.images.requests.get')
    def test_baja_y_procesa(self, get, _):
        get.return_value = FakeResponse(body=make_image())
        self.assertTrue(image_from_url('https://cdn.example.com/a.jpg').name.endswith('.webp'))

    @mock.patch('recetas.images.socket.getaddrinfo', return_value=PRIVATE)
    @mock.patch('recetas.images.requests.get')
    def test_no_entra_a_ips_internas(self, get, _):
        self.assertIsNone(image_from_url('https://metadata.internal/latest'))
        get.assert_not_called()

    @mock.patch('recetas.images.socket.getaddrinfo')
    @mock.patch('recetas.images.requests.get')
    def test_redireccion_a_ip_interna(self, get, addrinfo):
        addrinfo.side_effect = lambda host, *_: PUBLIC if host == 'cdn.example.com' else PRIVATE
        get.return_value = FakeResponse(302, {'Location': 'http://169.254.169.254/latest/meta-data'})
        self.assertIsNone(image_from_url('https://cdn.example.com/a.jpg'))
        self.assertEqual(get.call_count, 1)

    @mock.patch('recetas.images.socket.getaddrinfo', return_value=PUBLIC)
    @mock.patch('recetas.images.requests.get')
    def test_corta_descargas_gigantes_sin_content_length(self, get, _):
        get.return_value = FakeResponse(body=b'x' * (6 * 1024 * 1024))
        self.assertIsNone(image_from_url('https://cdn.example.com/a.jpg'))


@override_settings(STORAGES=IN_MEMORY, PIZCA_MAX_IMAGES_PER_USER_PER_DAY=2)
class RecipeImageApiTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user('ana', 'ana@example.com', 'contraseña-segura')
        self.client = APIClient()
        self.client.force_authenticate(self.user)

    def create(self, **extra):
        payload = {'title': 'Tarta', 'ingredients': [{'name': 'harina'}], 'steps': [{'order': 1, 'instruction': 'Mezclar'}], **extra}
        return self.client.post('/api/recetas/', payload, format='json')

    def test_guarda_webp_y_rechaza_lo_que_no_es_imagen(self):
        r = self.create(image_base64=data_uri(make_image()))
        self.assertEqual(r.status_code, 201, r.content)
        self.assertTrue(Recipe.objects.get(uuid=r.data['uuid']).image.name.endswith('.webp'))

        r = self.create(image_base64=data_uri(b'<html></html>'))
        self.assertEqual(r.status_code, 400)
        self.assertIn('image', r.data)

    def test_tope_diario_de_fotos(self):
        for _ in range(2):
            self.assertEqual(self.create(image_base64=data_uri(make_image(size=(50, 50)))).status_code, 201)
        r = self.create(image_base64=data_uri(make_image(size=(50, 50))))
        self.assertEqual(r.status_code, 400)
        self.assertIn('máximo de 2 fotos', str(r.data['image']))
        # Sin foto se sigue pudiendo guardar.
        self.assertEqual(self.create().status_code, 201)

    def test_reemplazar_foto_borra_la_anterior(self):
        r = self.create(image_base64=data_uri(make_image(size=(50, 50))))
        recipe = Recipe.objects.get(uuid=r.data['uuid'])
        old = recipe.image.name
        storage = recipe.image.storage
        r = self.client.patch(f'/api/recetas/{recipe.pk}/', {'image_base64': data_uri(make_image(size=(60, 60)))}, format='json')
        self.assertEqual(r.status_code, 200, r.content)
        self.assertFalse(storage.exists(old))


class ShoppingListTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user('beto', 'beto@example.com', 'contraseña-segura')
        self.client = APIClient()
        self.client.force_authenticate(self.user)

    def test_regenerar_mantiene_lo_agregado_a_mano(self):
        week = '2026-11-09'
        r = self.client.post('/api/shopping/', {'week_start': week, 'ingredient_name': 'Servilletas'}, format='json')
        self.assertEqual(r.status_code, 201, r.content)
        self.assertTrue(r.data['is_manual'])
        self.client.post('/api/shopping/', {'week_start': week, 'ingredient_name': 'Pan', 'is_checked': True}, format='json')

        r = self.client.post('/api/planner/generate_shopping_list/', {'week_start': week}, format='json')
        self.assertEqual(r.status_code, 200, r.content)
        names = {i['ingredient_name'] for i in r.data}
        self.assertIn('Servilletas', names)
        self.assertNotIn('Pan', names)  # lo tachado se va igual

    def test_no_se_puede_marcar_como_manual_desde_afuera(self):
        r = self.client.post('/api/shopping/', {'week_start': '2026-11-09', 'ingredient_name': 'x', 'is_manual': False}, format='json')
        self.assertTrue(r.data['is_manual'])


class NotFoundTests(TestCase):
    def test_404_en_castellano(self):
        r = APIClient().get('/api/compartidas/00000000-0000-0000-0000-000000000000/')
        self.assertEqual(r.status_code, 404)
        self.assertEqual(r.data['detail'], 'Esta receta no existe o ya no está compartida.')

    def test_404_generico_en_castellano(self):
        user = User.objects.create_user('caro', 'caro@example.com', 'contraseña-segura')
        client = APIClient()
        client.force_authenticate(user)
        r = client.get('/api/recetas/999999/')
        self.assertEqual(r.status_code, 404)
        self.assertEqual(r.data['detail'], 'No encontramos lo que buscabas.')
