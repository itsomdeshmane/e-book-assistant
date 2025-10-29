# Pinecone Migration Guide

## Overview
Successfully migrated from ChromaDB + Local Embeddings to Pinecone + OpenAI Embeddings.

---

## Required Environment Variables

Add these to your `.env` file:

```env
# OpenAI Configuration (MANDATORY)
OPENAI_API_KEY=sk-proj-...  # Get from https://platform.openai.com/api-keys

# Pinecone Configuration (MANDATORY)
PINECONE_API_KEY=pcsk_...  # Get from https://app.pinecone.io/
PINECONE_INDEX_NAME=e-book-assistant-9eiz80o  # Your index name (from dashboard)

# Other existing variables...
JWT_SECRET=your-secret
DATABASE_URL=sqlite:///./app.db
AZURE_DI_ENDPOINT=https://your-resource.cognitiveservices.azure.com
AZURE_DI_KEY=your-azure-key
```

---

## How to Find Your Index Name

1. Go to https://app.pinecone.io/
2. Look at your index list in the dashboard
3. Copy the exact index name (e.g., `e-book-assistant-9eiz80o`)
4. Add it to your `.env` file

**Note**: With Pinecone SDK v5+, you only need the API key and index name. The environment/region is automatically determined from the index.

---

## Create Pinecone Index (First Time Only)

1. Go to https://app.pinecone.io/
2. Click **"Create Index"**
3. Configure:
   - **Name**: `ebook-assistant` (or your choice)
   - **Dimensions**: `1536` (required for OpenAI text-embedding-3-small)
   - **Metric**: `cosine`
   - **Cloud**: GCP or AWS (free tier available on both)
   - **Region**: Choose closest to your users
4. Click **"Create Index"**

---

## Changes Made

### Removed Dependencies (~2GB savings):
- ❌ `torch` (PyTorch)
- ❌ `transformers`
- ❌ `sentence-transformers`
- ❌ `chromadb`
- ❌ `sentencepiece`

### Added Dependencies:
- ✅ `pinecone>=5.0.0` (~1MB)

### Files Modified:
- `requirements.txt` - Updated dependencies
- `Dockerfile` - Updated ML stack installation
- `app/config.py` - Added Pinecone config, removed ChromaDB
- `app/embeddings.py` - OpenAI only, no local fallback
- `app/vector_db.py` - Complete Pinecone rewrite
- `app/query_engine.py` - Removed local model references
- `app/main.py` - Updated dependency checks
- `app/routes_docs.py` - Removed old ChromaDB imports

---

## Testing Checklist

After adding API keys to `.env`:

1. ✅ **Start app**: `uvicorn app.main:app --reload`
2. ✅ **Upload PDF**: Test document upload endpoint
3. ✅ **Check indexing**: Wait for background processing
4. ✅ **Query document**: Test RAG question answering
5. ✅ **Generate summary**: Test summarization endpoint
6. ✅ **Delete document**: Test document deletion

---

## API Costs Estimate

### OpenAI Embeddings
- **Cost**: $0.00002 per 1K tokens
- **Example**: 100-page document ≈ $0.02

### Pinecone Free Tier
- **Included**: 1 index, 100K vectors, 5GB storage
- **Limits**: 1 pod, 1 replica
- **Perfect for**: Development and small-scale production

---

## Data Migration

✅ **Clean Start** (What we did):
- No ChromaDB data migration
- Old data is ignored (still exists in `chroma_db/` folder)
- Users need to re-upload documents
- Simpler, no migration scripts needed

---

## Troubleshooting

### Error: "OPENAI_API_KEY environment variable is required"
- Add `OPENAI_API_KEY=sk-...` to your `.env` file
- Make sure `.env` is in project root
- Restart the app

### Error: "PINECONE_API_KEY environment variable is required"
- Add `PINECONE_API_KEY=pcsk_...` to your `.env` file
- Get API key from https://app.pinecone.io/
- Restart the app

### Error: "Malformed domain" or connection issues
- Make sure your `PINECONE_INDEX_NAME` exactly matches the name in your dashboard
- Run `python check_pinecone_config.py` to verify your configuration
- Restart the app

### Error: "Index not found"
- Create the index in Pinecone dashboard first
- Make sure `PINECONE_INDEX_NAME` matches your index name
- Wait a few seconds for index initialization

### Error during document upload
- Check your OpenAI API key is valid
- Check your Pinecone API key is valid
- Check Azure Document Intelligence credentials (for OCR)

---

## Rollback (If Needed)

If you need to rollback to ChromaDB:

```bash
git checkout HEAD~1  # Go back one commit
pip install -r requirements.txt
```

Your old ChromaDB data is still in `chroma_db/` folder.

---

## Next Steps

1. ✅ Add environment variables to `.env`
2. ✅ Create Pinecone index
3. ✅ Test the app locally
4. ✅ Update production environment variables
5. ✅ Deploy to production

---

## Support

If you encounter issues:
1. Check the logs for specific error messages
2. Verify all environment variables are set correctly
3. Ensure Pinecone index dimensions = 1536
4. Check OpenAI and Pinecone API keys are valid

