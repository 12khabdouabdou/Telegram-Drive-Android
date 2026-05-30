import { useCallback, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { toast } from 'sonner';
import { TelegramFile } from '../types';

export function useFileOperations(
  files: TelegramFile[],
  selectedIds: number[],
  setSelectedIds: (ids: number[]) => void,
  activeFolderId: number | null = null,
  queueDownload?: (fileId: number, fileName: string, folderId: number | null) => void
) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isMoving, setIsMoving] = useState(false);

  // Delete single file
  const handleDelete = useCallback(async (fileId: number) => {
    setIsDeleting(true);
    try {
      await invoke('cmd_delete_file', { messageId: fileId, folderId: activeFolderId });
      toast.success('File deleted');
      setSelectedIds([]);
    } catch (err) {
      toast.error(`Delete failed: ${err}`);
    } finally {
      setIsDeleting(false);
    }
  }, [setSelectedIds]);

  // Bulk delete
  const handleBulkDelete = useCallback(async () => {
    if (selectedIds.length === 0) return;
    
    setIsDeleting(true);
    try {
      for (const id of selectedIds) {
        await invoke('cmd_delete_file', { messageId: id, folderId: activeFolderId });
      }
      toast.success(`Deleted ${selectedIds.length} files`);
      setSelectedIds([]);
    } catch (err) {
      toast.error(`Bulk delete failed: ${err}`);
    } finally {
      setIsDeleting(false);
    }
  }, [selectedIds, setSelectedIds]);

  // Download single file
  const handleDownload = useCallback(async (fileId: number, fileName: string) => {
    if (queueDownload) {
      queueDownload(fileId, fileName, activeFolderId);
      return;
    }
    setIsDownloading(true);
    try {
      await invoke('cmd_download_file', { 
        fileId,
        fileName,
        folderId: activeFolderId
      });
      toast.success('Download started');
    } catch (err) {
      toast.error(`Download failed: ${err}`);
    } finally {
      setIsDownloading(false);
    }
  }, [queueDownload, activeFolderId]);

  // Bulk download
  const handleBulkDownload = useCallback(async () => {
    if (selectedIds.length === 0) return;
    
    setIsDownloading(true);
    try {
      const filesToDownload = files.filter(f => selectedIds.includes(f.id));
      for (const file of filesToDownload) {
        if (queueDownload) {
          queueDownload(file.id, file.name, activeFolderId);
        } else {
          await invoke('cmd_download_file', { 
            fileId: file.id,
            fileName: file.name,
            folderId: activeFolderId
          });
        }
      }
      toast.success(`Started ${filesToDownload.length} downloads`);
      setSelectedIds([]);
    } catch (err) {
      toast.error(`Bulk download failed: ${err}`);
    } finally {
      setIsDownloading(false);
    }
  }, [selectedIds, files, setSelectedIds, queueDownload, activeFolderId]);

  // Move files to folder
  const handleBulkMove = useCallback(async (targetFolderId: number | null) => {
    if (selectedIds.length === 0) return;
    
    setIsMoving(true);
    try {
      await invoke('cmd_move_files', {
        messageIds: selectedIds,
        sourceFolderId: activeFolderId,
        targetFolderId
      });
      toast.success(`Moved ${selectedIds.length} files`);
      setSelectedIds([]);
    } catch (err) {
      toast.error(`Move failed: ${err}`);
    } finally {
      setIsMoving(false);
    }
  }, [selectedIds, setSelectedIds, activeFolderId]);

  // Download folder (zip)
  const handleDownloadFolder = useCallback(async (folderId: number, folderName: string) => {
    setIsDownloading(true);
    try {
      await invoke('cmd_zip_folder', { folderId });
      if (queueDownload) {
        queueDownload(folderId, `${folderName}.zip`, activeFolderId);
      } else {
        await invoke('cmd_download_file', {
          fileId: folderId,
          fileName: `${folderName}.zip`,
          folderId: activeFolderId
        });
      }
      toast.success('Folder download started');
    } catch (err) {
      toast.error(`Folder download failed: ${err}`);
    } finally {
      setIsDownloading(false);
    }
  }, [queueDownload, activeFolderId]);

  // Global search
  const handleGlobalSearch = useCallback(async (query: string): Promise<TelegramFile[]> => {
    if (!query || query.length < 2) return [];
    
    try {
      const results = await invoke<any[]>('cmd_search_global', { query });
      return results.map(r => ({
        ...r,
        sizeStr: formatBytes(r.size),
        type: r.icon_type || 'file'
      }));
    } catch (err) {
      console.error('Search failed:', err);
      return [];
    }
  }, []);

  return {
    handleDelete,
    handleBulkDelete,
    handleDownload,
    handleBulkDownload,
    handleBulkMove,
    handleDownloadFolder,
    handleGlobalSearch,
    isDeleting,
    isDownloading,
    isMoving
  };
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}