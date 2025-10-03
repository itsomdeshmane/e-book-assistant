'use client';

import { useCallback, useState } from 'react';
import { Upload, File, X, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { useUploadDocument } from '@/hooks/use-api';
import { UploadStatus } from '@/components/UploadStatus';
import { toast } from 'sonner';

interface FileUploaderProps {
  onUploadComplete?: () => void;
}

export function FileUploader({ onUploadComplete }: FileUploaderProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadedDocId, setUploadedDocId] = useState<string | null>(null);
  const [uploadPhase, setUploadPhase] = useState<'idle' | 'uploading' | 'processing' | 'complete'>('idle');
  const uploadMutation = useUploadDocument();

  // File size thresholds (in MB)
  const LARGE_FILE_THRESHOLD = 10;
  const MAX_FILE_SIZE = 100;

  const handleFileSelect = useCallback((file: File) => {
    // Validate filename extension
    if (!file.name || !file.name.toLowerCase().endsWith('.pdf')) {
      toast.error('Only PDF files are supported');
      return;
    }

    // Validate MIME type
    const allowedTypes = ['application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Please select a valid PDF file');
      return;
    }

    const fileSizeMB = file.size / 1024 / 1024;
    
    if (fileSizeMB > MAX_FILE_SIZE) {
      toast.error(`File too large. Maximum size is ${MAX_FILE_SIZE}MB`);
      return;
    }

    if (fileSizeMB > LARGE_FILE_THRESHOLD) {
      toast.info(`Large file detected (${fileSizeMB.toFixed(1)}MB). Processing may take several minutes.`);
    }

    setSelectedFile(file);
    setUploadPhase('idle');
    setUploadedDocId(null);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) {
        handleFileSelect(file);
      }
    },
    [handleFileSelect]
  );

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        handleFileSelect(file);
      }
    },
    [handleFileSelect]
  );

  const handleUpload = async () => {
    if (!selectedFile) return;

    setUploadPhase('uploading');

    try {
      const response = await uploadMutation.mutateAsync({
        file: selectedFile,
        onUploadProgress: (progressEvent) => {
          const progress = progressEvent.total
            ? Math.round((progressEvent.loaded * 100) / progressEvent.total)
            : 0;
          setUploadProgress(progress);
        },
      });

      // Upload completed, now start processing phase
      setUploadPhase('processing');
      setUploadedDocId(response.doc_id);
      setUploadProgress(0);
      
      const fileSizeMB = selectedFile.size / 1024 / 1024;
      if (fileSizeMB > LARGE_FILE_THRESHOLD) {
        toast.success('Upload complete! Processing large file - this may take several minutes.');
      } else {
        toast.success('Upload complete! Processing document...');
      }

    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to upload document');
      setUploadProgress(0);
      setUploadPhase('idle');
    }
  };

  const handleProcessingComplete = () => {
    setUploadPhase('complete');
    toast.success('Document ready for chat!');
    onUploadComplete?.();
  };

  const handleStartOver = () => {
    setSelectedFile(null);
    setUploadProgress(0);
    setUploadedDocId(null);
    setUploadPhase('idle');
  };

  const getFileSizeInfo = (file: File) => {
    const sizeMB = file.size / 1024 / 1024;
    const isLarge = sizeMB > LARGE_FILE_THRESHOLD;
    return { sizeMB, isLarge };
  };

  return (
    <div className="space-y-4">
      {/* Upload Area - Hide when processing or complete */}
      {uploadPhase === 'idle' && (
        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-500 transition-colors cursor-pointer"
        >
          <input
            type="file"
            id="file-upload"
            className="hidden"
            accept=".pdf"
            onChange={handleFileInputChange}
          />
          <label
            htmlFor="file-upload"
            className="cursor-pointer flex flex-col items-center space-y-2"
          >
            <Upload className="h-12 w-12 text-gray-400" />
            <div className="text-sm text-gray-600">
              <span className="font-semibold text-blue-600">Click to upload</span> or drag and drop
            </div>
            <div className="text-xs text-gray-500">
              PDF files only • Max {MAX_FILE_SIZE}MB
            </div>
          </label>
        </div>
      )}

      {/* File Selection and Upload Phase */}
      {selectedFile && uploadPhase === 'idle' && (
        <div className="bg-gray-50 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <File className="h-5 w-5 text-blue-600" />
              <div className="flex-1">
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-medium text-gray-900">{selectedFile.name}</span>
                  {getFileSizeInfo(selectedFile).isLarge && (
                    <Badge variant="outline" className="text-xs">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      Large File
                    </Badge>
                  )}
                </div>
                <span className="text-xs text-gray-500">
                  {getFileSizeInfo(selectedFile).sizeMB.toFixed(2)} MB
                </span>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedFile(null)}
              disabled={uploadMutation.isPending}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {getFileSizeInfo(selectedFile).isLarge && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <div className="flex items-start space-x-2">
                <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5" />
                <div className="text-sm text-yellow-800">
                  <p className="font-medium">Large file detected</p>
                  <p className="text-xs mt-1">
                    Processing may take several minutes. You'll see real-time progress updates.
                  </p>
                </div>
              </div>
            </div>
          )}

          <Button
            onClick={handleUpload}
            disabled={uploadMutation.isPending}
            className="w-full"
          >
            {uploadMutation.isPending ? 'Uploading...' : 'Upload & Process'}
          </Button>
        </div>
      )}

      {/* Upload Progress */}
      {uploadPhase === 'uploading' && (
        <div className="bg-blue-50 rounded-lg p-4 space-y-3">
          <div className="flex items-center space-x-3">
            <File className="h-5 w-5 text-blue-600" />
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900">
                Uploading {selectedFile?.name}...
              </p>
              <p className="text-xs text-gray-500">
                {uploadProgress}% complete
              </p>
            </div>
          </div>
          <Progress value={uploadProgress} className="h-2" />
        </div>
      )}

      {/* Processing Status */}
      {uploadPhase === 'processing' && uploadedDocId && (
        <UploadStatus 
          docId={uploadedDocId} 
          onProcessingComplete={handleProcessingComplete}
          showNavigateButton={false}
        />
      )}

      {/* Completion Status */}
      {uploadPhase === 'complete' && uploadedDocId && (
        <div className="space-y-3">
          <UploadStatus 
            docId={uploadedDocId} 
            onProcessingComplete={handleProcessingComplete}
            showNavigateButton={true}
          />
          <Button 
            onClick={handleStartOver}
            variant="outline"
            className="w-full"
          >
            Upload Another Document
          </Button>
        </div>
      )}
    </div>
  );
}