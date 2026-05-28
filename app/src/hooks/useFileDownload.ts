import { useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { toast } from 'sonner';
import { DownloadItem } from '../types';

export function useFileDownload(store: any) {
  const [downloadQueue, setDownloadQueue] = useState<DownloadItem[]>([]);

  // Queue a file for download
  const queueDownload = useCallback(async (
    fileId: number,
    filename: string,
    folderId: number | null
  ) => {
    if (!store) {
      toast.error('Not connected to Telegram');
      return;
    }

    const downloadId = `download_${fileId}_${Date.now()}`;
    
    const newItem: DownloadItem = {
      id: downloadId,
      messageId: fileId,
      filename,
      folderId,
      status: 'pending',
      progress: 0
    };

    setDownloadQueue(prev => [...prev, newItem]);

    try {
      await invoke('cmd_download_file', { fileId, fileName: filename });
      
      setDownloadQueue(prev => prev.map(item => 
        item.id === downloadId 
          ? { ...item, status: 'success', progress: 100 }
          : item
      ));
      
      toast.success('Download completed');
    } catch (err) {
      setDownloadQueue(prev => prev.map(item => 
        item.id === downloadId 
          ? { ...item, status: 'error', error: String(err) }
          : item
      ));
      
      toast.error(`Download failed: ${err}`);
    }
  }, [store]);

  // Cancel single download
  const cancelItem = useCallback(async (itemId: string) => {
    try {
      const item = downloadQueue.find(i => i.id === itemId);
      if (item) {
        await invoke('cmd_cancel_transfer', { transferId: item.messageId.toString() });
        setDownloadQueue(prev => prev.filter(i => i.id !== itemId));
        toast.success('Download cancelled');
      }
    } catch (err) {
      toast.error(`Cancel failed: ${err}`);
    }
  }, [downloadQueue]);

  // Cancel all downloads
  const cancelAll = useCallback(async () => {
    try {
      for (const item of downloadQueue) {
        if (item.status === 'downloading' || item.status === 'pending') {
          await invoke('cmd_cancel_transfer', { transferId: item.messageId.toString() });
        }
      }
      setDownloadQueue([]);
      toast.success('All downloads cancelled');
    } catch (err) {
      toast.error(`Cancel all failed: ${err}`);
    }
  }, [downloadQueue]);

  // Retry failed download
  const retryItem = useCallback(async (itemId: string) => {
    const item = downloadQueue.find(i => i.id === itemId);
    if (!item) return;

    setDownloadQueue(prev => prev.map(i => 
      i.id === itemId ? { ...i, status: 'pending', error: undefined } : i
    ));

    try {
      await invoke('cmd_download_file', { 
        fileId: item.messageId, 
        fileName: item.filename 
      });
      
      setDownloadQueue(prev => prev.map(i => 
        i.id === itemId ? { ...i, status: 'success', progress: 100 } : i
      ));
      
      toast.success('Download completed');
    } catch (err) {
      setDownloadQueue(prev => prev.map(i => 
        i.id === itemId ? { ...i, status: 'error', error: String(err) } : i
      ));
      
      toast.error(`Retry failed: ${err}`);
    }
  }, [downloadQueue]);

  // Clear finished downloads
  const clearFinished = useCallback(() => {
    setDownloadQueue(prev => prev.filter(item => 
      item.status !== 'success' && item.status !== 'cancelled' && item.status !== 'error'
    ));
  }, []);

  return {
    downloadQueue,
    queueDownload,
    cancelAll,
    cancelItem,
    retryItem,
    clearFinished
  };
}