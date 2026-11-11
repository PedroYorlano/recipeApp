import yt_dlp
import os
import subprocess
from google import genai
from google.genai import types
import json
import time
from google.genai import errors as genai_errors
from decouple import config

COMMON_INGREDIENTS = [
    'huevo', 'arroz', 'pollo', 'pasta', 'tomate', 'cebolla', 'ajo',
    'zanahoria', 'papa', 'carne', 'leche', 'queso', 'harina', 'aceite',
    'manteca', 'sal', 'pimienta', 'limón', 'palta', 'zapallo', 'fideos',
    'atún', 'sardina', 'lenteja', 'garbanzo', 'espinaca', 'brócoli',
    'chocolate', 'dulce de leche', 'banana', 'frutilla', 'arandanos', 'frambuesas',
    'naranja', 'manzana', 'pera', 'uva', 'sandia', 'melon', 'kiwi', 'mandarina', 'pomelo'
]

def download_audio_from_url(video_url):
    """
    Descarga el audio de un video de TikTok/Reels/YouTube
    y devuelve la ruta del archivo .mp3 generado.
    """
    
    # Configuración para yt-dlp
    ydl_opts = {
        'format': 'bestaudio/best',
        'postprocessors': [{
            'key': 'FFmpegExtractAudio',
            'preferredcodec': 'mp3',
            'preferredquality': '192',
        }],
        # Guardar en la carpeta temporal del sistema con un nombre único
        'outtmpl': '%(id)s.%(ext)s', 
        # Evitar que imprima demasiada basura en la consola
        'quiet': True,
        'no_warnings': True,
        'cookies_from_browser': ['chrome'],
    }

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            # 1. Extraemos info del video sin descargar todavía
            info = ydl.extract_info(video_url, download=False)
            video_title = info.get('title', 'Video sin titulo')
            video_description = info.get('description', 'Video sin descripcion')
            thumbnail_url = info.get('thumbnail', None)

            print(f"Detectado: {video_title}")

            # 2. Descargamos y convertimos
            error_code = ydl.download([video_url])
            
            if error_code != 0:
                raise Exception("Falló la descarga")

            # yt-dlp guarda el archivo con el ID del video. 
            # Calculamos el nombre del archivo final.
            video_id = info['id']
            filename = f"{video_id}.mp3"
            
            # Devolvemos la ruta absoluta para que luego Gemini la encuentre
            return os.path.abspath(filename), video_description, thumbnail_url

    except Exception as e:
        print(f"Error descargando: {e}")
        return None, None, None

GENAI_API_KEY = config('GENAI_API_KEY')
client = genai.Client(api_key=GENAI_API_KEY)

# El Flash-Lite actual: el más barato de Gemini con audio y sin fecha de apagado. Se cambia desde el .env sin tocar código.
GEMINI_MODEL = config('GEMINI_MODEL', default='gemini-3.5-flash-lite')


def generate_json(contents, retries=3, wait=10):
    """
    Llama a Gemini pidiendo JSON y devuelve un dict.
    Reintenta si se pasó la cuota (429), si Google falla (5xx) o si el JSON vino roto;
    cualquier otro error (key inválida, modelo inexistente) se propaga de una.
    """
    for attempt in range(1, retries + 1):
        try:
            result = client.models.generate_content(
                model=GEMINI_MODEL,
                contents=contents,
                config=types.GenerateContentConfig(response_mime_type="application/json"),
            )
            data = json.loads(result.text)
            if isinstance(data, list):
                data = data[0] if data else {}
            return data
        except genai_errors.APIError as e:
            if e.code != 429 and (e.code or 0) < 500:
                raise
            print(f"⚠️ Gemini respondió {e.code} (intento {attempt}/{retries}).")
            if attempt == retries:
                raise
        except json.JSONDecodeError:
            print(f"⚠️ Gemini devolvió un JSON inválido (intento {attempt}/{retries}).")
            if attempt == retries:
                raise
        time.sleep(wait)

def convert_audio_to_mp3(input_path):
    """
    Convierte cualquier audio (m4a del iPhone, webm del navegador, opus de WhatsApp...)
    a un mp3 mono liviano, un formato que Gemini acepta seguro.
    Devuelve la ruta del mp3; tira ValueError si ffmpeg no lo pudo leer.
    """
    output_path = f"{input_path}.mp3"
    try:
        subprocess.run(
            ['ffmpeg', '-y', '-loglevel', 'error', '-i', input_path, '-vn', '-ac', '1', '-b:a', '64k', output_path],
            check=True, capture_output=True, timeout=120,
        )
    except (subprocess.CalledProcessError, subprocess.TimeoutExpired, FileNotFoundError) as e:
        if os.path.exists(output_path):
            os.remove(output_path)
        raise ValueError('No pudimos leer el audio. Probá con otro archivo.') from e
    return output_path


def extract_recipe_from_audio(audio_path, description_text, thumbnail_url=None, require_audio=False):
    """
    Sube el audio a Gemini directamente y extrae la receta estructurada en JSON.
    No usa Groq Whisper — Gemini procesa el audio nativo.
    Con `require_audio=True` (audio subido por el usuario, sin descripción) no se usa el
    modo "solo texto": sin el audio no hay de dónde sacar la receta y la IA la inventaría.
    """
    print("1. Subiendo audio a la IA...")

    try:
        myfile = client.files.upload(file=audio_path)
        while myfile.state == "PROCESSING":
            time.sleep(1)
            myfile = client.files.get(name=myfile.name)
    except Exception as e:
        print(f"Error subiendo audio: {e}. Pasando a modo Solo-Texto.")
        myfile = None

    if require_audio and not myfile:
        return None

    print("2. Analizando receta...")

    prompt = f"""
    Actúa como un chef experto transcribiendo una receta.
    
    TIENES DOS FUENTES DE INFORMACIÓN:
    1. Un archivo de AUDIO (lo que dice el cocinero).
    2. Un texto de DESCRIPCIÓN del video (que suele tener las cantidades exactas).
    
    TEXTO DE DESCRIPCIÓN:
    "{description_text}"
    
    TU TAREA:
    Combina ambas fuentes. Si el audio dice "agrega azúcar" pero la descripción dice "20g de azúcar", USA LA CANTIDAD EXACTA de la descripción. La descripción tiene prioridad para las cantidades.
    
    FORMATO JSON REQUERIDO:
    {{
        "title": "Título atractivo",
        "description": "Breve resumen",
        "ingredients": [
            {{"name": "ingrediente", "quantity": 200, "unit": "g"}}
        ],
        "steps": [
            {{"order": 1, "instruction": "Paso detallado"}}
        ]
    }}
    
    REGLAS PARA INGREDIENTES:
    - "quantity" DEBE ser un número decimal (ej: 200, 0.5, 1.5). Si no hay cantidad, usa null.
    - "unit" es la unidad de medida como string (ej: "g", "ml", "cucharada", "taza", "unidad", "pizca"). Si no hay unidad, usa "".
    - Siempre separa la cantidad numérica de la unidad. Ejemplo: "200g de harina" → quantity: 200, unit: "g", name: "harina"
    - Para cantidades como "3 huevos" → quantity: 3, unit: "unidad", name: "huevos"
    - Para "sal a gusto" → quantity: null, unit: "", name: "sal a gusto"
    - "medio"/"media" va con el ingrediente que le sigue, no con el anterior: "tres huevos y media cebolla" → huevos: 3 y cebolla: 0.5
    
    Devuelve SOLO el JSON limpio.
    """

    def build_contents(with_audio):
        contenido = []
        if description_text:
            contenido.append(f"DESCRIPCIÓN DEL VIDEO (Prioridad para cantidades): {description_text}")
        if with_audio:
            contenido.append(myfile)
        else:
            contenido.append("No hay audio disponible. Extrae la receta basándote SOLO en la descripción proporcionada arriba.")
        contenido.append(prompt)
        return contenido

    try:
        result_json = generate_json(build_contents(with_audio=bool(myfile)))
    except Exception as e:
        print(f"Error analizando el audio: {e}")
        # Último recurso para videos: si hay descripción, armamos la receta solo con ella.
        if not myfile or require_audio or not description_text:
            return None
        try:
            result_json = generate_json(build_contents(with_audio=False), retries=1)
        except Exception as e2:
            print(f"Error analizando la descripción: {e2}")
            return None

    if thumbnail_url and isinstance(result_json, dict):
        result_json['image_url'] = thumbnail_url
    return result_json


def extract_recipe_from_text(description_text: str, strict_mode: bool = False):
    """
    Envía texto plano libre escrito por el usuario a Gemini para organizar
    en formato de Receta JSON. Autocompleta detalles faltantes si es necesario.
    """
    print("Analizando receta desde texto libre con Gemini...")

    if strict_mode:
        behavior = 'ADVERTENCIA: Extrae ÚNICAMENTE la información presente en el texto. NO inventes recetas, ingredientes, cantidades ni pasos que no existan. Si el texto claramente no contiene una receta (por ejemplo, es un mensaje de error, acceso denegado, Incapsula, Cloudflare, etc.), devuelve exactamente esto en el JSON: {"title": "ERROR_NO_RECIPE"}'
    else:
        behavior = "ADVERTENCIA: El texto provisto por el usuario puede estar muy incompleto. Si las cantidades, proporciones o pasos están ausentes, INFIÉRELOS LÓGICAMENTE usando tu vasta inteligencia culinaria para completar la receta de manera que el plato quede funcional y apetecible. Asegúrate de inventar las cantidades e instrucciones que lógicamente falten y asume ingredientes fundamentales si el usuario solo describió el núcleo."

    prompt = f"""
    Actúa como un chef experto transcribiendo y estructurando una receta.
    
    TIENES LA SIGUIENTE INFORMACIÓN DE REFERENCIA O TEXTO INGRESADO POR EL USUARIO:
    "{description_text}"
    
    TU TAREA:
    Analiza este texto y estructúralo en un formato de receta. 
    {behavior}
    
    FORMATO JSON REQUERIDO:
    {{
        "title": "Título atractivo (si no hay, invéntalo lógico)",
        "description": "Breve resumen",
        "ingredients": [
            {{"name": "ingrediente", "quantity": 200, "unit": "g"}}
        ],
        "steps": [
            {{"order": 1, "instruction": "Paso detallado y bien explicado"}}
        ]
    }}
    
    REGLAS PARA INGREDIENTES:
    - "quantity" DEBE ser un número decimal (ej: 200, 0.5, 1.5). Si no hay cantidad, usa null.
    - "unit" es la unidad de medida como string (ej: "g", "ml", "cucharada", "taza", "unidad", "pizca"). Si no hay unidad, usa "".
    - Siempre separa la cantidad numérica de la unidad. Ejemplo: "200g de harina" → quantity: 200, unit: "g", name: "harina"
    - Para cantidades como "3 huevos" → quantity: 3, unit: "unidad", name: "huevos"
    - Para "sal a gusto" → quantity: null, unit: "", name: "sal a gusto"
    - "medio"/"media" va con el ingrediente que le sigue, no con el anterior: "tres huevos y media cebolla" → huevos: 3 y cebolla: 0.5
    
    Devuelve SOLO el JSON limpio.
    """

    try:
        result_json = generate_json(prompt, wait=3)
    except Exception as e:
        print(f"Error analizando el texto: {e}")
        return None

    if result_json.get('title') == 'ERROR_NO_RECIPE':
        print("Gemini determinó que el texto no contenía una receta válida.")
        return None
    return result_json

def extract_keywords(text: str) -> list[str]:
    """Extrae ingredientes mencionados en el mensaje del usuario."""
    text_lower = text.lower()
    return [ing for ing in COMMON_INGREDIENTS if ing in text_lower]

def build_recipes_summary(recipes_qs) -> list[dict]:
    """Convierte un queryset de recetas en resumen compacto para Gemini."""
    return [
        {
            "uuid": str(r.uuid),
            "title": r.title,
            "categories": [c.name for c in r.categories.all()],
            "ingredients": [i.name for i in r.ingredients.all()],
            "prep_time": r.prep_time,
        }
        for r in recipes_qs
    ]

def call_fogoncito(user_message: str, recipes_summary: list[dict]) -> dict:
    """Llama a Gemini y devuelve la respuesta estructurada."""
    prompt = f"""
    Sos Fogoncito, el asistente de cocina de Fogón. Sos cálido, breve e informal.

    El usuario dice: "{user_message}"

    Recetas disponibles:
    {json.dumps(recipes_summary, ensure_ascii=False)}

    Recomendá las 2-3 que mejor encajen. Por cada una: nombre y por qué encaja en una línea.
    Si ninguna encaja, decíselo honestamente y sugerí que agregue más recetas.
    Devolvé SOLO un JSON con esta estructura:
    {{"message": "texto conversacional breve", "suggestions": [{{"uuid": "...", "title": "..."}}]}}
    """
    return generate_json(prompt, retries=2, wait=3)
