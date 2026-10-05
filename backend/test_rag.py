import os
import sys
from pathlib import Path

# Add backend to sys.path
BASE_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(BASE_DIR))

from app.services.pdf_service import PDFService
from app.services.embedding_service import EmbeddingService
from app.services.vector_store import VectorStore
from app.services.rag_service import RAGService
from app.schemas.schemas import ChatResponse

def run_test():
    print("--- 1. Initializing Embedding Service & FAISS Vector Store ---")
    embedding_service = EmbeddingService.get_instance()
    vector_store = VectorStore.get_instance()
    rag_service = RAGService()

    fin_pdf = BASE_DIR / "sample_docs" / "Annual_Financial_Report_2024.pdf"
    res_pdf = BASE_DIR / "sample_docs" / "Research_Paper_AI_Agents.pdf"

    print(f"Loading {fin_pdf.name}...")
    pages1 = PDFService.extract_text_with_pages(fin_pdf)
    print(f"Extracted {len(pages1)} pages.")
    chunks1 = PDFService.chunk_document("doc_fin_01", fin_pdf.name, pages1)
    print(f"Created {len(chunks1)} chunks. Computing embeddings...")
    emb1 = embedding_service.embed_texts([c["text"] for c in chunks1])
    vector_store.add_chunks(chunks1, emb1)

    print(f"\nLoading {res_pdf.name}...")
    pages2 = PDFService.extract_text_with_pages(res_pdf)
    print(f"Extracted {len(pages2)} pages.")
    chunks2 = PDFService.chunk_document("doc_res_02", res_pdf.name, pages2)
    print(f"Created {len(chunks2)} chunks. Computing embeddings...")
    emb2 = embedding_service.embed_texts([c["text"] for c in chunks2])
    vector_store.add_chunks(chunks2, emb2)

    print("\n--- 2. Test Flow 1: Fact Retrieval & Page Citation ---")
    q1 = "What was the company's consolidated revenue for fiscal year 2024?"
    print(f"Q: {q1}")
    res1: ChatResponse = rag_service.answer_query(q1, "conv_test", document_id="all")
    print(f"A: {res1.answer}")
    print(f"Sources: {[(s.document_name, s.page_number) for s in res1.sources]}")

    print("\n--- 3. Test Flow 2: Multi-Turn Conversation Memory ---")
    q2 = "What about the previous year?"
    print(f"Q: {q2}")
    history = [
        {"role": "user", "content": q1},
        {"role": "assistant", "content": res1.answer}
    ]
    res2: ChatResponse = rag_service.answer_query(q2, "conv_test", document_id="all", conversation_history=history)
    print(f"A: {res2.answer}")
    print(f"Sources: {[(s.document_name, s.page_number) for s in res2.sources]}")

    print("\n--- 4. Test Flow 3: Strict No-Hallucination Grounding ---")
    q3 = "What is the CEO's favorite food?"
    print(f"Q: {q3}")
    res3: ChatResponse = rag_service.answer_query(q3, "conv_test", document_id="all")
    print(f"A: {res3.answer}")
    print(f"Sources count: {len(res3.sources)}")

    print("\n--- 5. Test Flow 4: Cross-Document Retrieval ---")
    q4 = "What chunking size and overlap were used in the research paper methodology?"
    print(f"Q: {q4}")
    res4: ChatResponse = rag_service.answer_query(q4, "conv_test", document_id="all")
    print(f"A: {res4.answer}")
    print(f"Sources: {[(s.document_name, s.page_number) for s in res4.sources]}")

    print("\nALL BACKEND RAG TESTS COMPLETED SUCCESSFULLY!")

if __name__ == "__main__":
    run_test()
