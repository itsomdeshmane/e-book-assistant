import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { documentsAPI, ragAPI } from '@/lib/api';
import { summaryCache } from '@/lib/cache';
import type { AskRequest, SummarizeRequest, InterviewRequest, Conversation, ConversationMessage, InterviewSession } from '@/lib/types';

export function useDocuments(userId?: string | number) {
  return useQuery({
    queryKey: ['documents', userId],
    queryFn: documentsAPI.getDocuments,
    staleTime: 0, // Always refetch
    retry: 1,
  });
}

export function useMe() {
  return useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      const response = await fetch('/api/auth/me', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      return response.json();
    },
  });
}

export function useDocument(docId: string | number) {
  return useQuery({
    queryKey: ['document', docId],
    queryFn: () => documentsAPI.getDocument(docId),
    enabled: !!docId,
    refetchInterval: (data) => {
      // If document is still processing (chunk_count is 0), refetch every 3 seconds
      if (data && (data as any).chunk_count === 0) {
        return 3000;
      }
      // If processed, stop auto-refetching
      return false;
    },
    refetchIntervalInBackground: true,
    staleTime: 0, // Always consider data stale for processing documents
    gcTime: 1000 * 60 * 5, // Keep in cache for 5 minutes (renamed from cacheTime in newer versions)
  });
}

export function useUploadDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      file,
      onUploadProgress,
    }: {
      file: File;
      onUploadProgress?: (progressEvent: any) => void;
    }) => documentsAPI.uploadDocument(file, onUploadProgress),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
    },
  });
}

export function useDeleteDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (docId: string | number) => documentsAPI.deleteDocument(docId),
    onSuccess: (_, docId) => {
      // Invalidate React Query cache
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      queryClient.invalidateQueries({ queryKey: ['document', docId] });
      queryClient.invalidateQueries({ queryKey: ['cached-summary', docId.toString()] });
      
      // Clear summary cache for this document
      summaryCache.removeAllSummariesForDocument(docId.toString());
    },
  });
}

export function useAskQuestion() {
  return useMutation({
    mutationFn: (data: AskRequest) => ragAPI.ask(data),
  });
}

export function useSummarize() {
  return useMutation({
    mutationFn: async (data: SummarizeRequest) => {
      // Get current user ID for cache isolation
      const token = localStorage.getItem('token');
      let userId: string | undefined;
      
      if (token && typeof window !== 'undefined') {
        try {
          const payload = JSON.parse(atob(token.split('.')[1]));
          userId = payload.sub;
        } catch (error) {
          console.warn('Failed to parse token for cache isolation:', error);
        }
      }
      
      // Check cache first
      const cachedSummary = summaryCache.getSummary(data.doc_id, data.scope, userId);
      
      if (cachedSummary) {
        // Return cached summary in the same format as API response
        return { summary: cachedSummary };
      }

      // If not cached, make API call
      const response = await ragAPI.summarize(data);
      
      // Cache the response with user ID
      summaryCache.setSummary(data.doc_id, response.summary, data.scope, userId);
      
      return response;
    },
  });
}

// New hook to get cached summary without triggering API call
export function useCachedSummary(docId: string, scope: string = 'full') {
  return useQuery({
    queryKey: ['cached-summary', docId, scope],
    queryFn: () => {
      // Get current user ID for cache isolation
      let userId: string | undefined;
      const token = localStorage.getItem('token');
      if (token && typeof window !== 'undefined') {
        try {
          const payload = JSON.parse(atob(token.split('.')[1]));
          userId = payload.sub;
        } catch (error) {
          console.warn('Failed to parse token for cache isolation:', error);
        }
      }
      
      const cachedSummary = summaryCache.getSummary(docId, scope, userId);
      return cachedSummary ? { summary: cachedSummary, fromCache: true } : null;
    },
    staleTime: Infinity, // Cache data is always fresh until manually invalidated
    enabled: !!docId,
  });
}

// Hook to check if summary is cached
export function useIsSummaryCached(docId: string, scope: string = 'full') {
  // Get current user ID for cache isolation
  let userId: string | undefined;
  const token = localStorage.getItem('token');
  if (token && typeof window !== 'undefined') {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      userId = payload.sub;
    } catch (error) {
      console.warn('Failed to parse token for cache isolation:', error);
    }
  }
  
  return summaryCache.isCached(docId, scope, userId);
}

export function useGenerateInterviewQuestions() {
  return useMutation({
    mutationFn: (data: InterviewRequest) => ragAPI.generateInterviewQuestions(data),
  });
}

// Conversation history hooks
export function useConversations(documentId: string | number) {
  return useQuery({
    queryKey: ['conversations', documentId],
    queryFn: () => ragAPI.getConversations(Number(documentId)),
    enabled: !!documentId,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}

export function useConversationMessages(conversationId: number) {
  return useQuery({
    queryKey: ['conversationMessages', conversationId],
    queryFn: () => ragAPI.getConversationMessages(conversationId),
    enabled: !!conversationId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

// Interview history hooks
export function useInterviewSessions() {
  return useQuery({
    queryKey: ['interviewSessions'],
    queryFn: ragAPI.getInterviewSessions,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}

export function useDocumentInterviewSessions(documentId: string | number) {
  return useQuery({
    queryKey: ['interviewSessions', documentId],
    queryFn: () => ragAPI.getInterviewSessionsForDocument(Number(documentId)),
    enabled: !!documentId,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}