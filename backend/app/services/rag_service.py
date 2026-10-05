import json
from typing import List, Dict, Any, Tuple, Optional
from app.services.embedding_service import EmbeddingService
from app.services.vector_store import VectorStore
from app.services.llm_service import LLMService
from app.schemas.schemas import SourceCitation, RetrievedChunk, ChatResponse
from app.config import TOP_K_RETRIEVAL

class RAGService:
    def __init__(self):
        self.embedding_service = EmbeddingService.get_instance()
        self.vector_store = VectorStore.get_instance()
        self.llm_service = LLMService()

    def _reformulate_query_if_needed(self, query: str, conversation_history: List[Dict[str, str]]) -> str:
        """
        Uses conversation history to resolve pronouns or follow-up references
        into a standalone retrieval query.
        """
        if not conversation_history or len(conversation_history) < 2:
            return query

        try:
            # Quick light reformulation prompt
            reformulate_prompt = [
                {
                    "role": "system",
                    "content": (
                        "You are a query rewriting assistant for a document search system. "
                        "Given the chat history and the latest user query, rewrite the user query "
                        "into a standalone search question that can be used for semantic search. "
                        "If the user query is already standalone, return it as-is. "
                        "Respond ONLY with the rewritten query, nothing else."
                    )
                }
            ]
            for msg in conversation_history[-3:]:
                reformulate_prompt.append({"role": msg["role"], "content": msg["content"]})
            reformulate_prompt.append({"role": "user", "content": f"Rewrite this query: {query}"})

            rewritten = self.llm_service.client.chat.completions.create(
                model=self.llm_service.model,
                messages=reformulate_prompt,
                max_tokens=60,
                temperature=0.0
            ).choices[0].message.content.strip()

            return rewritten if rewritten else query
        except Exception as e:
            print(f"Error reformulating query: {e}")
            return query

    def retrieve_context(
        self,
        query: str,
        document_id: Optional[str] = "all",
        conversation_history: List[Dict[str, str]] = None
    ) -> Tuple[List[RetrievedChunk], str, List[SourceCitation]]:
        """
        Retrieves top relevant chunks from FAISS and prepares formatted context and citations.
        """
        # If follow-up, contextualize query for vector search
        search_query = self._reformulate_query_if_needed(query, conversation_history or [])
        
        # Embed query
        query_vector = self.embedding_service.embed_query(search_query)

        # FAISS search
        chunks = self.vector_store.search(
            query_vector=query_vector,
            top_k=TOP_K_RETRIEVAL,
            document_id=document_id if document_id != "all" else None,
            min_score=0.15
        )

        if not chunks:
            return [], "", []

        # Build formatted context block
        context_parts = []
        citations_map: Dict[Tuple[str, int], SourceCitation] = {}

        for chk in chunks:
            part = f"[Document: {chk.document_name} | Page: {chk.page_number}]\n{chk.text}\n"
            context_parts.append(part)

            citation_key = (chk.document_id, chk.page_number)
            if citation_key not in citations_map:
                citations_map[citation_key] = SourceCitation(
                    document_id=chk.document_id,
                    document_name=chk.document_name,
                    page_number=chk.page_number,
                    snippet=chk.text[:140] + ("..." if len(chk.text) > 140 else "")
                )

        formatted_context = "\n---\n".join(context_parts)
        citations = list(citations_map.values())

        return chunks, formatted_context, citations

    def answer_query(
        self,
        query: str,
        conversation_id: str,
        document_id: Optional[str] = "all",
        conversation_history: List[Dict[str, str]] = None
    ) -> ChatResponse:
        """
        Synchronous end-to-end RAG answer generation.
        """
        chunks, context_text, citations = self.retrieve_context(
            query=query,
            document_id=document_id,
            conversation_history=conversation_history
        )

        if not chunks or not context_text.strip():
            answer = "I could not find this information in the uploaded document."
            return ChatResponse(
                conversation_id=conversation_id,
                answer=answer,
                sources=[],
                retrieved_chunks=[]
            )

        answer = self.llm_service.generate_grounded_answer(
            query=query,
            context_text=context_text,
            conversation_history=conversation_history
        )

        # If LLM indicates not found, do not attach deceptive sources
        if "could not find this information" in answer.lower() or "not found in the provided" in answer.lower():
            citations = []

        return ChatResponse(
            conversation_id=conversation_id,
            answer=answer,
            sources=citations,
            retrieved_chunks=chunks
        )
