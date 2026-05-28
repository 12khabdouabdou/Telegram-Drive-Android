import { useState } from 'react';
import { X, Folder, FolderPlus } from 'lucide-react';
import { motion } from 'framer-motion';
import { invoke } from '@tauri-apps/api/core';
import { toast } from 'sonner';

interface CreateFolderModalProps {
  onClose: () => void;
  onCreated: () => void;
}

export function CreateFolderModal({ onClose, onCreated }: CreateFolderModalProps) {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!name.trim()) {
      setError('Please enter a folder name');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await invoke('cmd_create_folder', { name: name.trim() });
      toast.success('Folder created successfully');
      onCreated();
      onClose();
    } catch (err) {
      setError(String(err));
      toast.error(`Failed to create folder: ${err}`);
    } finally {
      setLoading(false);
    }
  };

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
        className="bg-telegram-surface border border-telegram-border rounded-t-3xl sm:rounded-2xl w-full max-w-md overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-telegram-border flex items-center justify-between">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <FolderPlus className="w-5 h-5 text-telegram-primary" />
            Create Folder
          </h3>
          <button 
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-telegram-hover transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          {/* Folder Name Input */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-telegram-subtext">Folder Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError(null);
              }}
              placeholder="Enter folder name"
              className="w-full px-4 py-3.5 rounded-xl bg-telegram-hover/50 border border-telegram-border/50 text-sm focus:outline-none focus:border-telegram-primary/50 transition-colors"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleCreate();
                }
              }}
            />
            {error && (
              <p className="text-xs text-red-400">{error}</p>
            )}
          </div>

          {/* Preview */}
          <div className="p-4 rounded-xl bg-telegram-hover/30 border border-telegram-border/30">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-telegram-primary/10">
                <Folder className="w-5 h-5 text-telegram-primary" />
              </div>
              <div>
                <p className="text-sm font-medium truncate">
                  {name || 'New Folder'}
                </p>
                <p className="text-xs text-telegram-subtext">Private Channel</p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-3 rounded-xl bg-telegram-hover/50 text-telegram-text font-semibold text-sm transition-all hover:bg-telegram-hover active:scale-[0.98]"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={loading || !name.trim()}
              className="flex-1 py-3 rounded-xl bg-telegram-primary text-black font-bold text-sm transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <span className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin"></span>
                  Creating...
                </>
              ) : (
                <>
                  <FolderPlus className="w-4 h-4" />
                  Create
                </>
              )}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}