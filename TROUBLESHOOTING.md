# Troubleshooting Guide - E-Book Assistant

## Common Issues and Solutions

### Issue 1: PDF to Image Conversion Issues

**Error Message:**
```
ERROR:root:[PDF->Image] PyMuPDF failed: ...
ERROR:root:[PDF->Image] pdf2image/Poppler failed: Unable to get page count. Is poppler installed and in PATH?
```

**Cause:** The application needs to convert PDF pages to images for OCR processing. It tries PyMuPDF first, then falls back to Poppler.

#### ✅ Recommended Solution: Ensure PyMuPDF is Installed

PyMuPDF is the **preferred** PDF renderer because:
- ✅ No external dependencies (pure Python)
- ✅ Works on all platforms without system installation
- ✅ Faster than Poppler
- ✅ Already in requirements.txt

**Install or reinstall PyMuPDF:**
```bash
pip install --upgrade pymupdf
```

**Verify installation:**
```python
import fitz
print(f"PyMuPDF version: {fitz.__version__}")
```

This should resolve the issue on all platforms (Windows, Linux, macOS) without needing Poppler.

#### Alternative: Install Poppler (Optional Fallback)

If you prefer to use Poppler or PyMuPDF is not working:

**Windows:**
1. Download from: https://github.com/oschwartz10612/poppler-windows/releases/
2. Extract to `C:\Program Files\poppler`
3. Add `C:\Program Files\poppler\Library\bin` to System PATH
4. Restart terminal/IDE

**Linux:**
```bash
# Ubuntu/Debian
sudo apt-get install poppler-utils

# CentOS/RHEL
sudo yum install poppler-utils

# Arch Linux
sudo pacman -S poppler
```

**macOS:**
```bash
brew install poppler
```

---

### Issue 2: Azure Document Intelligence 404 Error

**Error Message:**
```
ERROR:root:[OCR] Azure failed for page 1: (404) Resource not found
Code: 404
Message: Resource not found
```

**Cause:** Incorrect Azure Document Intelligence endpoint configuration.

#### Solution:

1. **Check Your Endpoint Format:**
   
   The endpoint should be in this exact format:
   ```
   https://<your-resource-name>.cognitiveservices.azure.com/
   ```
   
   **Common Mistakes:**
   - ❌ Missing trailing slash
   - ❌ Including API version in URL
   - ❌ Using wrong subdomain (e.g., `.documentintelligence.azure.com` instead of `.cognitiveservices.azure.com`)
   - ❌ Typo in resource name

2. **Verify Your Azure Resource:**
   
   - Go to [Azure Portal](https://portal.azure.com)
   - Navigate to your Document Intelligence resource
   - Click on "Keys and Endpoint"
   - Copy the **Endpoint** exactly as shown
   - Copy one of the **Keys** (Key 1 or Key 2)

3. **Update Your .env File:**
   
   ```env
   AZURE_DI_ENDPOINT=https://your-resource-name.cognitiveservices.azure.com/
   AZURE_DI_KEY=your-actual-key-here
   AZURE_DI_API_VERSION=2024-07-31-preview
   ```
   
   **Important Notes:**
   - The endpoint URL should end with a forward slash `/`
   - Do NOT include `/formrecognizer/` or any path in the endpoint
   - Use the API version `2024-07-31-preview` or `2023-07-31`

4. **Test Your Credentials:**
   
   Create a test script `test_azure_di.py`:
   ```python
   import os
   from dotenv import load_dotenv
   from azure.core.credentials import AzureKeyCredential
   from azure.ai.documentintelligence import DocumentIntelligenceClient
   
   load_dotenv()
   
   endpoint = os.getenv("AZURE_DI_ENDPOINT")
   key = os.getenv("AZURE_DI_KEY")
   
   print(f"Testing endpoint: {endpoint}")
   
   try:
       client = DocumentIntelligenceClient(
           endpoint=endpoint,
           credential=AzureKeyCredential(key)
       )
       print("✓ Client initialized successfully")
       print("Azure Document Intelligence is configured correctly!")
   except Exception as e:
       print(f"✗ Error: {e}")
   ```
   
   Run it:
   ```bash
   python test_azure_di.py
   ```

5. **Common Endpoint Issues:**

   | Issue | Wrong | Correct |
   |-------|-------|---------|
   | Missing slash | `https://myresource.cognitiveservices.azure.com` | `https://myresource.cognitiveservices.azure.com/` |
   | Wrong domain | `https://myresource.documentintelligence.azure.com/` | `https://myresource.cognitiveservices.azure.com/` |
   | Extra path | `https://myresource.cognitiveservices.azure.com/formrecognizer/` | `https://myresource.cognitiveservices.azure.com/` |
   | Typo | `https://myresorse.cognitiveservices.azure.com/` | `https://myresource.cognitiveservices.azure.com/` |

6. **Restart Application:**
   After updating `.env`, restart your FastAPI application to reload environment variables.

---

### Issue 3: Both PyMuPDF and Poppler Failing

**Error Message:**
```
RuntimeError: No PDF renderer available. Please ensure PyMuPDF (pymupdf) is installed
```

**Cause:** Neither PyMuPDF nor Poppler is available for rendering PDFs.

#### Solution:

1. **Reinstall PyMuPDF (Recommended):**
   ```bash
   pip uninstall pymupdf
   pip install pymupdf
   ```

2. **Verify PyMuPDF installation:**
   ```python
   import fitz
   print(f"PyMuPDF version: {fitz.__version__}")
   ```

3. **If still failing, check for conflicts:**
   ```bash
   pip list | grep -i mupdf
   ```
   Should show `PyMuPDF` with version number.

4. **Alternative - Install Poppler as backup:**
   Follow the Poppler installation instructions from Issue 1.

---

### Issue 4: Azure Blob Storage Connection Issues

**Error Message:**
```
ValueError: AZURE_STORAGE_CONNECTION_STRING environment variable is required
```

#### Solution:

1. **Verify Connection String Format:**
   ```env
   AZURE_STORAGE_CONNECTION_STRING="DefaultEndpointsProtocol=https;AccountName=yourstoragename;AccountKey=your-long-key-here==;EndpointSuffix=core.windows.net"
   ```

2. **Get Connection String from Azure:**
   - Go to Azure Portal
   - Navigate to your Storage Account
   - Go to "Security + networking" → "Access keys"
   - Click "Show" and copy the entire connection string

3. **Check Container Name:**
   ```env
   AZURE_STORAGE_CONTAINER_NAME=pdf-uploads
   ```

---

### Issue 5: Memory Issues During PDF Processing

**Error Message:**
```
MemoryError: Unable to allocate array
```

#### Solution:

1. **Reduce Batch Size:**
   ```env
   PROCESS_PAGES_BATCH_SIZE=3  # Reduce from 5 to 3
   ```

2. **Lower DPI:**
   ```env
   PDF2IMAGE_DPI=100  # Reduce from 150 to 100
   ```

3. **Limit Maximum Pages:**
   ```env
   MAX_PDF_PAGES=30  # Reduce from 50 to 30
   ```

---

### Issue 6: Pinecone Connection Issues

**Error Message:**
```
ValueError: PINECONE_API_KEY environment variable is required
```

#### Solution:

1. **Verify Pinecone Configuration:**
   ```env
   PINECONE_API_KEY=your-pinecone-api-key
   PINECONE_INDEX_NAME=your-index-name
   ```

2. **Check Index Exists:**
   - Log into [Pinecone Console](https://app.pinecone.io/)
   - Verify your index exists and is active
   - Check the dimensions match (should be 1536 for OpenAI embeddings)

---

## Quick Checklist

When experiencing issues, verify:

- [ ] All required environment variables are set in `.env`
- [ ] Poppler is installed and in system PATH (Windows)
- [ ] Azure Document Intelligence endpoint format is correct (with trailing `/`)
- [ ] Azure Blob Storage connection string is valid
- [ ] Pinecone index exists and is active
- [ ] All Python dependencies are installed: `pip install -r requirements.txt`
- [ ] Application has been restarted after changing `.env`

---

## Getting Help

If you're still experiencing issues:

1. **Check Logs:**
   - Look for detailed error messages in the console
   - Enable debug logging if needed

2. **Test Individual Components:**
   - Test Azure DI connection separately
   - Test Azure Blob Storage separately
   - Test Pinecone connection separately

3. **Verify Service Health:**
   - Check Azure Status: https://status.azure.com/
   - Check Pinecone Status: https://status.pinecone.io/

4. **Review Configuration:**
   - Double-check all environment variables
   - Ensure no typos in URLs or keys
   - Verify services are in the correct regions

---

## Environment Variable Reference

Complete list of required environment variables:

```env
# Server
PORT=8000
ALLOW_ORIGINS=*

# OpenAI (Required)
OPENAI_API_KEY=your-openai-key
MODEL_NAME=gpt-4o-mini
EMBEDDING_MODEL=text-embedding-3-small

# Pinecone (Required)
PINECONE_API_KEY=your-pinecone-key
PINECONE_INDEX_NAME=your-index-name

# Azure Blob Storage (Required)
AZURE_STORAGE_CONNECTION_STRING=your-connection-string
AZURE_STORAGE_CONTAINER_NAME=pdf-uploads

# Azure Document Intelligence (Required for OCR)
AZURE_DI_ENDPOINT=https://your-resource.cognitiveservices.azure.com/
AZURE_DI_KEY=your-azure-di-key
AZURE_DI_API_VERSION=2024-07-31-preview

# JWT
JWT_SECRET=your-secret-key
JWT_EXPIRE_MINUTES=120

# Database
DATABASE_URL=sqlite:///./app.db

# PDF Processing (Optional)
CHUNK_SIZE=1000
CHUNK_OVERLAP=200
PDF2IMAGE_DPI=150
MAX_PDF_PAGES=50
PROCESS_PAGES_BATCH_SIZE=5
```

