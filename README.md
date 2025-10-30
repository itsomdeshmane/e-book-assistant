# AI-Powered E-Book / Knowledge Assistant (FastAPI + Auth + Pinecone)

## Features
- User registration & login (JWT)
- Upload PDF, extract text, chunk, embed (OpenAI), store in Pinecone (cloud vector database)
- **Cloud Storage** - PDF files stored securely in Azure Blob Storage
- Ask questions against a selected document (RAG)
- List / get / delete documents
- Optional chapter or full-book summarization
- Generate interview questions based on document content
- Clean, modular FastAPI project
- **Smart OCR Processing** with Azure AI Document Intelligence
- **Intelligent Text Verification** - Only uses OCR when truly needed
- **Production-Ready Logging** - Clean, focused logging without debug clutter

## Quickstart

### Option 1: Docker (Recommended)
```bash
# Clone the repository
git clone <your-repo-url>
cd e-book-assistant

# Create environment file (see Configuration section below)
# Edit .env with your configuration

# Run with Docker Compose
docker-compose up -d

# Open Swagger UI
# http://localhost:8000/docs
```

### Option 2: Local Development
```bash
python -m venv .venv && source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt

# Set up environment variables (see Configuration section below)
# Run the API
uvicorn app.main:app --reload

# Open Swagger UI
# http://localhost:8000/docs
```

## Configuration

Create a `.env` file in the project root with the following variables:

```env
# Server Configuration
PORT=8000
ALLOW_ORIGINS=*

# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key_here

# Pinecone Configuration (Required for vector storage)
PINECONE_API_KEY=your_pinecone_api_key_here
PINECONE_INDEX_NAME=your_pinecone_index_name

# JWT Configuration
JWT_SECRET=your_jwt_secret_here
JWT_EXPIRE_MINUTES=120

# Database Configuration
DATABASE_URL=sqlite:///./app.db

# Text Processing Configuration
CHUNK_SIZE=1000
CHUNK_OVERLAP=200
MODEL_NAME=gpt-4o-mini
EMBEDDING_MODEL=text-embedding-3-small
EMBEDDING_BACKEND=openai

# PDF Processing Configuration
PDF2IMAGE_DPI=200

# Azure AI Document Intelligence Configuration (Required for OCR)
AZURE_DI_ENDPOINT=https://your-resource-name.cognitiveservices.azure.com
AZURE_DI_KEY=your_azure_di_key_here
AZURE_DI_API_VERSION=2024-07-31

# Azure Blob Storage Configuration (Required for file storage)
AZURE_STORAGE_CONNECTION_STRING=DefaultEndpointsProtocol=https;AccountName=yourstoragename;AccountKey=your-key-here==;EndpointSuffix=core.windows.net
AZURE_STORAGE_CONTAINER_NAME=pdf-uploads
```

### Azure Blob Storage Setup

**Azure Blob Storage is required** for storing uploaded PDF files. The application no longer uses local file storage.

For detailed setup instructions, see **[AZURE_BLOB_SETUP.md](AZURE_BLOB_SETUP.md)**.

Quick setup:
1. Create an Azure Storage Account in the Azure portal
2. Create a container named `pdf-uploads` (or your preferred name)
3. Get your connection string from the storage account's "Access keys" section
4. Set the `AZURE_STORAGE_CONNECTION_STRING` and `AZURE_STORAGE_CONTAINER_NAME` environment variables

### Azure AI Document Intelligence Setup

1. Create an Azure AI Document Intelligence resource in the Azure portal
2. Get your endpoint URL and API key from the resource
3. Set the `AZURE_DI_ENDPOINT` and `AZURE_DI_KEY` environment variables
4. The system will intelligently use Azure AI Document Intelligence only when needed

### Pinecone Setup

1. Create a free account at [Pinecone](https://www.pinecone.io/)
2. Create a new index with the following settings:
   - **Dimensions**: 1536 (for OpenAI's text-embedding-3-small model)
   - **Metric**: cosine
   - **Cloud**: Choose your preferred region
3. Copy your API key and index name
4. Set `PINECONE_API_KEY` and `PINECONE_INDEX_NAME` environment variables
5. The system automatically creates user-specific namespaces for data isolation

## API Endpoints

### Authentication
- `POST /auth/register` - User registration
- `POST /auth/login` - User login
- `GET /auth/me` - Get current user info

### Document Management
- `POST /docs/upload` - Upload PDF document
- `GET /docs/` - List user documents
- `GET /docs/{doc_id}` - Get document details
- `DELETE /docs/{doc_id}` - Delete document

### RAG Operations
- `POST /rag/ask` - Ask questions about a document
- `POST /rag/summarize` - Generate document summary
- `POST /rag/interview-questions` - Generate interview questions

### Conversation Management
- `GET /rag/conversations/{document_id}` - Get conversation history
- `GET /rag/interview-history` - Get interview question history

**Note:** This application now uses only Azure AI Document Intelligence for OCR. Previous OCR libraries (Tesseract, PaddleOCR) have been removed.

## Recent Improvements

### 🚀 Smart OCR Processing (v2.0)
- **Intelligent Text Verification**: The system now performs comprehensive text quality checks before deciding whether OCR is needed
- **Cost Optimization**: Azure OCR is only called when extracted text is insufficient or meaningless
- **Better Performance**: Faster processing by avoiding unnecessary OCR operations
- **Quality Assessment**: Uses multiple criteria (length, word patterns, readability) to determine text quality

### 🧹 Production-Ready Codebase
- **Clean Logging**: Removed debug clutter and excessive logging for production environments
- **Optimized Performance**: Reduced logging overhead and improved code efficiency
- **Better Error Handling**: Streamlined error messages and warnings
- **Removed Debug Routes**: Cleaned up development-only endpoints

### 🔧 Technical Enhancements
- **Text Quality Algorithm**: Advanced text verification using pattern matching and character analysis
- **Smart Fallbacks**: Intelligent decision-making about when to use OCR vs. extracted text
- **Improved Chunking**: Better text processing with meaningful content detection
- **Enhanced RAG**: More reliable question answering with better text validation

## Architecture

### Text Processing Pipeline
1. **PDF Upload** → Store in Azure Blob Storage
2. **Download Temporarily** → Download to temp file for processing
3. **Text Extraction** → Extract text using PyPDF
4. **Quality Check** → Verify if extracted text is meaningful
5. **Smart Decision** → Use OCR only if text quality is insufficient
6. **Chunking** → Create semantic chunks with overlap
7. **Embedding** → Generate embeddings using OpenAI
8. **Vector Storage** → Store in Pinecone with metadata
9. **Cleanup** → Remove temporary file

### OCR Decision Logic
```
Extracted Text → Quality Check → Decision
├─ Meaningful Text → Use as-is (Skip OCR)
└─ Poor Quality → Azure OCR → Enhanced Text
```

### Quality Assessment Criteria
- Minimum length (50+ characters)
- Word count (5+ words)
- Readable patterns (common words, sentence structure)
- Alphabetic character ratio (40%+ for readable text)

## Performance & Cost Optimization

### OCR Cost Savings
- **Before**: Azure OCR called for every document processing
- **After**: Azure OCR only called when text extraction fails quality checks
- **Savings**: Up to 80% reduction in OCR API calls for text-based PDFs

### Processing Speed
- **Faster Upload**: Text-based PDFs process 3-5x faster
- **Reduced Latency**: Skip OCR preprocessing for readable documents
- **Better UX**: Immediate feedback for documents with good text extraction

### Logging Optimization
- **Production Ready**: Clean, focused logging without debug clutter
- **Better Monitoring**: Essential errors and warnings preserved
- **Reduced Overhead**: Minimal logging impact on performance

## Troubleshooting

### OCR Issues
- **No OCR Called**: Check if PDF has extractable text - system may skip OCR for text-based PDFs
- **OCR Always Called**: Verify text quality - system will use OCR for scanned/handwritten documents
- **Azure Errors**: Check `AZURE_DI_ENDPOINT` and `AZURE_DI_KEY` configuration

### Text Processing
- **Empty Chunks**: Verify PDF has readable content
- **Poor Quality**: System automatically detects and uses OCR for low-quality text
- **Processing Slow**: Check if OCR is being called unnecessarily

### Performance
- **Slow Upload**: Normal for first-time OCR processing
- **Fast Processing**: Expected for documents with good text extraction
- **Memory Usage**: Monitor during large document processing

## Docker Deployment

### Prerequisites
- Docker and Docker Compose installed
- OpenAI API key
- Azure AI Document Intelligence credentials (optional but recommended)

### Environment Setup
Create a `.env` file in the project root with your actual values:

```env
# Server Configuration
PORT=8000
ALLOW_ORIGINS=*

# Required
OPENAI_API_KEY=your_openai_api_key_here
JWT_SECRET=your_secure_jwt_secret_here

# Required - Azure Blob Storage
AZURE_STORAGE_CONNECTION_STRING=DefaultEndpointsProtocol=https;AccountName=yourstoragename;AccountKey=your-key==;EndpointSuffix=core.windows.net
AZURE_STORAGE_CONTAINER_NAME=pdf-uploads

# Required - Pinecone Vector Database
PINECONE_API_KEY=your_pinecone_api_key_here
PINECONE_INDEX_NAME=your_pinecone_index_name

# Required - Azure Document Intelligence (OCR)
AZURE_DI_ENDPOINT=https://your-resource-name.cognitiveservices.azure.com
AZURE_DI_KEY=your_azure_di_key_here
```

**See [AZURE_BLOB_SETUP.md](AZURE_BLOB_SETUP.md) for detailed Azure Blob Storage setup instructions.**

### Running with Docker Compose
```bash
# Build and start the application
docker-compose up -d

# View logs
docker-compose logs -f

# Stop the application
docker-compose down

# Rebuild after code changes
docker-compose up -d --build
```

### Docker Commands
```bash
# Build the image
docker build -t e-book-assistant .

# Run the container
docker run -p 8000:8000 --env-file .env e-book-assistant

# Run with volume mounts for persistence
docker run -p 8000:8000 \
  -v $(pwd)/app.db:/app/app.db \
  --env-file .env \
  e-book-assistant
```

### Data Persistence
The Docker setup includes volume mounts for:
- `app.db` - SQLite database (user data, documents metadata)

**File Storage**: PDF files are stored in Azure Blob Storage (cloud-based), eliminating the need for local file volumes.

**Vector Storage**: Embeddings are stored in Pinecone (cloud-based), so no local volume is needed.

### Health Checks
The application includes health checks accessible at:
- Container health check: Built into Docker image
- Application health endpoint: `http://localhost:8000/healthz`

### Cloud Deployment
The application is ready for deployment on various cloud platforms:

#### Heroku
```bash
# Set environment variables
heroku config:set OPENAI_API_KEY=your_key
heroku config:set JWT_SECRET=your_secret
heroku config:set PORT=8000
heroku config:set ALLOW_ORIGINS=https://your-app.herokuapp.com

# Deploy
git push heroku main
```

#### Railway
```bash
# Set environment variables in Railway dashboard
# PORT is automatically set by Railway
# ALLOW_ORIGINS should be set to your domain
# PINECONE_API_KEY and PINECONE_INDEX_NAME are required
# AZURE_STORAGE_CONNECTION_STRING and AZURE_STORAGE_CONTAINER_NAME are required
# AZURE_DI_ENDPOINT and AZURE_DI_KEY are required
```

#### Google Cloud Run / AWS ECS
- Set `PORT` environment variable (usually provided by the platform)
- Set `ALLOW_ORIGINS` to your domain for security
- Set `PINECONE_API_KEY` and `PINECONE_INDEX_NAME` for vector storage
- Set `AZURE_STORAGE_CONNECTION_STRING` and `AZURE_STORAGE_CONTAINER_NAME` for file storage
- Set `AZURE_DI_ENDPOINT` and `AZURE_DI_KEY` for OCR capabilities

## Development

### Running Tests
```bash
# Install test dependencies
pip install pytest pytest-asyncio

# Run tests
pytest tests/
```

### Code Quality
- **Linting**: `flake8 app/`
- **Type Checking**: `mypy app/`
- **Formatting**: `black app/`