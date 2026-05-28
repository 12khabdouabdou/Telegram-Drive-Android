import { useState, useEffect, useRef, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight, Download, Trash2, Share2, ZoomIn, RotateCcw } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { toast } from 'sonner';
import { TelegramFile } from '../../types';

interface StreamInfo {
  token: string;
  base_url: string;
}

interface MobileImageGalleryProps {
  files: TelegramFile[];
  initialIndex: number;
  onClose: () => void;
  onDelete?: (fileId: number) => void;
  onDownload?: (file: TelegramFile) => void;
  activeFolderId: number | null;
}

export function MobileImageGallery({
  files,
  initialIndex,
  onClose,
  onDelete,
  onDownload,
  activeFolderId
}: MobileImageGalleryProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [streamInfo, setStreamInfo] = useState<StreamInfo | null>(null);
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const touchStartX = useRef<number>(0);
  const touchStartY = useRef<number>(0);
  const longPressTimer = useRef<any>(null);

  const currentFile = files[currentIndex];

  useEffect(() => {
    invoke<StreamInfo>('cmd_get_stream_info')
      .then(setStreamInfo)
      .catch(console.error);
  }, []);

  const folderIdParam = activeFolderId !== null ? activeFolderId.toString() : 'home';
  const imageUrl = streamInfo
    ? `${streamInfo.base_url}/stream/${folderIdParam}/${currentFile.id}?token=${streamInfo.token}`
    : null;

  const goToNext = useCallback(() => {
    if (currentIndex < files.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setScale(1);
      setRotation(0);
      setLoading(true);
      setError(null);
    }
  }, [currentIndex, files.length]);

  const goToPrev = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setScale(1);
      setRotation(0);
      setLoading(true);
      setError(null);
    }
  }, [currentIndex]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowRight') {
        goToNext();
      } else if (e.key === 'ArrowLeft') {
        goToPrev();
      } else if (e.key === '+' || e.key === '=') {
        setScale(s => Math.min(s + 0.25, 4));
      } else if (e.key === '-') {
        setScale(s => Math.max(s - 0.25, 0.5));
      } else if (e.key === 'r' || e.key === 'R') {
        setRotation(r => (r + 90) % 360);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, goToNext, goToPrev]);

  // Touch handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;

    // Start long press timer for actions
    longPressTimer.current = setTimeout(() => {
      setShowControls(true);
    }, 500);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    // Cancel long press if finger moves too much
    const deltaX = Math.abs(e.touches[0].clientX - touchStartX.current);
    const deltaY = Math.abs(e.touches[0].clientY - touchStartY.current);
    
    if (deltaX > 10 || deltaY > 10) {
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }

    const deltaX = touchStartX.current - e.changedTouches[0].clientX;
    const deltaY = touchStartY.current - e.changedTouches[0].clientY;

    // Horizontal swipe
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 80) {
      if (deltaX > 0) {
        goToNext();
      } else {
        goToPrev();
      }
    }
  };

  const handleImageLoad = () => {
    setLoading(false);
    setError(null);
  };

  const handleImageError = () => {
    setLoading(false);
    setError('Failed to load image');
  };

  const handleDownload = () => {
    if (onDownload) {
      onDownload(currentFile);
    } else {
      invoke('cmd_download_file', { 
        fileId: currentFile.id, 
        fileName: currentFile.name 
      }).then(() => {
        toast.success('Download started');
      }).catch((err) => {
        toast.error(`Download failed: ${err}`);
      });
    }
  };

  const handleDelete = () => {
    if (onDelete) {
      onDelete(currentFile.id);
      // Navigate to next after delete
      if (currentIndex < files.length - 1) {
        setTimeout(() => {
          goToNext();
        }, 100);
      } else if (currentIndex > 0) {
        setTimeout(() => {
          goToPrev();
        }, 100);
      } else {
        onClose();
      }
    }
  };

  const toggleControls = () => {
    setShowControls(!showControls);
  };

  return (
    <div 
      className="fixed inset-0 z-[200] bg-black flex flex-col"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onClick={toggleControls}
    >
      {/* Top Controls */}
      <header 
        className={`absolute top-0 left-0 right-0 z-10 transition-all duration-300 ${
          showControls ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0'
        }`}
      >
        <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/80 to-transparent">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all"
          >
            <X className="w-6 h-6" />
          </button>
          
          <div className="text-center">
            <p className="text-sm font-medium text-white truncate max-w-[200px]">
              {currentFile.name}
            </p>
            <p className="text-xs text-white/60">
              {currentIndex + 1} of {files.length}
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setRotation(r => (r + 90) % 360);
              }}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all"
            >
              <RotateCcw className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Image Container */}
      <div className="flex-1 flex items-center justify-center overflow-hidden">
        {loading && (
          <div className="absolute flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-white/30 border-t-white rounded-full animate-spin"></div>
            <p className="text-sm text-white/70">Loading...</p>
          </div>
        )}

        {error && (
          <div className="absolute flex flex-col items-center gap-4 text-center px-6">
            <div className="p-4 rounded-full bg-white/10">
              <X className="w-10 h-10 text-red-400" />
            </div>
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {imageUrl && !error && (
          <img
            src={imageUrl}
            alt={currentFile.name}
            className={`max-w-full max-h-full object-contain transition-transform duration-200 ${
              loading ? 'opacity-0' : 'opacity-100'
            }`}
            style={{
              transform: `scale(${scale}) rotate(${rotation}deg)`,
            }}
            onLoad={handleImageLoad}
            onError={handleImageError}
            draggable={false}
          />
        )}
      </div>

      {/* Navigation Arrows */}
      {currentIndex > 0 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            goToPrev();
          }}
          className={`absolute left-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all ${
            showControls ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <ChevronLeft className="w-8 h-8" />
        </button>
      )}
      
      {currentIndex < files.length - 1 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            goToNext();
          }}
          className={`absolute right-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all ${
            showControls ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <ChevronRight className="w-8 h-8" />
        </button>
      )}

      {/* Bottom Controls */}
      <footer 
        className={`absolute bottom-0 left-0 right-0 z-10 transition-all duration-300 ${
          showControls ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'
        }`}
      >
        <div className="flex items-center justify-center gap-4 px-6 py-4 bg-gradient-to-t from-black/80 to-transparent">
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleDownload();
            }}
            className="flex flex-col items-center gap-1 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all"
          >
            <Download className="w-5 h-5" />
            <span className="text-[10px] font-medium">Save</span>
          </button>
          
          <button
            onClick={(e) => {
              e.stopPropagation();
              // Share functionality
              if (navigator.share) {
                navigator.share({
                  title: currentFile.name,
                  text: `Check out ${currentFile.name}`,
                }).catch(console.error);
              } else {
                navigator.clipboard.writeText(imageUrl || '');
                toast.success('Link copied!');
              }
            }}
            className="flex flex-col items-center gap-1 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all"
          >
            <Share2 className="w-5 h-5" />
            <span className="text-[10px] font-medium">Share</span>
          </button>
          
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleDelete();
            }}
            className="flex flex-col items-center gap-1 px-4 py-2 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-400 transition-all"
          >
            <Trash2 className="w-5 h-5" />
            <span className="text-[10px] font-medium">Delete</span>
          </button>
        </div>

        {/* Zoom Controls */}
        <div className="flex items-center justify-center gap-4 pb-8">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setScale(s => Math.max(s - 0.25, 0.5));
            }}
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all"
          >
            <ZoomIn className="w-5 h-5" />
          </button>
          <span className="text-xs text-white/70 font-mono w-12 text-center">
            {Math.round(scale * 100)}%
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setScale(s => Math.min(s + 0.25, 4));
            }}
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all"
          >
            <ZoomIn className="w-6 h-6" />
          </button>
        </div>
      </footer>

      {/* Thumbnail Strip */}
      <div className="absolute bottom-32 left-0 right-0 flex justify-center gap-2 overflow-x-auto px-4 py-2">
        {files.slice(Math.max(0, currentIndex - 2), currentIndex + 3).map((file, idx) => {
          const actualIndex = Math.max(0, currentIndex - 2) + idx;
          return (
            <button
              key={file.id}
              onClick={(e) => {
                e.stopPropagation();
                setCurrentIndex(actualIndex);
                setScale(1);
                setRotation(0);
                setLoading(true);
              }}
              className={`w-12 h-12 rounded-lg overflow-hidden border-2 transition-all flex-shrink-0 ${
                actualIndex === currentIndex
                  ? 'border-telegram-primary scale-110'
                  : 'border-transparent opacity-60'
              }`}
            >
              <div className="w-full h-full bg-telegram-hover flex items-center justify-center">
                <span className="text-xs text-telegram-subtext">
                  {actualIndex + 1}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}