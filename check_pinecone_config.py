#!/usr/bin/env python3
"""
Pinecone Configuration Checker
Run this to get your correct Pinecone configuration
"""
import os
from dotenv import load_dotenv

load_dotenv()

PINECONE_API_KEY = os.getenv("PINECONE_API_KEY")

if not PINECONE_API_KEY:
    print("❌ PINECONE_API_KEY not found in .env file")
    exit(1)

try:
    from pinecone import Pinecone
    
    pc = Pinecone(api_key=PINECONE_API_KEY)
    
    print("=" * 60)
    print("✅ Pinecone API Key is valid!")
    print("=" * 60)
    print()
    
    # List all indexes
    indexes = pc.list_indexes()
    
    if not indexes:
        print("❌ No indexes found in your Pinecone account")
        print()
        print("Please create an index first:")
        print("1. Go to https://app.pinecone.io/")
        print("2. Click 'Create Index'")
        print("3. Set dimensions to 1536")
        print("4. Choose cosine metric")
        exit(1)
    
    print(f"Found {len(indexes)} index(es):")
    print()
    
    for idx in indexes:
        print(f"📌 Index Name: {idx.name}")
        print(f"   Host: {idx.host}")
        print(f"   Dimension: {idx.dimension}")
        print(f"   Metric: {idx.metric}")
        print(f"   Status: {idx.status.state if hasattr(idx, 'status') else 'Unknown'}")
        
        print()
        print("   ✅ Add to your .env file:")
        print(f"   PINECONE_INDEX_NAME={idx.name}")
        print()
        print("   ℹ️  Note: PINECONE_ENVIRONMENT is NOT needed in SDK v5+")
        print()
        print("-" * 60)
        print()
    
    print("=" * 60)
    print("Next steps:")
    print("1. Copy the environment value above")
    print("2. Update your .env file with the correct PINECONE_ENVIRONMENT")
    print("3. Make sure PINECONE_INDEX_NAME matches your index name")
    print("4. Restart your application")
    print("=" * 60)
    
except ImportError:
    print("❌ Pinecone package not installed")
    print("Run: pip install pinecone>=5.0.0")
except Exception as e:
    print(f"❌ Error: {e}")
    print()
    print("Please check:")
    print("1. Your PINECONE_API_KEY is correct")
    print("2. You have access to the Pinecone dashboard")
    print("3. Your index is created")

