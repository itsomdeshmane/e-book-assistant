# app/vector_db.py
import logging
import uuid
from typing import List, Dict, Any, Optional
from pinecone import Pinecone

from .config import PINECONE_API_KEY, PINECONE_INDEX_NAME
from .embeddings import get_embedding_dimensions

logger = logging.getLogger("vector_db")
logging.basicConfig(level=logging.INFO)

# Initialize Pinecone client
try:
    _pc = Pinecone(api_key=PINECONE_API_KEY)
    logger.info("[vector_db] Pinecone client initialized successfully")
except Exception as e:
    logger.exception("[vector_db] Failed to initialize Pinecone client")
    raise RuntimeError(f"Pinecone initialization failed: {e}")

# Connect to existing index
try:
    # List indexes to verify the index exists
    existing_indexes = [index.name for index in _pc.list_indexes()]
    
    if PINECONE_INDEX_NAME not in existing_indexes:
        logger.error(f"[vector_db] Index '{PINECONE_INDEX_NAME}' not found!")
        logger.error(f"[vector_db] Available indexes: {existing_indexes}")
        raise RuntimeError(
            f"Pinecone index '{PINECONE_INDEX_NAME}' not found. "
            f"Please create it in the Pinecone dashboard first with dimensions=1536, metric=cosine. "
            f"Available indexes: {existing_indexes}"
        )
    
    logger.info(f"[vector_db] Connecting to existing index: {PINECONE_INDEX_NAME}")
    _index = _pc.Index(PINECONE_INDEX_NAME)
    logger.info(f"[vector_db] Successfully connected to index: {PINECONE_INDEX_NAME}")
except Exception as e:
    logger.exception("[vector_db] Failed to connect to Pinecone index")
    raise RuntimeError(f"Pinecone index connection failed: {e}. Please run check_pinecone_config.py to verify your configuration.")


def _get_namespace(user_id: int) -> str:
    """
    Get namespace for a user.
    Pinecone uses namespaces to isolate data per user.
    """
    return f"user_{user_id}"


def add_chunks(
    user_id: int,
    doc_id: int,
    chunks: List[str],
    embeddings: List[List[float]],
    metadatas: Optional[List[Dict[str, Any]]] = None,
):
    """
    Adds chunks to Pinecone with unique UUID-based IDs.
    Uses user-specific namespace and doc_id in metadata for filtering.
    
    Args:
        user_id: User ID for namespace isolation
        doc_id: Document ID
        chunks: List of text chunks
        embeddings: List of embedding vectors
        metadatas: Optional metadata for each chunk
    """
    if not chunks:
        return

    if embeddings is None or len(embeddings) != len(chunks):
        raise ValueError("Embeddings must be provided and match chunks length.")

    namespace = _get_namespace(user_id)
    
    # Prepare vectors for upsert
    vectors = []
    for i, (chunk, embedding) in enumerate(zip(chunks, embeddings)):
        # Generate unique ID
        vector_id = f"{doc_id}_{uuid.uuid4().hex}_{i}"
        
        # Prepare metadata
        if metadatas and i < len(metadatas):
            metadata = dict(metadatas[i])
        else:
            metadata = {}
        
        # Add required fields to metadata
        metadata["doc_id"] = str(doc_id)
        metadata["user_id"] = str(user_id)
        metadata["chunk_id"] = i
        metadata["text"] = chunk  # Store text in metadata for retrieval
        
        vectors.append({
            "id": vector_id,
            "values": embedding,
            "metadata": metadata
        })
    
    try:
        # Upsert in batches of 100 (Pinecone recommended batch size)
        batch_size = 100
        for i in range(0, len(vectors), batch_size):
            batch = vectors[i:i + batch_size]
            _index.upsert(vectors=batch, namespace=namespace)
        
        logger.info(f"[vector_db] Added {len(vectors)} chunks for doc_id={doc_id}, user_id={user_id}")
    except Exception as e:
        logger.exception(f"[vector_db] Failed to add chunks for doc={doc_id}: {e}")
        raise


def delete_doc_chunks(user_id: int, doc_id: int) -> Dict[str, Any]:
    """
    Remove all chunks for a doc_id using metadata filtering.
    
    Args:
        user_id: User ID
        doc_id: Document ID to delete
        
    Returns:
        dict: Status information about deletion
    """
    from pinecone.exceptions import NotFoundException
    
    namespace = _get_namespace(user_id)
    str_doc_id = str(doc_id)
    
    try:
        # Pinecone delete by metadata filter
        _index.delete(
            filter={
                "doc_id": {"$eq": str_doc_id},
                "user_id": {"$eq": str(user_id)}
            },
            namespace=namespace
        )
        logger.info(f"[vector_db] Deleted chunks for doc_id={doc_id}, user_id={user_id}")
        return {"deleted": True, "doc_id": doc_id}
    except NotFoundException as e:
        # Namespace or vectors not found - this is OK (nothing to delete)
        logger.info(f"[vector_db] Namespace or chunks not found for doc_id={doc_id} (already deleted or never indexed)")
        return {"deleted": True, "doc_id": doc_id, "note": "namespace_not_found"}
    except Exception as e:
        logger.exception(f"[vector_db] Exception while deleting doc chunks for doc_id={doc_id}: {e}")
        return {"error": str(e)}


def query_similar_chunks(
    user_id: int,
    doc_id: int,
    query_embedding: List[float],
    top_k: int = 4
) -> Dict[str, Any]:
    """
    Query similar chunks from Pinecone for a specific document.
    
    Args:
        user_id: User ID
        doc_id: Document ID to query within
        query_embedding: Query embedding vector
        top_k: Number of results to return
        
    Returns:
        dict: Query results with matches
    """
    namespace = _get_namespace(user_id)
    
    try:
        results = _index.query(
            vector=query_embedding,
            top_k=top_k,
            filter={
                "doc_id": {"$eq": str(doc_id)},
                "user_id": {"$eq": str(user_id)}
            },
            include_metadata=True,
            namespace=namespace
        )
        
        return results
    except Exception as e:
        logger.exception(f"[vector_db] Query failed for doc_id={doc_id}: {e}")
        raise


def get_all_doc_chunks(user_id: int, doc_id: int) -> List[Dict[str, Any]]:
    """
    Get all chunks for a document.
    Note: Pinecone doesn't have a direct "get all" like ChromaDB.
    This is a workaround using a dummy query with high top_k.
    
    Args:
        user_id: User ID
        doc_id: Document ID
        
    Returns:
        list: List of chunk metadata
    """
    namespace = _get_namespace(user_id)
    
    try:
        # Create a dummy embedding (all zeros) to fetch by metadata only
        dummy_embedding = [0.0] * get_embedding_dimensions()
        
        results = _index.query(
            vector=dummy_embedding,
            top_k=10000,  # Max results (adjust based on your needs)
            filter={
                "doc_id": {"$eq": str(doc_id)},
                "user_id": {"$eq": str(user_id)}
            },
            include_metadata=True,
            namespace=namespace
        )
        
        chunks = []
        for match in results.get("matches", []):
            metadata = match.get("metadata", {})
            chunks.append({
                "text": metadata.get("text", ""),
                "metadata": metadata
            })
        
        return chunks
    except Exception as e:
        logger.exception(f"[vector_db] Failed to get all chunks for doc_id={doc_id}: {e}")
        return []
