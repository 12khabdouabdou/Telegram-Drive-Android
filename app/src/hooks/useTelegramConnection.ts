import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { load } from '@tauri-apps/plugin-store';
import { TelegramFolder } from '../types';
import { toast } from 'sonner';

export function useTelegramConnection(onLogout: () => void) {
  const [store, setStore] = useState<any>(null);
  const [folders, setFolders] = useState<TelegramFolder[]>([]);
  const [activeFolderId, setActiveFolderId] = useState<number | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

  // Initialize store and check connection on mount
  useEffect(() => {
    const init = async () => {
      try {
        const storeInstance = await load('config.json');
        setStore(storeInstance);

        const savedId = await storeInstance.get<string>('api_id');
        if (savedId) {
          const apiId = parseInt(savedId, 10);
          if (!isNaN(apiId)) {
            try {
              await invoke('cmd_connect', { apiId });
              const ok = await invoke<boolean>('cmd_check_connection');
              setIsConnected(ok);
              
              if (ok) {
                await scanFolders();
              }
            } catch (err) {
              console.warn('Connection check failed:', err);
              setIsConnected(false);
            }
          }
        }
      } catch (err) {
        console.error('Store initialization failed:', err);
      }
    };

    init();
  }, []);

  // Scan folders from Telegram
  const scanFolders = useCallback(async () => {
    setIsSyncing(true);
    try {
      const scannedFolders = await invoke<any[]>('cmd_scan_folders');
      setFolders(scannedFolders.map(f => ({
        id: f.id,
        name: f.name,
        parent_id: f.parent_id,
        username: f.username
      })));
      
      // Set default to Saved Messages (usually ID 0 or null)
      if (scannedFolders.length > 0) {
        const savedMessages = scannedFolders.find(f => f.name === 'Saved Messages');
        if (savedMessages) {
          setActiveFolderId(savedMessages.id);
        } else {
          setActiveFolderId(scannedFolders[0].id);
        }
      }
    } catch (err) {
      toast.error(`Failed to scan folders: ${err}`);
    } finally {
      setIsSyncing(false);
    }
  }, []);

  // Create new folder
  const handleCreateFolder = useCallback(async (name: string) => {
    try {
      await invoke('cmd_create_folder', { name });
      toast.success('Folder created');
      await scanFolders();
    } catch (err) {
      toast.error(`Failed to create folder: ${err}`);
      throw err;
    }
  }, [scanFolders]);

  // Delete folder
  const handleFolderDelete = useCallback(async (folderId: number) => {
    try {
      await invoke('cmd_delete_folder', { folderId });
      toast.success('Folder deleted');
      await scanFolders();
      
      if (activeFolderId === folderId) {
        setActiveFolderId(null);
      }
    } catch (err) {
      toast.error(`Failed to delete folder: ${err}`);
      throw err;
    }
  }, [activeFolderId, scanFolders]);

  // Logout
  const handleLogout = useCallback(async () => {
    try {
      await invoke('cmd_logout');
      
      // Clear stored credentials
      const storeInstance = await load('config.json');
      await storeInstance.delete('api_id');
      await storeInstance.delete('api_hash');
      await storeInstance.save();
      
      toast.success('Logged out successfully');
      onLogout();
    } catch (err) {
      toast.error(`Logout failed: ${err}`);
      onLogout();
    }
  }, [onLogout]);

  // Refresh connection
  const handleRefresh = useCallback(async () => {
    await scanFolders();
  }, [scanFolders]);

  return {
    store,
    folders,
    activeFolderId,
    setActiveFolderId,
    isSyncing,
    isConnected,
    handleLogout,
    handleSyncFolders: scanFolders,
    handleCreateFolder,
    handleFolderDelete,
    handleRefresh
  };
}