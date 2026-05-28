import { useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { toast } from 'sonner';
import { QueueItem } from '../types';

export function useFileUpload(store: any) {
  const [uploadQueue, setUploadQueue] = useState<QueueItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  // Manual file upload
  const handleManualUpload = useCallback(async () => {
    if (!store) {
      toast.error('Not connected to Telegram');
      return;
    }

    try {
      // This will be called from mobile file picker
      // The actual file selection happens in the native dialog
      toast.info('Opening file picker...');
    } catch (err) {
      toast.error(`Upload failed: ${err}`);
    }
  }, [store]);

  // Folder upload with auto-zip
  const handleFolderUpload = useCallback(async () => {
    if (!store) {
      toast.error('Not connected to Telegram');
      return;
    }

    try {
      toast.info('Folder upload coming soon');
    } catch (err) {
      toast.error(`Folder upload failed: ${err}`);
    }
  }, [store]);

  // Cancel single upload
  const cancelItem = useCallback(async (itemId: string) => {
    try {
      await invoke('cmd_cancel_transfer', { transferId: itemId });
      setUploadQueue(prev => prev.filter(item => item.id !== itemId));
      toast.success('Upload cancelled');
    } catch (err) {
      toast.error(`Cancel failed: ${err}`);
    }
  }, []);

  // Cancel all uploads
  const cancelAll = useCallback(async () => {
    try {
      for (const item of uploadQueue) {
        if (item.status === 'uploading' || item.status === 'pending') {
          await invoke('cmd_cancel_transfer', { transferId: item.id });
        }
      }
      setUploadQueue([]);
      toast.success('All uploads cancelled');
    } catch (err) {
      toast.error(`Cancel all failed: ${err}`);
    }
  }, [uploadQueue]);

  // Retry failed upload
  const retryItem = useCallback(async (itemId: string) => {
    try {
      setUploadQueue(prev => prev.map(item => 
        item.id === itemId ? { ...item, status: 'pending', error: undefined } : item
      ));
      // Re-trigger upload logic
      toast.info('Retrying upload...');
    } catch (err) {
      toast.error(`Retry failed: ${err}`);
    }
  }, []);

  // Clear completed uploads
  const clearCompleted = useCallback(() => {
    setUploadQueue(prev => prev.filter(item => 
      item.status !== 'success' && item.status !== 'cancelled' && item.status !== 'error'
    ));
  }, []);

  return {
    uploadQueue,
    setUploadQueue,
    handleManualUpload,
    handleFolderUpload,
    cancelAll,
    cancelItem,
    retryItem,
    clearCompleted,
    isDragging
  };
}