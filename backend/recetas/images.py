"""
Fotos de portada: todo lo que se guarda en el bucket pasa por acá.

- Se valida que sea una imagen de verdad (Pillow), no lo que diga el cliente.
- Se achica a MAX_SIDE y se guarda como WebP: pesa ~10 veces menos.
- Se descarta el EXIF (puede traer la ubicación GPS de quien sacó la foto).
- Las descargas desde URL pasan por net.fetch_public (protección SSRF y tope de tamaño).
"""
import base64
import binascii
import uuid
from io import BytesIO

from django.core.files.base import ContentFile
from PIL import Image, ImageOps

from .net import FetchError, fetch_public

MAX_BYTES = 5 * 1024 * 1024        # Tamaño máximo del archivo original
MAX_PIXELS = 40_000_000            # ~40 MP: frena "bombas" de descompresión
MAX_SIDE = 1600                    # Lado mayor de la foto guardada
WEBP_QUALITY = 80
ALLOWED_FORMATS = {'JPEG', 'MPO', 'PNG', 'WEBP', 'GIF'}  # MPO: JPEG de algunos iPhone y cámaras


class InvalidImage(ValueError):
    """El archivo no es una imagen que podamos usar. El mensaje se le puede mostrar al usuario."""


def process_image(raw: bytes) -> ContentFile:
    """Valida, achica y convierte a WebP. Tira InvalidImage si no sirve."""
    if not raw:
        raise InvalidImage('La imagen está vacía.')
    if len(raw) > MAX_BYTES:
        raise InvalidImage('La imagen es demasiado grande (máximo 5 MB).')
    try:
        with Image.open(BytesIO(raw)) as probe:
            if probe.format not in ALLOWED_FORMATS:
                raise InvalidImage('Ese formato de imagen no está permitido.')
            if probe.width * probe.height > MAX_PIXELS:
                raise InvalidImage('La imagen tiene demasiada resolución.')
            probe.verify()
        # verify() deja el objeto inutilizable: hay que abrirla de nuevo para procesarla.
        with Image.open(BytesIO(raw)) as img:
            img.seek(0)  # GIF animado: primer cuadro
            img = ImageOps.exif_transpose(img)  # respeta la rotación del celu antes de tirar el EXIF
            img = img.convert('RGBA' if _has_alpha(img) else 'RGB')
            img.thumbnail((MAX_SIDE, MAX_SIDE), Image.Resampling.LANCZOS)
            out = BytesIO()
            img.save(out, format='WEBP', quality=WEBP_QUALITY, method=4)
    except InvalidImage:
        raise
    except (Image.DecompressionBombError, OSError, SyntaxError, ValueError) as e:
        raise InvalidImage('No pudimos leer la imagen. Probá con otra.') from e
    return ContentFile(out.getvalue(), name=f'{uuid.uuid4()}.webp')


def _has_alpha(img: Image.Image) -> bool:
    return img.mode in ('RGBA', 'LA', 'PA') or (img.mode == 'P' and 'transparency' in img.info)


def image_from_base64(data: str) -> ContentFile:
    """Acepta 'data:image/...;base64,XXXX' o el base64 pelado."""
    if len(data) > MAX_BYTES * 4 // 3 + 1024:
        raise InvalidImage('La imagen es demasiado grande (máximo 5 MB).')
    payload = data.split(';base64,', 1)[1] if ';base64,' in data else data
    try:
        raw = base64.b64decode(payload, validate=True)
    except (binascii.Error, ValueError) as e:
        raise InvalidImage('La imagen llegó dañada. Probá elegirla de nuevo.') from e
    return process_image(raw)


def image_from_url(url: str) -> ContentFile | None:
    """
    Baja la imagen (portada de un reel o de una web) y la procesa.
    Devuelve None si no se pudo: la receta se guarda igual, sin foto.
    """
    try:
        return process_image(fetch_public(url, MAX_BYTES))
    except (FetchError, InvalidImage):
        return None
