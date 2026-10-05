import React, { useRef, useState } from "react";
import {
  FileText,
  Plus,
  UploadCloud,
  Trash2,
  Eye,
  MessageSquare,
  Sparkles,
  Layers,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ChevronRight,
  Database
} from "lucide-react";

export default function Sidebar({
  documents = [],
  conversations = [],
  activeConversationId,
  onSelectConversation,
  onNewChat,
  onDeleteConversation,
  onUploadFiles,
  onDeleteDocument,
  onOpenDocumentInViewer,
  onSelectDocumentFilter,
  selectedDocumentId,
  isUploading,
  uploadProgress,
  backendHealth,
}) {
  const fileInputRef = useRef(null);
  const [dragActive, setDragActive] = useState(false);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onUploadFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      onUploadFiles(Array.from(e.target.files));
      e.target.value = "";
    }
  };

  return (
    <aside className="w-80 h-full bg-white border-r border-slate-200 flex flex-col justify-between shrink-0 select-none shadow-sm">
      {/* Top Branding & New Chat */}
      <div className="p-4 border-b border-slate-100 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md shadow-brand-500/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-slate-900 tracking-tight text-lg">DocuRAG</span>
                <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded-full bg-brand-50 text-brand-600 border border-brand-200">
                  Strict
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">AI Document Intelligence</p>
            </div>
          </div>
        </div>

        {/* New Chat Button */}
        <button
          onClick={onNewChat}
          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-brand-700 text-white font-medium text-sm transition-all shadow-sm hover:shadow active:scale-[0.99]"
        >
          <Plus className="w-4 h-4" />
          <span>New Chat</span>
        </button>
      </div>

      {/* Scrollable Center: Upload, Documents & Recent Chats */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-5">
        {/* Upload Area */}
        <div>
          <div className="flex items-center justify-between mb-2 px-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Upload PDF
            </span>
          </div>

          <div
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-3.5 text-center cursor-pointer transition-all ${
              dragActive
                ? "border-brand-500 bg-brand-50"
                : "border-slate-200 hover:border-brand-400 hover:bg-slate-50/70"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              multiple
              onChange={handleFileChange}
              className="hidden"
            />
            {isUploading ? (
              <div className="flex flex-col items-center gap-1.5 py-1">
                <Loader2 className="w-6 h-6 text-brand-600 animate-spin" />
                <span className="text-xs font-medium text-brand-700">
                  {uploadProgress || "Embedding into FAISS..."}
                </span>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-1.5">
                <div className="w-8 h-8 rounded-full bg-brand-50 flex items-center justify-center text-brand-600">
                  <UploadCloud className="w-4 h-4" />
                </div>
                <div className="text-xs font-medium text-slate-700">
                  <span className="text-brand-600 font-semibold">Click to upload</span> or drag PDF
                </div>
                <span className="text-[10px] text-slate-400">Preserves exact page citations</span>
              </div>
            )}
          </div>
        </div>

        {/* Documents Section */}
        <div>
          <div className="flex items-center justify-between mb-2 px-1">
            <div className="flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Documents ({documents.length})
              </span>
            </div>
            {documents.length > 0 && (
              <button
                onClick={() => onSelectDocumentFilter(selectedDocumentId === "all" ? "" : "all")}
                className={`text-[11px] font-medium px-2 py-0.5 rounded transition ${
                  selectedDocumentId === "all"
                    ? "bg-brand-100 text-brand-700"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                All Docs
              </button>
            )}
          </div>

          {documents.length === 0 ? (
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 text-center">
              <FileText className="w-6 h-6 text-slate-300 mx-auto mb-1.5" />
              <p className="text-xs font-medium text-slate-500">No documents yet</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Upload a PDF to begin asking questions</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {documents.map((doc) => {
                const isFiltered = selectedDocumentId === doc.id;
                return (
                  <div
                    key={doc.id}
                    className={`group relative rounded-xl border p-2.5 transition-all ${
                      isFiltered
                        ? "bg-brand-50/70 border-brand-300 shadow-sm"
                        : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50"
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 mt-0.5">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-slate-800 truncate" title={doc.filename}>
                          {doc.filename}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-400">
                          <span>{doc.page_count} {doc.page_count === 1 ? "page" : "pages"}</span>
                          <span>•</span>
                          <span className="text-emerald-600 font-medium flex items-center gap-0.5">
                            <CheckCircle2 className="w-2.5 h-2.5" /> Ready
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Quick Document Actions */}
                    <div className="flex items-center justify-end gap-1 mt-2 pt-1.5 border-t border-slate-100">
                      <button
                        onClick={() => onSelectDocumentFilter(doc.id)}
                        title="Chat with this document only"
                        className={`px-2 py-0.5 rounded text-[11px] font-medium transition flex items-center gap-1 ${
                          isFiltered
                            ? "bg-blue-600 text-white"
                            : "text-slate-600 hover:bg-slate-100"
                        }`}
                      >
                        <MessageSquare className="w-3 h-3" />
                        <span>Chat</span>
                      </button>

                      <button
                        onClick={() => onOpenDocumentInViewer(doc, 1)}
                        title="Open in PDF Viewer"
                        className="px-2 py-0.5 rounded text-[11px] font-medium text-brand-600 hover:bg-brand-50 transition flex items-center gap-1"
                      >
                        <Eye className="w-3 h-3" />
                        <span>View</span>
                      </button>

                      <button
                        onClick={() => onDeleteDocument(doc.id)}
                        title="Delete Document"
                        className="p-1 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 transition"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent Chats Section */}
        <div>
          <div className="flex items-center justify-between mb-2 px-1">
            <div className="flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Recent Chats
              </span>
            </div>
          </div>

          {conversations.length === 0 ? (
            <p className="text-xs text-slate-400 italic px-2 py-1">No past conversations</p>
          ) : (
            <div className="space-y-1">
              {conversations.map((conv) => {
                const isActive = activeConversationId === conv.id;
                return (
                  <div
                    key={conv.id}
                    onClick={() => onSelectConversation(conv.id)}
                    className={`group flex items-center justify-between px-3 py-2 rounded-xl text-xs cursor-pointer transition ${
                      isActive
                        ? "bg-brand-50 text-brand-700 font-medium border border-brand-200"
                        : "text-slate-600 hover:bg-slate-100 border border-transparent"
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-brand-500 shrink-0" />
                      <span className="truncate">{conv.title || "New Conversation"}</span>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteConversation(conv.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-red-500 transition"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Bottom Status / System Info */}
      <div className="p-3 border-t border-slate-100 bg-slate-50/50">
        <div className="flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="font-medium text-slate-700">FAISS + Groq</span>
          </div>
          <span className="text-[11px] text-slate-400 font-mono">
            {backendHealth?.faiss_total_vectors ? `${backendHealth.faiss_total_vectors} vectors` : "Connected"}
          </span>
        </div>
      </div>
    </aside>
  );
}
