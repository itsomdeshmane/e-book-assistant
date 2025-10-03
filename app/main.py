from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .db import init_db
from .routes_auth import router as auth_router
from .routes_docs import router as docs_router
from .routes_rag import router as rag_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup logic
    init_db()
    yield
    # Shutdown logic (optional)
    # Example: close DB connections, cleanup tasks
    print("Application is shutting down...")


app = FastAPI(
    title="E-Book / Knowledge Assistant API",
    version="1.0.0",
    lifespan=lifespan
)

# Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # you can restrict this to specific origins later
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
