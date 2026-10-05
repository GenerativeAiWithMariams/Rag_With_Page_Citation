import os
from typing import List, Dict, Any, AsyncGenerator
from groq import Groq, AsyncGroq
from app.config import GROQ_API_KEY, GROQ_MODEL

STRICT_SYSTEM_PROMPT = """You are DocuRAG — an enterprise-grade AI Document Intelligence Assistant.

CRITICAL INSTRUCTIONS:
1. Answer the user's question STRICTLY and ONLY using the provided document context below.
2. Do NOT use outside or general world knowledge. Do NOT invent facts or hallucinate.
3. If the answer cannot be found in the provided document context, you MUST clearly and explicitly say:
   "I could not find this information in the uploaded document."
4. Do not speculate, extrapolate, or assume facts not explicitly written in the text.
5. Format your answers clearly using clean Markdown (bullet points, bold highlights, concise paragraphs).
6. When referencing specific facts from the text, state the facts accurately without altering numerical data or dates.
"""

class LLMService:
    def __init__(self):
        if not GROQ_API_KEY:
            raise ValueError("GROQ_API_KEY is not configured in backend/.env")
        self.client = Groq(api_key=GROQ_API_KEY)
        self.async_client = AsyncGroq(api_key=GROQ_API_KEY)
        self.model = GROQ_MODEL

    def generate_grounded_answer(
        self,
        query: str,
        context_text: str,
        conversation_history: List[Dict[str, str]] = None
    ) -> str:
        """
        Generates a non-streaming grounded answer using Groq.
        """
        messages = [
            {"role": "system", "content": STRICT_SYSTEM_PROMPT}
        ]

        # Add recent conversation memory (last 4 turns for context awareness)
        if conversation_history:
            for turn in conversation_history[-4:]:
                messages.append({"role": turn["role"], "content": turn["content"]})

        # Add the current question with strict retrieved context
        user_prompt = f"""DOCUMENT CONTEXT:
---
{context_text if context_text.strip() else "[NO RELEVANT DOCUMENT CONTEXT FOUND]"}
---

USER QUESTION:
{query}

Remember: Answer STRICTLY from the DOCUMENT CONTEXT above. If the information is not present, reply that it was not found in the document."""

        messages.append({"role": "user", "content": user_prompt})

        response = self.client.chat.completions.create(
            model=self.model,
            messages=messages,
            temperature=0.0, # zero temperature for deterministic, factual extraction
            max_tokens=600,
        )

        return response.choices[0].message.content

    async def stream_grounded_answer(
        self,
        query: str,
        context_text: str,
        conversation_history: List[Dict[str, str]] = None
    ) -> AsyncGenerator[str, None]:
        """
        Streams grounded answer chunks from Groq.
        """
        messages = [
            {"role": "system", "content": STRICT_SYSTEM_PROMPT}
        ]

        if conversation_history:
            for turn in conversation_history[-4:]:
                messages.append({"role": turn["role"], "content": turn["content"]})

        user_prompt = f"""DOCUMENT CONTEXT:
---
{context_text if context_text.strip() else "[NO RELEVANT DOCUMENT CONTEXT FOUND]"}
---

USER QUESTION:
{query}

Remember: Answer STRICTLY from the DOCUMENT CONTEXT above. If the information is not present, reply that it was not found in the document."""

        messages.append({"role": "user", "content": user_prompt})

        stream = await self.async_client.chat.completions.create(
            model=self.model,
            messages=messages,
            temperature=0.0,
            max_tokens=600,
            stream=True
        )

        async for chunk in stream:
            delta = chunk.choices[0].delta.content
            if delta:
                yield delta
