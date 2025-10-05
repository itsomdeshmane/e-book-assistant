from contextlib import asynccontextmanager
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .db import init_db
from .routes_auth import router as auth_router
from .routes_docs import router as docs_router
from .routes_rag import router as rag_router
from .config import ALLOW_ORIGINS


def check_numpy_compatibility():
    """Check NumPy version compatibility with ChromaDB"""
    try:
        import numpy
        if numpy.__version__.startswith('2.'):
            logging.error(f"CRITICAL: NumPy 2.x detected ({numpy.__version__}). "
                         f"ChromaDB is not compatible with NumPy 2.x. "
                         f"This will cause runtime errors!")
            raise RuntimeError(f"NumPy 2.x incompatibility detected: {numpy.__version__}")
        else:
            logging.info(f"NumPy version check passed: {numpy.__version__}")
    except ImportError:
        logging.warning("NumPy not found - this may cause issues with ML dependencies")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup logic
    check_numpy_compatibility()
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
app.add_middleware(
    CORSMiddleware,
    allow_origins=[ALLOW_ORIGINS] if ALLOW_ORIGINS != "*" else ["*"],
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
