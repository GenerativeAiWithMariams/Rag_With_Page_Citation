import numpy as np
from typing import List
from sentence_transformers import SentenceTransformer
from app.config import EMBEDDING_MODEL_NAME

class EmbeddingService:
    _instance = None
    _model = None

    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def __init__(self):
        print(f"Loading embedding model: {EMBEDDING_MODEL_NAME}...")
        self.model = SentenceTransformer(EMBEDDING_MODEL_NAME)
        self.dimension = self.model.get_embedding_dimension()
        print(f"Embedding model loaded. Dimension: {self.dimension}")

    def embed_texts(self, texts: List[str]) -> np.ndarray:
        """
        Generates normalized embeddings for a list of texts.
        """
        if not texts:
            return np.empty((0, self.dimension), dtype="float32")
        embeddings = self.model.encode(texts, convert_to_numpy=True, normalize_embeddings=True)
        return embeddings.astype("float32")

    def embed_query(self, query: str) -> np.ndarray:
        """
        Generates normalized embedding for a single query text.
        """
        emb = self.model.encode([query], convert_to_numpy=True, normalize_embeddings=True)
        return emb[0].astype("float32")
