from pydantic import BaseModel, EmailStr
from typing import Optional

class RegisterRequest(BaseModel):
    email: EmailStr
    name: str
    password: str

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"

class AskRequest(BaseModel):
    doc_id: int
    query: str
    top_k: int = 4

class SummarizeRequest(BaseModel):
    doc_id: int
    scope: str = "full"  # or "chapter"
    chapter_hint: Optional[str] = None