import os
import json
import uuid
import datetime
from pathlib import Path
from typing import List
from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import FileResponse
from app.config import UPLOADS_DIR, DATA_DIR
from app.schemas.schemas import DocumentInfo
from app.services.pdf_service import PDFService
from app.services.embedding_service import EmbeddingService
from app.services.vector_store import VectorStore

router = APIRouter(prefix="/api/documents", tags=["documents"])

DOCS_META_FILE = DATA_DIR / "documents.json"

def _load_documents_db() -> List[dict]:
    if DOCS_META_FILE.exists():
        try:
            with open(DOCS_META_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return []
    return []

def _save_documents_db(docs: List[dict]):
    with open(DOCS_META_FILE, "w", encoding="utf-8") as f:
        json.dump(docs, f, ensure_ascii=False, indent=2)

@router.post("/upload", response_model=List[DocumentInfo])
async def upload_documents(files: List[UploadFile] = File(...)):
    """
    Handles PDF upload, validates file type, extracts text, chunks, computes embeddings,
    and updates the FAISS vector database.
    """
    embedding_service = EmbeddingService.get_instance()
    vector_store = VectorStore.get_instance()
    docs_db = _load_documents_db()
    processed_docs: List[DocumentInfo] = []

    for file in files:
        if not file.filename.lower().endswith(".pdf"):
            raise HTTPException(status_code=400, detail=f"File '{file.filename}' is not a PDF.")

        # Sanitize filename & generate unique ID
        clean_name = os.path.basename(file.filename)
        doc_id = str(uuid.uuid4())[:8]
        saved_file_path = UPLOADS_DIR / f"{doc_id}_{clean_name}"

        # Write file to disk
        content = await file.read()
        if len(content) == 0:
            raise HTTPException(status_code=400, detail=f"File '{file.filename}' is empty.")

        with open(saved_file_path, "wb") as f:
            f.write(content)

        # Extract text per page
        try:
            pages_content = PDFService.extract_text_with_pages(saved_file_path)
        except Exception as e:
            if saved_file_path.exists():
                os.remove(saved_file_path)
            raise HTTPException(status_code=500, detail=f"Failed to parse PDF '{file.filename}': {str(e)}")

        page_count = len(pages_content)
        if page_count == 0:
            if saved_file_path.exists():
                os.remove(saved_file_path)
            raise HTTPException(status_code=400, detail=f"PDF '{file.filename}' contains no readable pages.")

        # Chunk text
        chunks = PDFService.chunk_document(
            doc_id=doc_id,
            doc_name=clean_name,
            pages_content=pages_content
        )

        chunk_count = len(chunks)

        # Generate embeddings and add to FAISS
        if chunk_count > 0:
            chunk_texts = [c["text"] for c in chunks]
            embeddings = embedding_service.embed_texts(chunk_texts)
            vector_store.add_chunks(chunks, embeddings)

        doc_record = {
            "id": doc_id,
            "filename": clean_name,
            "file_size": len(content),
            "page_count": page_count,
            "upload_time": datetime.datetime.now().strftime("%Y-%m-%d %H:%M"),
            "status": "ready",
            "chunk_count": chunk_count,
            "file_path": str(saved_file_path)
        }

        docs_db.append(doc_record)
        processed_docs.append(DocumentInfo(**doc_record))

    _save_documents_db(docs_db)
    return processed_docs

@router.get("", response_model=List[DocumentInfo])
def get_all_documents():
    """
    Returns list of all uploaded and indexed documents.
    """
    docs_db = _load_documents_db()
    # verify files still exist
    valid_docs = []
    for d in docs_db:
        valid_docs.append(DocumentInfo(**d))
    return valid_docs

@router.get("/{document_id}/file")
def get_document_pdf(document_id: str):
    """
    Serves the raw PDF file for the PDF viewer.
    """
    docs_db = _load_documents_db()
    doc = next((d for d in docs_db if d["id"] == document_id), None)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    file_path = Path(doc["file_path"])
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="PDF file missing on server")

    return FileResponse(
        path=str(file_path),
        media_type="application/pdf",
        filename=doc["filename"],
        content_disposition_type="inline"
    )

@router.delete("/{document_id}")
def delete_document(document_id: str):
    """
    Deletes document file, records, and purges its vectors from the FAISS index.
    """
    docs_db = _load_documents_db()
    doc = next((d for d in docs_db if d["id"] == document_id), None)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    # Remove physical file
    file_path = Path(doc.get("file_path", ""))
    if file_path.exists():
        try:
            os.remove(file_path)
        except Exception as e:
            print(f"Error removing file {file_path}: {e}")

    # Remove from FAISS index
    embedding_service = EmbeddingService.get_instance()
    vector_store = VectorStore.get_instance()
    vector_store.delete_document(document_id, embedding_service)

    # Remove from documents database
    docs_db = [d for d in docs_db if d["id"] != document_id]
    _save_documents_db(docs_db)

    return {"message": "Document deleted successfully", "document_id": document_id}
