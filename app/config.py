import os
from dotenv import load_dotenv

load_dotenv()

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
JWT_SECRET = os.getenv("JWT_SECRET", "change_me")
JWT_EXPIRE_MINUTES = int(os.getenv("JWT_EXPIRE_MINUTES", "120"))
CHROMA_DB_DIR = os.getenv("CHROMA_DB_DIR", "./chroma_db")
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./app.db")
CHUNK_SIZE = int(os.getenv("CHUNK_SIZE", "1000"))
CHUNK_OVERLAP = int(os.getenv("CHUNK_OVERLAP", "200"))
MODEL_NAME = os.getenv("MODEL_NAME", "gpt-4o-mini")
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "text-embedding-3-small")
EMBEDDING_BACKEND = os.getenv("EMBEDDING_BACKEND", "openai")
OCR_BACKEND = os.getenv("OCR_BACKEND", "trocr")  # options: 'trocr', 'paddle', 'tesseract', 'google'
OCR_DEVICE = os.getenv("OCR_DEVICE", "cpu")     # 'cpu' or 'cuda'
PDF2IMAGE_DPI = int(os.getenv("PDF2IMAGE_DPI", "200"))
TESSERACT_CMD = os.getenv("TESSERACT_CMD", "tesseract")  # if installed in custom location
