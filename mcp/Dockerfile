# MCP remoto de Pizca (conector de Claude). Cloud Run: gcloud run deploy pizca-mcp --source mcp
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

COPY pyproject.toml README.md ./
COPY pizca_mcp ./pizca_mcp
RUN pip install .

# Sin root: si alguien rompe el proceso, no es dueño del contenedor.
RUN useradd --create-home --uid 1000 pizca
USER pizca

# Cloud Run pasa el puerto en $PORT (8080).
EXPOSE 8080
CMD ["pizca-mcp-http"]
