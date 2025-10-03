# app/conversation_manager.py
import logging
import json
from typing import Optional, List, Dict, Any
from sqlmodel import Session, select
from datetime import datetime

from .models import Conversation, Message, InterviewSession, User, Document

logger = logging.getLogger("conversation_manager")

class ConversationManager:
    """Manages conversation storage and retrieval."""
    
    @staticmethod
    def get_or_create_conversation(
        session: Session, 
        user_id: int, 
        document_id: int, 
        title: Optional[str] = None
    ) -> Conversation:
        """Get existing conversation or create new one."""
        try:
            # Try to get the most recent conversation for this user/document
            stmt = select(Conversation).where(
                Conversation.user_id == user_id,
                Conversation.document_id == document_id
            ).order_by(Conversation.updated_at.desc()).limit(1)
            
            conversation = session.exec(stmt).first()
            
            if conversation:
                return conversation
            
            # Create new conversation
            conversation = Conversation(
                user_id=user_id,
                document_id=document_id,
                title=title or f"Chat with Document {document_id}"
            )
            session.add(conversation)
            session.commit()
            session.refresh(conversation)
            
            logger.info(f"[ConversationManager] Created new conversation {conversation.id}")
            return conversation
            
        except Exception as e:
            logger.exception(f"[ConversationManager] Error managing conversation: {e}")
            session.rollback()
            raise
    
    @staticmethod
    def add_message(
        session: Session,
        conversation_id: int,
        role: str,
        content: str,
        metadata: Optional[Dict[str, Any]] = None
    ) -> Message:
        """Add a message to a conversation."""
        try:
            message = Message(
                conversation_id=conversation_id,
                role=role,
                content=content,
                message_metadata=json.dumps(metadata) if metadata else None
            )
            session.add(message)
            
            # Update conversation updated_at timestamp
            conversation = session.get(Conversation, conversation_id)
            if conversation:
                conversation.updated_at = datetime.utcnow()
                session.add(conversation)
            
            session.commit()
            session.refresh(message)
            
            logger.info(f"[ConversationManager] Added message {message.id} to conversation {conversation_id}")
            return message
            
        except Exception as e:
            logger.exception(f"[ConversationManager] Error adding message: {e}")
            session.rollback()
            raise
    
    @staticmethod
    def get_conversations_for_user(session: Session, user_id: int) -> List[Conversation]:
        """Get all conversations for a user."""
        try:
            stmt = select(Conversation).where(Conversation.user_id == user_id).order_by(Conversation.updated_at.desc())
            return session.exec(stmt).all()
        except Exception as e:
            logger.exception(f"[ConversationManager] Error getting conversations: {e}")
            return []
    
    @staticmethod
    def get_conversation_messages(session: Session, conversation_id: int) -> List[Message]:
        """Get all messages for a conversation."""
        try:
            stmt = select(Message).where(Message.conversation_id == conversation_id).order_by(Message.created_at.asc())
            return session.exec(stmt).all()
        except Exception as e:
            logger.exception(f"[ConversationManager] Error getting messages: {e}")
            return []
    
    @staticmethod
    def store_interview_questions(
        session: Session,
        user_id: int,
        document_id: int,
        level: str,
        questions: List[str],
        metadata: Optional[Dict[str, Any]] = None
    ) -> InterviewSession:
        """Store generated interview questions."""
        try:
            interview_session = InterviewSession(
                user_id=user_id,
                document_id=document_id,
                level=level,
                questions=json.dumps(questions),
                session_metadata=json.dumps(metadata) if metadata else None
            )
            session.add(interview_session)
            session.commit()
            session.refresh(interview_session)
            
            logger.info(f"[ConversationManager] Stored interview session {interview_session.id} with {len(questions)} questions")
            return interview_session
            
        except Exception as e:
            logger.exception(f"[ConversationManager] Error storing interview questions: {e}")
            session.rollback()
            raise
    
    @staticmethod
    def get_interview_sessions_for_user(session: Session, user_id: int) -> List[InterviewSession]:
        """Get all interview sessions for a user."""
        try:
            stmt = select(InterviewSession).where(InterviewSession.user_id == user_id).order_by(InterviewSession.created_at.desc())
            return session.exec(stmt).all()
        except Exception as e:
            logger.exception(f"[ConversationManager] Error getting interview sessions: {e}")
            return []
    
    @staticmethod
    def get_interview_sessions_for_document(session: Session, user_id: int, document_id: int) -> List[InterviewSession]:
        """Get interview sessions for a specific document."""
        try:
            stmt = select(InterviewSession).where(
                InterviewSession.user_id == user_id,
                InterviewSession.document_id == document_id
            ).order_by(InterviewSession.created_at.desc())
            return session.exec(stmt).all()
        except Exception as e:
            logger.exception(f"[ConversationManager] Error getting document interview sessions: {e}")
            return []
