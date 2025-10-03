import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import { GetServerSideProps } from 'next';
import axios from 'axios';
import { toast } from 'sonner';
import { 
  Clock, 
  CheckCircle, 
  AlertCircle, 
  RefreshCw, 
  FileText, 
  Eye, 
  Calendar,
  Hash,
  TrendingUp,
  Image as ImageIcon,
  Edit3
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { OcrReviewModal } from '@/components/OcrReviewModal';

// Types
interface Document {
  id: string;
  doc_id: string;
  title: string;
  filename: string;
  chunk_count: number;
  status: 'uploading' | 'processing' | 'processed' | 'error';
  created_at: string;
  updated_at?: string;
}

interface PageMetadata {
  page_number: number;
  source: string;
  confidence: number;
  snippet: string;
  image_url?: string;
  raw_text?: string;
  bbox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

interface DebugResponse {
  doc_id: string;
  total_pages: number;
  pages: PageMetadata[];
  processing_info?: {
    ocr_engine: string;
    processing_time: number;
    total_confidence: number;
  };
}

interface DocumentPageProps {
  docId: string;
}

export default function DocumentPage({ docId }: DocumentPageProps) {
  const router = useRouter();
  
  // State management
  const [document, setDocument] = useState<Document | null>(null);
  const [debugData, setDebugData] = useState<DebugResponse | null>(null);
  const [isLoadingDoc, setIsLoadingDoc] = useState(true);
  const [isLoadingPages, setIsLoadingPages] = useState(false);
  const [pagesLoaded, setPagesLoaded] = useState(false);
  const [pollAttempt, setPollAttempt] = useState(0);
  const [selectedPage, setSelectedPage] = useState<PageMetadata | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Polling timeout ref
  const pollTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  // Exponential backoff delays
  const getBackoffDelay = useCallback((attempt: number): number => {
    const delays = [1000, 2000, 4000, 8000, 10000]; // 1s, 2s, 4s, 8s, 10s
    return delays[Math.min(attempt, delays.length - 1)];
  }, []);

  // Fetch document data
  const fetchDocument = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get<Document>(`/api/documents/${docId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setDocument(response.data);
      return response.data;
    } catch (error: any) {
      console.error('Error fetching document:', error);
      toast.error('Failed to load document');
      throw error;
    }
  }, [docId]);

  // Poll document status with exponential backoff
  const pollDocumentStatus = useCallback(async (attempt: number = 0) => {
    try {
      const doc = await fetchDocument();
      
      if (doc.status === 'processed' || doc.chunk_count > 0) {
        toast.success('Document processing complete!');
        return;
      }

      if (doc.status === 'error') {
        toast.error('Document processing failed');
        return;
      }

      // Continue polling with exponential backoff
      const delay = getBackoffDelay(attempt);
      setPollAttempt(attempt + 1);
      
      pollTimeoutRef.current = setTimeout(() => {
        pollDocumentStatus(attempt + 1);
      }, delay);

    } catch (error) {
      // Retry with exponential backoff, max 10 attempts
      if (attempt < 10) {
        const delay = getBackoffDelay(attempt);
        setPollAttempt(attempt + 1);
        
        pollTimeoutRef.current = setTimeout(() => {
          pollDocumentStatus(attempt + 1);
        }, delay);
      } else {
        toast.error('Failed to check document status');
      }
    }
  }, [fetchDocument, getBackoffDelay]);

  // Fetch debug/page metadata
  const fetchPageMetadata = useCallback(async () => {
    setIsLoadingPages(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get<DebugResponse>(`/api/documents/debug/${docId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setDebugData(response.data);
      setPagesLoaded(true);
      toast.success(`Loaded ${response.data.pages.length} pages`);
    } catch (error: any) {
      console.error('Error fetching page metadata:', error);
      toast.error('Failed to load page metadata');
    } finally {
      setIsLoadingPages(false);
    }
  }, [docId]);

  // Initial document fetch
  useEffect(() => {
    const loadDocument = async () => {
      setIsLoadingDoc(true);
      try {
        const doc = await fetchDocument();
        
        // Start polling if not processed
        if (doc.status !== 'processed' && doc.status !== 'error' && doc.chunk_count === 0) {
          pollDocumentStatus(0);
        }
      } catch (error) {
        // Handle error
      } finally {
        setIsLoadingDoc(false);
      }
    };

    if (docId) {
      loadDocument();
    }

    // Cleanup polling on unmount
    return () => {
      if (pollTimeoutRef.current) {
        clearTimeout(pollTimeoutRef.current);
      }
    };
  }, [docId, fetchDocument, pollDocumentStatus]);

  // Handle OCR review
  const handleOcrReview = (page: PageMetadata) => {
    setSelectedPage(page);
    setIsModalOpen(true);
  };

  // Get status info for display
  const getStatusInfo = () => {
    if (!document) return null;

    switch (document.status) {
      case 'processing':
        return {
          badge: <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Processing</Badge>,
          icon: <RefreshCw className="h-4 w-4 animate-spin text-yellow-600" />,
          message: `Processing... (attempt ${pollAttempt + 1})`
        };
      case 'processed':
        return {
          badge: <Badge variant="default" className="bg-green-100 text-green-800">Processed</Badge>,
          icon: <CheckCircle className="h-4 w-4 text-green-600" />,
          message: 'Ready for use'
        };
      case 'error':
        return {
          badge: <Badge variant="destructive">Error</Badge>,
          icon: <AlertCircle className="h-4 w-4 text-red-600" />,
          message: 'Processing failed'
        };
      default:
        return {
          badge: <Badge variant="outline">Unknown</Badge>,
          icon: <Clock className="h-4 w-4 text-gray-600" />,
          message: 'Status unknown'
        };
    }
  };

  const statusInfo = getStatusInfo();

  // Get confidence color
  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-600 bg-green-50';
    if (confidence >= 0.6) return 'text-yellow-600 bg-yellow-50';
    return 'text-red-600 bg-red-50';
  };

  // Loading skeleton
  if (isLoadingDoc) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="space-y-6">
          <Skeleton className="h-8 w-64" />
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-48" />
            </CardHeader>
            <CardContent className="space-y-4">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!document) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <Card>
          <CardContent className="py-16 text-center">
            <AlertCircle className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Document not found</h3>
            <p className="text-gray-500 mb-6">The requested document could not be loaded.</p>
            <Button onClick={() => router.push('/dashboard')}>
              Back to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {document.title || document.filename}
          </h1>
          <div className="flex items-center space-x-4 text-sm text-gray-500">
            <div className="flex items-center space-x-1">
              <Calendar className="h-4 w-4" />
              <span>{new Date(document.created_at).toLocaleDateString()}</span>
            </div>
            <div className="flex items-center space-x-1">
              <FileText className="h-4 w-4" />
              <span>ID: {document.doc_id}</span>
            </div>
          </div>
        </div>
        <Button variant="outline" onClick={() => router.push('/dashboard')}>
          Back to Dashboard
        </Button>
      </div>

      {/* Document Status Card */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <FileText className="h-5 w-5" />
            <span>Document Status</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Status */}
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                {statusInfo?.icon}
                <span className="text-sm font-medium">Status</span>
              </div>
              {statusInfo?.badge}
              <p className="text-xs text-gray-500">{statusInfo?.message}</p>
            </div>

            {/* Chunk Count */}
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Hash className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium">Chunks Processed</span>
              </div>
              <div className="text-2xl font-bold text-blue-600">
                {document.chunk_count}
              </div>
              <p className="text-xs text-gray-500">
                {document.chunk_count > 0 ? 'Ready for search' : 'Processing...'}
              </p>
            </div>

            {/* Processing Progress */}
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <TrendingUp className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium">Progress</span>
              </div>
              <div className="space-y-2">
                <Progress 
                  value={document.status === 'processed' ? 100 : document.chunk_count > 0 ? 75 : 25} 
                  className="h-2" 
                />
                <p className="text-xs text-gray-500">
                  {document.status === 'processed' ? 'Complete' : 'In progress'}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Page Metadata Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center space-x-2">
              <Eye className="h-5 w-5" />
              <span>Page Analysis</span>
            </CardTitle>
            {!pagesLoaded && (
              <Button 
                onClick={fetchPageMetadata}
                disabled={isLoadingPages}
                variant="outline"
              >
                {isLoadingPages ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Loading...
                  </>
                ) : (
                  <>
                    <Eye className="h-4 w-4 mr-2" />
                    Load Pages
                  </>
                )}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isLoadingPages && (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="p-4">
                  <div className="flex space-x-4">
                    <Skeleton className="h-20 w-16" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-1/4" />
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-3/4" />
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {!pagesLoaded && !isLoadingPages && (
            <div className="text-center py-12">
              <ImageIcon className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Page Analysis Available</h3>
              <p className="text-gray-500 mb-6">
                Load detailed page-by-page analysis including OCR confidence and text snippets.
              </p>
            </div>
          )}

          {debugData && (
            <div className="space-y-4">
              {/* Summary Stats */}
              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">{debugData.total_pages}</div>
                    <div className="text-sm text-gray-600">Total Pages</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {debugData.processing_info?.total_confidence ? 
                        `${Math.round(debugData.processing_info.total_confidence * 100)}%` : 
                        'N/A'
                      }
                    </div>
                    <div className="text-sm text-gray-600">Avg Confidence</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-600">
                      {debugData.processing_info?.ocr_engine || 'Unknown'}
                    </div>
                    <div className="text-sm text-gray-600">OCR Engine</div>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Page Cards */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Page Details</h3>
                {debugData.pages.map((page) => (
                  <Card key={page.page_number} className="overflow-hidden">
                    <CardContent className="p-4">
                      <div className="flex space-x-4">
                        {/* Page Thumbnail */}
                        <div className="flex-shrink-0">
                          {page.image_url ? (
                            <img
                              src={page.image_url}
                              alt={`Page ${page.page_number}`}
                              className="w-16 h-20 object-cover rounded border"
                            />
                          ) : (
                            <div className="w-16 h-20 bg-gray-100 rounded border flex items-center justify-center">
                              <FileText className="h-6 w-6 text-gray-400" />
                            </div>
                          )}
                        </div>

                        {/* Page Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center space-x-3">
                              <h4 className="text-sm font-semibold">
                                Page {page.page_number}
                              </h4>
                              <Badge 
                                variant="outline" 
                                className={getConfidenceColor(page.confidence)}
                              >
                                {Math.round(page.confidence * 100)}% confidence
                              </Badge>
                            </div>
                            
                            {page.confidence < 0.7 && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleOcrReview(page)}
                              >
                                <Edit3 className="h-3 w-3 mr-1" />
                                Review
                              </Button>
                            )}
                          </div>

                          <div className="space-y-2">
                            <div className="text-xs text-gray-500">
                              Source: {page.source}
                            </div>
                            <div className="text-sm text-gray-700 line-clamp-3">
                              {page.snippet || 'No text snippet available'}
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* OCR Review Modal */}
      <OcrReviewModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        page={selectedPage}
        docId={docId}
        onSave={() => {
          setIsModalOpen(false);
          toast.success('OCR correction saved');
          // Optionally refresh page data
          fetchPageMetadata();
        }}
      />
    </div>
  );
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const { docId } = context.params!;
  
  return {
    props: {
      docId: docId as string,
    },
  };
};

