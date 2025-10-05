# Use Python 3.11 slim image as base
FROM python:3.11-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_DEFAULT_TIMEOUT=1000 \
    PORT=8000 \
    # OpenCV environment variables for headless operation
    QT_QPA_PLATFORM=offscreen \
    OPENCV_IO_ENABLE_OPENEXR=1 \
    OPENCV_IO_ENABLE_GDAL=1 \
    # Hugging Face cache directory
    HF_HOME=/app/.cache/huggingface \
    TRANSFORMERS_CACHE=/app/.cache/huggingface/transformers \
    HF_DATASETS_CACHE=/app/.cache/huggingface/datasets \
    SENTENCE_TRANSFORMERS_HOME=/app/.cache/huggingface/sentence_transformers

# Set work directory
WORKDIR /app

# Install system dependencies with proper error handling
RUN apt-get update --fix-missing && \
    apt-get install -y --no-install-recommends \
    # Required for PDF processing
    poppler-utils \
    # Required for image processing (updated package names for newer Debian)
    libgl1-mesa-dri \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender1 \
    libgomp1 \
    # Required for python-magic
    libmagic1 \
    # Required for compilation
    gcc \
    g++ \
    # Required for health check
    curl \
    # Required for SSL/TLS
    ca-certificates \
    # Additional dependencies for OpenCV and image processing
    libgtk-3-0 \
    libavcodec-dev \
    libavformat-dev \
    libswscale-dev \
    # OpenGL libraries for OpenCV (headless support)
    libglu1-mesa \
    libglu1-mesa-dev \
    libgl1-mesa-dev \
    # Additional X11 libraries for headless OpenCV
    libx11-6 \
    libx11-dev \
    libxrandr2 \
    libxinerama1 \
    libxcursor1 \
    libxi6 \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/* \
    && rm -rf /tmp/* \
    && rm -rf /var/tmp/*

# Copy requirements first for better caching
COPY requirements.txt .

# Install Python dependencies in stages to avoid timeout issues
# Install core dependencies first
RUN pip install --no-cache-dir --timeout=1000 --retries=3 \
    fastapi uvicorn[standard] sqlmodel python-dotenv pydantic pydantic-settings

# Install ML dependencies separately (these are large)
RUN pip install --no-cache-dir --timeout=1000 --retries=3 \
    torch==2.1.0+cpu --index-url https://download.pytorch.org/whl/cpu

# Install remaining dependencies
RUN pip install --no-cache-dir --timeout=1000 --retries=3 \
    chromadb openai transformers sentence-transformers sentencepiece

# Install remaining packages
RUN pip install --no-cache-dir --timeout=1000 --retries=3 \
    pypdf pdf2image pillow opencv-python-headless pdfplumber \
    passlib[bcrypt] python-jose[cryptography] python-multipart \
    azure-ai-documentintelligence requests email-validator \
    python-magic numpy opencv-python

# Clean up to reduce image size
RUN apt-get autoremove -y && apt-get clean && \
    rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/* && \
    pip cache purge

# Copy application code
COPY app/ ./app/
COPY *.py ./

# Create necessary directories
RUN mkdir -p uploads chroma_db .cache/huggingface

# Create non-root user for security
RUN groupadd -r appuser && useradd -r -g appuser -m appuser
RUN chown -R appuser:appuser /app
RUN chown -R appuser:appuser /home/appuser

# Create huggingface cache directory in user's home and set permissions
RUN mkdir -p /home/appuser/.cache/huggingface
RUN chown -R appuser:appuser /home/appuser/.cache

USER appuser

# Expose port (use environment variable)
EXPOSE $PORT

# Health check
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:$PORT/healthz || exit 1

# Run the application
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port $PORT"]
