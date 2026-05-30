import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { listen } from '@tauri-apps/api/event';
import { X, CloudUpload, Play, Square, Folder, Phone, FolderSearch, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface MobileAutoBackupProps {
  onClose: () => void;
  folders: { id: number, name: string }[];
}

export function MobileAutoBackup({ onClose, folders }: MobileAutoBackupProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState<{total: number, done: number, current_file: string} | null>(null);
  
  const [backupMode, setBackupMode] = useState<'all' | 'custom'>('all');
  const [destFolderId, setDestFolderId] = useState<number | null>(null);
  
  // Standard Android media directories
  const standardFolders = [
    "/storage/emulated/0/DCIM",
    "/storage/emulated/0/Pictures",
    "/storage/emulated/0/Movies",
    "/storage/emulated/0/Download"
  ];
  
  const [customFolders, setCustomFolders] = useState<string[]>(standardFolders);
  
  useEffect(() => {
    // Check initial status
    invoke<boolean>('cmd_get_backup_status').then(setIsRunning).catch(console.error);

    // Listen for progress
    const unlisten = listen('backup-progress', (event: any) => {
      const p = event.payload;
      setIsRunning(p.is_running);
      if (p.is_running) {
        setProgress({ total: p.total, done: p.done, current_file: p.current_file });
      } else {
        setProgress(null);
        toast.success("Auto-backup completed!");
      }
    });

    return () => {
      unlisten.then(f => f());
    };
  }, []);

  const handleStartBackup = async () => {
    try {
      const selectedFolders = backupMode === 'all' ? standardFolders : customFolders;
      
      await invoke('cmd_start_backup', {
        config: {
          folders: selectedFolders,
          destFolderId: destFolderId
        }
      });
      setIsRunning(true);
      toast.success("Backup started in background");
    } catch (err) {
      toast.error(`Failed to start backup: ${err}`);
    }
  };

  const handleStopBackup = async () => {
    try {
      await invoke('cmd_stop_backup');
      toast.info("Stopping backup after current file...");
    } catch (err) {
      toast.error(`Failed to stop backup: ${err}`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md bg-telegram-surface border border-telegram-border rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-telegram-border/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-telegram-primary/10 rounded-xl text-telegram-primary">
              <CloudUpload className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold">Auto Backup</h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-telegram-hover transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-2xl">
            <p className="text-xs text-yellow-600 font-medium">
              Note: The app requires Storage permissions in Android settings to access your photos and files.
            </p>
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-semibold">Source Folders</h3>
            <div className="flex gap-2">
              <button
                onClick={() => setBackupMode('all')}
                className={`flex-1 flex flex-col items-center gap-2 p-3 rounded-2xl border transition-all ${backupMode === 'all' ? 'bg-telegram-primary/10 border-telegram-primary text-telegram-primary' : 'bg-telegram-hover/30 border-telegram-border/30 text-telegram-subtext'}`}
              >
                <Phone className="w-5 h-5" />
                <span className="text-xs font-bold">All Media</span>
              </button>
              <button
                onClick={() => setBackupMode('custom')}
                className={`flex-1 flex flex-col items-center gap-2 p-3 rounded-2xl border transition-all ${backupMode === 'custom' ? 'bg-telegram-primary/10 border-telegram-primary text-telegram-primary' : 'bg-telegram-hover/30 border-telegram-border/30 text-telegram-subtext'}`}
              >
                <Folder className="w-5 h-5" />
                <span className="text-xs font-bold">Custom</span>
              </button>
            </div>
            
            {backupMode === 'custom' && (
              <div className="p-3 bg-telegram-bg/50 rounded-xl space-y-3">
                <div className="flex items-center gap-2">
                  <button
                    onClick={async () => {
                      try {
                        const selected = await open({
                          directory: true,
                          multiple: false,
                        });
                        if (selected && typeof selected === 'string' && !customFolders.includes(selected)) {
                          setCustomFolders(prev => [...prev, selected]);
                        } else if (selected && selected.startsWith && selected.startsWith('content://')) {
                          toast.error("Android protected folders (content://) are not fully supported. Please try a different folder or grant All Files Access.");
                        }
                      } catch (err) {
                        toast.error("Failed to open folder picker");
                      }
                    }}
                    className="flex-1 flex items-center justify-center gap-2 bg-telegram-primary/20 text-telegram-primary border border-telegram-primary/30 rounded-lg px-3 py-2.5 text-xs font-semibold active:scale-95 transition-all"
                  >
                    <FolderSearch className="w-4 h-4" />
                    Browse Phone Folders
                  </button>
                </div>
                <ul className="space-y-1.5">
                  {customFolders.length === 0 && (
                    <p className="text-xs text-telegram-subtext/70 italic py-1">No custom folders added.</p>
                  )}
                  {customFolders.map(f => (
                    <li key={f} className="flex items-center justify-between bg-telegram-hover/20 px-3 py-2 rounded-lg border border-telegram-border/30">
                      <span className="text-xs text-telegram-text truncate flex-1 mr-2" title={f}>{f}</span>
                      <button
                        onClick={() => setCustomFolders(prev => prev.filter(folder => folder !== f))}
                        className="text-red-400 hover:text-red-300 p-1 active:scale-95 transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-semibold">Destination Folder</h3>
            <select
              value={destFolderId ?? ''}
              onChange={e => setDestFolderId(e.target.value ? Number(e.target.value) : null)}
              className="w-full bg-telegram-hover/20 border border-telegram-border/30 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-telegram-primary/50"
            >
              <option value="">Saved Messages (Root)</option>
              {folders.map(f => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          </div>

          {isRunning && progress && (
            <div className="p-4 bg-telegram-hover/30 rounded-2xl space-y-2">
              <div className="flex justify-between text-xs text-telegram-subtext">
                <span>Backing up...</span>
                <span>{progress.done} / {progress.total}</span>
              </div>
              <div className="w-full h-2 bg-telegram-bg/50 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-telegram-primary transition-all duration-300"
                  style={{ width: `${progress.total > 0 ? (progress.done / progress.total) * 100 : 0}%` }}
                />
              </div>
              <p className="text-[10px] text-telegram-subtext truncate">{progress.current_file.split('/').pop()}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-telegram-border/50 bg-telegram-surface flex gap-3">
          <button
            onClick={handleStartBackup}
            disabled={isRunning}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-telegram-primary text-black font-bold active:scale-95 transition-all disabled:opacity-50"
          >
            <Play className="w-5 h-5" />
            {isRunning ? 'Backup in Progress...' : 'Start Backup Now'}
          </button>
          {isRunning && (
            <button
              onClick={handleStopBackup}
              className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-red-500/15 text-red-400 border border-red-500/30 font-bold active:scale-95 transition-all"
              title="Stop backup after current file"
            >
              <Square className="w-5 h-5" />
              Stop
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
