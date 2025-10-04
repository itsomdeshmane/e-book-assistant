import logging
from .vector_db import collection_for_user, add_chunks
from .chunker import chunk_text
from .embeddings import get_embedding
from .pdf_processor import extract_pages_text
from .db import engine
from sqlmodel import Session
from .models import Document
import os
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
    except Exception as e:
        logging.warning(f"[QueryEngine] Failed to init OpenAI client: {e}")
        _client = None
else:
    logging.warning("[QueryEngine] No OPENAI_API_KEY found, will use local fallback")

# Local summarizer (fallback model)
_local_model = SentenceTransformer("all-MiniLM-L6-v2")


# ==============================
# Text verification helpers
# ==============================
def has_sufficient_text_data(user_id: int, doc_id: int) -> bool:
    """
    Check if document has sufficient text data for processing without OCR.
    Returns True if document has meaningful text chunks, False if OCR is needed.
    """
    col = collection_for_user(user_id)
    all_docs = col.get(where={"doc_id": str(doc_id)})
    docs = all_docs.get("documents", [])
    
    if not docs or not any(docs):
        return False
    
    # Flatten chunks and check for meaningful content
    flat_docs = []
    for d in docs:
        flat_docs.extend(d if isinstance(d, list) else [d])
    
    # Check if we have at least some meaningful text chunks
    meaningful_chunks = 0
    for chunk in flat_docs[:10]:  # Check first 10 chunks
        if chunk and len(chunk.strip()) > 50:  # Basic length check
            # Check for readable patterns
            import re
            if re.search(r'[a-zA-Z]{3,}', chunk) and re.search(r'\b(the|and|or|but|in|on|at|to|for|of|with|by)\b', chunk, re.IGNORECASE):
                meaningful_chunks += 1
    
    # Need at least 2 meaningful chunks to consider text sufficient
    return meaningful_chunks >= 2

# ==============================
# Summarize function
# ==============================
def summarize(user_id: int, doc_id: int, scope: str = "full", chapter_hint: str = None) -> str:

    # Fetch documents from Chroma
    col = collection_for_user(user_id)
    all_docs = col.get(where={"doc_id": str(doc_id)})
    docs = all_docs.get("documents", [])

    if not docs or not any(docs):
        logging.warning(f"[Summarize] No documents found for doc_id={doc_id} — attempting on-the-fly indexing from PDF")
        try:
            with Session(engine) as s:
                doc = s.get(Document, doc_id)
                if not doc or doc.owner_id != user_id:
                    logging.error("[Summarize] Document not found or unauthorized for on-the-fly indexing")
                else:
                    # Build absolute path like routes_docs.py
                    base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
                    uploads_dir = os.path.join(base_dir, "uploads")
                    pdf_path = os.path.join(uploads_dir, doc.filename)

                    if os.path.exists(pdf_path):
                        # 🔑 Try normal extraction first
                        pages = extract_pages_text(pdf_path)

                        # Check if we have meaningful text extracted
                        meaningful_pages = [p for p in pages if p.get("text") and p.get("text").strip()]
                        
                        # Only use OCR if no meaningful text was extracted
                        if not meaningful_pages:
                            logging.info("[Summarize] No meaningful text extracted → retrying with Azure OCR (force_ocr=True)")
                            from .pdf_processor import extract_pages_text as extract_with_force
                            pages = extract_with_force(pdf_path, force_ocr=True)
                        else:
                            logging.info(f"[Summarize] Found meaningful text in {len(meaningful_pages)}/{len(pages)} pages - skipping OCR")

                        total_chunks = 0
                        for p in pages:
                            text = (p.get("text") or "").strip()
                            if not text:
                                continue
                            header = f"[PAGE {p.get('page')} | source={p.get('source')} | conf={float(p.get('confidence', 0.0)):.1f}]"
                            full_text = header + "\n\n" + text
                            chunks = chunk_text(full_text)
                            if not chunks:
                                continue
                            embeddings = [get_embedding(c) for c in chunks]
                            metadatas = [
                                {
                                    "doc_id": str(doc_id),
                                    "page": p.get("page"),
                                    "chunk_id": i,
                                    "source": p.get("source"),
                                    "confidence": float(p.get("confidence", 0.0)),
                                }
                                for i in range(len(chunks))
                            ]
                            add_chunks(user_id, doc_id, chunks, embeddings, metadatas=metadatas)
                            total_chunks += len(chunks)

                        logging.info(f"[Summarize] Reindexed {total_chunks} chunks for doc_id={doc_id}")

                        # Re-fetch from Chroma after indexing
                        all_docs = col.get(where={"doc_id": str(doc_id)})
                        docs = all_docs.get("documents", [])
                    else:
                        logging.error(f"[Summarize] PDF path not found: {pdf_path}")
        except Exception as e:
            logging.exception(f"[Summarize] On-the-fly indexing failed: {e}")

        if not docs or not any(docs):
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

    # Try OpenAI first
    if _client:
        try:
            resp = _client.chat.completions.create(model=MODEL_NAME, messages=messages)
            return resp.choices[0].message.content.strip()
        except Exception as e:
            logging.error(f"[Summarize] OpenAI failed → fallback. Error: {e}")

    # Local fallback
    try:
        preview = " ".join(flat_docs[:3])
        return f"(Fallback summary)\n\n{preview[:1000]}"
    except Exception as e:
        logging.error(f"[Summarize] Local summarizer failed. Error: {e}")
        return "Summary unavailable (both OpenAI and local summarizer failed)."

def answer_query(user_id: int, doc_id: int, question: str, top_k: int = 4, conversation_history: list = None) -> str:
    """
    Retrieve relevant chunks from ChromaDB for a question
    and return an answer with relevance checking and chat history context.
    """
    from .embeddings import get_embedding
    import logging


    # First check if we have sufficient text data
    if not has_sufficient_text_data(user_id, doc_id):
        logging.warning(f"[AnswerQuery] Insufficient text data for doc_id={doc_id} - attempting on-the-fly indexing")
        try:
            with Session(engine) as s:
                doc = s.get(Document, doc_id)
                if not doc or doc.owner_id != user_id:
                    return "Document not found or unauthorized for processing."
                
                # Build absolute path
                base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
                uploads_dir = os.path.join(base_dir, "uploads")
                pdf_path = os.path.join(uploads_dir, doc.filename)

                if os.path.exists(pdf_path):
                    # Try normal extraction first
                    pages = extract_pages_text(pdf_path)
                    meaningful_pages = [p for p in pages if p.get("text") and p.get("text").strip()]
                    
                    # Only use OCR if no meaningful text was extracted
                    if not meaningful_pages:
                        logging.info("[AnswerQuery] No meaningful text extracted → retrying with Azure OCR (force_ocr=True)")
                        from .pdf_processor import extract_pages_text as extract_with_force
                        pages = extract_with_force(pdf_path, force_ocr=True)
                    else:
                        logging.info(f"[AnswerQuery] Found meaningful text in {len(meaningful_pages)}/{len(pages)} pages - skipping OCR")

                    # Process pages and create chunks (similar to background processing)
                    col = collection_for_user(user_id)
                    total_chunks = 0
                    for p in pages:
                        text = (p.get("text") or "").strip()
                        if not text:
                            continue
                        
                        # Create chunks and store them
                        chunks = chunk_text(text, chunk_size=1000, overlap=200)
                        for chunk in chunks:
                            col.add(
                                documents=[chunk],
                                metadatas=[{
                                    "doc_id": str(doc_id),
                                    "page": p.get("page", 1),
                                    "source": p.get("source", "text"),
                                    "confidence": float(p.get("confidence", 100.0))
                                }],
                                ids=[f"{doc_id}_{p.get('page', 1)}_{total_chunks}"]
                            )
                            total_chunks += 1
                    
                    logging.info(f"[AnswerQuery] Created {total_chunks} chunks from on-the-fly processing")
        except Exception as e:
            logging.error(f"[AnswerQuery] On-the-fly processing failed: {e}")
            return f"Failed to process document for answering: {str(e)}"

    col = collection_for_user(user_id)
    query_embedding = get_embedding(question)

    # Query top_k results from Chroma
    results = col.query(
        query_embeddings=[query_embedding],
        n_results=top_k,
        where={"doc_id": str(doc_id)}
    )

    docs = results.get("documents", [[]])
    distances = results.get("distances", [[]])
    
    flat_docs = []
    for d in docs[0]:
        flat_docs.append(d)

    if not flat_docs:
        return "I apologize, but I couldn't find any relevant information in this document to answer your question. Please try asking something related to the content of this PDF."

    # Check relevance using distance threshold
    # Lower distance means more relevant (ChromaDB uses cosine similarity)
    avg_distance = sum(distances[0]) / len(distances[0]) if distances[0] else 1.0
    relevance_threshold = 0.7  # Adjust this threshold as needed
    
    if avg_distance > relevance_threshold:
        logging.info(f"[AnswerQuery] Question not relevant to document (avg_distance: {avg_distance:.3f})")
        return "I apologize, but your question doesn't seem to be related to the content of this document. Please ask questions that are relevant to the topics covered in this PDF."

    context = "\n\n".join(flat_docs)
    
    # Build conversation history context if available
    history_context = ""
    if conversation_history and len(conversation_history) > 0:
        # Get last 3 exchanges for context (6 messages max)
        recent_history = conversation_history[-6:] if len(conversation_history) > 6 else conversation_history
        history_context = "\n\nPrevious conversation:\n"
        for msg in recent_history:
            role = "User" if msg.get("role") == "user" else "Assistant"
            history_context += f"{role}: {msg.get('content', '')}\n"

    # Build prompt for answering with relevance checking
    system_prompt = """You are a helpful assistant that answers questions based on document context. 
    
IMPORTANT RULES:
1. ONLY answer questions that are directly related to the document content provided
2. If the question is not relevant to the document, politely explain that you can only answer questions about this specific document
3. Use the conversation history to provide context-aware answers
4. Be helpful but stay within the scope of the document content
5. If you're unsure about relevance, err on the side of caution and ask for clarification"""

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": f"Document Context:\n{context}\n{history_context}\n\nQuestion: {question}\n\nPlease answer based only on the document content provided. If the question is not relevant to this document, politely explain that you can only answer questions about this specific document."}
    ]

    # Try OpenAI if available
    if _client:
        try:
            resp = _client.chat.completions.create(model=MODEL_NAME, messages=messages)
            answer = resp.choices[0].message.content.strip()
            
            # Additional relevance check on the answer
            if "not relevant" in answer.lower() or "not related" in answer.lower() or "can't answer" in answer.lower():
                logging.info("[AnswerQuery] AI determined question is not relevant")
                return "I apologize, but your question doesn't seem to be related to the content of this document. Please ask questions that are relevant to the topics covered in this PDF."
            
            return answer
            
        except Exception as e:
            logging.error(f"[AnswerQuery] OpenAI failed → fallback. Error: {e}")

    # Fallback → return context with relevance note
    return f"Based on the document content:\n\n{context[:1000]}\n\nNote: This is a fallback response. For better answers, please ensure your question is directly related to the document content."

def generate_interview_questions(user_id: int, doc_id: int, level: str = "beginner") -> dict:
    from .vector_db import collection_for_user
    import logging


    # First check if we have sufficient text data
    if not has_sufficient_text_data(user_id, doc_id):
        logging.warning(f"[InterviewQuestions] Insufficient text data for doc_id={doc_id} - attempting on-the-fly indexing")
        try:
            with Session(engine) as s:
                doc = s.get(Document, doc_id)
                if not doc or doc.owner_id != user_id:
                    return {"questions": [], "error": "Document not found or unauthorized"}
                
                # Build absolute path
                base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
                uploads_dir = os.path.join(base_dir, "uploads")
                pdf_path = os.path.join(uploads_dir, doc.filename)

                if os.path.exists(pdf_path):
                    # Try normal extraction first
                    pages = extract_pages_text(pdf_path)
                    meaningful_pages = [p for p in pages if p.get("text") and p.get("text").strip()]
                    
                    # Only use OCR if no meaningful text was extracted
                    if not meaningful_pages:
                        logging.info("[InterviewQuestions] No meaningful text extracted → retrying with Azure OCR (force_ocr=True)")
                        from .pdf_processor import extract_pages_text as extract_with_force
                        pages = extract_with_force(pdf_path, force_ocr=True)
                    else:
                        logging.info(f"[InterviewQuestions] Found meaningful text in {len(meaningful_pages)}/{len(pages)} pages - skipping OCR")

                    # Process pages and create chunks (similar to background processing)
                    total_chunks = 0
                    for p in pages:
                        text = (p.get("text") or "").strip()
                        if not text:
                            continue
                        
                        # Create chunks and store them
                        chunks = chunk_text(text, chunk_size=1000, overlap=200)
                        for chunk in chunks:
                            col.add(
                                documents=[chunk],
                                metadatas=[{
                                    "doc_id": str(doc_id),
                                    "page": p.get("page", 1),
                                    "source": p.get("source", "text"),
                                    "confidence": float(p.get("confidence", 100.0))
                                }],
                                ids=[f"{doc_id}_{p.get('page', 1)}_{total_chunks}"]
                            )
                            total_chunks += 1
                    
                    logging.info(f"[InterviewQuestions] Created {total_chunks} chunks from on-the-fly processing")
        except Exception as e:
            logging.error(f"[InterviewQuestions] On-the-fly processing failed: {e}")
            return {"questions": [], "error": f"Failed to process document: {str(e)}"}

    # Fetch documents (either existing or newly created)
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
