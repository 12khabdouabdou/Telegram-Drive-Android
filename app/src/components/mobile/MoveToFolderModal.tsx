import { useState, useEffect } from 'react';
import { X, Folder, ChevronRight, Home } from 'lucide-react';
import { motion } from 'framer-motion';
import { invoke } from '@tauri-apps/api/core';
import { toast } from 'sonner';
import { TelegramFolder } from '../../types';

interface MoveToFolderModalProps {
  selectedFileIds: number[];
  sourceFolderId?: number | null;
  onClose: () => void;
  onMoved: () => void;
}

export function MoveToFolderModal({ selectedFileIds, sourceFolderId = null, onClose, onMoved }: MoveToFolderModalProps) {
  const [folders, setFolders] = useState<TelegramFolder[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [moving, setMoving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadFolders();
  }, []);

  const loadFolders = async () => {
    setLoading(true);
    try {
      const scannedFolders = await invoke<any[]>('cmd_scan_folders');
      setFolders(scannedFolders.map((f: any) => ({
        id: f.id,
        name: f.name,
        parent_id: f.parent_id,
        username: f.username
      })));
    } catch (err) {
      toast.error(`Failed to load folders: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  const handleMove = async () => {
    if (selectedFolderId === null) return;

    setMoving(true);
    try {
      await invoke('cmd_move_files', {
        messageIds: selectedFileIds,
        sourceFolderId: sourceFolderId,
        targetFolderId: selectedFolderId
      });
      toast.success(`Moved ${selectedFileIds.length} file(s) successfully`);
      onMoved();
      onClose();
    } catch (err) {
      toast.error(`Failed to move files: ${err}`);
    } finally {
      setMoving(false);
    }
  };

  const filteredFolders = folders.filter(f => 
    f.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Find "Saved Messages" or first folder to be default
  const defaultFolder = folders.find(f => f.name === 'Saved Messages') || folders[0];

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div 
        initial={{ y: '100%', opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: '100%', opacity: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="bg-telegram-surface border border-telegram-border rounded-t-3xl sm:rounded-2xl w-full max-w-md max-h-[80vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-telegram-border flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">Move to Folder</h3>
            <p className="text-xs text-telegram-subtext mt-0.5">
              {selectedFileIds.length} file(s) selected
            </p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-telegram-hover transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-telegram-border">
          <input
            type="text"
            placeholder="Search folders..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl bg-telegram-hover/50 border border-telegram-border/50 text-sm focus:outline-none focus:border-telegram-primary/50 transition-colors"
          />
        </div>

        {/* Folder List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-8 h-8 border-3 border-telegram-primary border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : filteredFolders.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-telegram-subtext">No folders found</p>
            </div>
          ) : (
            <>
              {/* Home / Saved Messages option */}
              {defaultFolder && !searchTerm && (
                <button
                  onClick={() => setSelectedFolderId(defaultFolder.id)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl transition-colors ${
                    selectedFolderId === defaultFolder.id
                      ? 'bg-telegram-primary/20 border border-telegram-primary/50'
                      : 'bg-telegram-hover/30 border border-transparent hover:bg-telegram-hover/50'
                  }`}
                >
                  <div className="p-2 rounded-lg bg-telegram-primary/10">
                    <Home className="w-5 h-5 text-telegram-primary" />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="text-sm font-medium">{defaultFolder.name}</p>
                    <p className="text-xs text-telegram-subtext">Default location</p>
                  </div>
                  {selectedFolderId === defaultFolder.id && (
                    <div className="w-5 h-5 rounded-full bg-telegram-primary flex items-center justify-center">
                      <span className="text-black text-xs font-bold">✓</span>
                    </div>
                  )}
                </button>
              )}

              {/* Other folders */}
              {filteredFolders
                .filter(f => f.name !== 'Saved Messages' || searchTerm)
                .map((folder) => (
                  <button
                    key={folder.id}
                    onClick={() => setSelectedFolderId(folder.id)}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl transition-colors ${
                      selectedFolderId === folder.id
                        ? 'bg-telegram-primary/20 border border-telegram-primary/50'
                        : 'bg-telegram-hover/30 border border-transparent hover:bg-telegram-hover/50'
                    }`}
                  >
                    <div className="p-2 rounded-lg bg-telegram-primary/10">
                      <Folder className="w-5 h-5 text-telegram-primary" />
                    </div>
                    <div className="flex-1 text-left">
                      <p className="text-sm font-medium truncate">{folder.name}</p>
                      {folder.username && (
                        <p className="text-xs text-telegram-subtext">@{folder.username}</p>
                      )}
                    </div>
                    <ChevronRight className="w-4 h-4 text-telegram-subtext" />
                    {selectedFolderId === folder.id && (
                      <div className="w-5 h-5 rounded-full bg-telegram-primary flex items-center justify-center">
                        <span className="text-black text-xs font-bold">✓</span>
                      </div>
                    )}
                  </button>
                ))}
            </>
          )}
        </div>

        {/* Actions */}
        <div className="p-4 border-t border-telegram-border">
          <button
            onClick={handleMove}
            disabled={moving || selectedFolderId === null}
            className="w-full py-3.5 rounded-xl bg-telegram-primary text-black font-bold text-sm transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {moving ? (
              <>
                <span className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin"></span>
                Moving...
              </>
            ) : (
              <>
                <Folder className="w-4 h-4" />
                Move Here
              </>
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
}