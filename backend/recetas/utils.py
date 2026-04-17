import yt_dlp
import os
import google.generativeai as genai
import json
import time
import google.api_core.exceptions as exceptions
from decouple import config
from groq import Groq

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
            
            # Devolvemos la ruta absoluta para que luego Whisper la encuentre
            return os.path.abspath(filename), video_description, thumbnail_url

    except Exception as e:
        print(f"Error descargando: {e}")
        return None, None, None

GENAI_API_KEY = config('GENAI_API_KEY')
genai.configure(api_key=GENAI_API_KEY)

GROQ_API_KEY = config('GROQ_API_KEY')
groq_client = Groq(api_key=GROQ_API_KEY)

def extract_recipe_from_audio(audio_path, description_text, thumbnail_url=None):
    """
    Transcribe el audio a texto con Groq Whisper y luego usa Gemini
    para extraer la receta estructurada en JSON.
    """
    print("1. Transcribiendo audio con Groq Whisper...")
    audio_transcript = ""
    
    if audio_path and os.path.exists(audio_path):
        try:
            with open(audio_path, "rb") as file:
                transcription = groq_client.audio.transcriptions.create(
                    file=(os.path.basename(audio_path), file.read()),
                    model="whisper-large-v3", # Modelo base fuerte para transcripción rápida
                    response_format="text"
                )
            audio_transcript = transcription
            print("Transcripción completada con éxito.")
        except Exception as e:
            print(f"Error transcribiendo audio con Groq: {e}. Pasando a modo Solo-Texto.")
            audio_transcript = ""
    else:
        print("No se encontró o no se proveyó archivo de audio.")

    print("2. Analizando receta con Gemini...")

    # Usamos el modelo Flash que es rápido y barato
    model = genai.GenerativeModel("gemini-flash-lite-latest")

    prompt = f"""
    Actúa como un chef experto transcribiendo y estructurando una receta.
    
    TIENES DOS FUENTES DE INFORMACIÓN:
    1. Un texto de TRANSCRIPCIÓN de AUDIO (proveniente de otra IA que transcribió lo que dice el cocinero).
       IMPORTANTE: Al ser una transcripción de otra IA, puede contener errores gramaticales, palabras confundidas o texto de relleno. Usa tu sentido común lógico de cocina para corregirlos o interpretarlos al vuelo.
    2. Un texto de DESCRIPCIÓN del video original (que suele tener las cantidades exactas).
    
    TEXTO DE DESCRIPCIÓN ORIGINAL:
    "{description_text if description_text else 'Sin información adicional.'}"
    
    TRANSCRIPCIÓN DEL AUDIO:
    "{audio_transcript if audio_transcript else 'No hay audio disponible.'}"
    
    TU TAREA:
    Combina ambas fuentes. Si la transcripción dice "agrega azúcar" pero la descripción dice "20g de azúcar", USA LA CANTIDAD EXACTA de la descripción. La descripción tiene prioridad para las cantidades y tiempos.
    
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
            # LLAMADA A LA IA
            print(f"Intento {attempt + 1} con modelo {model.model_name}...")
            result = model.generate_content(
                prompt,
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
        except (exceptions.InternalServerError, exceptions.ServiceUnavailable):
            print(f"⚠️ Error temporal de Google (Intento {attempt+1}). Esperando {retry_delay}s...")
            time.sleep(retry_delay)
        except Exception as e:
            print(f"Error inesperado: {e}")
            return None

    print("Error: Se agotaron los reintentos. Intenta más tarde.")
    return None

def extract_recipe_from_text(description_text: str):
    """
    Envía texto plano libre escrito por el usuario a Gemini para organizar
    en formato de Receta JSON. Autocompleta detalles faltantes si es necesario.
    """
    print("Analizando receta desde texto libre con Gemini...")
    model = genai.GenerativeModel("gemini-flash-latest")

    prompt = f"""
    Actúa como un chef experto transcribiendo y estructurando una receta.
    
    TIENES LA SIGUIENTE INFORMACIÓN DE REFERENCIA O TEXTO INGRESADO POR EL USUARIO:
    "{description_text}"
    
    TU TAREA:
    Analiza este texto y estructúralo en un formato de receta. 
    ADVERTENCIA: El texto provisto por el usuario puede estar muy incompleto. Si las cantidades, proporciones o pasos están ausentes, INFIÉRELOS LÓGICAMENTE usando tu vasta inteligencia culinaria para completar la receta de manera que el plato quede funcional y apetecible. Asegúrate de inventar las cantidades e instrucciones que lógicamente falten y asume ingredientes fundamentales si el usuario solo describió el núcleo.
    
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
            return result_json
        except Exception as e:
            print(f"Error parseando texto: {e}")
            time.sleep(3)

    return None
