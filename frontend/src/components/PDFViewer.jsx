import React, { useState, useEffect, useRef, useCallback } from "react";
import * as pdfjsLib from "pdfjs-dist";
import {
  FileText,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Maximize2,
  ExternalLink,
  X,
  Bookmark,
  Download,
  Minimize2,
  RotateCcw,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { api } from "../services/api";

// ── PDF.js worker setup ──────────────────────────────────────────────────────
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

// ── Main Component ────────────────────────────────────────────────────────────
export default function PDFViewer({
  document = null,       // { id, filename, page_count, ... } or null
  targetPage = null,     // page number clicked from citation or null
  jumpKey = 0,           // increments ONLY when a citation is clicked
  onClose,
  citedPages = [],
}) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const activeRenderTaskRef = useRef(null);
  const renderSeqRef = useRef(0);

  const [pdfDoc, setPdfDoc] = useState(null);
  const [loadedDocId, setLoadedDocId] = useState(null);
  // selectedPage starts null until a citation is clicked
  const [currentPage, setCurrentPage] = useState(targetPage || null);
  const [totalPages, setTotalPages] = useState(0);
  const [pageInput, setPageInput] = useState(targetPage ? String(targetPage) : "");
  // scale is user-controlled zoom multiplier: 1.0 means "Fit to Page" (100%)
  const [scale, setScale] = useState(1.0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLoadingDoc, setIsLoadingDoc] = useState(false);
  const [docError, setDocError] = useState(null);
  const [renderError, setRenderError] = useState(null);
  const [retryKey, setRetryKey] = useState(0);

  // Mouse pan state
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef({ x: 0, y: 0, scrollLeft: 0, scrollTop: 0 });

  const isCitedPage = currentPage ? citedPages.includes(currentPage) : false;

  // ── 1. Load PDF document ONLY when document?.id changes ─────────────────────
  useEffect(() => {
    if (!document?.id) {
      setPdfDoc(null);
      setLoadedDocId(null);
      setTotalPages(0);
      setIsLoadingDoc(false);
      return;
    }

    // Do NOT re-fetch if this exact document is already loaded
    if (loadedDocId === document.id && pdfDoc) {
      return;
    }

    let isSubscribed = true;
    setIsLoadingDoc(true);
    setDocError(null);
    setRenderError(null);

    const pdfUrl = api.getDocumentFileUrl(document.id);
    const loadingTask = pdfjsLib.getDocument({
      url: pdfUrl,
      withCredentials: false,
    });

    loadingTask.promise
      .then((loaded) => {
        if (!isSubscribed) return;
        setPdfDoc(loaded);
        setLoadedDocId(document.id);
        setTotalPages(loaded.numPages);
        setIsLoadingDoc(false);

        // If targetPage was passed with this document, navigate to it
        if (targetPage && targetPage >= 1) {
          const validInitial = Math.min(targetPage, loaded.numPages);
          setCurrentPage(validInitial);
          setPageInput(String(validInitial));
        }
      })
      .catch((err) => {
        if (!isSubscribed) return;
        console.error("PDF load error:", err);
        setDocError(err.message || "Failed to load PDF document.");
        setIsLoadingDoc(false);
      });

    return () => {
      isSubscribed = false;
      try {
        loadingTask.destroy();
      } catch (_) {}
    };
  }, [document?.id, retryKey]);

  // ── 2. Jump to targetPage ONLY when jumpKey changes (explicit citation click) ──
  useEffect(() => {
    if (!targetPage || targetPage < 1) return;

    if (pdfDoc) {
      const validPage = Math.min(Math.max(1, targetPage), pdfDoc.numPages);
      setCurrentPage(validPage);
      setPageInput(String(validPage));
    } else {
      setCurrentPage(targetPage);
      setPageInput(String(targetPage));
    }
  }, [jumpKey]); // Note: ONLY triggered when jumpKey changes!

  // ── 3. Proportional "Fit to Page" canvas render (no cropping) ────────────────
  const renderCurrentPage = useCallback(async () => {
    if (!pdfDoc || !canvasRef.current || !currentPage) return;

    const thisSeq = ++renderSeqRef.current;

    // Cancel in-flight render task and wait for clean cancellation
    if (activeRenderTaskRef.current) {
      try {
        activeRenderTaskRef.current.cancel();
        await activeRenderTaskRef.current.promise;
      } catch (_) {
        // Expected cancellation exception
      }
    }

    // If another render started while waiting, bail out
    if (thisSeq !== renderSeqRef.current) {
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    const pageNum = Math.min(Math.max(1, currentPage), pdfDoc.numPages);

    try {
      const page = await pdfDoc.getPage(pageNum);
      if (!canvasRef.current || thisSeq !== renderSeqRef.current) return;

      const container = containerRef.current;
      const clientWidth = container ? container.clientWidth : 0;
      const clientHeight = container ? container.clientHeight : 0;

      // Allow 32px padding (16px on each side) for clean margins
      const availWidth = Math.max(clientWidth - 32, 200);
      const availHeight = Math.max(clientHeight - 32, 200);

      const baseViewport = page.getViewport({ scale: 1 });
      const scaleX = availWidth / baseViewport.width;
      const scaleY = availHeight / baseViewport.height;

      // "Fit to Page": scale proportionally so ENTIRE page fits horizontally AND vertically
      const fitScale = Math.min(scaleX, scaleY);
      const effectiveScale = Math.max(0.1, fitScale * scale);
      const viewport = page.getViewport({ scale: effectiveScale });

      // HiDPI support for crisp text rendering
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.floor(viewport.width * dpr);
      canvas.height = Math.floor(viewport.height * dpr);
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;

      const ctx = canvas.getContext("2d");
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, viewport.width, viewport.height);

      const renderTask = page.render({
        canvasContext: ctx,
        viewport: viewport,
      });
      activeRenderTaskRef.current = renderTask;

      await renderTask.promise;

      if (activeRenderTaskRef.current === renderTask) {
        activeRenderTaskRef.current = null;
      }
      setRenderError(null);
    } catch (err) {
      if (err?.name !== "RenderingCancelledException") {
        console.error("PDF page render error:", err);
        if (thisSeq === renderSeqRef.current) {
          setRenderError("Failed to render page " + pageNum);
        }
      }
    }
  }, [pdfDoc, currentPage, scale]);

  // Trigger render when pdfDoc, currentPage, or scale changes
  useEffect(() => {
    if (currentPage && pdfDoc) {
      renderCurrentPage();
    }
  }, [renderCurrentPage, currentPage, pdfDoc]);

  // ── 4. Mouse Wheel Zoom (Ctrl / Cmd + Wheel or Trackpad Pinch) ───────────────
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = e.deltaY < 0 ? 0.15 : -0.15;
        setScale((prev) => {
          const next = parseFloat((prev + delta).toFixed(2));
          return Math.min(3.0, Math.max(0.5, next));
        });
      }
    };

    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => container.removeEventListener("wheel", handleWheel);
  }, []);

  // ── 5. Mouse Drag-to-Pan When Zoomed ─────────────────────────────────────────
  const handleMouseDown = (e) => {
    if (e.button !== 0 || !containerRef.current) return;
    if (e.target.closest("button") || e.target.closest("input")) return;

    setIsPanning(true);
    panStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      scrollLeft: containerRef.current.scrollLeft,
      scrollTop: containerRef.current.scrollTop,
    };
  };

  const handleMouseMove = (e) => {
    if (!isPanning || !containerRef.current) return;
    e.preventDefault();
    const dx = e.clientX - panStartRef.current.x;
    const dy = e.clientY - panStartRef.current.y;
    containerRef.current.scrollLeft = panStartRef.current.scrollLeft - dx;
    containerRef.current.scrollTop = panStartRef.current.scrollTop - dy;
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  // ── 6. Auto-adjust canvas on container resize or fullscreen toggle ──────────
  useEffect(() => {
    if (!containerRef.current) return;
    let resizeTimer = null;
    const ro = new ResizeObserver(() => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        if (currentPage && pdfDoc) {
          renderCurrentPage();
        }
      }, 50);
    });
    ro.observe(containerRef.current);
    return () => {
      if (resizeTimer) clearTimeout(resizeTimer);
      ro.disconnect();
    };
  }, [renderCurrentPage, currentPage, pdfDoc]);

  // ── 7. Keyboard ESC to exit fullscreen ──────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFullscreen]);

  // ── 8. Navigation ───────────────────────────────────────────────────────────
  const goTo = (page) => {
    const p = Math.min(Math.max(1, page), totalPages || 1);
    setCurrentPage(p);
    setPageInput(String(p));
  };

  const handlePageInputSubmit = (e) => {
    if (e.key === "Enter") {
      const num = parseInt(pageInput, 10);
      if (!isNaN(num)) goTo(num);
      else setPageInput(String(currentPage || 1));
    }
  };

  // ── 9. Zoom Controls ────────────────────────────────────────────────────────
  const zoomIn = () => setScale((s) => Math.min(3.0, parseFloat((s + 0.2).toFixed(1))));
  const zoomOut = () => setScale((s) => Math.max(0.5, parseFloat((s - 0.2).toFixed(1))));
  const zoomReset = () => setScale(1.0); // Reset to Fit to Page (100%)
  const zoomPercent = Math.round(scale * 100);

  // ── 10. Download & External Link ────────────────────────────────────────────
  const handleDownload = () => {
    if (!document) return;
    const link = window.document.createElement("a");
    link.href = api.getDocumentFileUrl(document.id);
    link.download = document.filename;
    link.click();
  };

  const handleOpenNewTab = () => {
    if (!document) return;
    window.open(api.getDocumentFileUrl(document.id), "_blank", "noopener,noreferrer");
  };

  // ── 11. INITIAL / EMPTY STATE: Blank Sheet Viewer before citation clicked ───
  if (!document || !currentPage) {
    return (
      <aside className="w-[500px] h-full shrink-0 bg-slate-100/70 border-l border-slate-200 flex flex-col shadow-lg relative z-20">
        {/* Header */}
        <div className="h-14 border-b border-slate-200 px-4 bg-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <FileText className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-xs font-semibold text-slate-700">PDF Viewer</h3>
              <span className="text-[10px] text-slate-400">No citation selected</span>
            </div>
          </div>
          <button
            onClick={onClose}
            title="Close PDF Viewer"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Disabled Toolbar */}
        <div className="px-3 py-2 border-b border-slate-200 bg-white/70 flex items-center justify-between text-xs shrink-0 gap-2 opacity-50 select-none">
          <div className="flex items-center gap-1 text-slate-400 font-medium">
            <span className="text-[11px]">Page — / —</span>
          </div>
          <div className="flex items-center gap-1 text-slate-400">
            <ZoomOut className="w-3.5 h-3.5" />
            <span className="text-[11px] font-mono min-w-[36px] text-center">100%</span>
            <ZoomIn className="w-3.5 h-3.5" />
          </div>
        </div>

        {/* Blank Document Sheet */}
        <div className="flex-1 overflow-auto bg-slate-200/50 p-6 flex flex-col items-center justify-center select-none">
          <div className="w-[85%] max-w-[340px] aspect-[1/1.414] bg-white rounded-lg shadow-sm border border-slate-200 flex flex-col items-center justify-center p-6 text-center">
            <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-center text-slate-400 mb-3 shadow-xs">
              <FileText className="w-6 h-6" />
            </div>
            <p className="text-xs font-semibold text-slate-700 mb-1">PDF Viewer Blank</p>
            <p className="text-[11px] text-slate-400 max-w-[210px] leading-relaxed">
              Click any citation (e.g. <strong>Page 1</strong>, <strong>Page 4</strong>) in the chat to open and inspect the exact source page.
            </p>
          </div>
        </div>
      </aside>
    );
  }

  // ── 12. Main PDF Inspector (Rendered when citation is active) ────────────────
  return (
    <aside
      className={`${
        isFullscreen
          ? "fixed inset-0 z-50 w-screen h-screen bg-slate-100 flex flex-col shadow-2xl"
          : "w-[500px] h-full shrink-0 bg-slate-100/70 border-l border-slate-200 flex flex-col shadow-lg relative z-20"
      } transition-all`}
    >
      {/* Header */}
      <div className="h-14 border-b border-slate-200 px-4 bg-white flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <FileText className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h3 className="text-xs font-semibold text-slate-800 truncate" title={document.filename}>
              {document.filename}
            </h3>
            <span className="text-[10px] text-slate-400">
              Total {totalPages || document.page_count || "?"}{" "}
              {(totalPages || document.page_count) === 1 ? "page" : "pages"}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={handleOpenNewTab}
            title="Open in new browser tab"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onClose}
            title="Close PDF Viewer"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="px-3 py-2 border-b border-slate-200 bg-white flex items-center justify-between text-xs shrink-0 gap-2">
        {/* Page navigation */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => goTo(currentPage - 1)}
            disabled={currentPage <= 1 || isLoadingDoc}
            className="p-1 rounded bg-slate-50 hover:bg-slate-100 border border-slate-200 disabled:opacity-40 text-slate-600 transition"
            title="Previous Page"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>

          <div className="flex items-center gap-1 text-slate-600 font-medium">
            <span>Page</span>
            <input
              type="text"
              value={pageInput}
              onChange={(e) => setPageInput(e.target.value)}
              onKeyDown={handlePageInputSubmit}
              onBlur={() => setPageInput(String(currentPage))}
              className="w-10 text-center py-0.5 px-1 bg-slate-50 border border-slate-200 rounded font-semibold text-slate-800 text-xs focus:outline-none focus:border-blue-500"
            />
            <span className="text-slate-400">/ {totalPages || "?"}</span>
          </div>

          <button
            onClick={() => goTo(currentPage + 1)}
            disabled={currentPage >= totalPages || isLoadingDoc}
            className="p-1 rounded bg-slate-50 hover:bg-slate-100 border border-slate-200 disabled:opacity-40 text-slate-600 transition"
            title="Next Page"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Zoom & View Controls */}
        <div className="flex items-center gap-1">
          <button
            onClick={zoomOut}
            className="p-1 rounded hover:bg-slate-100 transition text-slate-600"
            title="Zoom out (Ctrl + Mouse Wheel)"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="text-[11px] font-mono text-slate-500 min-w-[36px] text-center">
            {zoomPercent}%
          </span>
          <button
            onClick={zoomIn}
            className="p-1 rounded hover:bg-slate-100 transition text-slate-600"
            title="Zoom in (Ctrl + Mouse Wheel)"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>

          <div className="w-px h-4 bg-slate-200 mx-0.5" />

          <button
            onClick={zoomReset}
            className="p-1 rounded hover:bg-slate-100 transition text-slate-600"
            title="Fit to Page (100%)"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => setIsFullscreen((f) => !f)}
            className="p-1 rounded hover:bg-slate-100 transition text-slate-600"
            title={isFullscreen ? "Exit fullscreen (Esc)" : "Full Screen"}
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>

          {/* Download button — explicit only, citations never download */}
          <button
            onClick={handleDownload}
            className="p-1 rounded hover:bg-blue-50 transition text-blue-600"
            title={`Download ${document.filename}`}
          >
            <Download className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Cited-page Grounding Verified banner */}
      {isCitedPage && (
        <div className="px-4 py-1.5 bg-blue-50/90 border-b border-blue-200 text-blue-800 text-[11px] flex items-center justify-between font-medium shrink-0">
          <div className="flex items-center gap-1.5">
            <Bookmark className="w-3.5 h-3.5 text-blue-600" />
            <span>Viewing cited reference: <strong>Page {currentPage}</strong></span>
          </div>
          <span className="text-[10px] bg-blue-600 text-white px-1.5 py-0.5 rounded-full font-bold">
            Grounding Verified
          </span>
        </div>
      )}

      {/* PDF Viewport Area with Centering & Drag-to-Pan */}
      <div
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        className={`flex-1 overflow-auto bg-slate-200/60 flex relative select-none ${
          isPanning ? "cursor-grabbing" : "cursor-grab"
        }`}
        title="Drag to pan page • Ctrl + Mouse Wheel to zoom"
      >
        {/* Loading Spinner Overlay */}
        {isLoadingDoc && (
          <div className="absolute inset-0 z-10 bg-slate-100/80 backdrop-blur-xs flex flex-col items-center justify-center gap-3 text-slate-500">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            <span className="text-xs font-medium">Loading PDF page…</span>
          </div>
        )}

        {/* Document Loading Error State */}
        {docError && !isLoadingDoc && (
          <div className="m-auto flex flex-col items-center justify-center p-6 text-red-500 text-center">
            <AlertCircle className="w-8 h-8 mb-2" />
            <p className="text-xs font-medium mb-3">{docError}</p>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setRetryKey((k) => k + 1)}
                className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                Retry
              </button>
              <button
                onClick={handleOpenNewTab}
                className="text-xs px-3 py-1.5 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition"
              >
                Open in New Tab
              </button>
            </div>
          </div>
        )}

        {/* Page Render Error Alert (non-destructive) */}
        {renderError && !isLoadingDoc && !docError && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 px-3 py-2 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg flex items-center justify-between gap-2 max-w-md w-[90%] shadow-sm">
            <div className="flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{renderError}</span>
            </div>
            <button
              onClick={() => renderCurrentPage()}
              className="text-[11px] underline font-semibold hover:text-red-900"
            >
              Retry
            </button>
          </div>
        )}

        {/* Canvas wrapper: centers the canvas horizontally & vertically, allows natural scroll when zoomed */}
        {!docError && (
          <div className="min-w-full min-h-full flex items-center justify-center p-4 shrink-0 m-auto">
            <canvas
              ref={canvasRef}
              className={`shadow-xl rounded-sm transition-opacity duration-150 ${
                isLoadingDoc ? "opacity-0" : "opacity-100"
              }`}
            />
          </div>
        )}
      </div>
    </aside>
  );
}
