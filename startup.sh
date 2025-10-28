#!/bin/bash
# Azure App Service startup script for FastAPI application

# Set default port if not specified
export PORT=${PORT:-8000}

# Start the FastAPI application using uvicorn
python -m uvicorn app.main:app --host 0.0.0.0 --port $PORT

