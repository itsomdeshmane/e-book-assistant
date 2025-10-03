import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import type {
  User,
  AuthResponse,
  LoginRequest,
  RegisterRequest,
  Document,
  UploadResponse,
  AskRequest,
  RAGResponse,
  SummarizeRequest,
  SummaryResponse,
  InterviewRequest,
  InterviewResponse,
  Conversation,
  ConversationMessage,
  InterviewSession,
} from './types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = localStorage.getItem('token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export const authAPI = {
  login: async (credentials: LoginRequest): Promise<AuthResponse> => {
    const response = await api.post<AuthResponse>('/auth/login', credentials);
    return response.data;
  },

  register: async (data: RegisterRequest): Promise<AuthResponse> => {
    const response = await api.post<AuthResponse>('/auth/register', data);
    return response.data;
  },

  getMe: async (): Promise<User> => {
    const response = await api.get<User>('/auth/me');
    return response.data;
  },
};

export const documentsAPI = {
  getDocuments: async (): Promise<Document[]> => {
    const response = await api.get<Document[]>('/documents');
    return response.data;
  },

  getDocument: async (docId: string | number): Promise<Document> => {
    const response = await api.get<Document>(`/documents/${docId}`);
    return response.data;
  },

  uploadDocument: async (
    file: File,
    onUploadProgress?: (progressEvent: any) => void
  ): Promise<UploadResponse> => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await api.post<UploadResponse>('/documents/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress,
    });
    return response.data;
  },

  deleteDocument: async (docId: string | number): Promise<void> => {
    await api.delete(`/documents/${docId}`);
  },
};

export const ragAPI = {
  ask: async (data: AskRequest): Promise<RAGResponse> => {
    const response = await api.post<RAGResponse>('/rag/ask', data);
    return response.data;
  },

  summarize: async (data: SummarizeRequest): Promise<SummaryResponse> => {
    const response = await api.post<SummaryResponse>('/rag/summarize', data);
    return response.data;
  },

  generateInterviewQuestions: async (data: InterviewRequest): Promise<InterviewResponse> => {
    const response = await api.post<InterviewResponse>('/rag/interview-questions', data);
    return response.data;
  },

  // Conversation history endpoints
  getConversations: async (documentId: number): Promise<Conversation[]> => {
    const response = await api.get<Conversation[]>(`/rag/conversations/${documentId}`);
    return response.data;
  },

  getConversationMessages: async (conversationId: number): Promise<ConversationMessage[]> => {
    const response = await api.get<ConversationMessage[]>(`/rag/conversations/${conversationId}/messages`);
    return response.data;
  },

  // Interview history endpoints
  getInterviewSessions: async (): Promise<InterviewSession[]> => {
    const response = await api.get<InterviewSession[]>('/rag/interview-sessions');
    return response.data;
  },

  getInterviewSessionsForDocument: async (documentId: number): Promise<InterviewSession[]> => {
    const response = await api.get<InterviewSession[]>(`/rag/interview-sessions/document/${documentId}`);
    return response.data;
  },
};