# Use Python 3.11 slim image as base
FROM python:3.11-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_DEFAULT_TIMEOUT=1000 \
    PORT=8000 \
    QT_QPA_PLATFORM=offscreen \
    OPENCV_IO_ENABLE_OPENEXR=1 \
    OPENCV_IO_ENABLE_GDAL=1 \
    HF_HOME=/app/.cache/huggingface \
    TRANSFORMERS_CACHE=/app/.cache/huggingface/transformers \
    HF_DATASETS_CACHE=/app/.cache/huggingface/datasets \
    SENTENCE_TRANSFORMERS_HOME=/app/.cache/huggingface/sentence_transformers

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update --fix-missing && \
    apt-get install -y --no-install-recommends \
    poppler-utils libgl1-mesa-dri libglib2.0-0 libsm6 libxext6 libxrender1 libgomp1 \
    libmagic1 gcc g++ curl ca-certificates libgtk-3-0 libavcodec-dev libavformat-dev libswscale-dev \
    libglu1-mesa libglu1-mesa-dev libgl1-mesa-dev libx11-6 libx11-dev libxrandr2 libxinerama1 libxcursor1 libxi6 && \
    apt-get autoremove -y && apt-get clean && \
    rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

# Copy requirements first (for build cache efficiency)
COPY requirements.txt .

# ------------------------------------------------------------
# 🔧 Fix: enforce NumPy 1.x for PyTorch & SentenceTransformers
# ------------------------------------------------------------
RUN pip install --no-cache-dir "numpy<2"

# Install core Python dependencies
RUN pip install --no-cache-dir --timeout=1000 --retries=3 \
    fastapi uvicorn[standard] sqlmodel python-dotenv pydantic pydantic-settings

# Install ML dependencies (CPU version for Railway)
RUN pip install --no-cache-dir --timeout=1000 --retries=3 \
    torch==2.1.0+cpu --index-url https://download.pytorch.org/whl/cpu

# Install Transformer and Chroma stack
RUN pip install --no-cache-dir --timeout=1000 --retries=3 \
    "chromadb==0.5.3" "openai" "transformers==4.42.4" "sentence-transformers==2.7.0" "sentencepiece"

# Install remaining dependencies
RUN pip install --no-cache-dir --timeout=1000 --retries=3 \
    pypdf pdf2image pillow opencv-python-headless pdfplumber \
    passlib[bcrypt] python-jose[cryptography] python-multipart \
    azure-ai-documentintelligence requests email-validator \
    python-magic opencv-python

# Final cleanup (Railway-safe, no pip purge)
RUN apt-get autoremove -y && apt-get clean && \
    rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/* /root/.cache/pip || true

# Copy application source
COPY app/ ./app/
COPY *.py ./

# Create necessary directories
RUN mkdir -p uploads chroma_db .cache/huggingface

# Create non-root user for security
RUN groupadd -r appuser && useradd -r -g appuser -m appuser
RUN chown -R appuser:appuser /app /home/appuser
RUN mkdir -p /home/appuser/.cache/huggingface && chown -R appuser:appuser /home/appuser/.cache

# Switch to non-root user
USER appuser

# Expose application port
EXPOSE $PORT

# Health check endpoint
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:$PORT/healthz || exit 1

# Start FastAPI server
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port $PORT"]
