'use client';

import React from 'react';
import { PdfUploader } from './PdfUploader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';

interface Document {
  id: string;
  doc_id: string;
  title: string;
  filename: string;
  chunk_count: number;
  status: 'uploading' | 'processing' | 'processed' | 'error';
  created_at: string;
}

export function PdfUploaderExample() {
  const handleDocumentCreated = (docId: string) => {
    console.log('Document created with ID:', docId);
    toast.info(`Document created: ${docId}`);
    
    // You can perform additional actions here, such as:
    // - Adding the document to a list
    // - Navigating to a processing page
    // - Updating global state
  };

  const handleDocumentProcessed = (document: Document) => {
    console.log('Document processed:', document);
    toast.success(`Document "${document.filename}" is ready with ${document.chunk_count} chunks!`);
    
    // You can perform additional actions here, such as:
    // - Redirecting to chat page
    // - Updating document list
    // - Enabling document-specific features
    
    // Example: Navigate to chat
    // router.push(`/chat/${document.doc_id}`);
  };

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>PDF Document Uploader</CardTitle>
        </CardHeader>
        <CardContent>
          <PdfUploader
            onCreated={handleDocumentCreated}
            onProcessed={handleDocumentProcessed}
            maxSizeMB={50}
            className="w-full"
          />
        </CardContent>
      </Card>

      {/* Usage Instructions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">How to Use</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-gray-600">
          <p>1. <strong>Select or drag</strong> a PDF file (max 50MB)</p>
          <p>2. <strong>Preview</strong> the first page thumbnail</p>
          <p>3. <strong>Upload</strong> and watch real-time progress</p>
          <p>4. <strong>Wait</strong> for processing with exponential backoff polling</p>
          <p>5. <strong>Get notified</strong> when document is ready for chat</p>
        </CardContent>
      </Card>
    </div>
  );
}

// Alternative minimal usage example
export function MinimalPdfUploaderExample() {
  return (
    <PdfUploader
      onCreated={(docId) => console.log('Created:', docId)}
      onProcessed={(doc) => console.log('Processed:', doc)}
      maxSizeMB={25}
    />
  );
}

