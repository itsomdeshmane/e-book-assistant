'use client';

import { useEffect, useState } from 'react';
import { useDocument } from '@/hooks/use-api';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle, Clock, FileText, AlertCircle, RefreshCw, MessageSquare } from 'lucide-react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';

interface UploadStatusProps {
  docId: string | number;
  onProcessingComplete?: () => void;
  showNavigateButton?: boolean;
}

type ProcessingStatus = 'uploading' | 'processing' | 'ready' | 'error';

interface StatusInfo {
  message: string;
  icon: React.ReactNode;
  color: string;
  progress?: number;
}

export function UploadStatus({ 
  docId, 
  onProcessingComplete, 
  showNavigateButton = true 
}: UploadStatusProps) {
  const router = useRouter();
  const { data: document, isLoading, error, refetch } = useDocument(docId);
  const [status, setStatus] = useState<ProcessingStatus>('processing');
  const [pollCount, setPollCount] = useState(0);
  const [estimatedChunks, setEstimatedChunks] = useState<number | null>(null);

  // Estimate chunks based on file size (rough calculation)
  const estimateChunks = (fileSize?: number) => {
    if (!fileSize) return null;
    // Rough estimate: 1 chunk per ~1000 characters, average PDF page ~2000 chars
    const avgCharsPerMB = 500000; // Approximate characters per MB for PDF
    const charsPerChunk = 1000;
    return Math.ceil((fileSize * avgCharsPerMB) / charsPerChunk);
  };

  useEffect(() => {
    if (!docId) return;
    
    // Don't start polling if already processed
    if (status === 'ready') return;

    const pollInterval = setInterval(async () => {
      try {
        console.log(`Polling document ${docId} - attempt ${pollCount + 1}`);
        const result = await refetch();
        setPollCount(prev => prev + 1);
        
        // Force a small delay to ensure state updates
        setTimeout(() => {
          if (result.data) {
            console.log('Poll result:', result.data);
          }
        }, 100);
      } catch (error) {
        console.error('Error polling document status:', error);
        setStatus('error');
      }
    }, 3000); // Poll every 3 seconds for responsive updates

    // Cleanup interval after 10 minutes to prevent infinite polling
    const timeout = setTimeout(() => {
      clearInterval(pollInterval);
      if (status === 'processing') {
        console.warn('Processing timeout reached, stopping polling');
        setStatus('error');
      }
    }, 600000); // 10 minutes

    return () => {
      clearInterval(pollInterval);
      clearTimeout(timeout);
    };
  }, [docId, refetch, status, pollCount]);

  useEffect(() => {
    if (document) {
      console.log('Document updated:', document);
      
      // Estimate chunks if we don't have the info yet
      if (!estimatedChunks && document.chunk_count === 0) {
        // Try to estimate based on any available file size info
        setEstimatedChunks(estimateChunks());
      }

      // Check if processing is complete
      if (document.chunk_count > 0) {
        console.log(`Document processing complete! Chunks: ${document.chunk_count}`);
        setStatus('ready');
        onProcessingComplete?.();
      } else if (error) {
        console.log('Document processing error:', error);
        setStatus('error');
      } else {
        console.log('Document still processing...');
        setStatus('processing');
      }
    }
  }, [document, error, estimatedChunks, onProcessingComplete]);

  const getStatusInfo = (): StatusInfo => {
    switch (status) {
      case 'processing':
        const currentChunks = document?.chunk_count || 0;
        const totalChunks = estimatedChunks || 100; // Default estimate
        const progress = estimatedChunks 
          ? Math.min((currentChunks / totalChunks) * 100, 95) // Cap at 95% until complete
          : Math.min(pollCount * 10, 90); // Fallback progress based on poll count

        return {
          message: currentChunks > 0 
            ? `Processing document... ${currentChunks} chunks processed`
            : 'Processing document...',
          icon: <Clock className="h-5 w-5 animate-pulse" />,
          color: 'text-blue-600',
          progress: progress
        };

      case 'ready':
        return {
          message: `✅ Document is ready! ${document?.chunk_count || 0} chunks processed`,
          icon: <CheckCircle className="h-5 w-5" />,
          color: 'text-green-600',
          progress: 100
        };

      case 'error':
        return {
          message: '❌ Processing failed. Please try uploading again.',
          icon: <AlertCircle className="h-5 w-5" />,
          color: 'text-red-600'
        };

      default:
        return {
          message: 'Initializing...',
          icon: <RefreshCw className="h-5 w-5 animate-spin" />,
          color: 'text-gray-600'
        };
    }
  };

  const statusInfo = getStatusInfo();

  const handleNavigateToChat = () => {
    if (document) {
      router.push(`/chat/${document.doc_id || document.id}`);
    }
  };

  const handleRetry = async () => {
    setStatus('processing');
    setPollCount(0);
    await refetch();
  };

  if (isLoading && !document) {
    return (
      <Card className="w-full">
        <CardContent className="p-4">
          <div className="flex items-center space-x-3">
            <RefreshCw className="h-5 w-5 animate-spin text-gray-400" />
            <span className="text-sm text-gray-600">Loading document info...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="w-full border-l-4 border-l-blue-500">
        <CardContent className="p-4 space-y-4">
          {/* Document Info */}
          {document && (
            <div className="flex items-center space-x-3">
              <div className="bg-blue-100 p-2 rounded-lg">
                <FileText className="h-4 w-4 text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {document.title || document.filename}
                </p>
                <p className="text-xs text-gray-500">
                  Document ID: {document.doc_id || document.id}
                </p>
              </div>
            </div>
          )}

          {/* Status Display */}
          <div className="flex items-center space-x-3">
            <div className={statusInfo.color}>
              {statusInfo.icon}
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900">
                {statusInfo.message}
              </p>
              {status === 'processing' && (
                <p className="text-xs text-gray-500 mt-1">
                  This may take a few minutes for large documents
                </p>
              )}
            </div>
            <Badge 
              variant={status === 'ready' ? 'default' : status === 'error' ? 'destructive' : 'secondary'}
            >
              {status === 'ready' ? 'Ready' : status === 'error' ? 'Error' : 'Processing'}
            </Badge>
          </div>

          {/* Progress Bar */}
          {statusInfo.progress !== undefined && (
            <div className="space-y-2">
              <Progress value={statusInfo.progress} className="h-2" />
              <div className="flex justify-between text-xs text-gray-500">
                <span>
                  {document?.chunk_count || 0} chunks processed
                </span>
                <span>{Math.round(statusInfo.progress)}%</span>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex space-x-2">
            {status === 'ready' && showNavigateButton && (
              <Button 
                onClick={handleNavigateToChat}
                className="flex-1"
              >
                <MessageSquare className="h-4 w-4 mr-2" />
                Start Chatting
              </Button>
            )}
            
            {status === 'error' && (
              <Button 
                onClick={handleRetry}
                variant="outline"
                className="flex-1"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Retry Processing
              </Button>
            )}

            {status === 'processing' && (
              <Button 
                onClick={handleRetry}
                variant="ghost"
                size="sm"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh Status
              </Button>
            )}
          </div>

          {/* Processing Info */}
          {status === 'processing' && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="flex items-start space-x-2">
                <Clock className="h-4 w-4 text-blue-600 mt-0.5" />
                <div className="text-sm text-blue-800">
                  <p className="font-medium mb-1">Processing in progress</p>
                  <ul className="text-xs space-y-1 text-blue-700">
                    <li>• Extracting text from PDF pages</li>
                    <li>• Creating searchable chunks</li>
                    <li>• Building vector embeddings</li>
                    <li>• Large files may take several minutes</li>
                  </ul>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
