# Use Python 3.13 slim image as base
FROM python:3.13-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_DEFAULT_TIMEOUT=1000 \
    PORT=8000 \
    QT_QPA_PLATFORM=offscreen \
    OPENCV_IO_ENABLE_OPENEXR=1 \
    OPENCV_IO_ENABLE_GDAL=1

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
# 🔧 Install NumPy 2.x (compatible with Python 3.13+)
# OpenCV requires numpy<2.3, so we cap at 2.2.x
# ------------------------------------------------------------
RUN pip install --no-cache-dir "numpy>=2.0,<2.3"

# Install core Python dependencies (no ML packages yet)
RUN pip install --no-cache-dir --timeout=1000 --retries=3 \
    fastapi==0.115.0 \
    uvicorn[standard]==0.30.6 \
    sqlmodel==0.0.22 \
    python-dotenv==1.0.1 \
    pydantic==2.9.2 \
    pydantic-settings==2.5.2 \
    passlib[bcrypt]==1.7.4 \
    argon2-cffi==23.1.0 \
    python-jose[cryptography]==3.3.0 \
    python-multipart==0.0.12 \
    requests==2.32.3 \
    email-validator==2.2.0 \
    python-magic==0.4.27 \
    psutil==6.0.0

# Install PDF processing dependencies
RUN pip install --no-cache-dir --timeout=1000 --retries=3 \
    pypdf==4.3.1 \
    pdf2image==1.17.0 \
    pillow==10.4.0 \
    pdfplumber==0.11.4 \
    pymupdf>=1.23.0 \
    azure-ai-documentintelligence==1.0.0b4

# Install OpenCV (headless for Docker, no GUI dependencies)
RUN pip install --no-cache-dir --timeout=1000 --retries=3 \
    opencv-python-headless==4.10.0.84 \
    opencv-python==4.10.0.84

# Install AI stack (Pinecone for vector DB, OpenAI for embeddings)
RUN pip install --no-cache-dir --timeout=1000 --retries=3 \
    pinecone>=5.0.0 \
    openai>=1.54.0

# Verify dependencies are installed correctly
RUN python -c "import numpy; from pinecone import Pinecone; import openai; print('✓ NumPy:', numpy.__version__); print('✓ Pinecone client installed'); print('✓ OpenAI:', openai.__version__)"

# Final cleanup (Railway-safe, no pip purge)
RUN apt-get autoremove -y && apt-get clean && \
    rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/* /root/.cache/pip || true

# Copy application source
COPY app/ ./app/
COPY *.py ./

# Create necessary directories
RUN mkdir -p uploads

# Create non-root user for security
RUN groupadd -r appuser && useradd -r -g appuser -m appuser
RUN chown -R appuser:appuser /app /home/appuser

# Switch to non-root user
USER appuser

# Expose application port
EXPOSE $PORT

# Health check endpoint
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:$PORT/healthz || exit 1

# Start FastAPI server
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port $PORT"]
