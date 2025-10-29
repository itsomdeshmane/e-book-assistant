# app/pdf_processor.py
import logging
from typing import List, Dict, Any, Optional
import io
import time
from PIL import Image
import numpy as np
import cv2

from pdf2image import convert_from_path
from pypdf import PdfReader

# Azure AI Document Intelligence SDK
from azure.core.credentials import AzureKeyCredential
from azure.ai.documentintelligence import DocumentIntelligenceClient

from .config import (
    PDF2IMAGE_DPI as CFG_PDF2IMAGE_DPI,
    MAX_PDF_PAGES,
    PROCESS_PAGES_BATCH_SIZE,
    AZURE_DI_ENDPOINT,
    AZURE_DI_KEY,
    AZURE_DI_API_VERSION,
)

# Optional PyMuPDF for Poppler-free rasterization
try:
    import fitz  # PyMuPDF
    _HAVE_PYMUPDF = True
except Exception:
    _HAVE_PYMUPDF = False

# Config knobs (tweak from config.py if you have one)
PDF2IMAGE_DPI = CFG_PDF2IMAGE_DPI

# Memory management utilities
import gc

def log_memory_usage(stage: str):
    """Log stage progress (memory monitoring removed to reduce dependencies)"""
    logging.info(f"[PROGRESS] {stage}")

def cleanup_memory():
    """Force garbage collection and memory cleanup"""
    gc.collect()
    try:
        import torch
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
    except ImportError:
        pass

# ---------- image helpers ----------
def pil_to_cv(img: Image.Image) -> np.ndarray:
    return cv2.cvtColor(np.array(img), cv2.COLOR_RGB2BGR)

def cv_to_pil(img: np.ndarray) -> Image.Image:
    return Image.fromarray(cv2.cvtColor(img, cv2.COLOR_BGR2RGB))

def deskew_image_cv(img: np.ndarray) -> np.ndarray:
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    coords = np.column_stack(np.where(gray > 0))
    if coords.size == 0:
        return img
    angle = cv2.minAreaRect(coords)[-1]
    if angle < -45:
        angle = -(90 + angle)
    else:
        angle = -angle
    (h, w) = img.shape[:2]
    M = cv2.getRotationMatrix2D((w // 2, h // 2), angle, 1.0)
    rotated = cv2.warpAffine(img, M, (w, h), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)
    return rotated

def enhance_image_cv(img: np.ndarray) -> np.ndarray:
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    denoised = cv2.fastNlMeansDenoising(gray, None, h=10, templateWindowSize=7, searchWindowSize=21)
    th = cv2.adaptiveThreshold(denoised, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
                               cv2.THRESH_BINARY, 31, 15)
    return cv2.cvtColor(th, cv2.COLOR_GRAY2BGR)

def enhance_handwriting_cv(img: np.ndarray) -> np.ndarray:
    """
    Handwriting-friendly enhancement: avoid harsh binarization; use CLAHE and mild smoothing.
    """
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    eq = clahe.apply(gray)
    smooth = cv2.bilateralFilter(eq, d=7, sigmaColor=50, sigmaSpace=50)
    return cv2.cvtColor(smooth, cv2.COLOR_GRAY2BGR)

def auto_crop_scan_borders(img: np.ndarray) -> np.ndarray:
    """
    Attempt to crop CamScanner-style thick borders/watermark bands by keeping largest contour.
    Falls back to original on failure.
    """
    try:
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        thr = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)[1]
        edges = cv2.Canny(thr, 50, 150)
        contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        if not contours:
            return img
        c = max(contours, key=cv2.contourArea)
        x, y, w, h = cv2.boundingRect(c)
        H, W = img.shape[:2]
        # Ignore degenerate crops
        if w < W * 0.5 or h < H * 0.5:
            return img
        pad_x = int(0.02 * W)
        pad_y = int(0.02 * H)
        x0 = max(0, x - pad_x)
        y0 = max(0, y - pad_y)
        x1 = min(W, x + w + pad_x)
        y1 = min(H, y + h + pad_y)
        return img[y0:y1, x0:x1]
    except Exception:
        return img

# ---------- OCR helpers ----------
def azure_document_intelligence_read_image_bytes(image_bytes: bytes, *, features: Optional[List[str]] = None, lang: str = "en") -> Dict[str, Any]:
    """
    Call Azure AI Document Intelligence Read (prebuilt-read) to extract text with handwriting support.
    Returns dict with 'text' and 'avg_conf' approximated from spans.
    """
    if not AZURE_DI_ENDPOINT or not AZURE_DI_KEY:
        raise RuntimeError("Azure Document Intelligence not configured")

    # Initialize the client
    client = DocumentIntelligenceClient(
        endpoint=AZURE_DI_ENDPOINT,
        credential=AzureKeyCredential(AZURE_DI_KEY)
    )

    # Analyze the document using prebuilt-read model
    poller = client.begin_analyze_document("prebuilt-read", image_bytes)
    result = poller.result()

    # Extract text and calculate confidence
    blocks = []
    confs: List[float] = []
    
    for page in result.pages:
        for line in page.lines:
            if line.content.strip():
                blocks.append(line.content)
                # Use line confidence if available, otherwise default to 0.9
                conf = getattr(line, 'confidence', 0.9)
                confs.append(conf)
    
    # Combine all text
    text = "\n".join(blocks).strip()
    
    # Calculate average confidence
    avg_conf = float(sum(confs) / len(confs)) if confs else 0.0
    # Normalize to 0-100 like tesseract uses
    avg_conf_0_100 = avg_conf * (100.0 if avg_conf <= 1.0 else 1.0)
    if avg_conf > 1.0:
        avg_conf_0_100 = min(avg_conf, 100.0)
    
    return {"text": text, "avg_conf": avg_conf_0_100}

def ocr_with_azure_for_page(pil_img: Image.Image) -> Dict[str, Any]:
    buf = io.BytesIO()
    pil_img.save(buf, format="PNG")
    return azure_document_intelligence_read_image_bytes(buf.getvalue())

def render_pdf_pages_batch(path: str, dpi: int, start_page: int = 0, max_pages: int = None) -> List[Image.Image]:
    """Render PDF pages in batches to reduce memory usage"""
    log_memory_usage(f"Starting PDF render batch (pages {start_page}-{start_page + (max_pages or PROCESS_PAGES_BATCH_SIZE)})")
    
    try:
        # Use pdf2image with specific page range
        if max_pages:
            end_page = min(start_page + max_pages, MAX_PDF_PAGES)
        else:
            end_page = start_page + PROCESS_PAGES_BATCH_SIZE
            
        pages = convert_from_path(
            path, 
            dpi=dpi,
            first_page=start_page + 1,  # pdf2image uses 1-based indexing
            last_page=end_page
        )
        log_memory_usage(f"Rendered {len(pages)} pages")
        return pages
    except Exception as e:
        logging.error(f"[PDF->Image] convert_from_path failed: {e}")
        if _HAVE_PYMUPDF:
            try:
                zoom = dpi / 72.0
                mat = fitz.Matrix(zoom, zoom)
                pages = []
                with fitz.open(path) as doc:
                    end_page = min(start_page + (max_pages or PROCESS_PAGES_BATCH_SIZE), len(doc), MAX_PDF_PAGES)
                    for page_num in range(start_page, end_page):
                        page = doc[page_num]
                        pix = page.get_pixmap(matrix=mat, alpha=False)
                        img_bytes = pix.tobytes("png")
                        pages.append(Image.open(io.BytesIO(img_bytes)).convert("RGB"))
                        # Clean up immediately
                        del pix, img_bytes
                logging.info(f"[PDF->Image] Rendered {len(pages)} pages via PyMuPDF fallback")
                return pages
            except Exception as e2:
                logging.error(f"[PDF->Image] PyMuPDF fallback failed: {e2}")
        raise RuntimeError("No PDF renderer available (Poppler or PyMuPDF required)")

def render_pdf_pages(path: str, dpi: int) -> List[Image.Image]:
    """Legacy function - now uses batch processing"""
    return render_pdf_pages_batch(path, dpi)

def ocr_with_azure_for_page(pil_img: Image.Image) -> Dict[str, Any]:
    buf = io.BytesIO()
    pil_img.save(buf, format="PNG")
    return azure_document_intelligence_read_image_bytes(buf.getvalue())

# ---------- main API ----------
def is_text_meaningful(text: str) -> bool:
    """
    Check if extracted text is meaningful enough to use without OCR.
    Returns True if text appears to be readable content, False if it needs OCR.
    """
    if not text or not text.strip():
        return False
    
    text = text.strip()
    
    # Check minimum length
    if len(text) < 50:
        return False
    
    # Check for meaningful word patterns (not just random characters)
    words = text.split()
    if len(words) < 5:
        return False
    
    # Check for common readable patterns
    readable_patterns = [
        r'[a-zA-Z]{3,}',  # At least some 3+ letter words
        r'\b(the|and|or|but|in|on|at|to|for|of|with|by)\b',  # Common words
        r'[.!?]',  # Sentence endings
        r'\d+',  # Numbers
    ]
    
    import re
    pattern_matches = sum(1 for pattern in readable_patterns if re.search(pattern, text, re.IGNORECASE))
    
    # Need at least 2 different types of readable patterns
    if pattern_matches < 2:
        return False
    
    # Check ratio of alphabetic characters (should be reasonable for readable text)
    alpha_chars = sum(1 for c in text if c.isalpha())
    total_chars = len(text)
    alpha_ratio = alpha_chars / total_chars if total_chars > 0 else 0
    
    # Should have at least 40% alphabetic characters for readable text
    if alpha_ratio < 0.4:
        return False
    
    return True

def extract_pages_text(path: str, dpi: int = PDF2IMAGE_DPI, force_ocr: bool = False) -> List[Dict[str, Any]]:
    """
    Memory-optimized text extraction with batch processing.
    If `force_ocr=True`, skips PdfReader and directly OCRs every page via Azure.
    """
    log_memory_usage("Starting PDF text extraction")
    results: List[Dict[str, Any]] = []

    if not AZURE_DI_ENDPOINT or not AZURE_DI_KEY:
        raise RuntimeError("Azure AI Document Intelligence not configured. Please set AZURE_DI_ENDPOINT and AZURE_DI_KEY")

    reader = None
    num_pages = 0

    if not force_ocr:
        try:
            reader = PdfReader(path)
            num_pages = len(reader.pages)
            # Limit pages to prevent OOM
            if num_pages > MAX_PDF_PAGES:
                logging.warning(f"[PDF] Document has {num_pages} pages, limiting to {MAX_PDF_PAGES}")
                num_pages = MAX_PDF_PAGES
        except Exception as e:
            logging.warning(f"[PDF] pypdf failed to open: {e}")

    # If PdfReader works and OCR not forced
    if reader and not force_ocr:
        for i in range(min(num_pages, MAX_PDF_PAGES)):
            try:
                txt = reader.pages[i].extract_text() or ""
            except Exception as e:
                logging.warning(f"[PDF] page {i} extract_text failed: {e}")
                txt = ""

            # Use improved text quality check instead of simple length check
            if is_text_meaningful(txt):
                results.append({"page": i+1, "text": txt.strip(), "source": "text", "confidence": 100.0})
            else:
                # Needs OCR - text is not meaningful enough
                results.append({"page": i+1, "text": "", "source": "needs_ocr", "confidence": 0.0})
        
        # Clean up reader
        del reader
        cleanup_memory()

    # If OCR is needed for some/all pages, process in batches
    if force_ocr or any(r["source"] == "needs_ocr" for r in results):
        total_pages = num_pages if num_pages > 0 else MAX_PDF_PAGES
        
        for batch_start in range(0, total_pages, PROCESS_PAGES_BATCH_SIZE):
            log_memory_usage(f"Processing OCR batch {batch_start}-{min(batch_start + PROCESS_PAGES_BATCH_SIZE, total_pages)}")
            
            try:
                batch_size = min(PROCESS_PAGES_BATCH_SIZE, total_pages - batch_start)
                images = render_pdf_pages_batch(path, dpi=dpi, start_page=batch_start, max_pages=batch_size)
            except Exception as e:
                logging.error(f"[PDF->Image] batch rendering failed: {e}")
                continue

            for batch_idx, pil_img in enumerate(images):
                page_idx = batch_start + batch_idx
                
                # Skip if we already have good text for this page
                if not force_ocr and page_idx < len(results) and results[page_idx]["source"] != "needs_ocr":
                    continue

                # Enhance for handwriting
                try:
                    cv_img = pil_to_cv(pil_img)
                    cv_img = deskew_image_cv(cv_img)
                    cv_img = auto_crop_scan_borders(cv_img)
                    hw_enhanced = enhance_handwriting_cv(cv_img)
                    proc_pil = cv_to_pil(hw_enhanced)
                    
                    # Clean up intermediate images
                    del cv_img, hw_enhanced
                except Exception as e:
                    logging.warning(f"[OCR] preprocess failed for page {page_idx+1}: {e}")
                    proc_pil = pil_img

                try:
                    o = ocr_with_azure_for_page(proc_pil)
                    if page_idx < len(results):
                        results[page_idx] = {"page": page_idx+1, "text": o["text"].strip(), "source": "azure", "confidence": float(o["avg_conf"])}
                    else:
                        results.append({"page": page_idx+1, "text": o["text"].strip(), "source": "azure", "confidence": float(o["avg_conf"])})
                except Exception as e:
                    logging.error(f"[OCR] Azure failed for page {page_idx+1}: {e}")
                    if page_idx < len(results):
                        results[page_idx] = {"page": page_idx+1, "text": "", "source": "azure", "confidence": 0.0}
                    else:
                        results.append({"page": page_idx+1, "text": "", "source": "azure", "confidence": 0.0})
                
                # Clean up processed image
                del pil_img, proc_pil
                
            # Clean up batch
            del images
            cleanup_memory()
            log_memory_usage(f"Completed OCR batch {batch_start}-{min(batch_start + PROCESS_PAGES_BATCH_SIZE, total_pages)}")

    log_memory_usage("Completed PDF text extraction")
    return results
