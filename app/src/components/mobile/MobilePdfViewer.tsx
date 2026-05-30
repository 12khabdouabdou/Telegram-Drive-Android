import { useEffect, useState, useRef } from 'react';
import { X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
// @ts-ignore
import * as pdfjsLib from 'pdfjs-dist/build/pdf.js';
import workerUrl from 'pdfjs-dist/build/pdf.worker.js?url';
import { TelegramFile } from '../../types';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

interface StreamInfo {
  token: string;
  base_url: string;
}

interface PdfViewerProps {
  file: TelegramFile;
  onClose: () => void;
  onNext?: () => void;
  onPrev?: () => void;
  activeFolderId: number | null;
}

export function MobilePdfViewer({ file, onClose, onNext, onPrev, activeFolderId }: PdfViewerProps) {
  const [streamInfo, setStreamInfo] = useState<StreamInfo | null>(null);
  const [pdf, setPdf] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [scale, setScale] = useState(1.2);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    invoke<StreamInfo>('cmd_get_stream_info')
      .then(setStreamInfo)
      .catch((err) => {
        console.error("Failed to get stream info:", err);
        setError("Failed to initialize stream");
      });
  }, []);

  useEffect(() => {
    if (!streamInfo) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    const folderIdParam = activeFolderId !== null ? activeFolderId.toString() : 'home';
    const streamUrl = `${streamInfo.base_url}/stream/${folderIdParam}/${file.id}?token=${streamInfo.token}`;

    const loadingTask = pdfjsLib.getDocument(streamUrl);

    loadingTask.promise
      .then((pdfDoc) => {
        if (cancelled) {
          pdfDoc.destroy();
          return;
        }
        setPdf(pdfDoc);
        setNumPages(pdfDoc.numPages);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("Error loading PDF:", err);
        setError("Failed to load PDF document.");
        setLoading(false);
      });

    return () => {
      cancelled = true;
      loadingTask.destroy();
    };
  }, [streamInfo, activeFolderId, file.id]);

  useEffect(() => {
    if (!pdf || !canvasRef.current) return;

    const renderPage = async () => {
      try {
        const page = await pdf.getPage(currentPage);
        const viewport = page.getViewport({ scale });
        const canvas = canvasRef.current!;
        const context = canvas.getContext('2d')!;

        canvas.height = viewport.height;
        canvas.width = viewport.width;

        const renderContext = {
          canvasContext: context,
          viewport,
          canvas
        };
        await page.render(renderContext).promise;
      } catch (err) {
        console.error('Error rendering page:', err);
      }
    };

    renderPage();
  }, [pdf, currentPage, scale]);

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    } else if (onPrev) {
      onPrev();
    }
  };

  const handleNextPage = () => {
    if (currentPage < numPages) {
      setCurrentPage(currentPage + 1);
    } else if (onNext) {
      onNext();
    }
  };

  const handleZoomIn = () => {
    setScale((s) => Math.min(s + 0.2, 3));
  };

  const handleZoomOut = () => {
    setScale((s) => Math.max(s - 0.2, 0.6));
  };

  // Touch swipe handlers
  const touchStartX = useRef<number>(0);
  const touchEndX = useRef<number>(0);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    touchEndX.current = e.changedTouches[0].clientX;
    const diff = touchStartX.current - touchEndX.current;
    
    if (Math.abs(diff) > 100) {
      if (diff > 0) {
        handleNextPage();
      } else {
        handlePrevPage();
      }
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowRight') {
        handleNextPage();
      } else if (e.key === 'ArrowLeft') {
        handlePrevPage();
      } else if (e.key === '+' || e.key === '=') {
        handleZoomIn();
      } else if (e.key === '-') {
        handleZoomOut();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentPage, numPages]);

  return (
    <div className="fixed inset-0 z-[200] bg-telegram-bg flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 bg-telegram-surface border-b border-telegram-border">
        <button
          onClick={onClose}
          className="p-2 rounded-xl hover:bg-telegram-hover transition-colors"
        >
          <X className="w-6 h-6" />
        </button>
        
        <div className="text-center">
          <p className="text-sm font-semibold truncate max-w-[200px]">{file.name}</p>
          <p className="text-xs text-telegram-subtext">{currentPage} / {numPages}</p>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={handleZoomOut}
            className="p-2 rounded-xl hover:bg-telegram-hover transition-colors"
          >
            <ZoomOut className="w-5 h-5" />
          </button>
          <span className="text-xs font-mono w-12 text-center">{Math.round(scale * 100)}%</span>
          <button
            onClick={handleZoomIn}
            className="p-2 rounded-xl hover:bg-telegram-hover transition-colors"
          >
            <ZoomIn className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* PDF Content */}
      <div 
        ref={containerRef}
        className="flex-1 overflow-auto bg-gray-800"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full space-y-4">
            <div className="w-12 h-12 border-4 border-telegram-primary border-t-transparent rounded-full animate-spin"></div>
            <p className="text-sm text-telegram-subtext">Loading PDF...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-full space-y-4 p-6">
            <div className="p-4 rounded-full bg-red-500/10 text-red-400">
              <X className="w-10 h-10" />
            </div>
            <p className="text-sm text-red-400 text-center">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-2 rounded-xl bg-telegram-primary/15 text-telegram-primary border border-telegram-primary/20 font-semibold text-sm"
            >
              Retry
            </button>
          </div>
        ) : (
          <div className="flex justify-center p-4">
            <canvas
              ref={canvasRef}
              className="shadow-2xl rounded-lg"
              style={{ maxWidth: '100%', height: 'auto' }}
            />
          </div>
        )}
      </div>

      {/* Navigation Footer */}
      <footer className="flex items-center justify-between px-6 py-4 bg-telegram-surface border-t border-telegram-border">
        <button
          onClick={handlePrevPage}
          disabled={currentPage <= 1 && !onPrev}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-telegram-hover hover:bg-telegram-hover/70 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="w-5 h-5" />
          <span className="text-sm font-medium">Previous</span>
        </button>
        
        <div className="flex items-center gap-2">
          <input
            type="range"
            min="1"
            max={numPages}
            value={currentPage}
            onChange={(e) => setCurrentPage(parseInt(e.target.value))}
            className="w-32 h-1.5 bg-telegram-border rounded-full appearance-none cursor-pointer accent-telegram-primary"
          />
        </div>
        
        <button
          onClick={handleNextPage}
          disabled={currentPage >= numPages && !onNext}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-telegram-hover hover:bg-telegram-hover/70 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span className="text-sm font-medium">Next</span>
          <ChevronRight className="w-5 h-5" />
        </button>
      </footer>
    </div>
  );
}