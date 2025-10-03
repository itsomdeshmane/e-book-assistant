'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { Navbar } from '@/components/Navbar';
import { useDocument, useSummarize, useCachedSummary, useIsSummaryCached } from '@/hooks/use-api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, FileText, Sparkles, Copy, Download, Clock, Zap } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

interface SummaryPageContentProps {
  params: { doc_id: string };
}

function SummaryPageContent({ params }: SummaryPageContentProps) {
  const router = useRouter();
  const { data: document, isLoading: docLoading } = useDocument(params.doc_id);
  const summarizeMutation = useSummarize();
  const { data: cachedSummaryData } = useCachedSummary(params.doc_id);
  const isSummaryCached = useIsSummaryCached(params.doc_id);
  const [summary, setSummary] = useState<string | null>(null);

  // Load cached summary on component mount
  useEffect(() => {
    if (cachedSummaryData?.summary && !summary) {
      setSummary(cachedSummaryData.summary);
    }
  }, [cachedSummaryData, summary]);

  const handleSummarize = async () => {
    try {
      const response = await summarizeMutation.mutateAsync({
        doc_id: params.doc_id,
        scope: 'full',
      });

      setSummary(response.summary);
      
      // Show different toast message based on cache status
      if (isSummaryCached) {
        toast.success('Summary loaded from cache');
      } else {
        toast.success('Summary generated and cached');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to generate summary');
    }
  };

  const handleCopy = async () => {
    if (summary) {
      await navigator.clipboard.writeText(summary);
      toast.success('Summary copied to clipboard');
    }
  };

  const handleDownload = async () => {
    if (!summary || !document) {
      toast.error('No summary available to download');
      return;
    }

    try {
      const blob = new Blob([summary], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      
      // Use explicit window.document to avoid naming conflicts
      const docData = document; // Store the PDF document data
      const windowDoc = window.document; // Reference the DOM document
      
      const link = windowDoc.createElement('a');
      link.style.display = 'none';
      link.href = url;
      link.download = `${docData.title || docData.filename}_summary.txt`;
      
      // Append to body, trigger download, then remove
      windowDoc.body.appendChild(link);
      link.click();
      windowDoc.body.removeChild(link);
      
      // Clean up the URL
      setTimeout(() => URL.revokeObjectURL(url), 100);
      
      toast.success('Summary downloaded');
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Failed to download summary');
    }
  };

  if (docLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Skeleton className="h-8 w-64 mb-4" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  if (!document) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Card>
            <CardContent className="py-16 text-center">
              <p className="text-gray-500">Document not found</p>
              <Button onClick={() => router.push('/dashboard')} className="mt-4">
                Back to Dashboard
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-6">
          <Button
            variant="ghost"
            onClick={() => router.push(`/chat/${params.doc_id}`)}
            className="mb-0"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Chat
          </Button>
          
          <div className="flex space-x-2">
            {summary && (
              <>
                <Button variant="outline" onClick={handleCopy}>
                  <Copy className="h-4 w-4 mr-2" />
                  Copy
                </Button>
                <Button variant="outline" onClick={handleDownload}>
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
              </>
            )}
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Card className="mb-6">
            <CardHeader>
              <div className="flex items-center space-x-3">
                <div className="bg-blue-100 p-2 rounded-lg">
                  <FileText className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <CardTitle className="text-xl">
                    {document.title || document.filename}
                  </CardTitle>
                  <p className="text-sm text-gray-500 mt-1">
                    Uploaded {format(new Date(document.created_at), 'MMM d, yyyy')} • {document.chunk_count} text chunks
                  </p>
                </div>
              </div>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Document Summary</CardTitle>
                {!summary && (
                  <div className="flex items-center space-x-3">
                    <Button
                      onClick={handleSummarize}
                      disabled={summarizeMutation.isPending}
                    >
                      {isSummaryCached ? (
                        <Clock className="h-4 w-4 mr-2" />
                      ) : (
                        <Sparkles className="h-4 w-4 mr-2" />
                      )}
                      {summarizeMutation.isPending 
                        ? 'Loading...' 
                        : isSummaryCached 
                          ? 'Load Summary' 
                          : 'Generate Summary'
                      }
                    </Button>
                    {isSummaryCached && (
                      <div className="flex items-center text-sm text-green-600">
                        <Zap className="h-4 w-4 mr-1" />
                        Cached
                      </div>
                    )}
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {summarizeMutation.isPending ? (
                <div className="space-y-3">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-5/6" />
                  <Skeleton className="h-4 w-4/5" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
              ) : summary ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.3 }}
                  className="prose prose-gray max-w-none"
                >
                  <div className="bg-gray-50 rounded-lg p-6 border">
                    <p className="text-gray-700 leading-relaxed whitespace-pre-wrap text-sm">
                      {summary}
                    </p>
                  </div>
                </motion.div>
              ) : (
                <div className="text-center py-12">
                  <Sparkles className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">Click "Generate Summary" to create a comprehensive summary of this document.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}

export default function SummaryPage({ params }: { params: { doc_id: string } }) {
  return (
    <ProtectedRoute>
      <SummaryPageContent params={params} />
    </ProtectedRoute>
  );
}
