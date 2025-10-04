from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session
from pydantic import BaseModel
from .schemas import AskRequest, SummarizeRequest
from .security import get_current_user
from .db import get_session
from .models import Document, Conversation
from .query_engine import answer_query, summarize, generate_interview_questions
from .conversation_manager import ConversationManager
import uuid
import logging

logger = logging.getLogger(__name__)
import json

router = APIRouter(prefix="/rag", tags=["RAG"])

@router.post("/ask")
def ask(payload: AskRequest, session: Session = Depends(get_session), user=Depends(get_current_user)):
    doc = session.get(Document, payload.doc_id)
    if not doc or doc.owner_id != user.id:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # Get conversation history for context
    conversation_history = []
    try:
        # Get or create conversation first
        conversation = ConversationManager.get_or_create_conversation(
            session=session,
            user_id=user.id,
            document_id=payload.doc_id,
            title=f"Chat about {doc.title}"
        )
        
        # Get recent conversation history for context
        messages = ConversationManager.get_conversation_messages(session, conversation.id)
        conversation_history = [
            {
                "role": msg.role,
                "content": msg.content,
                "created_at": msg.created_at.isoformat() if msg.created_at else None
            }
            for msg in messages[-10:]  # Get last 10 messages for context
        ]
        
    except Exception as e:
        logger.warning(f"Failed to get conversation history: {e}")
        conversation = None
    
    # Generate the answer with conversation history context
    answer = answer_query(
        user.id, 
        payload.doc_id, 
        payload.query, 
        top_k=payload.top_k,
        conversation_history=conversation_history
    )
    
    # Store conversation if we have a conversation object
    if conversation:
        try:
            # Store user question
            ConversationManager.add_message(
                session=session,
                conversation_id=conversation.id,
                role="user",
                content=payload.query,
                metadata={"top_k": payload.top_k, "doc_title": doc.title}
            )
            
            # Store assistant answer
            ConversationManager.add_message(
                session=session,
                conversation_id=conversation.id,
                role="assistant", 
                content=answer,
                metadata={"doc_title": doc.title, "model_used": "gpt-3.5-turbo"}
            )
            
        except Exception as e:
            # Log error but don't fail the request if storage fails
            logger.warning(f"Failed to store conversation: {e}")
    
    return {
        "answer": answer,
        "conversation_id": conversation.id if conversation else None
    }

@router.post("/summarize")
def do_summarize(payload: SummarizeRequest, session: Session = Depends(get_session), user=Depends(get_current_user)):
    doc = session.get(Document, payload.doc_id)
    if not doc or doc.owner_id != user.id:
        raise HTTPException(status_code=404, detail="Document not found")
    text = summarize(user.id, payload.doc_id, scope=payload.scope, chapter_hint=payload.chapter_hint)
    return {"summary": text}

class InterviewRequest(BaseModel):
    doc_id: int
    level: str  # "beginner" | "intermediate" | "advanced"

@router.post("/interview-questions")
def interview_questions(payload: InterviewRequest, session: Session = Depends(get_session), user=Depends(get_current_user)):
    doc = session.get(Document, payload.doc_id)
    if not doc or doc.owner_id != user.id:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # Generate interview questions
    result = generate_interview_questions(user.id, payload.doc_id, payload.level.lower())
    
    # Store the interview session if successful
    if result.get("questions") and not result.get("error"):
        try:
            ConversationManager.store_interview_questions(
                session=session,
                user_id=user.id,
                document_id=payload.doc_id,
                level=payload.level.lower(),
                questions=result["questions"],
                metadata={
                    "doc_title": doc.title,
                    "doc_filename": doc.filename,
                    "generation_time": "auto_generated"
                }
            )
        except Exception as e:
            # Log error but don't fail the request if storage fails
            logger.warning(f"Failed to store interview session: {e}")
    
    return result


# History and retrieval endpoints

@router.get("/conversations/{document_id}")
def get_conversations_for_document(
    document_id: int, 
    session: Session = Depends(get_session), 
    user=Depends(get_current_user)
):
    """Get all conversations for a specific document."""
    doc = session.get(Document, document_id)
    if not doc or doc.owner_id != user.id:
        raise HTTPException(status_code=404, detail="Document not found")
    
    conversations = ConversationManager.get_conversations_for_user(session, user.id)
    document_conversations = [c for c in conversations if c.document_id == document_id]
    
    return [
        {
            "id": conv.id,
            "title": conv.title,
            "document_id": conv.document_id,
            "created_at": conv.created_at,
            "updated_at": conv.updated_at,
            "message_count": len(ConversationManager.get_conversation_messages(session, conv.id))
        }
        for conv in document_conversations
    ]


@router.get("/conversations/{conversation_id}/messages")
def get_conversation_messages(
    conversation_id: int,
    session: Session = Depends(get_session),
    user=Depends(get_current_user)
):
    """Get all messages for a specific conversation."""
    # Verify conversation belongs to user
    conv = session.get(Conversation, conversation_id)
    if not conv or conv.user_id != user.id:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    messages = ConversationManager.get_conversation_messages(session, conversation_id)
    
    return [
        {
            "id": msg.id,
            "role": msg.role,
            "content": msg.content,
            "created_at": msg.created_at,
            "metadata": msg.message_metadata
        }
        for msg in messages
    ]


@router.get("/interview-sessions")
def get_interview_sessions(
    session: Session = Depends(get_session),
    user=Depends(get_current_user)
):
    """Get all interview sessions for the current user."""
    sessions = ConversationManager.get_interview_sessions_for_user(session, user.id)
    
    return [
        {
            "id": sess.id,
            "document_id": sess.document_id,
            "level": sess.level,
            "question_count": len(json.loads(sess.questions) if sess.questions else []),
            "created_at": sess.created_at,
            "questions": json.loads(sess.questions) if sess.questions else []
        }
        for sess in sessions
    ]


@router.get("/interview-sessions/document/{document_id}")
def get_interview_sessions_for_document(
    document_id: int,
    session: Session = Depends(get_session),
    user=Depends(get_current_user)
):
    """Get interview sessions for a specific document."""
    doc = session.get(Document, document_id)
    if not doc or doc.owner_id != user.id:
        raise HTTPException(status_code=404, detail="Document not found")
    
    sessions = ConversationManager.get_interview_sessions_for_document(session, user.id, document_id)
    
    return [
        {
            "id": sess.id,
            "level": sess.level,
            "question_count": len(json.loads(sess.questions) if sess.questions else []),
            "created_at": sess.created_at,
            "questions": json.loads(sess.questions) if sess.questions else []
        }
        for sess in sessions
    ]