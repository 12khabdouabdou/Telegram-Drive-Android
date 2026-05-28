import { useState, useEffect, useCallback } from 'react';
import { X, Link, Copy, Check, Trash2, RefreshCw, AlertCircle, Lock, Clock } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { toast } from 'sonner';
import { ShareInfo } from '../../../types';

interface MobileShareDashboardProps {
  onClose: () => void;
}

export function MobileShareDashboard({ onClose }: MobileShareDashboardProps) {
  const [shares, setShares] = useState<ShareInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [globalDomain, setGlobalDomain] = useState('');

  const fetchShares = useCallback(async () => {
    setLoading(true);
    try {
      const list = await invoke<ShareInfo[]>('cmd_list_shares');
      setShares(list.map(s => ({
        ...s,
        folder_id: null,
        message_id: s.id ? parseInt(s.id, 10) : 0,
        revoked: false,
        created_at: s.created_at,
        file_name: s.file_name,
        file_size: s.file_size,
        expires_at: s.expires_at,
        has_password: s.has_password,
        link: s.link
      })));
    } catch (e) {
      toast.error(`Failed to load shares: ${e}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchShares();
  }, [fetchShares]);

  const handleRevokeShare = async (id: string) => {
    try {
      await invoke('cmd_revoke_share', { id });
      toast.success('Shareable link revoked');
      fetchShares();
    } catch (e) {
      toast.error(`Failed to revoke link: ${e}`);
    }
  };

  const handleCopy = (id: string) => {
    const share = shares.find(s => s.id === id);
    if (!share) return;
    
    let link = share.link;
    if (globalDomain.trim()) {
      try {
        const url = new URL(share.link);
        link = `${url.protocol}//${globalDomain.trim()}${url.pathname}`;
      } catch {
        link = share.link;
      }
    }
    
    navigator.clipboard.writeText(link);
    setCopiedId(share.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const formatExpiry = (timestamp: number | null) => {
    if (!timestamp) return 'Never expires';
    const date = new Date(timestamp * 1000);
    const now = new Date();
    const diff = date.getTime() - now.getTime();
    
    if (diff < 0) return 'Expired';
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days > 0) return `Expires in ${days} day${days > 1 ? 's' : ''}`;
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours > 0) return `Expires in ${hours} hour${hours > 1 ? 's' : ''}`;
    
    const mins = Math.floor(diff / (1000 * 60));
    return `Expires in ${mins} minute${mins > 1 ? 's' : ''}`;
  };

  return (
    <div className="fixed inset-0 z-[100] bg-telegram-bg flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 bg-telegram-surface border-b border-telegram-border">
        <button
          onClick={onClose}
          className="p-2 rounded-xl hover:bg-telegram-hover transition-colors"
        >
          <X className="w-6 h-6" />
        </button>
        <h1 className="text-lg font-bold">Share Links</h1>
        <button
          onClick={fetchShares}
          disabled={loading}
          className="p-2 rounded-xl hover:bg-telegram-hover transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Stats */}
        <div className="p-4 rounded-2xl bg-telegram-primary/10 border border-telegram-primary/20">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-telegram-primary/20">
              <Link className="w-5 h-5 text-telegram-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold">Active Shares</p>
              <p className="text-2xl font-bold text-telegram-primary">{shares.length}</p>
            </div>
          </div>
        </div>

        {/* Global Domain */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Custom Domain (Optional)</label>
          <input
            type="text"
            value={globalDomain}
            onChange={(e) => setGlobalDomain(e.target.value)}
            placeholder="myserver.com"
            className="w-full px-4 py-3 rounded-xl bg-telegram-hover/50 border border-telegram-border/50 text-sm focus:outline-none focus:border-telegram-primary/50"
          />
          <p className="text-xs text-telegram-subtext">
            Replace localhost with your domain for sharing links
          </p>
        </div>

        {/* Shares List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-10 h-10 border-4 border-telegram-primary border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : shares.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 space-y-3 text-center">
            <div className="p-4 rounded-full bg-telegram-hover/50">
              <Link className="w-8 h-8 text-telegram-subtext" />
            </div>
            <h3 className="text-base font-bold">No Share Links</h3>
            <p className="text-sm text-telegram-subtext max-w-xs">
              Share links you create will appear here. Generate a link from any file's share option.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {shares.map((share) => (
              <div
                key={share.id}
                className="p-4 rounded-2xl bg-telegram-hover/30 border border-telegram-border/30 space-y-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold truncate">{share.file_name}</p>
                    <p className="text-xs text-telegram-subtext mt-0.5">
                      {formatBytes(share.file_size)} • Created {formatDate(share.created_at)}
                    </p>
                  </div>
                  {share.has_password && (
                    <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-telegram-primary/10">
                      <Lock className="w-3 h-3 text-telegram-primary" />
                      <span className="text-[10px] text-telegram-primary font-semibold">Protected</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 p-2 rounded-xl bg-telegram-bg/50">
                  <input
                    type="text"
                    readOnly
                    value={getDisplayLink(share.link, globalDomain)}
                    className="flex-1 bg-transparent text-xs text-telegram-subtext truncate"
                  />
                  <button
                    onClick={() => handleCopy(share.id)}
                    className={`p-2 rounded-lg transition-all ${
                      copiedId === share.id
                        ? 'bg-green-500/20 text-green-400'
                        : 'bg-telegram-primary/10 text-telegram-primary hover:bg-telegram-primary/20'
                    }`}
                  >
                    {copiedId === share.id ? (
                      <Check className="w-4 h-4" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-telegram-border/20">
                  <div className="flex items-center gap-1.5 text-xs text-telegram-subtext">
                    <Clock className="w-3.5 h-3.5" />
                    {formatExpiry(share.expires_at)}
                  </div>
                  <button
                    onClick={() => handleRevokeShare(share.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 text-xs font-semibold hover:bg-red-500/20 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Revoke
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatDate(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function getDisplayLink(link: string, domain: string): string {
  if (!domain.trim()) return link;
  try {
    const url = new URL(link);
    return `${url.protocol}//${domain.trim()}${url.pathname}`;
  } catch {
    return link;
  }
}