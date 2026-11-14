FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# ffmpeg: audio de los videos y del dictado. psycopg2-binary trae libpq, no hace falta compilar nada.
RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .

# Los estáticos (admin, DRF) se juntan en la imagen y los sirve whitenoise. collectstatic no usa
# la clave, pero settings la exige al cargar.
RUN SECRET_KEY=solo-para-el-build python manage.py collectstatic --noinput

# Sin root: si alguien rompe un proceso, no es dueño del contenedor.
RUN useradd --create-home --uid 1000 pizca && chown -R pizca /app
USER pizca

EXPOSE 8000

# Cloud Run pasa el puerto en $PORT (8080); en local queda 8000. Los hilos dejan atender otros
# requests mientras un import de video espera a yt-dlp o a Gemini.
# Las migraciones corren al arrancar: si una falla, la revisión nueva no levanta y Cloud Run sigue
# sirviendo la anterior. Con --max-instances=1 no hay dos migrando a la vez.
CMD python manage.py migrate --noinput && python manage.py crear_cliente_mcp && exec gunicorn config.wsgi --bind 0.0.0.0:${PORT:-8000} --workers 2 --threads 4 --timeout 120
