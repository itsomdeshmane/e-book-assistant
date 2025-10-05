# Memory Optimization Guide 🚀

## Problem Solved
Your deployment was running out of memory during PDF processing, causing the "Killed" error. This guide explains the optimizations implemented to prevent memory issues.

## Memory Optimizations Implemented

### 1. **Reduced Image Resolution**
- **Before**: DPI 200 (very high resolution)
- **After**: DPI 150 (25% memory reduction)
- **Impact**: Significantly reduces memory usage for image processing

### 2. **Batch Processing**
- **Before**: Processed entire PDF at once
- **After**: Processes 5 pages at a time
- **Impact**: Prevents memory spikes for large documents

### 3. **Page Limits**
- **Added**: Maximum 50 pages per document
- **Impact**: Prevents processing of extremely large documents that would cause OOM

### 4. **Memory Cleanup**
- **Added**: Explicit garbage collection after each page
- **Added**: Memory monitoring and logging
- **Impact**: Frees memory immediately after use

### 5. **Streaming Processing**
- **Before**: Loaded all images into memory
- **After**: Processes pages in batches, cleans up immediately
- **Impact**: Constant memory usage instead of growing memory

## Configuration Options

You can adjust these settings via environment variables:

```bash
# PDF Processing (Memory Optimized)
PDF2IMAGE_DPI=150                    # Image resolution (lower = less memory)
MAX_PDF_PAGES=50                     # Maximum pages to process
PROCESS_PAGES_BATCH_SIZE=5           # Pages per batch
```

## Deployment Recommendations

### For Small Deployments (512MB-1GB RAM)
```bash
PDF2IMAGE_DPI=120
MAX_PDF_PAGES=25
PROCESS_PAGES_BATCH_SIZE=3
```

### For Medium Deployments (1GB-2GB RAM)
```bash
PDF2IMAGE_DPI=150
MAX_PDF_PAGES=50
PROCESS_PAGES_BATCH_SIZE=5
```

### For Large Deployments (2GB+ RAM)
```bash
PDF2IMAGE_DPI=200
MAX_PDF_PAGES=100
PROCESS_PAGES_BATCH_SIZE=10
```

## Monitoring

The application now logs memory usage at key stages:
```
[MEMORY] Starting PDF text extraction: 245.3 MB
[MEMORY] Processing OCR batch 0-5: 312.7 MB
[MEMORY] Completed OCR batch 0-5: 298.1 MB
[MEMORY] Completed PDF processing for doc_id=1: 251.2 MB
```

## What to Expect

### Before Optimization:
- ❌ Memory usage grew continuously
- ❌ Large PDFs caused OOM errors
- ❌ No visibility into memory usage

### After Optimization:
- ✅ Memory usage stays constant
- ✅ Large PDFs process successfully
- ✅ Memory monitoring and cleanup
- ✅ Configurable limits prevent OOM

## Next Steps

1. **Rebuild your Docker image** with the new optimizations
2. **Monitor the logs** for memory usage patterns
3. **Adjust settings** based on your deployment's memory limits
4. **Test with various PDF sizes** to ensure stability

## Emergency Settings (Ultra-Low Memory)

If you're still experiencing memory issues, use these ultra-conservative settings:

```bash
PDF2IMAGE_DPI=100
MAX_PDF_PAGES=10
PROCESS_PAGES_BATCH_SIZE=2
```

This will process documents more slowly but use minimal memory.
