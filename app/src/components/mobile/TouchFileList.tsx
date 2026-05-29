import { useState, useEffect } from 'react';
import { CloudDownload, Trash2, File, Image, Music, Video, FileText, Folder, Share2, Eye } from 'lucide-react';
import { TelegramFile } from '../../types';
import { invoke } from '@tauri-apps/api/core';

interface TouchFileListProps {
  files: TelegramFile[];
  viewMode: 'grid' | 'list';
  selectedIds: number[];
  onFileClick: (fileId: number) => void;
  onFileLongPress: (fileId: number) => void;
  onDownload: (file: TelegramFile) => void;
  onDelete: (fileId: number, folderId?: number | null) => void;
  onShare?: (file: TelegramFile) => void;
  onPreview?: (file: TelegramFile) => void;
}

function getFileIcon(file: TelegramFile) {
  if (file.type === 'folder') return Folder;
  const name = file.name.toLowerCase();
  if (/\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(name)) return Image;
  if (/\.(mp3|wav|ogg|flac|m4a|aac)$/i.test(name)) return Music;
  if (/\.(mp4|mkv|avi|mov|webm|m4v)$/i.test(name)) return Video;
  if (/\.(pdf|doc|docx|txt|rtf|ppt|pptx|xls|xlsx)$/i.test(name)) return FileText;
  return File;
}

function getFileIconColor(file: TelegramFile) {
  if (file.type === 'folder') return 'text-yellow-500';
  const name = file.name.toLowerCase();
  if (/\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(name)) return 'text-purple-500';
  if (/\.(mp3|wav|ogg|flac|m4a|aac)$/i.test(name)) return 'text-pink-500';
  if (/\.(mp4|mkv|avi|mov|webm|m4v)$/i.test(name)) return 'text-indigo-500';
  if (/\.(pdf|doc|docx|txt|rtf|ppt|pptx|xls|xlsx)$/i.test(name)) return 'text-blue-500';
  return 'text-gray-400';
}

export function TouchFileList({
  files,
  viewMode,
  selectedIds,
  onFileClick,
  onFileLongPress,
  onDownload,
  onDelete,
  onShare,
  onPreview
}: TouchFileListProps) {
  const [contextMenuFile, setContextMenuFile] = useState<TelegramFile | null>(null);
  const [thumbnails, setThumbnails] = useState<Record<number, string>>({});

  // Fetch thumbnails for image files
  useEffect(() => {
    const imageFiles = files.filter(f =>
      /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(f.name) && !thumbnails[f.id]
    );
    if (imageFiles.length === 0) return;
    for (const file of imageFiles) {
      invoke<string>('cmd_get_thumbnail', { messageId: file.id, folderId: file.folder_id ?? null })
        .then(dataUrl => {
          if (dataUrl) {
            setThumbnails(prev => ({ ...prev, [file.id]: dataUrl }));
          }
        })
        .catch((err) => {
          console.warn(`Thumbnail failed for ${file.name} (id=${file.id}):`, err);
        });
    }
  }, [files, thumbnails]);

  const handleLongPress = (e: React.TouchEvent | React.MouseEvent, file: TelegramFile) => {
    e.preventDefault();
    onFileLongPress(file.id);
  };

  const handleClick = (e: React.MouseEvent, file: TelegramFile) => {
    e.stopPropagation();
    if (selectedIds.length > 0) {
      onFileClick(file.id);
    } else {
      onFileClick(file.id);
    }
  };

  const handleContextClick = (e: React.MouseEvent, file: TelegramFile) => {
    e.preventDefault();
    setContextMenuFile(file);
  };

  // Get image files for quick preview check
  const isPreviewable = (file: TelegramFile) => {
    const name = file.name.toLowerCase();
    return /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(name);
  };

  if (viewMode === 'grid') {
    return (
      <>
        <div className="grid grid-cols-2 gap-3">
          {files.map((file) => {
            const Icon = getFileIcon(file);
            const iconColor = getFileIconColor(file);
            const isSelected = selectedIds.includes(file.id);
            
            return (
              <div
                key={file.id}
                className={`relative rounded-2xl border transition-all duration-200 overflow-hidden ${
                  isSelected
                    ? 'bg-telegram-primary/20 border-telegram-primary ring-2 ring-telegram-primary/50'
                    : 'bg-telegram-hover/30 border-telegram-border/20 active:bg-telegram-hover/55'
                }`}
                onClick={(e) => handleClick(e, file)}
                onContextMenu={(e) => handleContextClick(e, file)}
                onTouchStart={(e) => {
                  const timeoutId = setTimeout(() => {
                    handleLongPress(e as any, file);
                  }, 500);
                  e.currentTarget.dataset['timeoutId'] = String(timeoutId);
                }}
                onTouchEnd={(e) => {
                  const timeoutId = e.currentTarget.dataset['timeoutId'];
                  if (timeoutId) {
clearTimeout(parseInt(timeoutId, 10));
                  }
                }}
                onTouchMove={(e) => {
                  const timeoutId = e.currentTarget.dataset['timeoutId'];
                  if (timeoutId) {
                    clearTimeout(parseInt(timeoutId, 10));
                  }
                }}
              >
                {isSelected && (
                  <div className="absolute top-2 left-2 z-10 w-6 h-6 rounded-full bg-telegram-primary border-2 border-white flex items-center justify-center shadow-lg">
                    <span className="text-black text-xs font-bold">✓</span>
                  </div>
                )}
                
                <div className="aspect-[4/3] flex items-center justify-center bg-telegram-bg/50 overflow-hidden">
                  {thumbnails[file.id] ? (
                    <img src={thumbnails[file.id]} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Icon className={`w-16 h-16 ${iconColor}`} />
                  )}
                </div>
                
                <div className="p-3">
                  <p className="text-xs font-semibold text-telegram-text truncate max-w-full leading-snug">
                    {file.name}
                  </p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-[10px] text-telegram-subtext/80 font-medium font-mono">
                      {file.sizeStr}
                    </span>
                    {file.created_at && (
                      <>
                        <span className="w-1 h-1 bg-telegram-border rounded-full" />
                        <span className="text-[10px] text-telegram-subtext/80 font-medium">
                          {new Date(file.created_at).toLocaleDateString()}
                        </span>
                      </>
                    )}
                  </div>
                  
                  {isSelected && (
                    <div className="flex items-center gap-1 mt-2 pt-2 border-t border-telegram-border/20">
                      {onPreview && isPreviewable(file) && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onPreview(file);
                          }}
                          className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg bg-blue-500/15 text-blue-400 text-xs font-semibold active:scale-95 transition-all"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          View
                        </button>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDownload(file);
                        }}
                        className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg bg-telegram-primary/15 text-telegram-primary text-xs font-semibold active:scale-95 transition-all"
                      >
                        <CloudDownload className="w-3.5 h-3.5" />
                        Save
                      </button>
                      {onShare && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onShare(file);
                          }}
                          className="p-1.5 rounded-lg bg-telegram-hover/50 text-telegram-subtext active:scale-90 transition-all"
                        >
                          <Share2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete(file.id, file.folder_id);
                        }}
                        className="p-1.5 rounded-lg bg-red-500/15 text-red-400 active:scale-90 transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Context Menu Bottom Sheet */}
        {contextMenuFile && (
          <>
            <div 
              className="fixed inset-0 z-[90] bg-black/60"
              onClick={() => setContextMenuFile(null)}
              onContextMenu={(e) => {
                e.preventDefault();
                setContextMenuFile(null);
              }}
            />
            <div className="fixed inset-x-4 bottom-[88px] z-[95] bg-telegram-surface border border-telegram-border rounded-3xl shadow-2xl overflow-hidden">
              <div className="p-4 border-b border-telegram-border/50 flex items-center gap-4">
                <div className="p-3 rounded-2xl bg-telegram-primary/10">
                  {(() => {
                    const Icon = getFileIcon(contextMenuFile);
                    return <Icon className="w-6 h-6 text-telegram-primary" />;
                  })()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{contextMenuFile.name}</p>
                  <p className="text-xs text-telegram-subtext">{contextMenuFile.sizeStr}</p>
                </div>
                <button
                  onClick={() => setContextMenuFile(null)}
                  className="p-2 rounded-xl hover:bg-telegram-hover transition-colors"
                >
                  ✕
                </button>
              </div>
              
              <div className="p-4 grid grid-cols-4 gap-3">
                {onPreview && isPreviewable(contextMenuFile) && (
                  <button
                    onClick={() => {
                      onPreview(contextMenuFile);
                      setContextMenuFile(null);
                    }}
                    className="flex flex-col items-center gap-2 p-3 rounded-2xl bg-blue-500/10 hover:bg-blue-500/20 transition-all"
                  >
                    <Eye className="w-6 h-6 text-blue-400" />
                    <span className="text-[10px] font-medium">Preview</span>
                  </button>
                )}
                <button
                  onClick={() => {
                    onDownload(contextMenuFile);
                    setContextMenuFile(null);
                  }}
                  className="flex flex-col items-center gap-2 p-3 rounded-2xl bg-telegram-primary/10 hover:bg-telegram-primary/20 transition-all"
                >
                  <CloudDownload className="w-6 h-6 text-telegram-primary" />
                  <span className="text-[10px] font-medium">Download</span>
                </button>
                {onShare && (
                  <button
                    onClick={() => {
                      onShare(contextMenuFile);
                      setContextMenuFile(null);
                    }}
                    className="flex flex-col items-center gap-2 p-3 rounded-2xl bg-telegram-hover/30 hover:bg-telegram-hover/50 transition-all"
                  >
                    <Share2 className="w-6 h-6 text-telegram-text" />
                    <span className="text-[10px] font-medium">Share</span>
                  </button>
                )}
                <button
                  onClick={() => {
                    onDelete(contextMenuFile.id, contextMenuFile.folder_id);
                    setContextMenuFile(null);
                  }}
                  className="flex flex-col items-center gap-2 p-3 rounded-2xl bg-red-500/10 hover:bg-red-500/20 transition-all"
                >
                  <Trash2 className="w-6 h-6 text-red-400" />
                  <span className="text-[10px] font-medium text-red-400">Delete</span>
                </button>
              </div>
            </div>
          </>
        )}
      </>
    );
  }

  // List View
  return (
    <>
      <div className="space-y-2">
        {files.map((file) => {
          const Icon = getFileIcon(file);
          const iconColor = getFileIconColor(file);
          const isSelected = selectedIds.includes(file.id);
          
          return (
            <div
              key={file.id}
              className={`flex items-center gap-3 p-3.5 rounded-2xl border transition-all duration-200 ${
                isSelected
                  ? 'bg-telegram-primary/20 border-telegram-primary'
                  : 'bg-telegram-hover/30 border-telegram-border/20 active:bg-telegram-hover/55'
              }`}
              onClick={(e) => handleClick(e, file)}
              onContextMenu={(e) => handleContextClick(e, file)}
              onTouchStart={(e) => {
                const timeoutId = setTimeout(() => {
                  handleLongPress(e as any, file);
                }, 500);
                e.currentTarget.dataset['timeoutId'] = String(timeoutId);
              }}
              onTouchEnd={(e) => {
                const timeoutId = e.currentTarget.dataset['timeoutId'];
                if (timeoutId) clearTimeout(parseInt(timeoutId, 10));
              }}
            >
              {isSelected ? (
                <div className="w-6 h-6 rounded-full bg-telegram-primary border-2 border-white flex items-center justify-center flex-shrink-0">
                  <span className="text-black text-xs font-bold">✓</span>
                </div>
              ) : (
                <div className={`w-10 h-10 rounded-xl bg-telegram-bg/50 flex-shrink-0 flex items-center justify-center overflow-hidden`}>
                  {thumbnails[file.id] ? (
                    <img src={thumbnails[file.id]} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Icon className={`w-5 h-5 ${iconColor}`} />
                  )}
                </div>
              )}
              
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-telegram-text truncate leading-snug">
                  {file.name}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] text-telegram-subtext/80 font-medium font-mono">
                    {file.sizeStr}
                  </span>
                  {file.created_at && (
                    <>
                      <span className="w-1 h-1 bg-telegram-border rounded-full" />
                      <span className="text-[10px] text-telegram-subtext/80 font-medium">
                        {new Date(file.created_at).toLocaleDateString()}
                      </span>
                    </>
                  )}
                </div>
              </div>
              
              <div className="flex items-center gap-1">
                {onPreview && isPreviewable(file) && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onPreview(file);
                    }}
                    className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400 active:scale-90 transition-all"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDownload(file);
                  }}
                  className="p-2.5 rounded-xl bg-telegram-primary/10 text-telegram-primary active:scale-90 transition-all"
                >
                  <CloudDownload className="w-4 h-4" />
                </button>
                {onShare && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onShare(file);
                    }}
                    className="p-2.5 rounded-xl bg-telegram-hover/50 text-telegram-subtext active:scale-90 transition-all"
                  >
                    <Share2 className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(file.id, file.folder_id);
                  }}
                  className="p-2.5 rounded-xl bg-red-500/10 text-red-400 active:scale-90 transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Context Menu */}
      {contextMenuFile && (
        <>
          <div 
            className="fixed inset-0 z-[90] bg-black/60"
            onClick={() => setContextMenuFile(null)}
          />
          <div className="fixed inset-x-4 bottom-[88px] z-[95] bg-telegram-surface border border-telegram-border rounded-3xl shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-telegram-border/50 flex items-center gap-4">
              <div className="p-3 rounded-2xl bg-telegram-primary/10">
                {(() => {
                  const Icon = getFileIcon(contextMenuFile);
                  return <Icon className="w-6 h-6 text-telegram-primary" />;
                })()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{contextMenuFile.name}</p>
                <p className="text-xs text-telegram-subtext">{contextMenuFile.sizeStr}</p>
              </div>
            </div>
            
            <div className="p-4 grid grid-cols-4 gap-3">
              {onPreview && isPreviewable(contextMenuFile) && (
                <button
                  onClick={() => {
                    onPreview(contextMenuFile);
                    setContextMenuFile(null);
                  }}
                  className="flex flex-col items-center gap-2 p-3 rounded-2xl bg-blue-500/10 hover:bg-blue-500/20"
                >
                  <Eye className="w-6 h-6 text-blue-400" />
                  <span className="text-[10px] font-medium">Preview</span>
                </button>
              )}
              <button
                onClick={() => {
                  onDownload(contextMenuFile);
                  setContextMenuFile(null);
                }}
                className="flex flex-col items-center gap-2 p-3 rounded-2xl bg-telegram-primary/10 hover:bg-telegram-primary/20"
              >
                <CloudDownload className="w-6 h-6 text-telegram-primary" />
                <span className="text-[10px] font-medium">Download</span>
              </button>
              {onShare && (
                <button
                  onClick={() => {
                    onShare(contextMenuFile);
                    setContextMenuFile(null);
                  }}
                  className="flex flex-col items-center gap-2 p-3 rounded-2xl bg-telegram-hover/30 hover:bg-telegram-hover/50"
                >
                  <Share2 className="w-6 h-6 text-telegram-text" />
                  <span className="text-[10px] font-medium">Share</span>
                </button>
              )}
              <button
                onClick={() => {
                  onDelete(contextMenuFile.id, contextMenuFile.folder_id);
                  setContextMenuFile(null);
                }}
                className="flex flex-col items-center gap-2 p-3 rounded-2xl bg-red-500/10 hover:bg-red-500/20"
              >
                <Trash2 className="w-6 h-6 text-red-400" />
                <span className="text-[10px] font-medium text-red-400">Delete</span>
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}