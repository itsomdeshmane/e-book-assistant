from typing import Optional, List
from sqlmodel import SQLModel, Field, Relationship
from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, Text

class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    email: str = Field(index=True, unique=True)
    name: str
    password_hash: str
    created_at: datetime = Field(default_factory=datetime.utcnow)

    documents: List["Document"] = Relationship(back_populates="owner")
    conversations: List["Conversation"] = Relationship(back_populates="user")
    interview_sessions: List["InterviewSession"] = Relationship(back_populates="user")

class Document(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    owner_id: int = Field(foreign_key="user.id", index=True)
    title: str
    filename: str
    file_hash: str = Field(index=True)   # ✅ NEW: unique per user
    chunk_count: int
    status: str = Field(default="processing", index=True)  # processing, processed, failed
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
    owner: User = Relationship(back_populates="documents")
    conversations: List["Conversation"] = Relationship(back_populates="document")
    interview_sessions: List["InterviewSession"] = Relationship(back_populates="document")

class Conversation(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    document_id: int = Field(foreign_key="document.id", index=True)
    title: str = Field(default="Untitled Conversation")  # Can be auto-generated
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    
    user: User = Relationship(back_populates="conversations")
    document: Document = Relationship(back_populates="conversations")
    messages: List["Message"] = Relationship(back_populates="conversation", cascade_delete=True)

class Message(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    conversation_id: int = Field(foreign_key="conversation.id", index=True)
    role: str = Field(index=True)  # "user" or "assistant"
    content: str = Field(sa_column=Column(Text))
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
    # Metadata for tracking
    message_metadata: Optional[str] = Field(default=None)  # JSON string for additional data like chunks used, model used, etc.
    
    conversation: Conversation = Relationship(back_populates="messages")

class InterviewSession(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    document_id: int = Field(foreign_key="document.id", index=True)
    level: str = Field(index=True)  # "beginner", "intermediate", "advanced"
    questions: str = Field(sa_column=Column(Text))  # JSON string of questions array
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
    # Metadata for tracking
    session_metadata: Optional[str] = Field(default=None)  # JSON string for additional data
    
    user: User = Relationship(back_populates="interview_sessions")
    document: Document = Relationship(back_populates="interview_sessions")
