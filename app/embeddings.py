# app/embeddings.py
import os
import logging
from openai import OpenAI
from sentence_transformers import SentenceTransformer

# OpenAI settings
EMBEDDING_MODEL = "text-embedding-3-small"
_client = None
if os.getenv("OPENAI_API_KEY"):
    try:
        _client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    except Exception as e:
        logging.warning(f"[Embeddings] Failed to init OpenAI client: {e}")
        _client = None

# Local fallback model - use explicit cache directory
_cache_dir = os.getenv("HF_HOME", "/app/.cache/huggingface")
_local_model = SentenceTransformer("all-MiniLM-L6-v2", cache_folder=_cache_dir)


def get_embedding(text: str):
    """
    Get embeddings from OpenAI if available,
    else fallback to local SentenceTransformer.
    """
    text = text.strip()
    if not text:
        return []

    if _client:
        try:
            resp = _client.embeddings.create(
                model=EMBEDDING_MODEL,
                input=text
            )
            return resp.data[0].embedding
        except Exception as e:
            logging.error(f"[Embeddings] OpenAI failed → fallback to local. Error: {e}")

    # Fallback
    return _local_model.encode(text).tolist()
