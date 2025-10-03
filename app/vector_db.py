# app/vector_db.py
import logging
import uuid
from typing import List, Dict, Any, Optional

import chromadb

from .config import CHROMA_DB_DIR

logger = logging.getLogger("vector_db")
logging.basicConfig(level=logging.DEBUG)

# Persistent client
try:
    _client = chromadb.PersistentClient(path=CHROMA_DB_DIR)
    logger.debug(f"[vector_db] Chroma PersistentClient initialized at {CHROMA_DB_DIR}")
except Exception as e:
    logger.exception("[vector_db] Failed to initialize PersistentClient; falling back to in-memory client")
    _client = chromadb.Client()


def collection_for_user(user_id: int):
    name = f"ebook_docs_u{user_id}"
    try:
        col = _client.get_collection(name=name)
    except Exception:
        col = _client.create_collection(name=name, metadata={"hnsw:space": "cosine"})
    return col


def add_chunks(
    user_id: int,
    doc_id: int,
    chunks: List[str],
    embeddings: List[List[float]],
    metadatas: Optional[List[Dict[str, Any]]] = None,
):
    """
    Adds chunks to Chroma with unique UUID-based IDs to avoid collisions.
    metadatas will be normalized so 'doc_id' is a string.
    """
    logger.debug(f"[vector_db] add_chunks called → user_id={user_id}, doc_id={doc_id}, chunks={len(chunks)}, embeddings={len(embeddings) if embeddings is not None else 'None'}")
    col = collection_for_user(user_id)

    if not chunks:
        # ensure collection exists
        logger.debug("[vector_db] No chunks provided - collection ensured.")
        return

    if embeddings is None or len(embeddings) != len(chunks):
        raise ValueError("Embeddings must be provided and match chunks length.")

    # prepare unique IDs to prevent collisions with previously deleted content
    ids = [f"{doc_id}_{uuid.uuid4().hex}_{i}" for i in range(len(chunks))]

    # normalize metadatas
    if metadatas is None:
        metadatas = [{"doc_id": str(doc_id), "chunk_id": i} for i in range(len(chunks))]
    else:
        # force doc_id to string and ensure chunk_id present
        nm = []
        for i, m in enumerate(metadatas):
            mm = dict(m) if m else {}
            mm["doc_id"] = str(mm.get("doc_id", doc_id))
            mm.setdefault("chunk_id", i)
            nm.append(mm)
        metadatas = nm

    try:
        col.add(ids=ids, documents=chunks, embeddings=embeddings, metadatas=metadatas)
        logger.debug(f"[vector_db] Added {len(chunks)} chunks to collection={col.name}")
    except Exception as e:
        logger.exception(f"[vector_db] Failed to add chunks for doc={doc_id}: {e}")
        raise


def delete_doc_chunks(user_id: int, doc_id: int) -> Dict[str, Any]:
    """
    Remove all chunks for a doc_id. Try to delete by metadata (preferred).
    Returns a small result dict indicating what happened.
    """
    col = collection_for_user(user_id)
    str_doc_id = str(doc_id)
    try:
        # Preferred: delete by metadata filter (if supported by Chroma)
        # This will remove all items where metadatas['doc_id'] == str_doc_id
        try:
            col.delete(where={"doc_id": str_doc_id})
            logger.debug(f"[vector_db] Deleted items where doc_id={str_doc_id} in collection={col.name}")
            return {"deleted_by_where": True}
        except TypeError:
            # Older Chroma API might not support `where` in delete; fallback to get ids then delete by ids
            logger.debug("[vector_db] delete(where=...) not supported; falling back to get() + delete(ids=...)")

        data = col.get(where={"doc_id": str_doc_id})
        ids = data.get("ids", [])
        if ids:
            col.delete(ids=ids)
            logger.debug(f"[vector_db] Deleted {len(ids)} items by ids for doc_id={str_doc_id} in collection={col.name}")
            return {"deleted_by_ids": len(ids)}
        else:
            logger.debug(f"[vector_db] No ids found for doc_id={str_doc_id} - nothing to delete")
            return {"deleted": 0}
    except Exception as e:
        logger.exception(f"[vector_db] Exception while deleting doc chunks for doc_id={doc_id}: {e}")
        return {"error": str(e)}
