import yt_dlp
import os
import google.generativeai as genai
import json
import time
import google.api_core.exceptions as exceptions
from decouple import config

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

def extract_recipe_from_audio(audio_path, description_text, thumbnail_url=None):
    """
    Sube el audio a Gemini y extrae la receta estructurada en JSON.
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
            {{"name": "ingrediente", "quantity": "cantidad exacta"}}
        ],
        "steps": [
            {{"order": 1, "instruction": "Paso detallado"}}
        ]
    }}
    
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
                # Reiniciamos el loop una vez más forzando un intento extra
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
