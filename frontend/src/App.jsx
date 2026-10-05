import React, { useState, useEffect } from "react";
import Sidebar from "./components/Sidebar";
import ChatArea from "./components/ChatArea";
import PDFViewer from "./components/PDFViewer";
import { api } from "./services/api";

export default function App() {
  const [documents, setDocuments] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [selectedDocumentId, setSelectedDocumentId] = useState("all");
  
  // PDF Viewer State
  const [pdfViewerOpen, setPdfViewerOpen] = useState(true);
  const [viewerDocument, setViewerDocument] = useState(null);
  const [viewerTargetPage, setViewerTargetPage] = useState(null);
  const [viewerJumpKey, setViewerJumpKey] = useState(0);
  const [viewerCitedPages, setViewerCitedPages] = useState([]);

  // Status & loading states
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");
  const [backendHealth, setBackendHealth] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);

  const showToast = (msg, type = "info") => {
    setToastMessage({ msg, type });
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Initial load: health check, documents, conversations
  const fetchData = async () => {
    try {
      const health = await api.checkHealth();
      setBackendHealth(health);
    } catch (e) {
      console.warn("Backend not running yet or unreachable");
    }

    try {
      const docs = await api.getDocuments();
      setDocuments(docs);
    } catch (e) {
      console.warn("Could not fetch documents", e);
    }

    try {
      const convs = await api.getConversations();
      setConversations(convs);
    } catch (e) {
      console.warn("Could not fetch conversations", e);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 8000);
    return () => clearInterval(interval);
  }, []);

  // Upload handler
  const handleUploadFiles = async (files) => {
    if (!files || files.length === 0) return;
    setIsUploading(true);
    setUploadProgress(`Processing ${files.length} document(s)...`);

    try {
      setUploadProgress("Extracting text and chunking pages...");
      const uploaded = await api.uploadDocuments(files);
      setDocuments((prev) => [...uploaded, ...prev]);
      if (uploaded.length > 0) {
        setViewerDocument(uploaded[0]);
        setViewerTargetPage(1);
        setPdfViewerOpen(true);
      }
      showToast(`Successfully processed & indexed ${uploaded.length} document(s)!`, "success");
      fetchData();
    } catch (err) {
      showToast(err.message || "Upload failed", "error");
    } finally {
      setIsUploading(false);
      setUploadProgress("");
    }
  };

  // Delete document handler
  const handleDeleteDocument = async (id) => {
    if (!confirm("Are you sure you want to delete this document from FAISS and storage?")) return;
    try {
      await api.deleteDocument(id);
      setDocuments((prev) => prev.filter((d) => d.id !== id));
      if (viewerDocument?.id === id) {
        setViewerDocument(documents.find((d) => d.id !== id) || null);
      }
      if (selectedDocumentId === id) {
        setSelectedDocumentId("all");
      }
      showToast("Document removed and vectors purged from FAISS", "info");
      fetchData();
    } catch (err) {
      showToast(err.message || "Failed to delete document", "error");
    }
  };

  // Start a new chat
  const handleNewChat = () => {
    setActiveConversationId(null);
    setMessages([]);
    showToast("Started a fresh conversation", "info");
  };

  // Select conversation from history
  const handleSelectConversation = async (convId) => {
    try {
      const conv = await api.getConversation(convId);
      setActiveConversationId(conv.id);
      setMessages(conv.messages || []);
      if (conv.document_id) {
        setSelectedDocumentId(conv.document_id);
      }
    } catch (err) {
      showToast("Failed to load conversation", "error");
    }
  };

  // Delete conversation
  const handleDeleteConversation = async (convId) => {
    try {
      await api.deleteConversation(convId);
      setConversations((prev) => prev.filter((c) => c.id !== convId));
      if (activeConversationId === convId) {
        handleNewChat();
      }
      showToast("Chat deleted", "info");
    } catch (err) {
      showToast("Failed to delete chat", "error");
    }
  };

  // Send message
  const handleSendMessage = async (userText) => {
    if (!userText.trim()) return;

    // Immediately add user message to UI
    const newUserMsg = { role: "user", content: userText };
    setMessages((prev) => [...prev, newUserMsg]);
    setIsLoading(true);

    try {
      const response = await api.sendMessage({
        message: userText,
        conversation_id: activeConversationId,
        document_id: selectedDocumentId || "all",
      });

      // Update active conversation ID if newly created
      if (!activeConversationId && response.conversation_id) {
        setActiveConversationId(response.conversation_id);
      }

      // Add assistant response
      const newAssistantMsg = {
        role: "assistant",
        content: response.answer,
        sources: response.sources,
        retrieved_chunks: response.retrieved_chunks,
      };

      setMessages((prev) => [...prev, newAssistantMsg]);
      fetchData(); // refresh conversation list titles
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `⚠️ Error: ${err.message || "Failed to generate answer"}. Please verify backend status and API key.`,
          sources: [],
          retrieved_chunks: [],
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // Open Document in Viewer from Sidebar
  const handleOpenDocumentInViewer = (doc, page = 1) => {
    setViewerDocument((prev) => (prev?.id === doc.id ? prev : doc));
    setViewerTargetPage(page);
    setViewerJumpKey((k) => k + 1);
    setPdfViewerOpen(true);
  };

  // When user clicks a source citation in chat:
  // Immediately select that document and jump to the exact page!
  const handleSourceClick = (documentId, pageNumber, docName) => {
    // 1. Find document by ID
    let targetDoc = documents.find((d) => d.id === documentId);
    // 2. Fallback: match by filename
    if (!targetDoc && docName) {
      targetDoc = documents.find((d) => d.filename === docName);
    }
    // 3. Fallback: case-insensitive match
    if (!targetDoc && docName) {
      targetDoc = documents.find(
        (d) =>
          d.filename.toLowerCase() === docName.toLowerCase() ||
          d.filename.toLowerCase().includes(docName.toLowerCase()) ||
          docName.toLowerCase().includes(d.filename.toLowerCase())
      );
    }
    // 4. Fallback object so backend /api/documents/{documentId}/file can still be loaded
    if (!targetDoc) {
      targetDoc = {
        id: documentId,
        filename: docName || "Document",
        page_count: null,
      };
    }

    setViewerDocument((prev) => {
      if (prev?.id !== targetDoc.id) {
        setViewerCitedPages([pageNumber]);
        return targetDoc;
      } else {
        setViewerCitedPages((pages) =>
          pages.includes(pageNumber) ? pages : [...pages, pageNumber]
        );
        return prev; // Keeps reference stable so PDF doesn't reload
      }
    });

    setViewerTargetPage(pageNumber);
    setViewerJumpKey((k) => k + 1);
    setPdfViewerOpen(true);
    showToast(`Jumped to ${targetDoc.filename} — Page ${pageNumber}`, "info");
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50 font-sans text-slate-800 antialiased">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-lg text-xs font-medium border transition-all animate-in fade-in slide-in-from-top-2 ${
            toastMessage.type === "error"
              ? "bg-red-50 text-red-700 border-red-200"
              : toastMessage.type === "success"
              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
              : "bg-blue-50 text-blue-700 border-blue-200"
          }`}
        >
          <span>{toastMessage.msg}</span>
        </div>
      )}

      {/* Panel 1: Left Sidebar */}
      <Sidebar
        documents={documents}
        conversations={conversations}
        activeConversationId={activeConversationId}
        onSelectConversation={handleSelectConversation}
        onNewChat={handleNewChat}
        onDeleteConversation={handleDeleteConversation}
        onUploadFiles={handleUploadFiles}
        onDeleteDocument={handleDeleteDocument}
        onOpenDocumentInViewer={handleOpenDocumentInViewer}
        onSelectDocumentFilter={setSelectedDocumentId}
        selectedDocumentId={selectedDocumentId}
        isUploading={isUploading}
        uploadProgress={uploadProgress}
        backendHealth={backendHealth}
      />

      {/* Panel 2: Center AI Chat */}
      <ChatArea
        messages={messages}
        onSendMessage={handleSendMessage}
        isLoading={isLoading}
        selectedDocumentId={selectedDocumentId}
        documents={documents}
        onClearDocumentFilter={() => setSelectedDocumentId("all")}
        onSourceClick={handleSourceClick}
        pdfViewerOpen={pdfViewerOpen}
        onTogglePdfViewer={() => setPdfViewerOpen(!pdfViewerOpen)}
      />

      {/* Panel 3: Right PDF Viewer */}
      {pdfViewerOpen && (
        <PDFViewer
          document={viewerDocument}
          targetPage={viewerTargetPage}
          jumpKey={viewerJumpKey}
          citedPages={viewerCitedPages}
          onClose={() => setPdfViewerOpen(false)}
        />
      )}
    </div>
  );
}
