'use client';

import { useState, useRef, useEffect } from 'react';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { Navbar } from '@/components/Navbar';
import { ChatBox } from '@/components/ChatBox';
import { useDocument, useAskQuestion, useSummarize, useCachedSummary, useIsSummaryCached, useConversations, useConversationMessages } from '@/hooks/use-api';
import { DocumentDebugInfo } from '@/components/DocumentDebugInfo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Skeleton } from '@/components/ui/skeleton';
import { Send, FileText, Sparkles, ChevronDown, ArrowLeft, ExternalLink, Eye, EyeOff, Clock, Zap, RefreshCw, History, MessageSquare } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import type { Message } from '@/lib/types';
import { useRouter } from 'next/navigation';

interface ChatPageContentProps {
  params: { doc_id: string };
}

function ChatPageContent({ params }: ChatPageContentProps) {
  const router = useRouter();
  const { data: document, isLoading: docLoading, refetch: refetchDocument } = useDocument(params.doc_id);
  const { data: conversations } = useConversations(params.doc_id);
  const askMutation = useAskQuestion();
  const summarizeMutation = useSummarize();
  const { data: cachedSummaryData } = useCachedSummary(params.doc_id);
  const isSummaryCached = useIsSummaryCached(params.doc_id);

  const [messages, setMessages] = useState<Message[]>([]);
  const [query, setQuery] = useState('');
  const [summary, setSummary] = useState<string | null>(null);
  const [isSummaryOpen, setIsSummaryOpen] = useState(false);
  const [isSidebarVisible, setIsSidebarVisible] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const [currentConversationId, setCurrentConversationId] = useState<number | null>(null);

  const { data: conversationMessages, refetch: refetchMessages } = useConversationMessages(
    currentConversationId || 0
  );
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Constants for summary truncation
  const SUMMARY_PREVIEW_LENGTH = 300;

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Load conversation history when component mounts and conversations are available
  useEffect(() => {
    if (conversations && conversations.length > 0 && !currentConversationId) {
      // Set the most recent conversation as current
      const mostRecent = conversations[0];
      setCurrentConversationId(mostRecent.id);
      refetchMessages();
    }
  }, [conversations, currentConversationId, refetchMessages]);

  // Load messages when conversation messages change
  useEffect(() => {
    if (conversationMessages && conversationMessages.length > 0) {
      const formattedMessages: Message[] = conversationMessages.map((msg, index) => ({
        id: msg.id.toString(),
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
        timestamp: new Date(msg.created_at)
      }));
      setMessages(formattedMessages);
    }
  }, [conversationMessages]);

  // Load cached summary on component mount
  useEffect(() => {
    if (cachedSummaryData?.summary && !summary) {
      setSummary(cachedSummaryData.summary);
      setIsSummaryOpen(true);
    }
  }, [cachedSummaryData, summary]);

  // Monitor document changes and log for debugging
  useEffect(() => {
    if (document) {
      console.log('Document data updated:', {
        doc_id: document.doc_id || document.id,
        chunk_count: document.chunk_count,
        title: document.title || document.filename
      });
    }
  }, [document]);

  const handleAsk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: query,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setQuery('');

    try {
      const response = await askMutation.mutateAsync({
        doc_id: params.doc_id,
        query: query.trim(),
        top_k: 5,
      });

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.answer,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to get answer');
      setMessages((prev) => prev.slice(0, -1));
    }
  };

  const handleSummarize = async () => {
    try {
      const response = await summarizeMutation.mutateAsync({
        doc_id: params.doc_id,
        scope: 'full',
      });

      setSummary(response.summary);
      setIsSummaryOpen(true);
      
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

  const toggleSidebar = () => {
    setIsSidebarVisible(!isSidebarVisible);
  };

  const navigateToFullSummary = () => {
    router.push(`/chat/${params.doc_id}/summary`);
  };

  const getTruncatedSummary = (text: string) => {
    if (text.length <= SUMMARY_PREVIEW_LENGTH) return text;
    return text.substring(0, SUMMARY_PREVIEW_LENGTH) + '...';
  };

  const isSummaryLengthy = summary && summary.length > SUMMARY_PREVIEW_LENGTH;

  const handleRefreshDocument = async () => {
    try {
      await refetchDocument();
      toast.success('Document status refreshed');
    } catch (error) {
      toast.error('Failed to refresh document status');
    }
  };

  const handleSwitchConversation = async (conversationId: number) => {
    setCurrentConversationId(conversationId);
    setShowHistory(false);
    setTimeout(() => {
      refetchMessages();
    }, 100); // Small delay to ensure hook picks up the new conversationId
  };

  const handleNewConversation = async () => {
    setMessages([]);
    setCurrentConversationId(null);
    setShowHistory(false);
  };

  if (docLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Skeleton className="h-8 w-64 mb-4" />
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <Skeleton className="h-96 lg:col-span-1" />
            <Skeleton className="h-96 lg:col-span-3" />
          </div>
        </div>
      </div>
    );
  }

  if (!document) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navbar />
      <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-4">
          <Button
            variant="ghost"
            onClick={() => router.push('/dashboard')}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
          
          <Button
            variant="outline"
            onClick={toggleSidebar}
          >
            {isSidebarVisible ? <EyeOff className="h-4 w-4 mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
            {isSidebarVisible ? 'Hide Sidebar' : 'Show Sidebar'}
          </Button>
        </div>

        <div className={`flex flex-col lg:flex-row gap-6 h-[calc(100vh-200px)] ${isSidebarVisible ? 'lg:grid lg:grid-cols-4' : ''}`}>
          {isSidebarVisible && (
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className={`w-full lg:w-auto ${isSidebarVisible ? 'lg:col-span-1' : 'hidden'} space-y-4`}
            >
            <Card>
              <CardHeader>
                <div className="flex items-center space-x-3 mb-2">
                  <div className="bg-blue-100 p-2 rounded-lg">
                    <FileText className="h-5 w-5 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-base truncate">
                      {document.title || document.filename}
                    </CardTitle>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleRefreshDocument}
                    className="flex-shrink-0"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
                <CardDescription>
                  Uploaded {format(new Date(document.created_at), 'MMM d, yyyy')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-sm text-gray-600">
                  <span className="font-medium">{document.chunk_count}</span> text chunks
                </div>
                <Button
                  onClick={handleSummarize}
                  disabled={summarizeMutation.isPending}
                  variant="outline"
                  className="w-full"
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
                  <div className="flex items-center text-xs text-green-600 mt-1">
                    <Zap className="h-3 w-3 mr-1" />
                    Cached - Instant load
                  </div>
                )}
              </CardContent>
            </Card>

            {summary && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <Collapsible open={isSummaryOpen} onOpenChange={setIsSummaryOpen}>
                  <Card>
                    <CollapsibleTrigger asChild>
                      <CardHeader className="cursor-pointer hover:bg-gray-50">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-base">Document Summary</CardTitle>
                          <ChevronDown
                            className={`h-4 w-4 transition-transform ${
                              isSummaryOpen ? 'rotate-180' : ''
                            }`}
                          />
                        </div>
                      </CardHeader>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <CardContent>
                        <div className="space-y-3">
                          <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                            {isSummaryLengthy ? getTruncatedSummary(summary) : summary}
                          </p>
                          {isSummaryLengthy && (
                            <div className="flex space-x-2 pt-2 border-t">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={navigateToFullSummary}
                                className="flex-1"
                              >
                                <ExternalLink className="h-3 w-3 mr-1" />
                                Show More
                              </Button>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>
              </motion.div>
            )}

            {/* Conversation History */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <History className="h-5 w-5 text-blue-600" />
                      <CardTitle className="text-lg">Chat History</CardTitle>
                    </div>
                    <div className="flex space-x-1">
                      <Button
                        onClick={handleNewConversation}
                        size="sm"
                        variant="outline"
                      >
                        New Chat
                      </Button>
                      <Button
                        onClick={() => setShowHistory(!showHistory)}
                        size="sm"
                        variant="outline"
                      >
                        {showHistory ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                
                {showHistory && conversations && conversations.length > 0 && (
                  <CardContent>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {conversations.map((conversation) => (
                        <Button
                          key={conversation.id}
                          onClick={() => handleSwitchConversation(conversation.id)}
                          variant={currentConversationId === conversation.id ? "default" : "outline"}
                          className="w-full justify-start text-left h-auto py-3 px-3"
                        >
                          <div className="flex items-center space-x-2 w-full">
                            <MessageSquare className="h-4 w-4 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium truncate">
                                {conversation.title}
                              </div>
                              <div className="text-xs text-gray-500">
                                {conversation.message_count} messages • {format(new Date(conversation.updated_at), 'MMM d, HH:mm')}
                              </div>
                            </div>
                          </div>
                        </Button>
                      ))}
                    </div>
                  </CardContent>
                )}

                {showHistory && (!conversations || conversations.length === 0) && (
                  <CardContent>
                    <div className="text-center py-4 text-gray-500">
                      <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No chat history yet</p>
                      <p className="text-xs">Start a conversation to see your questions here</p>
                    </div>
                  </CardContent>
                )}
              </Card>
            </motion.div>

            {/* Debug Info - Only show in development */}
            {process.env.NODE_ENV === 'development' && (
              <DocumentDebugInfo
                document={document}
                isLoading={docLoading}
                onRefresh={handleRefreshDocument}
              />
            )}
            </motion.div>
          )}

          <Card className={`${isSidebarVisible ? 'lg:col-span-3' : 'flex-1'} flex flex-col`}>
            <CardContent className="flex-1 flex flex-col p-6 overflow-hidden">
              <div className="flex-1 overflow-y-auto mb-4 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 hover:scrollbar-thumb-gray-400">
                <ChatBox messages={messages} />
                <div ref={messagesEndRef} />
              </div>

              <form onSubmit={handleAsk} className="flex space-x-2">
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Ask a question about this document..."
                  disabled={askMutation.isPending}
                  className="flex-1"
                />
                <Button
                  type="submit"
                  disabled={askMutation.isPending || !query.trim()}
                >
                  {askMutation.isPending ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default function ChatPage({ params }: { params: { doc_id: string } }) {
  return (
    <ProtectedRoute>
      <ChatPageContent params={params} />
    </ProtectedRoute>
  );
}