'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Upload, File, X, CheckCircle, AlertCircle, Eye, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

// PDF.js types (install with: npm install pdfjs-dist @types/pdfjs-dist)
import * as pdfjsLib from 'pdfjs-dist';
import 'pdfjs-dist/build/pdf.worker.entry';

interface Document {
  id: string;
  doc_id: string;
  title: string;
  filename: string;
  chunk_count: number;
  status: 'uploading' | 'processing' | 'processed' | 'error';
  created_at: string;
}

interface PdfUploaderProps {
  onCreated?: (docId: string) => void;
  onProcessed?: (document: Document) => void;
  maxSizeMB?: number;
  className?: string;
}

interface UploadResponse {
  doc_id: string;
  message?: string;
}

export function PdfUploader({ 
  onCreated, 
  onProcessed, 
  maxSizeMB = 50,
  className = '' 
}: PdfUploaderProps) {
  // State management
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [thumbnail, setThumbnail] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [status, setStatus] = useState<'idle' | 'uploading' | 'processing' | 'processed' | 'error'>('idle');
  const [docId, setDocId] = useState<string | null>(null);
  const [document, setDocument] = useState<Document | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [pollAttempt, setPollAttempt] = useState(0);
  
  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollTimeoutRef.current) {
        clearTimeout(pollTimeoutRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Generate PDF thumbnail
  const generateThumbnail = useCallback(async (file: File): Promise<string | null> => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const page = await pdf.getPage(1);
      
      const scale = 0.5;
      const viewport = page.getViewport({ scale });
      
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      
      if (!context) return null;
      
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      
      await page.render({
        canvasContext: context,
        viewport: viewport,
      }).promise;
      
      return canvas.toDataURL('image/jpeg', 0.8);
    } catch (error) {
      console.warn('Failed to generate PDF thumbnail:', error);
      return null;
    }
  }, []);

  // File validation
  const validateFile = useCallback((file: File): string | null => {
    // Validate filename extension
    if (!file.name || !file.name.toLowerCase().endsWith('.pdf')) {
      return 'Only PDF files are supported';
    }
    
    // Validate MIME type
    const allowedTypes = ['application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      return 'Please select a valid PDF file';
    }
    
    const sizeMB = file.size / (1024 * 1024);
    if (sizeMB > maxSizeMB) {
      return `File size must be less than ${maxSizeMB}MB`;
    }
    
    return null;
  }, [maxSizeMB]);

  // Handle file selection
  const handleFileSelect = useCallback(async (file: File) => {
    const error = validateFile(file);
    if (error) {
      toast.error(error);
      return;
    }

    setSelectedFile(file);
    setStatus('idle');
    setUploadProgress(0);
    setDocId(null);
    setDocument(null);
    setPollAttempt(0);

    // Generate thumbnail
    const thumbnailUrl = await generateThumbnail(file);
    setThumbnail(thumbnailUrl);
  }, [validateFile, generateThumbnail]);

  // Drag and drop handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  }, [handleFileSelect]);

  // File input change handler
  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  }, [handleFileSelect]);

  // Exponential backoff calculation
  const getBackoffDelay = useCallback((attempt: number): number => {
    const delays = [1000, 2000, 4000, 8000, 10000]; // 1s, 2s, 4s, 8s, 10s
    return delays[Math.min(attempt, delays.length - 1)];
  }, []);

  // Poll document status with exponential backoff
  const pollDocumentStatus = useCallback(async (docId: string, attempt: number = 0) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get<Document>(`/api/documents/${docId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const doc = response.data;
      setDocument(doc);

      if (doc.status === 'processed' || doc.chunk_count > 0) {
        setStatus('processed');
        toast.success('Document processed successfully!');
        onProcessed?.(doc);
        return;
      }

      if (doc.status === 'error') {
        setStatus('error');
        toast.error('Document processing failed');
        return;
      }

      // Continue polling with exponential backoff
      const delay = getBackoffDelay(attempt);
      setPollAttempt(attempt + 1);
      
      pollTimeoutRef.current = setTimeout(() => {
        pollDocumentStatus(docId, attempt + 1);
      }, delay);

    } catch (error) {
      console.error('Polling error:', error);
      
      // Retry with exponential backoff, max 10 attempts
      if (attempt < 10) {
        const delay = getBackoffDelay(attempt);
        setPollAttempt(attempt + 1);
        
        pollTimeoutRef.current = setTimeout(() => {
          pollDocumentStatus(docId, attempt + 1);
        }, delay);
      } else {
        setStatus('error');
        toast.error('Failed to check document status');
      }
    }
  }, [getBackoffDelay, onProcessed]);

  // Upload file
  const handleUpload = useCallback(async () => {
    if (!selectedFile) return;

    setStatus('uploading');
    setUploadProgress(0);

    // Create abort controller for cancellation
    abortControllerRef.current = new AbortController();

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const token = localStorage.getItem('token');
      
      const response = await axios.post<UploadResponse>('/api/documents/upload', formData, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setUploadProgress(progress);
          }
        },
        signal: abortControllerRef.current.signal,
      });

      const { doc_id } = response.data;
      setDocId(doc_id);
      setStatus('processing');
      setUploadProgress(100);
      
      toast.success('Upload complete! Processing document...');
      onCreated?.(doc_id);

      // Start polling for processing status
      setPollAttempt(0);
      pollDocumentStatus(doc_id, 0);

    } catch (error: any) {
      if (axios.isCancel(error)) {
        toast.info('Upload cancelled');
        setStatus('idle');
      } else {
        console.error('Upload error:', error);
        setStatus('error');
        toast.error(error.response?.data?.message || 'Upload failed');
      }
      setUploadProgress(0);
    }
  }, [selectedFile, onCreated, pollDocumentStatus]);

  // Cancel upload
  const handleCancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    if (pollTimeoutRef.current) {
      clearTimeout(pollTimeoutRef.current);
    }
    setStatus('idle');
    setUploadProgress(0);
    setDocId(null);
    setDocument(null);
    setPollAttempt(0);
  }, []);

  // Reset component
  const handleReset = useCallback(() => {
    handleCancel();
    setSelectedFile(null);
    setThumbnail(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [handleCancel]);

  // Get status info for display
  const getStatusInfo = () => {
    switch (status) {
      case 'uploading':
        return {
          message: 'Uploading file...',
          icon: <Upload className="h-5 w-5 animate-pulse text-blue-600" />,
          color: 'text-blue-600',
        };
      case 'processing':
        return {
          message: `Processing document... (attempt ${pollAttempt + 1})`,
          icon: <RefreshCw className="h-5 w-5 animate-spin text-yellow-600" />,
          color: 'text-yellow-600',
        };
      case 'processed':
        return {
          message: 'Document ready!',
          icon: <CheckCircle className="h-5 w-5 text-green-600" />,
          color: 'text-green-600',
        };
      case 'error':
        return {
          message: 'Processing failed',
          icon: <AlertCircle className="h-5 w-5 text-red-600" />,
          color: 'text-red-600',
        };
      default:
        return null;
    }
  };

  const statusInfo = getStatusInfo();

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Upload Area */}
      {!selectedFile && (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={`
            border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
            ${isDragOver 
              ? 'border-blue-500 bg-blue-50' 
              : 'border-gray-300 hover:border-blue-400'
            }
          `}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            onChange={handleFileInputChange}
            className="hidden"
          />
          
          <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <div className="text-sm text-gray-600">
            <span className="font-semibold text-blue-600">Click to upload</span> or drag and drop
          </div>
          <div className="text-xs text-gray-500 mt-1">
            PDF files only • Max {maxSizeMB}MB
          </div>
        </div>
      )}

      {/* Selected File Preview */}
      {selectedFile && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start space-x-4">
              {/* Thumbnail */}
              <div className="flex-shrink-0">
                {thumbnail ? (
                  <div className="relative">
                    <img
                      src={thumbnail}
                      alt="PDF preview"
                      className="w-16 h-20 object-cover rounded border"
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 rounded opacity-0 hover:opacity-100 transition-opacity">
                      <Eye className="h-4 w-4 text-white" />
                    </div>
                  </div>
                ) : (
                  <div className="w-16 h-20 bg-gray-100 rounded border flex items-center justify-center">
                    <File className="h-6 w-6 text-gray-400" />
                  </div>
                )}
              </div>

              {/* File Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-gray-900 truncate">
                    {selectedFile.name}
                  </h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleReset}
                    disabled={status === 'uploading'}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                
                <div className="flex items-center space-x-2 mb-3">
                  <span className="text-xs text-gray-500">
                    {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                  </span>
                  {status !== 'idle' && (
                    <Badge variant={status === 'processed' ? 'default' : status === 'error' ? 'destructive' : 'secondary'}>
                      {status}
                    </Badge>
                  )}
                </div>

                {/* Status Display */}
                {statusInfo && (
                  <div className="flex items-center space-x-2 mb-3">
                    {statusInfo.icon}
                    <span className={`text-sm ${statusInfo.color}`}>
                      {statusInfo.message}
                    </span>
                  </div>
                )}

                {/* Progress Bar */}
                {(status === 'uploading' || (status === 'processing' && uploadProgress > 0)) && (
                  <div className="mb-3">
                    <Progress value={uploadProgress} className="h-2" />
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>
                        {status === 'uploading' ? 'Uploading' : 'Processing'}
                      </span>
                      <span>{uploadProgress}%</span>
                    </div>
                  </div>
                )}

                {/* Document Info */}
                {document && (
                  <div className="text-xs text-gray-500 mb-3">
                    <div>Document ID: {document.doc_id}</div>
                    {document.chunk_count > 0 && (
                      <div>Chunks processed: {document.chunk_count}</div>
                    )}
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex space-x-2">
                  {status === 'idle' && (
                    <Button onClick={handleUpload} className="flex-1">
                      <Upload className="h-4 w-4 mr-2" />
                      Upload & Process
                    </Button>
                  )}
                  
                  {(status === 'uploading' || status === 'processing') && (
                    <Button onClick={handleCancel} variant="outline" className="flex-1">
                      Cancel
                    </Button>
                  )}
                  
                  {status === 'error' && (
                    <Button onClick={handleUpload} variant="outline" className="flex-1">
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Retry
                    </Button>
                  )}
                  
                  {status === 'processed' && (
                    <Button onClick={handleReset} variant="outline" className="flex-1">
                      Upload Another
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

