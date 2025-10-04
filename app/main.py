from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .db import init_db
from .routes_auth import router as auth_router
from .routes_docs import router as docs_router
from .routes_rag import router as rag_router
from .config import ALLOW_ORIGINS


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup logic
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
