import os
import json
import uuid
import datetime
from pathlib import Path
from typing import List, Optional
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from app.config import CHATS_DIR
from app.schemas.schemas import (
    ChatRequest,
    ChatResponse,
    Conversation,
    ConversationSummary,
    ChatMessage,
    SourceCitation,
    RetrievedChunk
)
from app.services.rag_service import RAGService

router = APIRouter(prefix="/api/chat", tags=["chat"])
rag_service = RAGService()

def _get_conversation_path(conv_id: str) -> Path:
    return CHATS_DIR / f"{conv_id}.json"

def _load_conversation(conv_id: str) -> Optional[Conversation]:
    path = _get_conversation_path(conv_id)
    if not path.exists():
        return None
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
            return Conversation(**data)
    except Exception as e:
        print(f"Error loading conversation {conv_id}: {e}")
        return None

def _save_conversation(conv: Conversation):
    path = _get_conversation_path(conv.id)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(conv.dict(), f, ensure_ascii=False, indent=2)

@router.post("", response_model=ChatResponse)
async def chat_message(req: ChatRequest):
    """
    Standard non-streaming chat endpoint with full RAG pipeline,
    conversation memory, strict grounding, and source citations.
    """
    conv_id = req.conversation_id or str(uuid.uuid4())[:8]
    now_str = datetime.datetime.now().strftime("%Y-%m-%d %H:%M")

    # Load or create conversation
    conv = _load_conversation(conv_id)
    if not conv:
        # Title generated from first question
        title = req.message[:40] + ("..." if len(req.message) > 40 else "")
        conv = Conversation(
            id=conv_id,
            title=title,
            created_at=now_str,
            updated_at=now_str,
            document_id=req.document_id,
            messages=[]
        )

    # Convert past messages for LLM history context
    history_turns = []
    for msg in conv.messages:
        history_turns.append({"role": msg.role, "content": msg.content})

    # Execute RAG
    rag_result = rag_service.answer_query(
        query=req.message,
        conversation_id=conv_id,
        document_id=req.document_id or "all",
        conversation_history=history_turns
    )

    # Add user message
    conv.messages.append(
        ChatMessage(
            role="user",
            content=req.message,
            timestamp=now_str
        )
    )

    # Add assistant message with citations and retrieved chunks
    conv.messages.append(
        ChatMessage(
            role="assistant",
            content=rag_result.answer,
            sources=rag_result.sources,
            retrieved_chunks=rag_result.retrieved_chunks,
            timestamp=now_str
        )
    )
    conv.updated_at = now_str
    _save_conversation(conv)

    return rag_result

@router.post("/stream")
async def chat_stream(req: ChatRequest):
    """
    Streaming chat endpoint via Server-Sent Events (SSE).
    Emits retrieval info first, then answer tokens, and final sources.
    """
    conv_id = req.conversation_id or str(uuid.uuid4())[:8]
    now_str = datetime.datetime.now().strftime("%Y-%m-%d %H:%M")

    conv = _load_conversation(conv_id)
    if not conv:
        title = req.message[:40] + ("..." if len(req.message) > 40 else "")
        conv = Conversation(
            id=conv_id,
            title=title,
            created_at=now_str,
            updated_at=now_str,
            document_id=req.document_id,
            messages=[]
        )

    history_turns = [{"role": m.role, "content": m.content} for m in conv.messages]

    # Retrieve context
    chunks, context_text, citations = rag_service.retrieve_context(
        query=req.message,
        document_id=req.document_id or "all",
        conversation_history=history_turns
    )

    async def event_generator():
        # Step 1: Send metadata event with retrieved chunks
        chunks_payload = [c.dict() for c in chunks]
        yield f"event: metadata\ndata: {json.dumps({'conversation_id': conv_id, 'chunks': chunks_payload})}\n\n"

        full_answer = ""

        if not chunks or not context_text.strip():
            not_found = "I could not find this information in the uploaded document."
            yield f"event: token\ndata: {json.dumps({'token': not_found})}\n\n"
            full_answer = not_found
            final_citations = []
        else:
            try:
                async for token in rag_service.llm_service.stream_grounded_answer(
                    query=req.message,
                    context_text=context_text,
                    conversation_history=history_turns
                ):
                    full_answer += token
                    yield f"event: token\ndata: {json.dumps({'token': token})}\n\n"
                
                # Check if answer says not found
                if "could not find this information" in full_answer.lower() or "not found in the provided" in full_answer.lower():
                    final_citations = []
                else:
                    final_citations = citations
            except Exception as e:
                err_msg = f"Error during generation: {str(e)}"
                yield f"event: error\ndata: {json.dumps({'error': err_msg})}\n\n"
                full_answer = err_msg
                final_citations = []

        # Step 2: Send sources
        citations_payload = [c.dict() for c in final_citations]
        yield f"event: done\ndata: {json.dumps({'sources': citations_payload})}\n\n"

        # Save to conversation memory
        conv.messages.append(ChatMessage(role="user", content=req.message, timestamp=now_str))
        conv.messages.append(
            ChatMessage(
                role="assistant",
                content=full_answer,
                sources=final_citations,
                retrieved_chunks=chunks,
                timestamp=now_str
            )
        )
        conv.updated_at = now_str
        _save_conversation(conv)

    return StreamingResponse(event_generator(), media_type="text/event-stream")

@router.get("/conversations", response_model=List[ConversationSummary])
def get_conversations():
    """
    Returns list of all saved conversations sorted by most recent.
    """
    summaries = []
    for file_path in CHATS_DIR.glob("*.json"):
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                summaries.append(
                    ConversationSummary(
                        id=data["id"],
                        title=data.get("title", "Conversation"),
                        created_at=data.get("created_at", ""),
                        updated_at=data.get("updated_at", ""),
                        document_id=data.get("document_id", "all"),
                        message_count=len(data.get("messages", []))
                    )
                )
        except Exception:
            continue

    summaries.sort(key=lambda s: s.updated_at, reverse=True)
    return summaries

@router.get("/conversations/{conversation_id}", response_model=Conversation)
def get_conversation_detail(conversation_id: str):
    """
    Returns complete messages for a given conversation.
    """
    conv = _load_conversation(conversation_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return conv

@router.delete("/conversations/{conversation_id}")
def delete_conversation(conversation_id: str):
    """
    Deletes conversation history.
    """
    path = _get_conversation_path(conversation_id)
    if path.exists():
        try:
            os.remove(path)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to delete conversation: {str(e)}")
    return {"message": "Conversation deleted successfully", "id": conversation_id}
