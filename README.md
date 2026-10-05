# DocuRAG — AI Document Intelligence Assistant

DocuRAG is a production-grade, portfolio-quality **AI Document RAG (Retrieval-Augmented Generation) System** built with **FastAPI**, **FAISS Vector Store**, **HuggingFace Sentence-Transformers**, and **Groq LLM**. It features a modern, responsive **Three-Panel UI (Sidebar, AI Chat, PDF Viewer)** adhering to a polished **Blue + White** SaaS design palette.

The core design principle is **strict factual grounding**: the AI answers questions *strictly and exclusively* from the uploaded PDF documents. If information is not in the document, it explicitly states so without hallucinating or inventing details.

---

## 🚀 Quick Start: How to Run the Project

### Prerequisites
- **Python 3.10+** (Tested on Python 3.13)
- **Node.js 18+** & **npm**

---

### Step 1: Start the Backend (FastAPI)

1. Open a terminal in the root directory:
   ```bash
   cd backend
   ```

2. Activate the virtual environment:
   - **Windows (PowerShell):**
     ```powershell
     .\venv\Scripts\Activate.ps1
     ```
   - **Windows (CMD):**
     ```cmd
     .\venv\Scripts\activate.bat
     ```
   - **Linux / macOS:**
     ```bash
     source venv/bin/activate
     ```

3. Ensure dependencies and environment variables are set:
   ```bash
   pip install -r requirements.txt
   ```
   *Note: `backend/.env` is pre-configured with your Groq API key and model settings.*

4. Launch the FastAPI server:
   ```bash
   python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
   ```
   The backend API will be live at: **`http://127.0.0.1:8000`**  
   Interactive API docs (Swagger): **`http://127.0.0.1:8000/docs`**

---

### Step 2: Start the Frontend (React + Vite)

1. Open a second terminal in the root directory:
   ```bash
   cd frontend
   ```

2. Install dependencies (if not already installed):
   ```bash
   npm install
   ```

3. Start the Vite development server:
   ```bash
   npm run dev
   ```
   The application will be live at: **`http://localhost:5173`**

---

## 🧪 Automated RAG Pipeline Verification

To run the automated test suite that validates PDF text extraction, FAISS vector indexing, multi-turn conversational memory, strict no-hallucination grounding, and cross-document retrieval:

```powershell
backend\venv\Scripts\python.exe -u backend\test_rag.py
```

---

## 🌟 Key Features

1. **Strict Factual Grounding (Zero Hallucination)**
   - System prompts enforce that answers are derived *strictly* from retrieved document chunks.
   - Refuses to use external world knowledge for private documents.
   - Responds: *"I could not find this information in the uploaded document."* when content is absent.

2. **Three-Panel Layout**
   - **Left Panel (Sidebar):** DocuRAG branding, "+ New Chat", PDF drag & drop upload, processed document cards with page counts and actions (Chat, View, Delete), Recent Chats list, vector store status.
   - **Center Panel (AI Chat):** Scope selector ("All Documents" or specific PDF), suggested questions, streaming/markdown answers, copy button, clickable source citations, collapsible *"▼ View Retrieved Context"* showing FAISS chunks with similarity scores.
   - **Right Panel (PDF Viewer):** Integrated PDF viewer with zoom controls, previous/next page navigation, direct page jump input, and **instant synchronization** when a source citation is clicked.

3. **Click-to-Page Source Citations**
   - Every answer that cites a document displays tags like: `📄 Annual_Financial_Report_2024.pdf • Page 1 ↗`.
   - Clicking the tag immediately focuses the PDF viewer on that exact document and page.

4. **Multi-Turn Conversation Memory**
   - Supports follow-up questions (e.g., *"What about the previous year?"*) using intelligent query rewriting while preserving strict document grounding.

---

## 🛠️ Architecture & Tech Stack

```text
DocuRAG Architecture
┌─────────────────────────┐     ┌────────────────────────┐     ┌────────────────────────┐
│     React + Vite        │◄───►│    FastAPI Backend     │◄───►│   FAISS Vector Store   │
│  (Tailwind, Lucide UI)  │     │  (Chunking & Routing)  │     │ (all-MiniLM-L6-v2)     │
└─────────────────────────┘     └───────────┬────────────┘     └────────────────────────┘
                                            │
                                            ▼
                                  ┌───────────────────┐
                                  │     Groq LLM      │
                                  │ (qwen/qwen3.8-27b)│
                                  └───────────────────┘
```

- **Frontend:** React 19, Vite, Tailwind CSS, Lucide Icons, React Markdown.
- **Backend:** FastAPI, Uvicorn, Pydantic, Python-Multipart.
- **Vector Database:** FAISS (`IndexFlatIP` with normalized vectors for cosine similarity).
- **Embeddings:** HuggingFace `sentence-transformers/all-MiniLM-L6-v2` (384-dimensional).
- **LLM Provider:** Groq Cloud (`qwen/qwen3.8-27b` / `openai/gpt-oss-120b`).
- **PDF Processing:** PyPDF page-aware text extraction with metadata preservation.

---

## 📁 Project Structure

```text
RAG_WITH_Frontnd/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI app entry point & CORS
│   │   ├── config.py            # Environment & path configs
│   │   ├── api/
│   │   │   ├── documents.py     # Upload, list, serve PDF, delete
│   │   │   └── chat.py          # RAG chat, streaming, history
│   │   ├── services/
│   │   │   ├── pdf_service.py   # Page-aware PDF extractor & chunker
│   │   │   ├── embedding_service.py # all-MiniLM-L6-v2 embeddings
│   │   │   ├── vector_store.py  # FAISS persistence & search
│   │   │   ├── llm_service.py   # Groq client with strict prompt
│   │   │   └── rag_service.py   # Query rewriter, retrieval, citation
│   │   └── schemas/
│   │       └── schemas.py       # Pydantic models
│   ├── data/
│   │   ├── uploads/             # Stored PDF files
│   │   └── faiss_index/         # Serialized FAISS index & metadata
│   ├── sample_docs/             # Multi-page test documents
│   ├── test_rag.py              # Automated RAG test suite
│   ├── create_sample_pdf.py     # PDF generator script
│   ├── requirements.txt         # Python dependencies
│   ├── .env                     # Pre-configured environment variables
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Sidebar.jsx      # Left sidebar
│   │   │   ├── ChatArea.jsx     # Center chat & citations
│   │   │   └── PDFViewer.jsx    # Right integrated PDF viewer
│   │   ├── services/
│   │   │   └── api.js           # REST API client
│   │   ├── App.jsx              # Main 3-panel layout state manager
│   │   └── index.css            # Tailwind & typography styling
│   ├── package.json
│   └── vite.config.js           # Server & proxy configuration
└── README.md
```
