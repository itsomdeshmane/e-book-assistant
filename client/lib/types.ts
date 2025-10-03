export interface User {
  id: string;
  email: string;
  name: string;
}

export interface AuthResponse {
  access_token: string;
}

export interface Document {
  id: string | number;
  doc_id?: string;
  title: string;
  filename: string;
  chunk_count: number;
  created_at: string;
  updated_at?: string;
  owner_id?: number;
}

export interface UploadResponse {
  doc_id: string;
  chunks: number;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface RAGResponse {
  answer: string;
}

export interface SummaryResponse {
  summary: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  name: string;
  password: string;
}

export interface AskRequest {
  doc_id: string;
  query: string;
  top_k?: number;
}

export interface SummarizeRequest {
  doc_id: string;
  scope: string;
  chapter_hint?: string;
}

export interface InterviewRequest {
  doc_id: number;
  level: "beginner" | "intermediate" | "advanced";
}

export interface InterviewResponse {
  questions: string[];
  error?: string;
}

export interface Conversation {
  id: number;
  title: string;
  document_id: number;
  created_at: string;
  updated_at: string;
  message_count: number;
}

export interface ConversationMessage {
  id: number;
  role: string;
  content: string;
  created_at: string;
  metadata: string | null;
}

export interface InterviewSession {
  id: number;
  document_id: number;
  level: string;
  question_count: number;
  created_at: string;
  questions: string[];
}