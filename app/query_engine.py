import logging
from .vector_db import collection_for_user
from sentence_transformers import SentenceTransformer
import os
from openai import OpenAI

# ==============================
# Config
# ==============================

MODEL_NAME = "gpt-3.5-turbo"   # or your preferred OpenAI model
_client = None

if os.getenv("OPENAI_API_KEY"):
    try:
        _client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
        logging.info("[QueryEngine] OpenAI client initialized")
    except Exception as e:
        logging.warning(f"[QueryEngine] Failed to init OpenAI client: {e}")
        _client = None
else:
    logging.warning("[QueryEngine] No OPENAI_API_KEY found, will use local fallback")

# Local summarizer (fallback model)
_local_model = SentenceTransformer("all-MiniLM-L6-v2")


# ==============================
# Summarize function
# ==============================
def summarize(user_id: int, doc_id: int, scope: str = "full", chapter_hint: str = None) -> str:
    logging.debug(f"[Summarize] Called → user_id={user_id}, doc_id={doc_id}, scope={scope}")

    # Fetch documents from Chroma
    col = collection_for_user(user_id)
    all_docs = col.get(where={"doc_id": str(doc_id)})
    docs = all_docs.get("documents", [])

    if not docs or not any(docs):
        logging.warning(f"[Summarize] No documents found for doc_id={doc_id}")
        return "Summary unavailable (no content retrieved)."

    # Flatten nested lists from ChromaDB
    flat_docs = []
    for d in docs:
        if isinstance(d, list):
            flat_docs.extend(d)
        else:
            flat_docs.append(d)

    if not flat_docs:
        return "Summary unavailable (no content retrieved)."

    # Use first 15 chunks (to avoid token overflow)
    context = "\n\n".join(flat_docs[:15])

    messages = [
        {"role": "system", "content": "You are a helpful assistant that summarizes eBooks and PDFs."},
        {"role": "user", "content": f"Context:\n{context}\n\nTask: Provide a structured {scope} summary with bullet points and short paragraphs."}
    ]

    # ==============================
    # Try OpenAI First
    # ==============================
    if _client:
        try:
            resp = _client.chat.completions.create(model=MODEL_NAME, messages=messages)
            return resp.choices[0].message.content.strip()
        except Exception as e:
            logging.error(f"[Summarize] OpenAI failed → fallback. Error: {e}")

    # ==============================
    # Local Fallback
    # ==============================
    try:
        # crude extractive fallback
        logging.info("[Summarize] Using local fallback summarizer")
        preview = " ".join(flat_docs[:3])  # take first few chunks
        return f"(Fallback summary)\n\n{preview[:1000]}"
    except Exception as e:
        logging.error(f"[Summarize] Local summarizer failed. Error: {e}")
        return "Summary unavailable (both OpenAI and local summarizer failed)."

def answer_query(user_id: int, doc_id: int, question: str, top_k: int = 4) -> str:
    """
    Retrieve relevant chunks from ChromaDB for a question
    and return a simple answer (stub or OpenAI if available).
    """
    from .embeddings import get_embedding

    col = collection_for_user(user_id)
    query_embedding = get_embedding(question)

    # Query top_k results from Chroma
    results = col.query(
        query_embeddings=[query_embedding],
        n_results=top_k,
        where={"doc_id": str(doc_id)}
    )

    docs = results.get("documents", [[]])
    flat_docs = []
    for d in docs[0]:
        flat_docs.append(d)

    if not flat_docs:
        return "No relevant content found for this question."

    context = "\n\n".join(flat_docs)

    # Build prompt for answering
    messages = [
        {"role": "system", "content": "You are a helpful assistant that answers questions based on document context."},
        {"role": "user", "content": f"Context:\n{context}\n\nQuestion: {question}\nAnswer:"}
    ]

    # Try OpenAI if available
    if _client:
        try:
            resp = _client.chat.completions.create(model=MODEL_NAME, messages=messages)
            return resp.choices[0].message.content.strip()
        except Exception as e:
            logging.error(f"[AnswerQuery] OpenAI failed → fallback. Error: {e}")

    # Fallback → just return the context
    return f"(Fallback answer)\n\n{context[:1000]}"

def generate_interview_questions(user_id: int, doc_id: int, level: str = "beginner") -> dict:
    from .vector_db import collection_for_user
    import logging

    logging.debug(f"[InterviewQuestions] Called → user_id={user_id}, doc_id={doc_id}, level={level}")

    # Fetch documents
    col = collection_for_user(user_id)
    all_docs = col.get(where={"doc_id": str(doc_id)})
    docs = all_docs.get("documents", [])

    if not docs or not any(docs):
        return {"questions": [], "error": "No content found for this document."}

    # Flatten chunks
    flat_docs = []
    for d in docs:
        flat_docs.extend(d if isinstance(d, list) else [d])

    context = "\n\n".join(flat_docs[:15])  # limit context

    # Prompt
    messages = [
        {"role": "system", "content": "You are an expert interviewer creating thoughtful interview questions based on given content."},
        {"role": "user", "content": f"Document content:\n{context}\n\nTask: Generate 10 {level} interview questions (no answers). Format as a clean list."}
    ]

    if _client:
        try:
            resp = _client.chat.completions.create(model=MODEL_NAME, messages=messages)
            questions = resp.choices[0].message.content.strip().split("\n")
            return {"questions": [q.strip("-•1234567890. ") for q in questions if q.strip()]}
        except Exception as e:
            logging.error(f"[InterviewQuestions] OpenAI failed → {e}")
            return {"questions": [], "error": str(e)}

    return {"questions": [], "error": "No AI backend available"}
