# AI-Powered E-Book / Knowledge Assistant (FastAPI + Auth + ChromaDB)

## Features
- User registration & login (JWT)
- Upload PDF, extract text, chunk, embed (OpenAI), store in ChromaDB (persistent)
- Ask questions against a selected document (RAG)
- List / get / delete documents
- Optional chapter or full-book summarization
- Clean, modular FastAPI project

## Quickstart
```bash
python -m venv .venv && source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt

# Copy .env.example to .env and set keys/paths
cp .env.example .env

# Run the API
uvicorn app.main:app --reload

# Open Swagger UI
# http://localhost:8000/docs
```