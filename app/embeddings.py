# app/embeddings.py
import os
import logging
from openai import OpenAI

# OpenAI settings (mandatory)
EMBEDDING_MODEL = "text-embedding-3-small"
EMBEDDING_DIMENSIONS = 1536  # Must match your Pinecone index dimensions

# Initialize OpenAI client
_client = None
if os.getenv("OPENAI_API_KEY"):
    try:
        _client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
        logging.info("[Embeddings] OpenAI client initialized successfully")
    except Exception as e:
        logging.error(f"[Embeddings] Failed to init OpenAI client: {e}")
        raise RuntimeError("OpenAI client initialization failed. Please check your OPENAI_API_KEY.")
else:
    raise ValueError("OPENAI_API_KEY is required for embeddings generation")


def get_embedding(text: str):
    """
    Get embeddings from OpenAI API.
    No fallback - OpenAI is mandatory.
    
    Args:
        text: Text to embed
        
    Returns:
        list: Embedding vector (1536 dimensions for text-embedding-3-small)
        
    Raises:
        RuntimeError: If OpenAI API call fails
    """
    text = text.strip()
    if not text:
        return []

    if not _client:
        raise RuntimeError("OpenAI client not initialized. Please check your OPENAI_API_KEY.")

    try:
        resp = _client.embeddings.create(
            model=EMBEDDING_MODEL,
            input=text
        )
        return resp.data[0].embedding
    except Exception as e:
        logging.error(f"[Embeddings] OpenAI embedding generation failed: {e}")
        raise RuntimeError(f"Failed to generate embeddings: {e}")


def get_embedding_dimensions():
    """Return the dimensions of the embedding model."""
    return EMBEDDING_DIMENSIONS
