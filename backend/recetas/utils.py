import yt_dlp
import os
import google.generativeai as genai
import json
import time
import google.api_core.exceptions as exceptions
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
genai.configure(api_key=GENAI_API_KEY)

def extract_recipe_from_audio(audio_path, description_text, thumbnail_url=None):
    """
    Sube el audio a Gemini directamente y extrae la receta estructurada en JSON.
    No usa Groq Whisper — Gemini procesa el audio nativo.
    """
    print("1. Subiendo audio a la IA...")

    try:
        myfile = genai.upload_file(audio_path)
        while myfile.state.name == "PROCESSING":
            time.sleep(1)
            myfile = genai.get_file(myfile.name)
    except Exception as e:
        print(f"Error subiendo audio: {e}. Pasando a modo Solo-Texto.")
        myfile = None

    print("2. Analizando receta...")

    # Usamos el modelo Flash que es rápido y barato
    model = genai.GenerativeModel("gemini-flash-latest")

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
    
    Devuelve SOLO el JSON limpio.
    """

    max_retries = 3
    retry_delay = 10

    for attempt in range(max_retries):
        try:
            contenido = []
            
            # Si tenemos descripción, la agregamos
            if description_text:
                contenido.append(f"DESCRIPCIÓN DEL VIDEO (Prioridad para cantidades): {description_text}")
            
            # Si el archivo de audio cargó bien, lo agregamos
            if myfile:
                contenido.append(myfile)
            else:
                # Si no hay audio, avisamos a la IA que dependa del texto
                contenido.append("No hay audio disponible. Extrae la receta basándote SOLO en la descripción proporcionada arriba.")

            contenido.append(prompt)

            # LLAMADA A LA IA
            print(f"Intento {attempt + 1} con modelo {model.model_name}...")
            result = model.generate_content(
                contenido,
                generation_config={"response_mime_type": "application/json"}
            )
            result_json = json.loads(result.text)
            
            # Inyectar url de thumbnail si viene
            if thumbnail_url:
                result_json['image_url'] = thumbnail_url

            return result_json
        except exceptions.ResourceExhausted:
            print(f"⚠️ Cuota excedida (Intento {attempt+1}). Esperando {retry_delay}s...")
            time.sleep(retry_delay)
            
            # ESTRATEGIA DE EMERGENCIA:
            # Si falló el último intento y teníamos audio, probamos UNA vez más SOLO con texto
            if attempt == max_retries - 1 and myfile:
                print("🚨 Último recurso: Intentando sin audio para ahorrar cuota...")
                myfile = None # Quitamos el audio
                max_retries += 1

        except (exceptions.InternalServerError, exceptions.ServiceUnavailable):
            print(f"⚠️ Error temporal de Google (Intento {attempt+1}). Esperando {retry_delay}s...")
            time.sleep(retry_delay)
            
            # La misma lógica de emergencia: si es el último intento, probamos solo texto
            if attempt == max_retries - 1 and myfile:
                print("🚨 Último recurso: Intentando sin audio...")
                myfile = None 
                max_retries += 1
            
        except Exception as e:
            # Si es otro error (ej: internet caído), fallamos de una vez
            print(f"Error inesperado: {e}")
            return None

    print("Error: Se agotaron los reintentos. Intenta más tarde.")
    return None


def extract_recipe_from_text(description_text: str, strict_mode: bool = False):
    """
    Envía texto plano libre escrito por el usuario a Gemini para organizar
    en formato de Receta JSON. Autocompleta detalles faltantes si es necesario.
    """
    print("Analizando receta desde texto libre con Gemini...")
    model = genai.GenerativeModel("gemini-flash-latest")

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
    
    Devuelve SOLO el JSON limpio.
    """

    for attempt in range(3):
        try:
            print(f"Intento {attempt + 1} de Texto con modelo {model.model_name}...")
            result = model.generate_content(
                prompt,
                generation_config={"response_mime_type": "application/json"}
            )
            result_json = json.loads(result.text)
            
            if result_json.get('title') == 'ERROR_NO_RECIPE':
                print("Gemini determinó que el texto no contenía una receta válida.")
                return None
                
            return result_json
        except Exception as e:
            print(f"Error parseando texto: {e}")
            time.sleep(3)

    return None

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
    model = genai.GenerativeModel("gemini-flash-latest")
    result = model.generate_content(
        prompt,
        generation_config={"response_mime_type": "application/json"}
    )
    return json.loads(result.text)
