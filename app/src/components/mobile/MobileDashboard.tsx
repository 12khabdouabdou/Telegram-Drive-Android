import React, { useState, useEffect, useCallback, useRef, useMemo, Suspense, lazy } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { downloadDir, join } from '@tauri-apps/api/path';
import { toast } from 'sonner';
import { Folder, Download, Settings, Search, Grid, List, Upload, FolderPlus, RefreshCw, CloudDownload, Trash2 } from 'lucide-react';
import { BottomNavBar } from './BottomNavBar';
import { TouchFileList } from './TouchFileList';
import { ThemeToggle } from '../shared/ThemeToggle';
import { usePlatform } from '../../hooks/usePlatform';
import { TelegramFile, TelegramFolder, DownloadItem, QueueItem } from '../../types';
import { formatBytes } from '../../utils';

// Lazy load modals
const CreateFolderModal = lazy(() => import('./CreateFolderModal').then(m => ({ default: m.CreateFolderModal })));
const MoveToFolderModal = lazy(() => import('./MoveToFolderModal').then(m => ({ default: m.MoveToFolderModal })));
const MobileShareDialog = lazy(() => import('./MobileShareDialog').then(m => ({ default: m.ShareDialog })));
const MobileImageGallery = lazy(() => import('./MobileImageGallery').then(m => ({ default: m.MobileImageGallery })));
const MobileNetworkSettings = lazy(() => import('./MobileNetworkSettings').then(m => ({ default: m.MobileNetworkSettings })));
const MobileShareDashboard = lazy(() => import('./MobileShareDashboard').then(m => ({ default: m.MobileShareDashboard })));
const MobileAutoBackup = lazy(() => import('./MobileAutoBackup').then(m => ({ default: m.MobileAutoBackup })));

export default function MobileDashboard({ onLogout }: { onLogout?: () => void }) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'files' | 'downloads' | 'settings'>('files');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [activeFolderId, setActiveFolderId] = useState<number | null>(null);
  const [folders, setFolders] = useState<TelegramFolder[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [downloadQueue, setDownloadQueue] = useState<DownloadItem[]>([]);
  const [uploadQueue, setUploadQueue] = useState<QueueItem[]>([]);
  const [sortBy, setSortBy] = useState<'name' | 'size' | 'date'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [globalResults, setGlobalResults] = useState<TelegramFile[]>([]);
  
  // Modal states
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [showMoveToFolder, setShowMoveToFolder] = useState(false);
  const [shareFile, setShareFile] = useState<TelegramFile | null>(null);
  const [previewGallery, setPreviewGallery] = useState<{ files: TelegramFile[]; index: number } | null>(null);
  const [showNetworkSettings, setShowNetworkSettings] = useState(false);
  const [showShareDashboard, setShowShareDashboard] = useState(false);
  const [showAutoBackup, setShowAutoBackup] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const { isAndroid } = usePlatform();
  const storeRef = { current: null } as any;

  // Initialize connection
  useEffect(() => {
    const initConnection = async () => {
      try {
        const { load } = await import('@tauri-apps/plugin-store');
        const store = await load('config.json');
        storeRef.current = store;
        
        const savedId = await store.get<string>('api_id');
        if (savedId) {
          const apiId = parseInt(savedId, 10);
          if (!isNaN(apiId)) {
            try {
              await invoke('cmd_connect', { apiId });
              const ok = await invoke<boolean>('cmd_check_connection');
              setIsConnected(ok);
              if (ok) await scanFolders();
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
    initConnection();
  }, []);

  // Listen for progress events
  useEffect(() => {
    let unlistenUpload: () => void;
    let unlistenDownload: () => void;

    const setupListeners = async () => {
      unlistenUpload = await listen('upload-progress', (event: any) => {
        const payload = event.payload;
        setUploadQueue(prev => prev.map(item => 
          item.id === payload.id 
            ? { ...item, progress: payload.percent, uploadedBytes: payload.uploaded_bytes, totalBytes: payload.total_bytes, speedBytesPerSec: payload.speed_bytes_per_sec } 
            : item
        ));
      });

      unlistenDownload = await listen('download-progress', (event: any) => {
        const payload = event.payload;
        setDownloadQueue(prev => prev.map(item => 
          item.id === payload.id 
            ? { ...item, progress: payload.percent, uploadedBytes: payload.uploaded_bytes, totalBytes: payload.total_bytes, speedBytesPerSec: payload.speed_bytes_per_sec } 
            : item
        ));
      });
    };

    setupListeners();

    return () => {
      if (unlistenUpload) unlistenUpload();
      if (unlistenDownload) unlistenDownload();
    };
  }, []);

  // Load queues from localStorage on mount
  useEffect(() => {
    try {
      const savedUploads = localStorage.getItem('mobile_upload_queue');
      if (savedUploads) {
        const parsed = JSON.parse(savedUploads);
        setUploadQueue(parsed.map((i: any) => 
          i.status === 'uploading' ? { ...i, status: 'error', error: 'Interrupted by app exit' } : i
        ));
      }
      
      const savedDownloads = localStorage.getItem('mobile_download_queue');
      if (savedDownloads) {
        const parsed = JSON.parse(savedDownloads);
        setDownloadQueue(parsed.map((i: any) => 
          i.status === 'downloading' ? { ...i, status: 'error', error: 'Interrupted by app exit' } : i
        ));
      }
    } catch (err) {
      console.error("Failed to restore queues", err);
    }
  }, []);

  // Save queues to localStorage when they change
  useEffect(() => {
    localStorage.setItem('mobile_upload_queue', JSON.stringify(uploadQueue));
  }, [uploadQueue]);

  useEffect(() => {
    localStorage.setItem('mobile_download_queue', JSON.stringify(downloadQueue));
  }, [downloadQueue]);

  // Query files
  const { data: allFiles = [], isLoading, error, refetch } = useQuery({
    queryKey: ['files', activeFolderId],
    queryFn: async () => {
      const files = await invoke<any[]>('cmd_get_files', { folderId: activeFolderId });
      return files.map((f: any) => ({
        ...f,
        sizeStr: formatBytes(f.size),
        type: f.icon_type || (f.name.endsWith('/') ? 'folder' : 'file')
      }));
    },
    enabled: isConnected,
  });

  const displayedFiles = searchTerm.length > 2
    ? allFiles.filter((f: TelegramFile) => 
        f.name.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : allFiles;

  // Scan folders
  const scanFolders = useCallback(async () => {
    setIsSyncing(true);
    try {
      const scannedFolders = await invoke<any[]>('cmd_scan_folders');
      setFolders(scannedFolders.map((f: any) => ({
        id: f.id,
        name: f.name,
        parent_id: f.parent_id,
        username: f.username
      })));
      
      if (scannedFolders.length > 0) {
        const savedMessages = scannedFolders.find((f: any) => f.name === 'Saved Messages');
        setActiveFolderId(savedMessages?.id || scannedFolders[0].id);
      }
    } catch (err) {
      toast.error(`Failed to scan folders: ${err}`);
    } finally {
      setIsSyncing(false);
    }
  }, []);

  // File operations
  const handleDelete = useCallback(async (fileId: number, fId?: number | null) => {
    try {
      await invoke('cmd_delete_file', { messageId: fileId, folderId: fId ?? null });
      toast.success('File deleted');
      queryClient.invalidateQueries({ queryKey: ['files'] });
      setSelectedIds([]);
    } catch (err) {
      toast.error(`Delete failed: ${err}`);
    }
  }, [queryClient]);

  const handleBulkDelete = useCallback(async () => {
    if (selectedIds.length === 0) return;
    try {
      for (const id of selectedIds) {
        await invoke('cmd_delete_file', { messageId: id, folderId: activeFolderId ?? null });
      }
      toast.success(`Deleted ${selectedIds.length} files`);
      queryClient.invalidateQueries({ queryKey: ['files'] });
      setSelectedIds([]);
    } catch (err) {
      toast.error(`Bulk delete failed: ${err}`);
    }
  }, [selectedIds, queryClient, setSelectedIds, activeFolderId]);

  const handleUpload = useCallback(async () => {
    fileInputRef.current?.click();
  }, []);

  const handleFilesSelected = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const totalFiles = files.length;

    for (let i = 0; i < totalFiles; i++) {
      const file = files[i];
      const uploadId = `upload_${Date.now()}_${i}`;

      let bytes: ArrayBuffer;
      try {
        bytes = await file.arrayBuffer();
      } catch (err) {
        console.error('Failed to read file:', file.name, err);
        toast.error(`Failed to read: ${file.name}`);
        continue;
      }

      let tempPath: string;
      try {
        tempPath = await invoke<string>('cmd_write_temp_file', {
          fileName: file.name,
          fileData: new Uint8Array(bytes),
        });
        console.log(`Wrote ${file.name} (${bytes.byteLength} bytes) to ${tempPath}`);
      } catch (err) {
        console.error('Failed to write temp file:', err);
        toast.error(`Failed to write temp file: ${file.name}`);
        continue;
      }

      const newItem: QueueItem = {
        id: uploadId,
        path: tempPath,
        folderId: activeFolderId ?? null,
        status: 'uploading',
        progress: 0
      };

      setUploadQueue(prev => [...prev, newItem]);

      try {
        console.log(`Initiating upload for ${tempPath}, folderId=${activeFolderId}, transferId=${uploadId}`);
        await invoke('initiate_upload', {
          path: tempPath,
          folderId: activeFolderId ?? null,
          transferId: uploadId,
        });
        setUploadQueue(prev => prev.map(item =>
          item.id === uploadId ? { ...item, status: 'success', progress: 100 } : item
        ));
        toast.success(`Uploaded: ${file.name}`);
        queryClient.invalidateQueries({ queryKey: ['files'] });
      } catch (err) {
        setUploadQueue(prev => prev.map(item =>
          item.id === uploadId ? { ...item, status: 'error', error: String(err) } : item
        ));
        toast.error(`Upload failed: ${file.name} — ${err}`);
      }
    }

    // Reset file input so the same file can be re-picked
    e.target.value = '';
  }, [activeFolderId, queryClient]);

  const handleDownload = useCallback(async (file: TelegramFile) => {
    const downloadId = `dl_${file.id}_${Date.now()}`;
    const newItem: DownloadItem = {
      id: downloadId,
      messageId: file.id,
      filename: file.name,
      folderId: file.folder_id ?? null,
      status: 'downloading',
      progress: 0
    };
    
    setDownloadQueue(prev => [...prev, newItem]);
    toast.success('Download started');

    try {
      const dir = await downloadDir();
      const savePath = await join(dir, file.name);
      await invoke('cmd_download_file', {
        messageId: file.id,
        savePath,
        folderId: file.folder_id ?? null,
        transferId: downloadId
      });
      setDownloadQueue(prev => prev.map(item => 
        item.id === downloadId ? { ...item, status: 'success', progress: 100 } : item
      ));
      toast.success(`Download completed: ${file.name}`);
    } catch (err) {
      setDownloadQueue(prev => prev.map(item => 
        item.id === downloadId ? { ...item, status: 'error', error: String(err) } : item
      ));
      toast.error(`Download failed: ${err}`);
    }
  }, []);

  const handleDeleteFolder = useCallback(async (folderId: number) => {
    try {
      await invoke('cmd_delete_folder', { folderId });
      toast.success('Folder deleted');
      await scanFolders();
      if (activeFolderId === folderId) {
        setActiveFolderId(folders.length > 1 ? folders.find(f => f.id !== folderId)?.id || null : null);
      }
    } catch (err) {
      toast.error(`Failed to delete folder: ${err}`);
    }
  }, [scanFolders, activeFolderId, folders]);

  const handleDownloadFolder = useCallback(async () => {
    if (!activeFolderId) return;
    toast.info('Downloading all files in folder...');
    try {
      const dir = await downloadDir();
      for (const file of displayedFiles) {
        const downloadId = `dl_${file.id}_${Date.now()}`;
        const newItem: DownloadItem = {
          id: downloadId,
          messageId: file.id,
          filename: file.name,
          folderId: file.folder_id ?? null,
          status: 'downloading',
          progress: 0
        };
        setDownloadQueue(prev => [...prev, newItem]);

        const savePath = await join(dir, file.name);
        try {
          await invoke('cmd_download_file', {
            messageId: file.id,
            savePath,
            folderId: file.folder_id ?? null,
            transferId: downloadId
          });
          setDownloadQueue(prev => prev.map(item => 
            item.id === downloadId ? { ...item, status: 'success', progress: 100 } : item
          ));
        } catch (err) {
          setDownloadQueue(prev => prev.map(item => 
            item.id === downloadId ? { ...item, status: 'error', error: String(err) } : item
          ));
          toast.error(`Download failed: ${file.name}`);
        }
      }
      toast.success('Folder download completed');
    } catch (err) {
      toast.error(`Folder download failed: ${err}`);
    }
  }, [activeFolderId, displayedFiles]);

  const handleBulkDownload = useCallback(async () => {
    if (selectedIds.length === 0) return;
    toast.info(`Starting download of ${selectedIds.length} files...`);
    try {
      const dir = await downloadDir();
      for (const id of selectedIds) {
        const downloadId = `dl_${id}_${Date.now()}`;
        const filename = `file_${id}`; // We don't have the file name easily accessible here
        const newItem: DownloadItem = {
          id: downloadId,
          messageId: id,
          filename: filename,
          folderId: activeFolderId ?? null,
          status: 'downloading',
          progress: 0
        };
        setDownloadQueue(prev => [...prev, newItem]);

        const savePath = await join(dir, filename);
        try {
          await invoke('cmd_download_file', {
            messageId: id,
            savePath,
            folderId: activeFolderId ?? null,
            transferId: downloadId
          });
          setDownloadQueue(prev => prev.map(item => 
            item.id === downloadId ? { ...item, status: 'success', progress: 100 } : item
          ));
        } catch (err) {
          setDownloadQueue(prev => prev.map(item => 
            item.id === downloadId ? { ...item, status: 'error', error: String(err) } : item
          ));
        }
      }
      toast.success(`Downloaded ${selectedIds.length} files`);
    } catch (err) {
      toast.error(`Bulk download failed: ${err}`);
    }
  }, [selectedIds, activeFolderId]);

  const handleLogout = useCallback(async () => {
    try {
      await invoke('cmd_logout');
      const { load } = await import('@tauri-apps/plugin-store');
      const store = await load('config.json');
      await store.delete('api_id');
      await store.delete('api_hash');
      await store.save();
      toast.success('Logged out successfully');
      onLogout?.();
    } catch (err) {
      toast.error(`Logout failed: ${err}`);
      onLogout?.();
    }
  }, [onLogout]);

  // Show ad on Android
  useEffect(() => {
    if (isAndroid) {
      invoke('show_ad').catch((e) => console.error('Failed to show ad:', e));
    }
  }, [isAndroid]);

  // Clear selection when folder changes
  useEffect(() => {
    setSelectedIds([]);
    setSearchTerm('');
  }, [activeFolderId]);


  const toggleSort = useCallback((field: 'name' | 'size' | 'date') => {
    if (sortBy === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  }, [sortBy]);

  const sortedFiles = useMemo(() => {
    const files = searchTerm.length > 2 && globalResults.length > 0
      ? globalResults
      : [...displayedFiles];
    files.sort((a, b) => {
      let cmp = 0;
      if (sortBy === 'name') cmp = a.name.localeCompare(b.name);
      else if (sortBy === 'size') cmp = (a.size || 0) - (b.size || 0);
      else if (sortBy === 'date') cmp = (a.created_at || '').localeCompare(b.created_at || '');
      return sortOrder === 'asc' ? cmp : -cmp;
    });
    return files;
  }, [displayedFiles, globalResults, searchTerm, sortBy, sortOrder]);

  // Global search effect
  useEffect(() => {
    if (searchTerm.length > 2) {
      invoke<any[]>('cmd_search_global', { query: searchTerm })
        .then(results => {
          setGlobalResults(results.map((f: any) => ({
            ...f,
            sizeStr: formatBytes(f.size),
            type: f.icon_type || 'file'
          })));
        })
        .catch(() => setGlobalResults([]));
    } else {
      setGlobalResults([]);
    }
  }, [searchTerm]);

  // Preview handler - check if it's an image and open gallery
  const handlePreview = useCallback((file: TelegramFile, allFilesList: TelegramFile[]) => {
    const isImage = /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(file.name);
    
    if (isImage) {
      const imageList = allFilesList.filter((f: TelegramFile) => 
        /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(f.name)
      );
      const index = imageList.findIndex(f => f.id === file.id);
      setPreviewGallery({ files: imageList, index: Math.max(0, index) });
    } else {
      // For non-images, just trigger download
      handleDownload(file);
    }
  }, [handleDownload]);

  return (
    <div className="flex flex-col h-full w-full bg-telegram-bg text-telegram-text overflow-hidden select-none font-sans" style={{ touchAction: 'manipulation' }}>
      {/* Top Header */}
      <header className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-telegram-hover/40 to-telegram-bg border-b border-telegram-border/60 shadow-lg sticky top-0 z-40">
        <div className="flex items-center gap-3 flex-1">
          {selectedIds.length > 0 ? (
            <>
              <button
                onClick={() => setSelectedIds([])}
                className="p-2 rounded-xl bg-telegram-hover/50 text-telegram-text transition-all"
              >
                <span className="text-xs font-bold">{selectedIds.length}</span>
              </button>
              <div className="flex-1">
                <p className="text-sm font-semibold">Selected</p>
                <p className="text-xs text-telegram-subtext">{selectedIds.length} items</p>
              </div>
            </>
          ) : (
            <>
              <div className="p-2 rounded-xl bg-telegram-primary/10 border border-telegram-primary/20 text-telegram-primary">
                <Folder className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-base font-bold tracking-tight bg-gradient-to-r from-white to-telegram-subtext bg-clip-text text-transparent">
                  Telegram Drive
                </h1>
                <select
                  value={activeFolderId ?? ''}
                  onChange={(e) => {
                    setActiveFolderId(e.target.value ? Number(e.target.value) : null);
                    setSearchTerm('');
                  }}
                  className="bg-transparent text-[10px] text-telegram-subtext/80 font-medium font-mono uppercase tracking-wider focus:outline-none appearance-none cursor-pointer block"
                  style={{ WebkitAppearance: 'none', MozAppearance: 'none' }}
                >
                  <option value="">SAVED MESSAGES</option>
                  {folders.map(f => <option key={f.id} value={f.id}>{f.name.toUpperCase()}</option>)}
                </select>
              </div>
            </>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {selectedIds.length > 0 ? (
            <>
              <button
                onClick={handleBulkDownload}
                className="p-2.5 rounded-xl bg-telegram-primary/15 text-telegram-primary active:scale-95 transition-all"
              >
                <Download className="w-5 h-5" />
              </button>
              <button
                onClick={() => setShowMoveToFolder(true)}
                className="p-2.5 rounded-xl bg-telegram-primary/15 text-telegram-primary active:scale-95 transition-all"
              >
                <FolderPlus className="w-5 h-5" />
              </button>
              <button
                onClick={handleBulkDelete}
                className="p-2.5 rounded-xl bg-red-500/15 text-red-400 active:scale-95 transition-all"
              >
                <span className="text-lg">🗑️</span>
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setShowSearch(!showSearch)}
                className="p-2.5 rounded-xl bg-telegram-hover/30 hover:bg-telegram-hover/60 text-telegram-subtext transition-all"
              >
                <Search className="w-5 h-5" />
              </button>
              <ThemeToggle />
            </>
          )}
        </div>
      </header>

      {/* Search Bar */}
      {showSearch && (
        <div className="px-4 py-2 bg-telegram-surface border-b border-telegram-border animate-in slide-in-from-top duration-200">
          <input
            type="text"
            placeholder="Search files..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl bg-telegram-bg/50 border border-telegram-border text-sm text-telegram-text placeholder-telegram-subtext focus:outline-none focus:border-telegram-primary/50 transition-all"
            autoFocus
          />
        </div>
      )}

      {/* Main Content */}
      <main className={`flex-1 overflow-y-auto px-4 py-3 space-y-4 scroll-smooth ${isAndroid ? 'pb-[130px]' : 'pb-[100px]'}`}>
        {activeTab === 'files' && (
          <div className="space-y-4 animate-fade-in">
            {/* Folder Header */}
            {selectedIds.length === 0 && (
              <div className="flex flex-col gap-3 bg-telegram-hover/20 p-3 rounded-2xl border border-telegram-border/30">
                {/* Row 1: Folder Name & Global Actions */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <Folder className="w-5 h-5 text-telegram-primary shrink-0" />
                    <div className="relative flex-1 min-w-0 flex items-center">
                      <select
                        value={activeFolderId ?? ''}
                        onChange={(e) => {
                          setActiveFolderId(e.target.value ? Number(e.target.value) : null);
                          setSearchTerm('');
                        }}
                        className="w-full bg-transparent text-sm font-semibold truncate focus:outline-none appearance-none cursor-pointer pr-4"
                        style={{ WebkitAppearance: 'none', MozAppearance: 'none' }}
                      >
                        <option value="">Saved Messages</option>
                        {folders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                      </select>
                      <span className="absolute right-0 pointer-events-none text-xs text-telegram-subtext">▼</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 ml-2">
                    <button
                      onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-telegram-primary/15 text-telegram-primary border border-telegram-primary/10 active:scale-95 transition-all"
                    >
                      {viewMode === 'grid' ? <List className="w-3.5 h-3.5" /> : <Grid className="w-3.5 h-3.5" />}
                      {viewMode === 'grid' ? 'List' : 'Grid'}
                    </button>
                    <button
                      onClick={scanFolders}
                      disabled={isSyncing}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-telegram-primary/15 text-telegram-primary border border-telegram-primary/10 active:scale-95 transition-all disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                      Sync
                    </button>
                  </div>
                </div>

                {/* Row 2: Sort Controls & Folder Actions */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1 px-2 py-1 rounded-xl bg-telegram-bg/50">
                    {(['name', 'size', 'date'] as const).map(field => (
                      <button
                        key={field}
                        onClick={() => toggleSort(field)}
                        className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${
                          sortBy === field
                            ? 'bg-telegram-primary/20 text-telegram-primary'
                            : 'text-telegram-subtext/60 hover:text-telegram-subtext'
                        }`}
                      >
                        {field === 'name' ? 'A-Z' : field === 'size' ? 'Size' : 'Date'}
                        {sortBy === field && (
                          <span className="text-[8px]">{sortOrder === 'asc' ? '▲' : '▼'}</span>
                        )}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-1.5">
                    {/* Download folder */}
                    <button
                      onClick={handleDownloadFolder}
                      disabled={displayedFiles.length === 0}
                      className="p-1.5 rounded-xl text-xs bg-telegram-primary/10 text-telegram-primary border border-telegram-primary/10 active:scale-95 transition-all disabled:opacity-40"
                      title="Download all files"
                    >
                      <CloudDownload className="w-3.5 h-3.5" />
                    </button>
                    {/* Delete folder */}
                    {activeFolderId && (
                      <button
                        onClick={() => handleDeleteFolder(activeFolderId)}
                        className="p-1.5 rounded-xl text-xs bg-red-500/10 text-red-400 border border-red-500/10 active:scale-95 transition-all"
                        title="Delete folder"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            {selectedIds.length === 0 && (
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={handleUpload}
                  className="flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-telegram-primary/15 hover:bg-telegram-primary/20 border border-telegram-primary/20 text-telegram-primary font-semibold text-sm active:scale-98 transition-all"
                >
                  <Upload className="w-5 h-5" />
                  Upload
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={handleFilesSelected}
                />
                <button
                  onClick={() => setShowCreateFolder(true)}
                  className="flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-telegram-hover/30 hover:bg-telegram-hover/50 border border-telegram-border/30 text-telegram-text font-semibold text-sm active:scale-98 transition-all"
                >
                  <FolderPlus className="w-5 h-5" />
                  New Folder
                </button>
              </div>
            )}
            
            {/* File List */}
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-20 space-y-4">
                <div className="w-10 h-10 border-4 border-telegram-primary border-t-transparent rounded-full animate-spin"></div>
                <p className="text-sm text-telegram-subtext">Loading files...</p>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center py-20 space-y-3 text-center">
                <div className="p-4 rounded-full bg-red-500/10 text-red-400 border border-red-500/20">
                  <span className="text-2xl">⚠️</span>
                </div>
                <h3 className="text-base font-bold text-red-400">Failed to Load Files</h3>
                <p className="text-xs text-telegram-subtext max-w-xs">{String(error)}</p>
                <button
                  onClick={() => refetch()}
                  className="px-6 py-2.5 rounded-xl bg-telegram-primary/15 text-telegram-primary border border-telegram-primary/20 font-semibold text-sm active:scale-95 transition-all"
                >
                  Retry
                </button>
              </div>
            ) : sortedFiles.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 space-y-3 text-center">
                <div className="p-4 rounded-full bg-telegram-primary/10 text-telegram-primary border border-telegram-primary/20">
                  <Folder className="w-8 h-8" />
                </div>
                <h3 className="text-base font-bold">No Files Here</h3>
                <p className="text-xs text-telegram-subtext max-w-xs">
                  {searchTerm ? globalResults.length === 0 ? 'No results found across all chats' : 'Try a different search term' : 'Upload files to get started'}
                </p>
              </div>
            ) : (
              <TouchFileList
                files={sortedFiles}
                viewMode={viewMode}
                selectedIds={selectedIds}
                onFileClick={(fileId) => {
                  if (selectedIds.length > 0) {
                    if (selectedIds.includes(fileId)) {
                      setSelectedIds(selectedIds.filter(id => id !== fileId));
                    } else {
                      setSelectedIds([...selectedIds, fileId]);
                    }
                  } else {
                    const file = sortedFiles.find(f => f.id === fileId);
                    if (file) {
                      if (file.type === 'folder') {
                        setActiveFolderId(file.id);
                        setSearchTerm('');
                      } else {
                        handlePreview(file, sortedFiles);
                      }
                    }
                  }
                }}
                onFileLongPress={(fileId) => {
                  if (selectedIds.includes(fileId)) {
                    setSelectedIds(selectedIds.filter(id => id !== fileId));
                  } else {
                    setSelectedIds([...selectedIds, fileId]);
                  }
                }}
                onDownload={handleDownload}
                onDelete={handleDelete}
                onShare={(file) => setShareFile(file)}
                onPreview={(file) => handlePreview(file, displayedFiles)}
              />
            )}
          </div>
        )}

        {activeTab === 'downloads' && (
          <div className="space-y-4 animate-fade-in">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">Transfers</h2>
              {downloadQueue.length > 0 && (
                <button
                  onClick={() => setDownloadQueue([])}
                  className="text-xs text-telegram-subtext hover:text-telegram-text transition-all"
                >
                  Clear All
                </button>
              )}
            </div>

            {uploadQueue.length > 0 && (
              <>
                <h3 className="text-sm font-semibold text-telegram-primary">Uploading</h3>
                <div className="space-y-3">
                  {uploadQueue.map(item => (
                    <div key={item.id} className="p-4 rounded-2xl bg-telegram-hover/20 border border-telegram-border/30 space-y-2">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-telegram-primary/10 text-telegram-primary">
                          <Upload className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate">{item.path.split('/').pop()}</p>
                          <p className="text-xs text-telegram-subtext capitalize">{item.status}</p>
                        </div>
                        {item.status === 'uploading' && (
                          <div className="w-5 h-5 border-2 border-telegram-primary border-t-transparent rounded-full animate-spin" />
                        )}
                      </div>
                      {item.progress !== undefined && (
                        <div className="relative h-2 bg-telegram-bg/50 rounded-full overflow-hidden">
                          <div
                            className="absolute left-0 top-0 h-full bg-gradient-to-r from-telegram-primary to-telegram-secondary rounded-full"
                            style={{ width: `${item.progress}%` }}
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}

            {downloadQueue.length === 0 && uploadQueue.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-[60vh] space-y-3 text-center px-6">
                <div className="p-4 rounded-full bg-telegram-primary/10 text-telegram-primary border border-telegram-primary/20">
                  <Download className="w-8 h-8 animate-pulse" />
                </div>
                <h3 className="text-base font-bold">No Active Transfers</h3>
                <p className="text-xs text-telegram-subtext max-w-xs leading-relaxed">
                  Your uploads and downloads will appear here
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-telegram-primary">Downloading</h3>
                {downloadQueue.map(item => (
                  <div key={item.id} className="p-4 rounded-2xl bg-telegram-hover/20 border border-telegram-border/30 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-telegram-primary/10 text-telegram-primary">
                          <Download className="w-5 h-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold truncate">{item.filename}</p>
                          <p className="text-xs text-telegram-subtext">
                            {item.status === 'success' ? 'Completed' : 
                             item.status === 'error' ? 'Failed' :
                             item.progress !== undefined ? `${Math.round(item.progress)}%` : item.status}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => setDownloadQueue(prev => prev.filter(i => i.id !== item.id))}
                        className="p-2 rounded-xl bg-telegram-hover/50 text-telegram-subtext active:scale-95 transition-all"
                      >
                        <span className="text-lg">✕</span>
                      </button>
                    </div>
                    {item.progress !== undefined && item.status === 'downloading' && (
                      <div className="relative h-2 bg-telegram-bg/50 rounded-full overflow-hidden">
                        <div
                          className="absolute left-0 top-0 h-full bg-gradient-to-r from-telegram-primary to-telegram-secondary rounded-full transition-all duration-300"
                          style={{ width: `${item.progress}%` }}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="space-y-4 animate-fade-in">
            <h2 className="text-lg font-bold">Settings</h2>
            
            {/* Appearance */}
            <div className="p-4 rounded-2xl bg-telegram-hover/20 border border-telegram-border/30 space-y-4">
              <h3 className="text-xs font-bold text-telegram-primary tracking-wide uppercase">Appearance</h3>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Theme</span>
                <ThemeToggle />
              </div>
            </div>

            {/* Network */}
            <div className="p-4 rounded-2xl bg-telegram-hover/20 border border-telegram-border/30 space-y-4">
              <h3 className="text-xs font-bold text-telegram-primary tracking-wide uppercase">Network</h3>
              
              <div className="flex items-center justify-between py-2 border-b border-telegram-border/20">
                <div>
                  <span className="text-sm font-medium">Connection Status</span>
                  <p className="text-xs text-telegram-subtext mt-0.5">
                    {isConnected ? 'Connected to Telegram' : 'Not connected'}
                  </p>
                </div>
                <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
              </div>

              <button
                onClick={() => setShowNetworkSettings(true)}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-telegram-primary/15 text-telegram-primary border border-telegram-primary/20 font-semibold text-sm active:scale-95 transition-all"
              >
                <Settings className="w-4 h-4" />
                Network & Proxy Settings
              </button>

              <button
                onClick={scanFolders}
                disabled={isSyncing}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-telegram-primary/15 text-telegram-primary border border-telegram-primary/20 font-semibold text-sm active:scale-95 transition-all disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                {isSyncing ? 'Syncing...' : 'Sync Folders'}
              </button>
            </div>

            {/* Auto-Backup */}
            <div className="p-4 rounded-2xl bg-telegram-hover/20 border border-telegram-border/30 space-y-4">
              <h3 className="text-xs font-bold text-telegram-primary tracking-wide uppercase">Auto-Backup</h3>
              <button
                onClick={() => setShowAutoBackup(true)}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-telegram-primary/15 text-telegram-primary border border-telegram-primary/20 font-semibold text-sm active:scale-95 transition-all"
              >
                <CloudDownload className="w-4 h-4" />
                Configure Auto-Backup
              </button>
            </div>

            {/* Sharing */}
            <div className="p-4 rounded-2xl bg-telegram-hover/20 border border-telegram-border/30 space-y-4">
              <h3 className="text-xs font-bold text-telegram-primary tracking-wide uppercase">Sharing</h3>
              <button
                onClick={() => setShowShareDashboard(true)}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-telegram-primary/15 text-telegram-primary border border-telegram-primary/20 font-semibold text-sm active:scale-95 transition-all"
              >
                <span className="text-lg">🔗</span>
                Manage Share Links
              </button>
            </div>

            {/* Storage */}
            <div className="p-4 rounded-2xl bg-telegram-hover/20 border border-telegram-border/30 space-y-4">
              <h3 className="text-xs font-bold text-telegram-primary tracking-wide uppercase">Storage</h3>
              <button
                onClick={async () => {
                  try {
                    await invoke('cmd_clean_cache');
                    toast.success('Cache cleared');
                  } catch (err) {
                    toast.error(`Failed to clear cache: ${err}`);
                  }
                }}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-telegram-hover/50 text-telegram-text border border-telegram-border/30 font-semibold text-sm active:scale-95 transition-all"
              >
                <span className="text-lg">🗑️</span>
                Clear Cache
              </button>
            </div>

            {/* Account */}
            <div className="p-4 rounded-2xl bg-telegram-hover/20 border border-telegram-border/30 space-y-4">
              <h3 className="text-xs font-bold text-telegram-primary tracking-wide uppercase">Account</h3>
              <button
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-red-500/15 hover:bg-red-500/20 text-red-400 border border-red-500/20 font-semibold text-sm active:scale-98 transition-all duration-200"
              >
                <span className="text-lg">🚪</span>
                Log Out
              </button>
            </div>

            <div className="text-center py-4">
              <p className="text-xs text-telegram-subtext">Telegram Drive v1.6.8</p>
              <p className="text-[10px] text-telegram-subtext/60 mt-1">Built with Tauri + React</p>
            </div>
          </div>
        )}
      </main>

      {/* Floating Bottom Nav Bar */}
      <BottomNavBar activeTab={activeTab} setActiveTab={setActiveTab} isAndroid={isAndroid} />

      {/* Modals */}
      <Suspense fallback={null}>
        {showCreateFolder && (
          <CreateFolderModal
            onClose={() => setShowCreateFolder(false)}
            onCreated={() => {
              setShowCreateFolder(false);
              scanFolders();
            }}
          />
        )}
      </Suspense>

      <Suspense fallback={null}>
        {showAutoBackup && (
          <MobileAutoBackup
            onClose={() => setShowAutoBackup(false)}
            folders={folders}
          />
        )}
      </Suspense>

      <Suspense fallback={null}>
        {showMoveToFolder && (
          <MoveToFolderModal
            selectedFileIds={selectedIds}
            onClose={() => setShowMoveToFolder(false)}
            onMoved={() => {
              setShowMoveToFolder(false);
              setSelectedIds([]);
              refetch();
            }}
          />
        )}
      </Suspense>

      <Suspense fallback={null}>
        {shareFile && (
          <MobileShareDialog
            file={shareFile}
            onClose={() => setShareFile(null)}
          />
        )}
      </Suspense>

      <Suspense fallback={null}>
        {previewGallery && (
          <MobileImageGallery
            files={previewGallery.files}
            initialIndex={previewGallery.index}
            onClose={() => setPreviewGallery(null)}
            onDelete={handleDelete}
            onDownload={handleDownload}
            activeFolderId={activeFolderId}
          />
        )}
      </Suspense>

      <Suspense fallback={null}>
        {showNetworkSettings && (
          <MobileNetworkSettings onClose={() => setShowNetworkSettings(false)} />
        )}
      </Suspense>

      <Suspense fallback={null}>
        {showShareDashboard && (
          <MobileShareDashboard onClose={() => setShowShareDashboard(false)} />
        )}
      </Suspense>
    </div>
  );
}