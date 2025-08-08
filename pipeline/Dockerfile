# syntax=docker/dockerfile:1
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# System deps (optional: add build deps if needed)
RUN apt-get update -y && apt-get install -y --no-install-recommends \
    curl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install Python deps first for better caching
COPY requirements.txt ./
RUN pip install --upgrade pip && pip install -r requirements.txt

# Copy pipeline code into a package directory so `import pipeline` works
COPY . /app/pipeline

# Default envs (override at runtime)
ENV LOG_LEVEL=INFO \
    PYTHONPATH=/app

# Entrypoint
# Provide env via docker run --env-file pipeline/.env
CMD ["python", "-m", "pipeline.main"]
