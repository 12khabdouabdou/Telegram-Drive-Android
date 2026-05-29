import { useState } from 'react';
import { 
  Download, Trash2, Folder, Share2, Pen, Copy, 
  ExternalLink, X, FileText, Image, Music, Clapperboard, File 
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { TelegramFile } from '../../types';
import { invoke } from '@tauri-apps/api/core';
import { toast } from 'sonner';

interface ContextMenuProps {
  file: TelegramFile;
  isOpen: boolean;
  onClose: () => void;
  onDownload: () => void;
  onDelete: () => void;
  onShare: () => void;
  onMove: () => void;
  onPreview: () => void;
}

function getFileIcon(file: TelegramFile) {
  if (file.type === 'folder') {
    return Folder;

  if (/\.(mp4|mkv|avi|mov|webm|m4v)$/i.test(name)) return Clapperboard;
  if (/\.(pdf|doc|docx|txt|rtf|ppt|pptx|xls|xlsx)$/i.test(name)) return FileText;
  return File;
}

export function ContextMenu({
  file,
  isOpen,
  onClose,
  onDownload,
  onDelete,
  onShare,
  onMove,
  onPreview
}: ContextMenuProps) {
  const Icon = getFileIcon(file);
  const [copied, setCopied] = useState(false);

  const handleCopyLink = async () => {
    try {
      await invoke('cmd_create_share', {
        folderId: null,
        messageId: file.id,
        fileName: file.name,
        fileSize: file.size,
        password: null,
        expiryHours: null
      }).then((shareInfo: any) => {
        navigator.clipboard.writeText(shareInfo.link);
        setCopied(true);
        toast.success('Link copied to clipboard');
        setTimeout(() => setCopied(false), 2000);
      });
    } catch (err) {
      toast.error(`Failed to copy link: ${err}`);
    }
    onClose();
  };

  const menuItems = [
    {
      icon: ExternalLink,
      label: 'Preview',
      action: onPreview,
      color: 'text-telegram-primary'
    },
    {
      icon: Download,
      label: 'Download',
      action: onDownload,
      color: 'text-telegram-primary'
    },
    {
      icon: Share2,
      label: 'Share Link',
      action: onShare,
      color: 'text-telegram-primary'
    },
    {
      icon: Folder,

      icon: Pen,
      label: 'Rename',
      action: () => {
        toast.info('Rename feature coming soon');
        onClose();
      },
      color: 'text-telegram-text'
    },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[90] bg-black/60"
            onClick={onClose}
          />
          
          {/* Bottom Sheet */}
          <motion.div
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed inset-x-4 bottom-20 z-[95] bg-telegram-surface border border-telegram-border rounded-3xl shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="p-4 border-b border-telegram-border/50">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-2xl bg-telegram-primary/10">
                  <Icon className="w-6 h-6 text-telegram-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{file.name}</p>
                  <p className="text-xs text-telegram-subtext">{file.sizeStr}</p>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 rounded-xl hover:bg-telegram-hover transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Menu Items */}
            <div className="p-4 grid grid-cols-3 gap-3">
              {menuItems.map((item) => (
                <button
                  key={item.label}
                  onClick={() => {
                    item.action();
                    onClose();
                  }}
                  className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-telegram-hover/30 hover:bg-telegram-hover/50 transition-all active:scale-95"
                >
                  <div className={`p-3 rounded-xl ${item.color} bg-telegram-bg/50`}>
                    <item.icon className="w-6 h-6" />
                  </div>
                  <span className="text-xs font-medium text-center">{item.label}</span>
                </button>
              ))}
              
              {/* Delete Button */}
              <button
                onClick={() => {
                  onDelete();
                  onClose();
                }}
                className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-red-500/10 hover:bg-red-500/20 transition-all active:scale-95"
              >
                <div className="p-3 rounded-xl text-red-400 bg-red-500/10">
                  <Trash2 className="w-6 h-6" />
                </div>
                <span className="text-xs font-medium text-red-400">Delete</span>
              </button>
            </div>

            {/* Spacer for bottom nav */}
            <div className="h-4" />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}