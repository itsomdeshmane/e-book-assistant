import os
from dotenv import load_dotenv

load_dotenv()

# Server Configuration
PORT = int(os.getenv("PORT", "8000"))
ALLOW_ORIGINS = os.getenv("ALLOW_ORIGINS", "*")

# OpenAI Configuration
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")

# JWT Configuration
JWT_SECRET = os.getenv("JWT_SECRET", "change_me")
JWT_EXPIRE_MINUTES = int(os.getenv("JWT_EXPIRE_MINUTES", "120"))

# Database Configuration
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./app.db")
CHROMA_DB_DIR = os.getenv("CHROMA_DB_DIR", "./chroma_db")

# Text Processing Configuration
CHUNK_SIZE = int(os.getenv("CHUNK_SIZE", "1000"))
CHUNK_OVERLAP = int(os.getenv("CHUNK_OVERLAP", "200"))
MODEL_NAME = os.getenv("MODEL_NAME", "gpt-4o-mini")
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "text-embedding-3-small")
EMBEDDING_BACKEND = os.getenv("EMBEDDING_BACKEND", "openai")

# PDF Processing Configuration
PDF2IMAGE_DPI = int(os.getenv("PDF2IMAGE_DPI", "150"))  # Reduced from 200 to save memory
MAX_PDF_PAGES = int(os.getenv("MAX_PDF_PAGES", "50"))  # Limit pages to prevent OOM
PROCESS_PAGES_BATCH_SIZE = int(os.getenv("PROCESS_PAGES_BATCH_SIZE", "5"))  # Process pages in batches

# Azure AI Document Intelligence (for high-quality OCR incl. handwriting)
AZURE_DI_ENDPOINT = os.getenv("AZURE_DI_ENDPOINT", "")  # e.g. https://<resource-name>.cognitiveservices.azure.com
AZURE_DI_KEY = os.getenv("AZURE_DI_KEY", "")
AZURE_DI_API_VERSION = os.getenv("AZURE_DI_API_VERSION", "2024-07-31")