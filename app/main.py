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
    """Check that required dependencies and API keys are configured"""
    import os
    from .config import OPENAI_API_KEY, PINECONE_API_KEY, PINECONE_INDEX_NAME
    
    # Check OpenAI
    if not OPENAI_API_KEY:
        logging.error("OPENAI_API_KEY not configured!")
        raise RuntimeError("OPENAI_API_KEY environment variable is required")
    logging.info("✓ OpenAI API key configured")
    
    # Check Pinecone
    if not PINECONE_API_KEY:
        logging.error("PINECONE_API_KEY not configured!")
        raise RuntimeError("PINECONE_API_KEY environment variable is required")
    if not PINECONE_INDEX_NAME:
        logging.error("PINECONE_INDEX_NAME not configured!")
        raise RuntimeError("PINECONE_INDEX_NAME environment variable is required")
    logging.info(f"✓ Pinecone configured (index: {PINECONE_INDEX_NAME})")
    
    # Check NumPy (still needed for image processing)
    try:
        import numpy
        logging.info(f"✓ NumPy version: {numpy.__version__}")
    except ImportError:
        logging.error("NumPy not installed!")
        raise RuntimeError("NumPy is required but not installed")


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
