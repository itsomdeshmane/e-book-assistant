# Chunk Count Display Issue - Troubleshooting Guide

## Problem
Document uploads successfully but chunk count shows as 0 until page refresh.

## Root Cause Analysis
This issue typically occurs due to:
1. **React Query Caching**: Stale data being served from cache
2. **Polling Not Working**: Automatic refetch intervals not functioning
3. **Backend Processing Delay**: Document processing takes time but UI doesn't update
4. **State Management**: Component state not updating with new data

## Solutions Implemented

### 1. Enhanced React Query Configuration
```typescript
// hooks/use-api.ts
export function useDocument(docId: string | number) {
  return useQuery({
    queryKey: ['document', docId],
    queryFn: () => documentsAPI.getDocument(docId),
    enabled: !!docId,
    refetchInterval: (data) => {
      // Auto-refetch every 3 seconds if still processing
      if (data && (data as any).chunk_count === 0) {
        return 3000;
      }
      return false; // Stop when processed
    },
    refetchIntervalInBackground: true,
    staleTime: 0, // Always consider data stale
    gcTime: 1000 * 60 * 5, // 5 minute cache
  });
}
```

### 2. Improved Upload Status Component
```typescript
// components/UploadStatus.tsx
useEffect(() => {
  if (!docId || status === 'ready') return;

  const pollInterval = setInterval(async () => {
    console.log(`Polling document ${docId} - attempt ${pollCount + 1}`);
    const result = await refetch();
    setPollCount(prev => prev + 1);
    
    if (result.data) {
      console.log('Poll result:', result.data);
    }
  }, 3000);

  // Cleanup after 10 minutes
  const timeout = setTimeout(() => {
    clearInterval(pollInterval);
    if (status === 'processing') {
      setStatus('error');
    }
  }, 600000);

  return () => {
    clearInterval(pollInterval);
    clearTimeout(timeout);
  };
}, [docId, refetch, status, pollCount]);
```

### 3. Manual Refresh Button
Added refresh button to document info card:
```typescript
const handleRefreshDocument = async () => {
  try {
    await refetchDocument();
    toast.success('Document status refreshed');
  } catch (error) {
    toast.error('Failed to refresh document status');
  }
};
```

### 4. Debug Information Panel
Added development-only debug panel to monitor real-time data:
```typescript
{process.env.NODE_ENV === 'development' && (
  <DocumentDebugInfo
    document={document}
    isLoading={docLoading}
    onRefresh={handleRefreshDocument}
  />
)}
```

## Testing Steps

### 1. Upload a Document
1. Go to dashboard
2. Upload a PDF file
3. Watch the upload progress
4. Monitor the UploadStatus component

### 2. Check Console Logs
Open browser DevTools and look for:
```
Polling document {docId} - attempt 1
Document updated: { doc_id: "...", chunk_count: 0, title: "..." }
Poll result: { chunk_count: 5, ... }
Document processing complete! Chunks: 5
```

### 3. Use Debug Panel
In development mode, the orange debug panel shows:
- Real-time document data
- Chunk count updates
- Last refresh timestamp
- Force refresh button

### 4. Manual Testing
- Click the refresh button (↻) in document header
- Check if chunk count updates
- Verify auto-polling is working

## Common Issues & Solutions

### Issue 1: Polling Not Starting
**Symptoms**: No console logs, chunk count never updates
**Solution**: Check that `docId` is valid and `refetchInterval` is configured

### Issue 2: Stale Cache Data
**Symptoms**: Old data persists, refresh shows correct data
**Solution**: Set `staleTime: 0` and use manual refresh

### Issue 3: Backend Processing Delay
**Symptoms**: Document uploaded but backend still processing
**Solution**: Increase polling timeout, check backend logs

### Issue 4: React Query Version Issues
**Symptoms**: `cacheTime` errors, refetch not working
**Solution**: Use `gcTime` instead of `cacheTime` for newer versions

## Debugging Commands

### Check Document Status Manually
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:8000/api/documents/YOUR_DOC_ID
```

### Monitor Network Requests
1. Open DevTools → Network tab
2. Filter by "documents"
3. Watch for GET requests every 3 seconds
4. Check response data for chunk_count

### React Query DevTools
Install React Query DevTools for better debugging:
```bash
npm install @tanstack/react-query-devtools
```

## Prevention

### 1. Proper Error Handling
Always handle polling errors gracefully:
```typescript
try {
  await refetch();
} catch (error) {
  console.error('Polling error:', error);
  // Don't stop polling on network errors
}
```

### 2. Timeout Protection
Prevent infinite polling:
```typescript
const timeout = setTimeout(() => {
  clearInterval(pollInterval);
  setStatus('error');
}, 600000); // 10 minutes max
```

### 3. User Feedback
Always provide visual feedback:
- Loading states
- Progress indicators
- Error messages
- Success notifications

## Monitoring

### Key Metrics to Track
1. **Polling Frequency**: Should be every 3 seconds
2. **Processing Time**: How long until chunk_count > 0
3. **Error Rate**: Failed polling attempts
4. **User Actions**: Manual refresh usage

### Console Logging
Enable detailed logging in development:
```typescript
console.log('Document updated:', {
  doc_id: document.doc_id,
  chunk_count: document.chunk_count,
  timestamp: new Date().toISOString()
});
```

## Next Steps

If issues persist:
1. Check backend processing logs
2. Verify API endpoint responses
3. Test with different file sizes
4. Monitor network connectivity
5. Check React Query configuration

The implemented solution should resolve the chunk count display issue by ensuring real-time updates through proper polling and cache management.

