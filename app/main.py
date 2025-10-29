from contextlib import asynccontextmanager
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .db import init_db
from .routes_auth import router as auth_router
from .routes_docs import router as docs_router
from .routes_rag import router as rag_router
from .config import ALLOW_ORIGINS


def check_dependencies():
    """Check that required dependencies are installed and log versions"""
    try:
        import numpy
        logging.info(f"NumPy version: {numpy.__version__}")
    except ImportError:
        logging.error("NumPy not installed!")
        raise RuntimeError("NumPy is required but not installed")
    
    try:
        import torch
        cuda_status = "available" if torch.cuda.is_available() else "not available (CPU-only)"
        logging.info(f"PyTorch version: {torch.__version__} | CUDA: {cuda_status}")
    except ImportError:
        logging.error("PyTorch not installed!")
        raise RuntimeError("PyTorch is required but not installed")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup logic
    check_dependencies()
    init_db()
    yield
    # Shutdown logic (optional)
    # Example: close DB connections, cleanup tasks


app = FastAPI(
    title="E-Book / Knowledge Assistant API",
    version="1.0.0",
    lifespan=lifespan
)

# Middleware
# Handle CORS origins properly - support both single origin and comma-separated list
if ALLOW_ORIGINS == "*":
    allowed_origins = ["*"]
else:
    # Split by comma and strip whitespace for multiple origins
    allowed_origins = [origin.strip() for origin in ALLOW_ORIGINS.split(",")]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(auth_router)
app.include_router(docs_router)
app.include_router(rag_router)

# Health
@app.get("/healthz")
def health():
    return {"status": "ok"}
