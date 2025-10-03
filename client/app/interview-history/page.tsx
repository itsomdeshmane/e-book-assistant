'use client';

import { ProtectedRoute } from '@/components/ProtectedRoute';
import { Navbar } from '@/components/Navbar';
import { useDocuments, useInterviewSessions } from '@/hooks/use-api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { FileText, Copy, CheckCircle, Clock, Users, Filter, Download } from 'lucide-react';
import { format } from 'date-fns';
import { useRouter } from 'next/navigation';
import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

function InterviewHistoryContent() {
  const [selectedDocument, setSelectedDocument] = useState<string>('all');
  const [selectedLevel, setSelectedLevel] = useState<string>('all');
  const [copiedSessions, setCopiedSessions] = useState<Set<number>>(new Set());
  
  const router = useRouter();
  const { data: documents } = useDocuments();
  const { 
    data: interviewSessions, 
    isLoading, 
    refetch 
  } = useInterviewSessions();

  const copySessionToClipboard = useCallback(async (session: any) => {
    const sessionText = `Interview Questions - ${session.level.charAt(0).toUpperCase() + session.level.slice(1)} Level\nGenerated: ${format(new Date(session.created_at), 'MMM d, yyyy HH:mm')}\n\n${session.questions.map((q: string, i: number) => `${i + 1}. ${q}`).join('\n')}`;
    
    try {
      await navigator.clipboard.writeText(sessionText);
      setCopiedSessions(prev => new Set([...prev, session.id]));
      toast.success('Interview questions copied to clipboard!');
      
      // Reset copied state after 2 seconds
      setTimeout(() => {
        setCopiedSessions(prev => {
          const newSet = new Set(prev);
          newSet.delete(session.id);
          return newSet;
        });
      }, 2000);
    } catch (error) {
      toast.error('Failed to copy to clipboard');
    }
  }, []);

  const copyDocumentHistory = useCallback(async (documentId: string) => {
    const document = documents?.find(d => d.id.toString() === documentId);
    if (!document) return;

    const documentSessions = interviewSessions?.filter(session => 
      session.document_id.toString() === documentId
    ) || [];

    if (documentSessions.length === 0) {
      toast.error('No interview questions found for this document');
      return;
    }

    const historyText = `Interview Questions History\nDocument: ${document.title || document.filename}\nGenerated: ${documentSessions.length} sessions\n\n` +
      documentSessions.map(session => 
        `${session.level.charAt(0).toUpperCase() + session.level.slice(1)} Level (${format(new Date(session.created_at), 'MMM d, yyyy HH:mm')})\n` +
        session.questions.map((q: string, i: number) => `  ${i + 1}. ${q}`).join('\n') + '\n'
      ).join('\n');

    try {
      await navigator.clipboard.writeText(historyText);
      toast.success('Document interview history copied to clipboard!');
    } catch (error) {
      toast.error('Failed to copy to clipboard');
    }
  }, [documents, interviewSessions]);

  // Filter sessions based on document and level
  const filteredSessions = interviewSessions?.filter(session => {
    const matchesDocument = selectedDocument === 'all' || session.document_id.toString() === selectedDocument;
    const matchesLevel = selectedLevel === 'all' || session.level === selectedLevel;
    return matchesDocument && matchesLevel;
  }) || [];

  // Group sessions by document for display
  const sessionsByDocument = filteredSessions.reduce((acc, session) => {
    const docId = session.document_id.toString();
    if (!acc[docId]) {
      acc[docId] = [];
    }
    acc[docId].push(session);
    return acc;
  }, {} as Record<string, typeof filteredSessions>);

  const selectedDocumentTitle = selectedDocument !== 'all' 
    ? (documents?.find(d => d.id.toString() === selectedDocument)?.title || 
       documents?.find(d => d.id.toString() === selectedDocument)?.filename)
    : null;

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <div className="bg-blue-100 p-3 rounded-full">
              <Users className="h-8 w-8 text-blue-600" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Interview Question History</h1>
          <p className="text-gray-600 mt-2">
            View and reuse previously generated interview questions
          </p>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Filter by Document
                </label>
                <Select value={selectedDocument} onValueChange={setSelectedDocument}>
                  <SelectTrigger>
                    <SelectValue placeholder="All documents" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Documents</SelectItem>
                    {documents?.map((doc) => (
                      <SelectItem key={doc.id} value={`${doc.id}`}>
                        <div className="flex items-center space-x-2">
                          <FileText className="h-4 w-4" />
                          <span>{doc.title || doc.filename}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Filter by Level
                </label>
                <Select value={selectedLevel} onValueChange={setSelectedLevel}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Levels</SelectItem>
                    <SelectItem value="beginner">
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 rounded-full bg-green-500"></div>
                        <span>Beginner</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="intermediate">
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
                        <span>Intermediate</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="advanced">
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 rounded-full bg-red-500"></div>
                        <span>Advanced</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {selectedDocument && selectedDocument !== 'all' && (
                <div className="flex items-end">
                  <Button
                    onClick={() => copyDocumentHistory(selectedDocument)}
                    variant="outline"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Copy All
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        <AnimatePresence mode="wait">
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Card key={i}>
                  <CardContent className="py-6">
                    <Skeleton className="h-4 w-full mb-2" />
                    <Skeleton className="h-4 w-3/4 mb-2" />
                    <Skeleton className="h-4 w-1/2" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : filteredSessions.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-16">
                  <Users className="h-16 w-16 text-gray-300 mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    {(selectedDocument && selectedDocument !== 'all') || selectedLevel !== 'all' 
                      ? 'No matching interview questions'
                      : 'No interview questions yet'
                    }
                  </h3>
                  <p className="text-gray-500 mb-6 text-center max-w-md">
                    {(selectedDocument && selectedDocument !== 'all') || selectedLevel !== 'all'
                      ? 'Try adjusting your filters or generate new interview questions'
                      : 'Generate your first set of interview questions to see them here'
                    }
                  </p>
                  <Button onClick={() => router.push('/interview-questions')}>
                    <Users className="h-4 w-4 mr-2" />
                    Generate Questions
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          ) : (
            <motion.div
              key="results"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              {/* Show by document or flat list based on filters */}
              {(selectedDocument && selectedDocument !== 'all') || Object.keys(sessionsByDocument).length === 1 ? (
                // Single document or specific filter - show flat list
                <div className="space-y-4">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-semibold">
                      {selectedDocumentTitle 
                        ? `Interview Questions: ${selectedDocumentTitle}`
                        : 'Interview Questions'
                      }
                      <span className="text-sm font-normal text-gray-500 ml-2">
                        ({filteredSessions.length} sessions)
                      </span>
                    </h2>
                    {filteredSessions.length > 0 && selectedDocument && selectedDocument !== 'all' && (
                      <Button
                        onClick={() => copyDocumentHistory(selectedDocument)}
                        variant="outline"
                        size="sm"
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Copy All
                      </Button>
                    )}
                  </div>

                  {filteredSessions.map((session, index) => {
                    const document = documents?.find(d => d.id === session.document_id);
                    return (
                      <motion.div
                        key={session.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 }}
                      >
                        <Card>
                          <CardHeader>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-3">
                                <div className="bg-blue-100 p-2 rounded-lg">
                                  <Users className="h-5 w-5 text-blue-600" />
                                </div>
                                <div>
                                  <CardTitle className="flex items-center space-x-2">
                                    <span className="capitalize">{session.level}</span>
                                    <div className={`w-2 h-2 rounded-full ${
                                      session.level === 'beginner' ? 'bg-green-500' :
                                      session.level === 'intermediate' ? 'bg-yellow-500' : 'bg-red-500'
                                    }`}></div>
                                  </CardTitle>
                                  <CardDescription>
                                    {document?.title || document?.filename || `Document ${session.document_id}`} • 
                                    {session.question_count} questions • 
                                    {format(new Date(session.created_at), 'MMM d, yyyy HH:mm')}
                                  </CardDescription>
                                </div>
                              </div>
                              <Button
                                variant="outline"
                                onClick={() => copySessionToClipboard(session)}
                                disabled={copiedSessions.has(session.id)}
                              >
                                {copiedSessions.has(session.id) ? (
                                  <>
                                    <CheckCircle className="h-4 w-4 mr-2 text-green-600" />
                                    Copied!
                                  </>
                                ) : (
                                  <>
                                    <Copy className="h-4 w-4 mr-2" />
                                    Copy
                                  </>
                                )}
                              </Button>
                            </div>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-3">
                              {session.questions.map((question, qIndex) => (
                                <div key={qIndex} className="flex items-start space-x-3 p-3 rounded-lg border border-gray-200">
                                  <div className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-sm font-medium">
                                    {qIndex + 1}
                                  </div>
                                  <div className="flex-1">
                                    <p className="text-gray-900 leading-relaxed">{question}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    );
                  })}
                </div>
              ) : (
                // Multiple documents - show grouped
                Object.entries(sessionsByDocument).map(([docId, sessions]) => {
                  const document = documents?.find(d => d.id.toString() === docId);
                  return (
                    <div key={docId} className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h2 className="text-xl font-semibold flex items-center space-x-2">
                          <FileText className="h-5 w-5 text-gray-600" />
                          <span>{document?.title || document?.filename || `Document ${docId}`}</span>
                          <span className="text-sm font-normal text-gray-500">
                            ({sessions.length} sessions)
                          </span>
                        </h2>
                        <Button
                          onClick={() => copyDocumentHistory(docId)}
                          variant="outline"
                          size="sm"
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Copy All
                        </Button>
                      </div>

                      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {sessions.map((session, index) => (
                          <motion.div
                            key={session.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.1 }}
                          >
                            <Card className="hover:shadow-md transition-shadow">
                              <CardHeader className="pb-3">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center space-x-2">
                                    <span className="font-medium capitalize">{session.level}</span>
                                    <div className={`w-2 h-2 rounded-full ${
                                      session.level === 'beginner' ? 'bg-green-500' :
                                      session.level === 'intermediate' ? 'bg-yellow-500' : 'bg-red-500'
                                    }`}></div>
                                  </div>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => copySessionToClipboard(session)}
                                    disabled={copiedSessions.has(session.id)}
                                  >
                                    {copiedSessions.has(session.id) ? (
                                      <CheckCircle className="h-3 w-3 text-green-600" />
                                    ) : (
                                      <Copy className="h-3 w-3" />
                                    )}
                                  </Button>
                                </div>
                                <CardDescription>
                                  {session.question_count} questions • 
                                  {format(new Date(session.created_at), 'MMM d, HH:mm')}
                                </CardDescription>
                              </CardHeader>
                              <CardContent>
                                <div className="space-y-2">
                                  {session.questions.slice(0, 3).map((question, qIndex) => (
                                    <div key={qIndex} className="text-sm text-gray-600 truncate">
                                      {qIndex + 1}. {question}
                                    </div>
                                  ))}
                                  {session.questions.length > 3 && (
                                    <div className="text-xs text-gray-500 mt-2">
                                      +{session.questions.length - 3} more questions
                                    </div>
                                  )}
                                </div>
                              </CardContent>
                            </Card>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  );
                })
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default function InterviewHistoryPage() {
  return (
    <ProtectedRoute>
      <InterviewHistoryContent />
    </ProtectedRoute>
  );
}
