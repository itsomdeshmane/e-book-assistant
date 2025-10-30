# app/routes_docs.py
import logging
import os
import uuid
import tempfile
from typing import List, Dict, Any
from .vector_db import add_chunks, delete_doc_chunks
from .blob_storage import upload_to_blob, download_from_blob, delete_from_blob
from fastapi import APIRouter, UploadFile, File, Depends, HTTPException, BackgroundTasks
from sqlmodel import Session, select
from .utils import compute_file_hash
from pypdf import PdfReader

from .db import get_session, engine  # engine must be exported from your db.py
from .models import Document, Conversation, InterviewSession
# Try to import page-level extractor; fall back to single-text extractor
try:
    from .pdf_processor import extract_pages_text  # preferred (returns per-page dicts)
    _USE_PAGE_EXTRACTOR = True
except Exception:
    from .pdf_processor import extract_text_from_pdf  # old extractor (returns full text)
    _USE_PAGE_EXTRACTOR = False

from .chunker import chunk_text
from .embeddings import get_embedding
from .security import get_current_user

router = APIRouter(prefix="/documents", tags=["Documents"])

logger = logging.getLogger("routes_docs")
logging.basicConfig(level=logging.INFO)


def validate_pdf_file(file: UploadFile, file_bytes: bytes | None = None) -> None:
    """
    Comprehensive PDF file validation including filename, content type, size, and file content.
    
    Args:
        file: The uploaded file object
        file_bytes: Optional file bytes for content validation
        
    Raises:
        HTTPException: If any validation fails
    """
    # Validate filename extension
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported (missing .pdf extension)")

    # Validate file content type (best-effort)
    allowed_content_types = ["application/pdf", "application/octet-stream"]
    if file.content_type and file.content_type not in allowed_content_types:
        raise HTTPException(
            status_code=400,
            detail="Invalid file type. Only PDF files are allowed."
        )
    
    # If we have the file bytes, validate size and content
    if file_bytes:
        # Size check
        MAX_FILE_SIZE = 100 * 1024 * 1024  # 100MB
        size_bytes = len(file_bytes)
        if size_bytes > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=400,
                detail=f"File too large. Maximum size allowed is {MAX_FILE_SIZE // (1024*1024)}MB"
            )
        
        # Try to open with pypdf to validate it's a real PDF
        try:
            import io
            reader = PdfReader(io.BytesIO(file_bytes))
            # Try to access page count to ensure file is readable
            _ = len(reader.pages)
        except Exception as e:
            logger.error(f"PDF validation failed: {e}")
            raise HTTPException(
                status_code=400,
                detail="Invalid file content. The file must be a valid PDF document."
            )


def _safe_update_doc_status(doc_id: int, status: str, chunk_count: int | None = None):
    """
    Update the Document record status and optional chunk_count using a fresh Session.
    """
    try:
        with Session(engine) as s:
            doc = s.get(Document, doc_id)
            if not doc:
                logger.warning(f"[BG] Document {doc_id} not found when updating status")
                return
            # set attributes only if present in model
            if hasattr(doc, "status"):
                doc.status = status
            if chunk_count is not None and hasattr(doc, "chunk_count"):
                doc.chunk_count = chunk_count
            s.add(doc)
            s.commit()
            logger.info(f"[BG] Updated doc {doc_id} status={status} chunk_count={chunk_count}")
    except Exception as e:
        logger.exception(f"[BG] Failed to update doc status for {doc_id}: {e}")


def process_pdf_background(user_id: int, doc_id: int, blob_name: str):
    """
    Memory-optimized background worker: per-page extraction, chunk, embed, store to vector DB.
    Uses extract_pages_text with OCR fallback for scanned/handwritten PDFs.
    Downloads blob temporarily, processes it, then deletes the temp file.
    """
    total_chunks = 0
    temp_file_path = None
    
    # Import memory utilities
    try:
        from .pdf_processor import log_memory_usage, cleanup_memory
        log_memory_usage(f"Starting PDF processing for doc_id={doc_id}")
    except ImportError:
        def log_memory_usage(stage): pass
        def cleanup_memory(): pass

    try:
        # Download blob to temporary file
        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp_file:
            temp_file_path = tmp_file.name
        
        logger.info(f"[BG] Downloading blob {blob_name} to temp file {temp_file_path}")
        download_from_blob(blob_name, temp_file_path)
        
        if not os.path.exists(temp_file_path) or os.path.getsize(temp_file_path) == 0:
            logger.error(f"[BG] Failed to download blob to {temp_file_path}")
            raise RuntimeError("Failed to download PDF from Azure Blob Storage")
        
        path = temp_file_path
        if _USE_PAGE_EXTRACTOR:
            from .pdf_processor import extract_pages_text as extract_with_force

            # First pass: normal extraction (try text layer first)
            pages = extract_with_force(path)

            # Check if we have meaningful text extracted
            meaningful_pages = [p for p in pages if p.get("text") and p.get("text").strip()]
            
            # Only retry with Azure OCR if no meaningful text was extracted
            if not meaningful_pages:
                logger.info(f"[BG] No meaningful text extracted for doc={doc_id}, retrying with Azure OCR (force_ocr=True)")
                pages = extract_with_force(path, force_ocr=True)
            else:
                logger.info(f"[BG] Found meaningful text in {len(meaningful_pages)}/{len(pages)} pages for doc={doc_id} - skipping OCR")

            for p in pages:
                page_number = p.get("page", None)
                text = (p.get("text") or "").strip()
                source = p.get("source", "ocr")
                confidence = float(p.get("confidence", 0.0))

                if not text:
                    logger.warning(f"[BG] Page {page_number} produced no text (source={source})")
                    continue

                # Add page header to preserve provenance inside chunks
                header = f"[PAGE {page_number} | source={source} | conf={confidence:.1f}]"
                full_text = header + "\n\n" + text

                chunks = chunk_text(full_text)
                if not chunks:
                    continue

                embeddings = [get_embedding(c) for c in chunks]
                metadatas = [
                    {
                        "doc_id": str(doc_id),
                        "page": page_number,
                        "chunk_id": i,
                        "source": source,
                        "confidence": confidence,
                    }
                    for i in range(len(chunks))
                ]

                add_chunks(user_id, doc_id, chunks, embeddings, metadatas=metadatas)
                total_chunks += len(chunks)

                # Clean up after each page to prevent memory buildup
                del chunks, embeddings, metadatas
                cleanup_memory()

                # Incremental progress update so frontend can display rising chunk_count
                _safe_update_doc_status(doc_id, status="processing", chunk_count=total_chunks)

        else:
            # Fallback: single full-text extraction
            text = extract_text_from_pdf(path)
            if not text or not text.strip():
                logger.warning(f"[BG] Full-text extraction returned no text for doc={doc_id}")
            else:
                chunks = chunk_text(text)
                embeddings = [get_embedding(c) for c in chunks]
                metadatas = [{"doc_id": str(doc_id), "chunk_id": i} for i in range(len(chunks))]
                add_chunks(user_id, doc_id, chunks, embeddings, metadatas=metadatas)
                total_chunks = len(chunks)
                
                # Clean up after processing
                del chunks, embeddings, metadatas, text
                cleanup_memory()
                
                _safe_update_doc_status(doc_id, status="processing", chunk_count=total_chunks)

        # ✅ Final update
        log_memory_usage(f"Completed PDF processing for doc_id={doc_id}")
        _safe_update_doc_status(doc_id, status="processed", chunk_count=total_chunks)

    except Exception as e:
        logger.exception(f"[BG] Exception while processing doc={doc_id}: {e}")
        log_memory_usage(f"Failed PDF processing for doc_id={doc_id}")
        _safe_update_doc_status(doc_id, status="failed", chunk_count=total_chunks)
    finally:
        # Clean up temporary file
        if temp_file_path and os.path.exists(temp_file_path):
            try:
                os.remove(temp_file_path)
                logger.info(f"[BG] Cleaned up temporary file: {temp_file_path}")
            except Exception as e:
                logger.warning(f"[BG] Failed to clean up temporary file {temp_file_path}: {e}")
        
        # Final memory cleanup
        cleanup_memory()


@router.post("/upload")
async def upload_pdf(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    session: Session = Depends(get_session),
    user=Depends(get_current_user),
):
    # Generate unique blob name
    blob_name = f"{uuid.uuid4().hex}_{file.filename}"
    
    # Read uploaded file bytes
    file_bytes = await file.read()
    
    if not file_bytes or len(file_bytes) == 0:
        logger.error(f"[upload_pdf] Uploaded file is empty")
        raise HTTPException(status_code=400, detail="Uploaded file is empty")
    
    # Validate PDF file
    try:
        validate_pdf_file(file, file_bytes)
    except HTTPException:
        raise
    
    # ✅ Compute hash of the uploaded file
    import hashlib
    file_hash = hashlib.sha256(file_bytes).hexdigest()

    # ✅ Check if a document with same hash already exists for this user
    existing_doc = session.exec(
        select(Document).where(Document.owner_id == user.id, Document.file_hash == file_hash)
    ).first()

    if existing_doc:
        raise HTTPException(status_code=400, detail="This PDF has already been uploaded.")

    # Upload to Azure Blob Storage
    try:
        upload_to_blob(file_bytes, blob_name)
        logger.info(f"[upload_pdf] Successfully uploaded {blob_name} to Azure Blob Storage")
    except Exception as e:
        logger.error(f"[upload_pdf] Failed to upload to Azure Blob Storage: {e}")
        raise HTTPException(status_code=500, detail="Failed to upload file to storage")

    # ✅ Create document record with "processing" status
    doc = Document(
        owner_id=user.id,
        title=file.filename,
        filename=blob_name,  # Store blob name
        file_hash=file_hash,   # store hash for duplicate checks
        chunk_count=0,
    )
    if hasattr(doc, "status"):
        doc.status = "processing"

    session.add(doc)
    session.commit()
    session.refresh(doc)

    # ✅ Queue background processing with blob name
    background_tasks.add_task(process_pdf_background, user.id, doc.id, blob_name)

    return {"message": "Upload received, processing in background", "doc_id": doc.id}

@router.get("")
def list_user_documents(
    session: Session = Depends(get_session),
    user=Depends(get_current_user)
):
    docs = session.exec(
        select(Document)
        .where(Document.owner_id == user.id)
        .order_by(Document.created_at.desc())
    ).all()
    return docs


@router.get("/{doc_id}")
def get_document(
    doc_id: int,
    session: Session = Depends(get_session),
    user=Depends(get_current_user)
):
    doc = session.get(Document, doc_id)
    if not doc or doc.owner_id != user.id:
        raise HTTPException(status_code=404, detail="Document not found")
    return doc


@router.delete("/{doc_id}")
def delete_document(
    doc_id: int,
    session: Session = Depends(get_session),
    user=Depends(get_current_user)
):
    doc = session.get(Document, doc_id)
    if not doc or doc.owner_id != user.id:
        raise HTTPException(status_code=404, detail="Document not found")

    # Default value in case delete_doc_chunks fails
    res = {}

    # First: delete vector chunks from Pinecone (best effort)
    try:
        res = delete_doc_chunks(user.id, doc_id)
        logger.info(f"[routes_docs] delete_doc_chunks result: {res}")
    except Exception as e:
        logger.exception(f"[routes_docs] delete_doc_chunks failed for doc_id={doc_id}: {e}")
        # continue with DB + blob cleanup

    # Remove blob from Azure (best effort)
    try:
        delete_from_blob(doc.filename)
        logger.info(f"[routes_docs] Successfully deleted blob: {doc.filename}")
    except Exception as e:
        logger.warning(f"[routes_docs] Failed to delete blob {doc.filename}: {e}")

    # Delete related conversations first (CASCADE DELETE)
    conversations = session.exec(select(Conversation).where(Conversation.document_id == doc_id))
    for conversation in conversations:
        session.delete(conversation)
    
    # Delete related interview sessions
    interview_sessions = session.exec(select(InterviewSession).where(InterviewSession.document_id == doc_id))
    for session_obj in interview_sessions:
        session.delete(session_obj)
    
    # Finally delete the document
    session.delete(doc)
    session.commit()

    return {"message": "Deleted", "vector_delete_result": res}
