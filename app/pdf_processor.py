# app/pdf_processor.py
import logging
from typing import List, Dict, Any, Optional
from PIL import Image
import numpy as np
import cv2
import pytesseract

from pdf2image import convert_from_path
from pypdf import PdfReader

# Config knobs (tweak from config.py if you have one)
PDF2IMAGE_DPI = 200

# Optional: set tesseract path on Windows if needed
# pytesseract.pytesseract.tesseract_cmd = r"C:\Program Files\Tesseract-OCR\tesseract.exe"

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

# ---------- OCR helpers ----------
def ocr_tesseract_with_confidence(img_pil: Image.Image) -> Dict[str, Any]:
    """
    Uses pytesseract to get full text and an approximate average confidence.
    Returns {'text': str, 'avg_conf': float}
    """
    # Use image_to_data to get per-word confidences (tsv)
    data = pytesseract.image_to_data(img_pil, output_type=pytesseract.Output.DICT, lang='eng')
    words = data.get("text", [])
    confs = data.get("conf", [])
    # Build text from non-empty words preserving spacing roughly
    text_parts = []
    conf_values = []
    for w, c in zip(words, confs):
        if w and w.strip():
            text_parts.append(w)
            try:
                ci = int(c)
                if ci >= 0:
                    conf_values.append(ci)
            except Exception:
                pass
    text = " ".join(text_parts)
    avg_conf = float(sum(conf_values) / len(conf_values)) if conf_values else 0.0
    return {"text": text, "avg_conf": avg_conf}

# ---------- main API ----------
def extract_pages_text(path: str, dpi: int = PDF2IMAGE_DPI) -> List[Dict[str, Any]]:
    """
    Returns a list (one per page) of dicts:
      { "page": int, "text": str, "source": "text"|"ocr", "confidence": float (0-100) }
    Behavior: Try pypdf text extraction per page. If empty -> OCR that page via tesseract.
    """
    results: List[Dict[str, Any]] = []

    # Attempt pure text extraction per page first
    try:
        reader = PdfReader(path)
        num_pages = len(reader.pages)
    except Exception as e:
        logging.warning(f"[PDF] pypdf failed to open: {e}")
        reader = None
        num_pages = None

    # If pypdf worked and we can get text per page: use it
    if reader is not None:
        for i, page in enumerate(reader.pages):
            try:
                txt = page.extract_text() or ""
            except Exception as e:
                logging.warning(f"[PDF] page {i} extract_text failed: {e}")
                txt = ""

            if txt and txt.strip():
                results.append({"page": i+1, "text": txt.strip(), "source": "text", "confidence": 100.0})
            else:
                # placeholder for pages that need OCR; we'll collect their indices
                results.append({"page": i+1, "text": "", "source": "needs_ocr", "confidence": 0.0})
    else:
        # If pypdf failed entirely, mark pages unknown and plan to OCR all pages via pdf2image
        results = []

    # If any pages need OCR (or reader was None), produce images and OCR them
    # Convert only pages that need OCR to images (efficiency)
    pages_to_ocr = [r["page"] - 1 for r in results if r.get("source") == "needs_ocr"] if results else None

    if pages_to_ocr is None:
        # fall back: convert all pages
        pages_to_ocr = None  # convert_from_path with no `first_page`/`last_page` gives all pages

    try:
        images = convert_from_path(path, dpi=dpi)
    except Exception as e:
        logging.error(f"[PDF->Image] convert_from_path failed: {e}")
        # If conversion fails, return whatever text we have
        return [r for r in results]

    # Loop pages and OCR those marked
    for idx, pil_img in enumerate(images):
        r = results[idx] if idx < len(results) else {"page": idx+1, "text": "", "source": "needs_ocr", "confidence": 0.0}
        if r.get("source") != "needs_ocr":
            continue  # already have text

        # Preprocess
        try:
            cv_img = pil_to_cv(pil_img)
            cv_img = deskew_image_cv(cv_img)
            cv_img = enhance_image_cv(cv_img)
            proc_pil = cv_to_pil(cv_img)
        except Exception as e:
            logging.warning(f"[OCR] preprocess failed for page {idx+1}: {e}")
            proc_pil = pil_img

        # OCR with Tesseract and get confidence
        try:
            o = ocr_tesseract_with_confidence(proc_pil)
            text = o["text"].strip()
            conf = float(o["avg_conf"])
            if text:
                results[idx]["text"] = text
                results[idx]["source"] = "ocr"
                results[idx]["confidence"] = conf
            else:
                results[idx]["text"] = ""
                results[idx]["source"] = "ocr"
                results[idx]["confidence"] = conf
        except Exception as e:
            logging.error(f"[OCR] tesseract failed page {idx+1}: {e}")
            results[idx]["text"] = ""
            results[idx]["source"] = "ocr"
            results[idx]["confidence"] = 0.0

    # If there were no reader results (pypdf failed initially), construct final list from 'images' iteration
    if not results:
        results = []
        for idx, pil_img in enumerate(images):
            try:
                cv_img = pil_to_cv(pil_img)
                cv_img = deskew_image_cv(cv_img)
                cv_img = enhance_image_cv(cv_img)
                proc_pil = cv_to_pil(cv_img)
            except Exception:
                proc_pil = pil_img
            o = ocr_tesseract_with_confidence(proc_pil)
            results.append({"page": idx+1, "text": o["text"].strip(), "source": "ocr", "confidence": float(o["avg_conf"])})
    return results
