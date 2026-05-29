import { useState, useEffect, useCallback, useRef, Suspense, lazy } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { invoke } from '@tauri-apps/api/core';
import { writeBinaryFile } from '@tauri-apps/plugin-fs';
import { tempDir, join } from '@tauri-apps/api/path';
import { toast } from 'sonner';
import { Folder, Download, Settings, Search, Grid, List, Upload, FolderPlus, RefreshCw } from 'lucide-react';
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
  
  // Modal states
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [showMoveToFolder, setShowMoveToFolder] = useState(false);
  const [shareFile, setShareFile] = useState<TelegramFile | null>(null);
  const [previewGallery, setPreviewGallery] = useState<{ files: TelegramFile[]; index: number } | null>(null);
  const [showNetworkSettings, setShowNetworkSettings] = useState(false);
  const [showShareDashboard, setShowShareDashboard] = useState(false);
  
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
  const handleDelete = useCallback(async (fileId: number) => {
    try {
      await invoke('cmd_delete_file', { fileId });
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
        await invoke('cmd_delete_file', { fileId: id });
      }
      toast.success(`Deleted ${selectedIds.length} files`);
      queryClient.invalidateQueries({ queryKey: ['files'] });
      setSelectedIds([]);
    } catch (err) {
      toast.error(`Bulk delete failed: ${err}`);
    }
  }, [searchTerm, queryClient, folders]);

  const handleUpload = useCallback(async () => {
    fileInputRef.current?.click();
  }, []);

  const handleFilesSelected = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const dir = await tempDir();
    const totalFiles = files.length;

    for (let i = 0; i < totalFiles; i++) {
      const file = files[i];
      const uploadId = `upload_${Date.now()}_${i}`;
      const bytes = await file.arrayBuffer();

      const tempPath = await join(dir, file.name);
      await writeBinaryFile(tempPath, new Uint8Array(bytes));

      const newItem: QueueItem = {
        id: uploadId,
        path: tempPath,
        folderId: activeFolderId,
        status: 'uploading',
        progress: 0
      };

      setUploadQueue(prev => [...prev, newItem]);

      try {
        await invoke('initiate_upload', {
          path: tempPath,
          folderId: activeFolderId,
          transferId: uploadId,
        });
        setUploadQueue(prev => prev.map(item =>
          item.id === uploadId ? { ...item, status: 'success', progress: 100 } : item
        ));
        toast.success(`Uploaded: ${file.name}`);
      } catch (err) {
        setUploadQueue(prev => prev.map(item =>
          item.id === uploadId ? { ...item, status: 'error', error: String(err) } : item
        ));
        toast.error(`Upload failed: ${file.name} — ${err}`);
      }
    }

    // Reset file input so the same file can be re-picked
    e.target.value = '';
  }, [activeFolderId]);

  const handleDownload = useCallback(async (file: TelegramFile) => {
    try {
      await invoke('cmd_download_file', { fileId: file.id, fileName: file.name });
      toast.success('Download started');
    } catch (err) {
      toast.error(`Download failed: ${err}`);
    }
  }, []);

  const handleBulkDownload = useCallback(async () => {
    if (selectedIds.length === 0) return;
    try {
      for (const id of selectedIds) {
        await invoke('cmd_download_file', { fileId: id, fileName: `file_${id}` });
      }
      toast.success(`Downloaded ${selectedIds.length} files`);
    } catch (err) {
      toast.error(`Bulk download failed: ${err}`);
    }
  }, [selectedIds]);

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

  const activeFolder = folders.find(f => f.id === activeFolderId);

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
    <div className="flex flex-col h-screen w-full bg-telegram-bg text-telegram-text overflow-hidden select-none font-sans" style={{ touchAction: 'manipulation' }}>
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
                <p className="text-[10px] text-telegram-subtext/80 font-medium font-mono uppercase tracking-wider">
                  {activeFolder?.name || 'Loading...'}
                </p>
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
      <main className={`flex-1 overflow-y-auto px-4 py-3 space-y-4 scroll-smooth ${isAndroid ? 'pb-[88px]' : 'pb-[28px]'}`}>
        {activeTab === 'files' && (
          <div className="space-y-4 animate-fade-in">
            {/* Folder Header */}
            {selectedIds.length === 0 && (
              <div className="flex items-center justify-between bg-telegram-hover/20 p-3 rounded-2xl border border-telegram-border/30">
                <div className="flex items-center gap-2.5">
                  <Folder className="w-5 h-5 text-telegram-primary" />
                  <span className="text-sm font-semibold">{activeFolder?.name || 'Saved Messages'}</span>
                </div>
                <div className="flex items-center gap-2">
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
            ) : displayedFiles.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 space-y-3 text-center">
                <div className="p-4 rounded-full bg-telegram-primary/10 text-telegram-primary border border-telegram-primary/20">
                  <Folder className="w-8 h-8" />
                </div>
                <h3 className="text-base font-bold">No Files Here</h3>
                <p className="text-xs text-telegram-subtext max-w-xs">
                  {searchTerm ? 'Try a different search term' : 'Upload files to get started'}
                </p>
              </div>
            ) : (
              <TouchFileList
                files={displayedFiles}
                viewMode={viewMode}
                selectedIds={selectedIds}
                onFileClick={(fileId) => {
                  if (selectedIds.length > 0) {
                    if (selectedIds.includes(fileId)) {
                      setSelectedIds(selectedIds.filter(id => id !== fileId));
                    } else {
                      setSelectedIds([...selectedIds, fileId]);
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