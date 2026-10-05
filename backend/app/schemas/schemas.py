from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any

class DocumentInfo(BaseModel):
    id: str
    filename: str
    file_size: int
    page_count: int
    upload_time: str
    status: str = "ready"
    chunk_count: int = 0

class SourceCitation(BaseModel):
    document_id: str
    document_name: str
    page_number: int
    snippet: str

class RetrievedChunk(BaseModel):
    chunk_id: str
    document_id: str
    document_name: str
    page_number: int
    text: str
    score: float

class ChatMessage(BaseModel):
    role: str # "user" | "assistant" | "system"
    content: str
    sources: Optional[List[SourceCitation]] = None
    retrieved_chunks: Optional[List[RetrievedChunk]] = None
    timestamp: Optional[str] = None

class ChatRequest(BaseModel):
    message: str
    conversation_id: Optional[str] = None
    document_id: Optional[str] = "all" # "all" or specific document ID

class ChatResponse(BaseModel):
    conversation_id: str
    answer: str
    sources: List[SourceCitation]
    retrieved_chunks: List[RetrievedChunk]

class Conversation(BaseModel):
    id: str
    title: str
    created_at: str
    updated_at: str
    document_id: Optional[str] = "all"
    messages: List[ChatMessage] = []

class ConversationSummary(BaseModel):
    id: str
    title: str
    created_at: str
    updated_at: str
    document_id: Optional[str] = "all"
    message_count: int
