import re
import uuid
from pathlib import Path
from typing import List, Dict, Any, Tuple
from pypdf import PdfReader
from app.config import CHUNK_SIZE, CHUNK_OVERLAP

class PDFService:
    @staticmethod
    def extract_text_with_pages(pdf_path: Path) -> List[Dict[str, Any]]:
        """
        Extracts text from PDF while strictly preserving 1-indexed page numbers.
        Returns a list of dicts: [{"page_number": int, "text": str}]
        """
        reader = PdfReader(str(pdf_path))
        pages_content = []

        for idx, page in enumerate(reader.pages):
            page_num = idx + 1
            raw_text = page.extract_text() or ""
            # Normalize whitespace
            clean_text = re.sub(r'[ \t]+', ' ', raw_text).strip()
            clean_text = re.sub(r'\n{3,}', '\n\n', clean_text)
            
            pages_content.append({
                "page_number": page_num,
                "text": clean_text
            })

        return pages_content

    @staticmethod
    def chunk_document(
        doc_id: str,
        doc_name: str,
        pages_content: List[Dict[str, Any]],
        chunk_size: int = CHUNK_SIZE,
        chunk_overlap: int = CHUNK_OVERLAP
    ) -> List[Dict[str, Any]]:
        """
        Splits text into chunks while preserving exact page number metadata.
        """
        chunks = []
        chunk_counter = 0

        for page in pages_content:
            page_num = page["page_number"]
            page_text = page["text"]

            if not page_text.strip():
                continue

            # Split into words/paragraphs for clean chunking
            words = page_text.split()
            if not words:
                continue

            # Character or word based chunking
            start = 0
            while start < len(words):
                end = min(start + chunk_size // 5, len(words))
                chunk_words = words[start:end]
                chunk_str = " ".join(chunk_words)

                if len(chunk_str.strip()) > 20: # ignore trivial fragments
                    chunk_counter += 1
                    chunk_id = f"{doc_id}_p{page_num}_c{chunk_counter}"
                    chunks.append({
                        "chunk_id": chunk_id,
                        "document_id": doc_id,
                        "document_name": doc_name,
                        "page_number": page_num,
                        "text": chunk_str
                    })

                if end >= len(words):
                    break
                # Advance with overlap
                start += max(1, (chunk_size // 5) - (chunk_overlap // 5))

        return chunks
