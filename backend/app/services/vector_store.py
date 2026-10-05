import json
import os
from pathlib import Path
from typing import List, Dict, Any, Optional
import faiss
import numpy as np
from app.config import INDEX_DIR
from app.schemas.schemas import RetrievedChunk

class VectorStore:
    _instance = None

    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def __init__(self, dimension: int = 384):
        self.dimension = dimension
        self.index_file = INDEX_DIR / "faiss.index"
        self.meta_file = INDEX_DIR / "metadata.json"
        
        # In-memory metadata list parallel to FAISS index IDs: list of chunk dicts
        self.metadata: List[Dict[str, Any]] = []
        self.index: Optional[faiss.Index] = None
        self._load_or_create()

    def _load_or_create(self):
        if self.index_file.exists() and self.meta_file.exists():
            try:
                self.index = faiss.read_index(str(self.index_file))
                with open(self.meta_file, "r", encoding="utf-8") as f:
                    self.metadata = json.load(f)
                print(f"Loaded existing FAISS index with {self.index.ntotal} vectors and {len(self.metadata)} metadata records.")
                return
            except Exception as e:
                print(f"Failed to load existing index: {e}. Creating a new one.")

        # Create IndexFlatIP (Inner Product = Cosine Similarity with normalized vectors)
        self.index = faiss.IndexFlatIP(self.dimension)
        self.metadata = []
        self._save()

    def _save(self):
        try:
            if self.index is not None:
                faiss.write_index(self.index, str(self.index_file))
            with open(self.meta_file, "w", encoding="utf-8") as f:
                json.dump(self.metadata, f, ensure_ascii=False, indent=2)
        except Exception as e:
            print(f"Error saving FAISS vector store: {e}")

    def add_chunks(self, chunks: List[Dict[str, Any]], embeddings: np.ndarray):
        """
        Adds vectors and corresponding metadata to FAISS.
        """
        if len(chunks) == 0 or embeddings.shape[0] == 0:
            return

        # Ensure embeddings are float32
        embeddings = embeddings.astype("float32")
        self.index.add(embeddings)
        self.metadata.extend(chunks)
        self._save()
        print(f"Added {len(chunks)} chunks to FAISS. Total vectors: {self.index.ntotal}")

    def search(
        self,
        query_vector: np.ndarray,
        top_k: int = 5,
        document_id: Optional[str] = None,
        min_score: float = 0.20
    ) -> List[RetrievedChunk]:
        """
        Performs similarity search in FAISS.
        Filters by document_id if provided and not "all".
        """
        if self.index is None or self.index.ntotal == 0:
            return []

        # Query vector shape: (1, dimension)
        query_vector = np.expand_dims(query_vector, axis=0).astype("float32")
        
        # Fetch more candidates to allow for post-filtering by document_id
        search_k = min(self.index.ntotal, max(top_k * 4, 20))
        scores, indices = self.index.search(query_vector, search_k)

        results: List[RetrievedChunk] = []
        for score, idx in zip(scores[0], indices[0]):
            if idx < 0 or idx >= len(self.metadata):
                continue
            
            chunk_meta = self.metadata[idx]
            
            # Apply document filter if specified
            if document_id and document_id != "all":
                if chunk_meta.get("document_id") != document_id:
                    continue

            # Check minimum similarity score
            float_score = float(score)
            if float_score < min_score:
                continue

            results.append(
                RetrievedChunk(
                    chunk_id=chunk_meta.get("chunk_id", f"chk_{idx}"),
                    document_id=chunk_meta.get("document_id", ""),
                    document_name=chunk_meta.get("document_name", ""),
                    page_number=chunk_meta.get("page_number", 1),
                    text=chunk_meta.get("text", ""),
                    score=round(float_score, 4)
                )
            )

            if len(results) >= top_k:
                break

        return results

    def delete_document(self, document_id: str, embedding_service):
        """
        Deletes all chunks belonging to a document and rebuilds index.
        """
        remaining_chunks = [c for c in self.metadata if c.get("document_id") != document_id]
        if len(remaining_chunks) == len(self.metadata):
            return # nothing to delete

        print(f"Rebuilding FAISS index after removing doc: {document_id}")
        self.metadata = remaining_chunks
        self.index = faiss.IndexFlatIP(self.dimension)

        if remaining_chunks:
            texts = [c["text"] for c in remaining_chunks]
            new_embeddings = embedding_service.embed_texts(texts)
            self.index.add(new_embeddings)

        self._save()
        print(f"FAISS index rebuilt. Remaining vectors: {self.index.ntotal}")

    def get_document_chunk_count(self, document_id: str) -> int:
        return sum(1 for c in self.metadata if c.get("document_id") == document_id)
