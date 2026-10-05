import React, { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Send,
  Sparkles,
  Bot,
  User,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  FileText,
  ExternalLink,
  RotateCcw,
  SlidersHorizontal,
  Info,
  Layers,
  PanelRightClose,
  PanelRightOpen,
  ArrowRight
} from "lucide-react";

export default function ChatArea({
  messages = [],
  onSendMessage,
  isLoading,
  selectedDocumentId,
  documents = [],
  onClearDocumentFilter,
  onSourceClick,
  pdfViewerOpen,
  onTogglePdfViewer,
}) {
  const [inputText, setInputText] = useState("");
  const [copiedIndex, setCopiedIndex] = useState(null);
  const [expandedContextIndex, setExpandedContextIndex] = useState(null);
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  const selectedDoc = documents.find((d) => d.id === selectedDocumentId);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // Handle enter key submit
  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSend = () => {
    if (!inputText.trim() || isLoading) return;
    onSendMessage(inputText);
    setInputText("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleCopy = (text, idx) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleTextareaInput = (e) => {
    setInputText(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`;
  };

  const starterSuggestions = [
    "What is the executive summary or main objective of this document?",
    "Explain the methodology or key approaches used.",
    "What are the main financial or numerical findings reported?",
    "What conclusions and recommendations are presented?"
  ];

  return (
    <div className="flex-1 h-full flex flex-col bg-white overflow-hidden relative">
      {/* Top Navigation Bar */}
      <header className="h-14 border-b border-slate-200 px-6 flex items-center justify-between bg-white/80 backdrop-blur-md z-10">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-800 text-sm">AI Document Assistant</span>
          </div>

          <div className="h-4 w-px bg-slate-200" />

          {/* Active Document Filter Badge */}
          {selectedDoc ? (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-xs font-medium">
              <FileText className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <span className="truncate max-w-[200px]">{selectedDoc.filename}</span>
              <button
                onClick={onClearDocumentFilter}
                className="ml-1 hover:text-blue-900 text-slate-400 font-bold"
                title="Remove filter (Search all documents)"
              >
                ×
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-medium">
              <Layers className="w-3.5 h-3.5 text-slate-500" />
              <span>Searching all documents ({documents.length})</span>
            </div>
          )}
        </div>

        {/* Right Action: Toggle PDF Viewer */}
        <div className="flex items-center gap-2">
          <button
            onClick={onTogglePdfViewer}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition ${
              pdfViewerOpen
                ? "bg-brand-50 border-brand-200 text-brand-700"
                : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
            title={pdfViewerOpen ? "Hide PDF Viewer" : "Show PDF Viewer"}
          >
            {pdfViewerOpen ? <PanelRightClose className="w-4 h-4" /> : <PanelRightOpen className="w-4 h-4" />}
            <span className="hidden sm:inline">PDF Viewer</span>
          </button>
        </div>
      </header>

      {/* Messages Scrollable Area */}
      <div className="flex-1 overflow-y-auto px-4 md:px-12 py-6 space-y-6">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center max-w-lg mx-auto py-12">
            <div className="w-14 h-14 rounded-2xl bg-brand-50 border border-brand-200 flex items-center justify-center text-brand-600 mb-4 shadow-sm">
              <Sparkles className="w-7 h-7" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-1">
              DocuRAG Document Intelligence
            </h2>
            <p className="text-xs text-slate-500 mb-6 leading-relaxed">
              Ask questions about your uploaded PDFs. Answers are strictly verified against the document text with zero hallucination.
            </p>

            {/* Quick Suggestion Chips */}
            <div className="w-full space-y-2 text-left">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block px-1">
                Suggested Questions
              </span>
              {starterSuggestions.map((q, idx) => (
                <button
                  key={idx}
                  onClick={() => onSendMessage(q)}
                  disabled={documents.length === 0}
                  className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-200 hover:border-brand-300 hover:bg-brand-50/50 text-xs text-slate-700 transition group text-left disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="pr-2">{q}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-brand-600 shrink-0 transition-transform group-hover:translate-x-0.5" />
                </button>
              ))}
            </div>

            {documents.length === 0 && (
              <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg p-2.5 mt-4">
                Please upload at least one PDF in the sidebar to start asking questions.
              </p>
            )}
          </div>
        ) : (
          messages.map((msg, index) => {
            const isUser = msg.role === "user";
            return (
              <div
                key={index}
                className={`flex gap-3.5 max-w-3xl ${
                  isUser ? "ml-auto justify-end" : "mr-auto justify-start"
                }`}
              >
                {/* Avatar */}
                {!isUser && (
                  <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-sm mt-0.5">
                    <Bot className="w-4 h-4" />
                  </div>
                )}

                <div className={`flex flex-col ${isUser ? "items-end" : "items-start"} max-w-[85%]`}>
                  {/* Message Bubble */}
                  <div
                    className={`rounded-2xl px-4 py-3.5 text-sm leading-relaxed ${
                      isUser
                        ? "bg-blue-600 text-white rounded-tr-sm shadow-sm"
                        : "bg-blue-50/70 border border-blue-100 text-slate-800 rounded-tl-sm shadow-card markdown-body"
                    }`}
                  >
                    {isUser ? (
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    ) : (
                      <div>
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {msg.content}
                        </ReactMarkdown>

                        {/* Copy button */}
                        <div className="flex items-center justify-end pt-2 border-t border-blue-200/50 mt-3">
                          <button
                            onClick={() => handleCopy(msg.content, index)}
                            className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-brand-700 transition"
                            title="Copy answer"
                          >
                            {copiedIndex === index ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                                <span className="text-emerald-600 font-medium">Copied!</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5" />
                                <span>Copy</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Sources / Citations Section for AI answers */}
                  {!isUser && msg.sources && msg.sources.length > 0 && (
                    <div className="mt-2.5 w-full bg-white border border-slate-200 rounded-xl p-3 shadow-xs">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 mb-2">
                        <FileText className="w-3.5 h-3.5 text-brand-600" />
                        <span>Sources & Citations:</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {msg.sources.map((src, sIdx) => (
                          <button
                            key={sIdx}
                            onClick={() => onSourceClick(src.document_id, src.page_number, src.document_name)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 hover:border-blue-300 text-xs font-medium transition active:scale-95 group shadow-xs"
                            title={`Jump to ${src.document_name}, Page ${src.page_number} in PDF Viewer`}
                          >
                            <span className="font-semibold text-blue-900 truncate max-w-[140px]">
                              {src.document_name}
                            </span>
                            <span className="text-blue-500">•</span>
                            <span className="bg-white px-1.5 py-0.5 rounded text-[11px] font-bold text-brand-600 border border-blue-200">
                              Page {src.page_number}
                            </span>
                            <ExternalLink className="w-3 h-3 text-blue-500 group-hover:translate-x-0.5 transition-transform" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Retrieved Context Accordion */}
                  {!isUser && msg.retrieved_chunks && msg.retrieved_chunks.length > 0 && (
                    <div className="mt-2 w-full">
                      <button
                        onClick={() =>
                          setExpandedContextIndex(expandedContextIndex === index ? null : index)
                        }
                        className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500 hover:text-brand-600 transition"
                      >
                        {expandedContextIndex === index ? (
                          <ChevronUp className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5" />
                        )}
                        <span>
                          {expandedContextIndex === index ? "Hide" : "View"} Retrieved Context (
                          {msg.retrieved_chunks.length} chunks from FAISS)
                        </span>
                      </button>

                      {expandedContextIndex === index && (
                        <div className="mt-2 space-y-2 bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs">
                          {msg.retrieved_chunks.map((chk, cIdx) => (
                            <div
                              key={cIdx}
                              className="p-2.5 bg-white rounded-lg border border-slate-200/80 shadow-xs"
                            >
                              <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1.5 border-b border-slate-100 pb-1">
                                <span className="font-semibold text-slate-700">
                                  📄 {chk.document_name} (Page {chk.page_number})
                                </span>
                                <span className="font-mono text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">
                                  Score: {chk.score}
                                </span>
                              </div>
                              <p className="text-slate-600 leading-relaxed font-sans text-[11.5px] italic">
                                "{chk.text}"
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* User avatar */}
                {isUser && (
                  <div className="w-8 h-8 rounded-xl bg-slate-800 text-white flex items-center justify-center shrink-0 shadow-sm mt-0.5">
                    <User className="w-4 h-4" />
                  </div>
                )}
              </div>
            );
          })
        )}

        {/* Loading / Generating State */}
        {isLoading && (
          <div className="flex gap-3.5 mr-auto max-w-xl">
            <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-sm animate-pulse">
              <Bot className="w-4 h-4" />
            </div>
            <div className="bg-blue-50/80 border border-blue-100 rounded-2xl rounded-tl-sm px-4 py-3 shadow-xs">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-600 animate-bounce"></span>
                <span className="w-2 h-2 rounded-full bg-blue-600 animate-bounce [animation-delay:0.2s]"></span>
                <span className="w-2 h-2 rounded-full bg-blue-600 animate-bounce [animation-delay:0.4s]"></span>
                <span className="text-xs font-medium text-brand-700 ml-1">
                  Searching FAISS & generating verified answer...
                </span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Bottom Chat Input Bar */}
      <footer className="p-4 border-t border-slate-200 bg-white">
        <div className="max-w-3xl mx-auto">
          <div className="relative flex items-center bg-slate-50 border border-slate-200 rounded-2xl focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/10 focus-within:bg-white transition-all shadow-subtle p-1.5">
            <textarea
              ref={textareaRef}
              rows={1}
              value={inputText}
              onChange={handleTextareaInput}
              onKeyDown={handleKeyDown}
              placeholder={
                documents.length === 0
                  ? "Upload a document in the sidebar to ask questions..."
                  : "Ask a question about the uploaded document(s)..."
              }
              disabled={documents.length === 0 || isLoading}
              className="flex-1 bg-transparent px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none resize-none max-h-40 leading-relaxed disabled:opacity-50"
            />

            <button
              onClick={handleSend}
              disabled={!inputText.trim() || isLoading || documents.length === 0}
              className="w-9 h-9 rounded-xl bg-blue-600 hover:bg-brand-700 disabled:bg-slate-200 text-white disabled:text-slate-400 flex items-center justify-center shrink-0 transition-all shadow-xs disabled:shadow-none active:scale-95 cursor-pointer disabled:cursor-not-allowed"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center justify-center gap-1.5 mt-2 text-[11px] text-slate-400 text-center">
            <Info className="w-3 h-3 text-brand-500" />
            <span>Strict RAG: Answers are extracted strictly from document context with zero hallucination.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
