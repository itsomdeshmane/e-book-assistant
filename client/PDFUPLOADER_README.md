# PdfUploader Component

A comprehensive TypeScript React component for uploading PDF files with real-time processing status, thumbnail preview, and exponential backoff polling.

## Features

- ✅ **Drag & Drop + File Input**: Multiple ways to select files
- ✅ **PDF Thumbnail Preview**: Shows first page using PDF.js
- ✅ **File Validation**: Type and size validation with clear error messages
- ✅ **Upload Progress**: Real-time progress bar during upload
- ✅ **Exponential Backoff Polling**: Smart polling with 1s, 2s, 4s, 8s, 10s intervals
- ✅ **Status Management**: Complete state management for upload lifecycle
- ✅ **Toast Notifications**: User-friendly notifications for all states
- ✅ **Callbacks**: `onCreated` and `onProcessed` for integration
- ✅ **Cancellation**: Ability to cancel uploads and polling
- ✅ **Error Handling**: Comprehensive error states and retry functionality

## Installation

### 1. Install Dependencies

```bash
npm install pdfjs-dist @types/pdfjs-dist axios sonner
```

### 2. Configure PDF.js Worker

Add to your `next.config.js`:

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      canvas: false,
    };
    return config;
  },
};

module.exports = nextConfig;
```

### 3. Add Required UI Components

Ensure you have these shadcn/ui components installed:

```bash
npx shadcn-ui@latest add button card progress badge
```

## API Endpoints Required

### Upload Endpoint
```
POST /api/documents/upload
Content-Type: multipart/form-data
Authorization: Bearer <token>

Response: { doc_id: string }
```

### Status Polling Endpoint
```
GET /api/documents/{doc_id}
Authorization: Bearer <token>

Response: {
  id: string;
  doc_id: string;
  title: string;
  filename: string;
  chunk_count: number;
  status: 'uploading' | 'processing' | 'processed' | 'error';
  created_at: string;
}
```

## Usage

### Basic Usage

```tsx
import { PdfUploader } from '@/components/PdfUploader';

function MyComponent() {
  const handleCreated = (docId: string) => {
    console.log('Document created:', docId);
  };

  const handleProcessed = (document: Document) => {
    console.log('Document processed:', document);
    // Navigate to chat or update UI
  };

  return (
    <PdfUploader
      onCreated={handleCreated}
      onProcessed={handleProcessed}
      maxSizeMB={50}
    />
  );
}
```

### Advanced Usage with Navigation

```tsx
import { useRouter } from 'next/navigation';
import { PdfUploader } from '@/components/PdfUploader';

function DocumentUploadPage() {
  const router = useRouter();

  return (
    <PdfUploader
      onCreated={(docId) => {
        // Document upload started
        console.log('Upload started for:', docId);
      }}
      onProcessed={(document) => {
        // Document ready - navigate to chat
        router.push(`/chat/${document.doc_id}`);
      }}
      maxSizeMB={100}
      className="max-w-2xl mx-auto"
    />
  );
}
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `onCreated` | `(docId: string) => void` | - | Called when upload completes and doc_id is received |
| `onProcessed` | `(document: Document) => void` | - | Called when document processing is complete |
| `maxSizeMB` | `number` | `50` | Maximum file size in megabytes |
| `className` | `string` | `''` | Additional CSS classes |

## Component States

1. **Idle**: Ready to accept file selection
2. **Uploading**: File upload in progress with progress bar
3. **Processing**: Document processing with exponential backoff polling
4. **Processed**: Document ready with success state
5. **Error**: Error state with retry option

## Polling Strategy

The component uses exponential backoff for efficient polling:

- **Attempt 1**: 1 second delay
- **Attempt 2**: 2 seconds delay  
- **Attempt 3**: 4 seconds delay
- **Attempt 4**: 8 seconds delay
- **Attempt 5+**: 10 seconds delay (max)

Polling stops when:
- Document status becomes 'processed' or chunk_count > 0
- Error state is reached
- Maximum attempts (10) exceeded
- Component is unmounted

## Error Handling

The component handles various error scenarios:

- **Invalid file type**: Shows toast error
- **File too large**: Shows size limit error
- **Upload failure**: Shows retry option
- **Network errors**: Automatic retry with exponential backoff
- **Processing timeout**: Graceful degradation after max attempts

## Styling

The component uses Tailwind CSS classes and is fully responsive. Key styling features:

- **Drag & Drop Area**: Visual feedback for drag states
- **Thumbnail Preview**: PDF first page preview with hover effects
- **Progress Indicators**: Animated progress bars and status icons
- **Status Badges**: Color-coded status indicators
- **Responsive Design**: Works on mobile and desktop

## Customization

### Custom Styling

```tsx
<PdfUploader
  className="border-2 border-blue-500 rounded-xl p-6"
  // ... other props
/>
```

### Custom Size Limits

```tsx
<PdfUploader
  maxSizeMB={25} // 25MB limit
  // ... other props
/>
```

## Troubleshooting

### PDF.js Issues

If you encounter PDF.js worker issues:

1. Ensure PDF.js is properly configured in `next.config.js`
2. Check that the worker file is accessible
3. Verify canvas polyfill is disabled for server-side rendering

### Authentication Issues

Ensure your axios interceptors or auth headers are properly configured:

```typescript
// In your API setup
axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
```

### Polling Not Working

1. Verify the GET endpoint returns correct document structure
2. Check that `chunk_count` or `status` fields are being updated
3. Ensure proper error handling in your backend

## Performance Considerations

- **Thumbnail Generation**: Happens client-side, may be slow for large PDFs
- **Memory Usage**: PDF.js loads entire file into memory for thumbnail
- **Network Usage**: Exponential backoff minimizes unnecessary requests
- **Cleanup**: Component properly cleans up timeouts and abort controllers

## Browser Support

- **Modern Browsers**: Chrome, Firefox, Safari, Edge (latest versions)
- **PDF.js Support**: Requires browsers that support Canvas API
- **File API**: Requires drag & drop and File API support

