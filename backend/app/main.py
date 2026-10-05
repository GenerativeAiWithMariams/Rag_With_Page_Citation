import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import GROQ_MODEL, EMBEDDING_MODEL_NAME
from app.api.documents import router as documents_router
from app.api.chat import router as chat_router
from app.services.vector_store import VectorStore
from app.services.embedding_service import EmbeddingService

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("Initializing DocuRAG services...")
    # Preload vector store & embedding model
    try:
        VectorStore.get_instance()
        EmbeddingService.get_instance()
        print("DocuRAG services initialized successfully.")
    except Exception as e:
        print(f"Warning during initialization: {e}")
    yield
    print("Shutting down DocuRAG services...")

app = FastAPI(
    title="DocuRAG API",
    description="Enterprise-grade Document Intelligence RAG API with FAISS, HuggingFace embeddings, and Groq LLM",
    version="1.0.0",
    lifespan=lifespan
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routes
app.include_router(documents_router)
app.include_router(chat_router)

@app.get("/api/health")
def health_check():
    vector_store = VectorStore.get_instance()
    total_vectors = vector_store.index.ntotal if vector_store.index else 0
    return {
        "status": "healthy",
        "service": "DocuRAG API",
        "llm_model": GROQ_MODEL,
        "embedding_model": EMBEDDING_MODEL_NAME,
        "faiss_total_vectors": total_vectors,
        "total_chunks_stored": len(vector_store.metadata)
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="127.0.0.1", port=8000, reload=True)
