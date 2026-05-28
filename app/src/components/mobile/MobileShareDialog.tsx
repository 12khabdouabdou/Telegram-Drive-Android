import { useState } from 'react';
import { X, Link, Copy, Check, Shield, Clock } from 'lucide-react';
import { TelegramFile, ShareInfo } from '../../types';
import { invoke } from '@tauri-apps/api/core';
import { motion } from 'framer-motion';

interface ShareDialogProps {
  file: TelegramFile;
  onClose: () => void;
}

export function ShareDialog({ file, onClose }: ShareDialogProps) {
  const [password, setPassword] = useState('');
  const [requirePassword, setRequirePassword] = useState(false);
  const [expiryType, setExpiryType] = useState<'never' | '1h' | '1d' | '7d' | 'custom'>('1d');
  const [customHours, setCustomHours] = useState('24');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shareInfo, setShareInfo] = useState<ShareInfo | null>(null);
  const [copied, setCopied] = useState(false);

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    try {
      let expiryHours: number | null = null;
      if (expiryType === '1h') expiryHours = 1;
      else if (expiryType === '1d') expiryHours = 24;
      else if (expiryType === '7d') expiryHours = 168;
      else if (expiryType === 'custom') {
        const parsed = parseInt(customHours, 10);
        if (isNaN(parsed) || parsed <= 0) {
          throw new Error('Please enter a valid number of hours');
        }
        expiryHours = parsed;
      }

      const pwdParam = requirePassword && password.trim() ? password : null;

      const res = await invoke<ShareInfo>('cmd_create_share', {
        folderId: null,
        messageId: file.id,
        fileName: file.name,
        fileSize: file.size,
        password: pwdParam,
        expiryHours,
      });

      setShareInfo(res);
    } catch (err: any) {
      setError(err.toString());
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (shareInfo?.link) {
      navigator.clipboard.writeText(shareInfo.link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
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
        className="bg-telegram-surface border border-telegram-border rounded-t-3xl sm:rounded-2xl w-full max-w-md max-h-[85vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-telegram-border flex justify-between items-center">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Link className="w-5 h-5 text-telegram-primary" />
            Share File
          </h3>
          <button 
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-telegram-hover transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 flex-1 overflow-y-auto space-y-5">
          {/* File Info */}
          <div className="bg-telegram-hover/40 border border-telegram-border/50 rounded-xl p-4">
            <p className="text-xs text-telegram-subtext uppercase font-semibold tracking-wider mb-1">Sharing File</p>
            <div className="text-sm font-medium truncate">{file.name}</div>
            <div className="text-xs text-telegram-subtext mt-0.5">{file.sizeStr}</div>
          </div>

          {/* Password Protection */}
          <div className="space-y-3">
            <button
              onClick={() => setRequirePassword(!requirePassword)}
              className="w-full flex items-center justify-between p-4 rounded-xl bg-telegram-hover/40 border border-telegram-border/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Shield className="w-5 h-5 text-telegram-primary" />
                <span className="text-sm font-medium">Password Protection</span>
              </div>
              <div className={`w-12 h-7 rounded-full transition-colors relative ${
                requirePassword ? 'bg-telegram-primary' : 'bg-telegram-border'
              }`}>
                <span className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 ${
                  requirePassword ? 'translate-x-6' : 'translate-x-1'
                }`} />
              </div>
            </button>

            {requirePassword && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                className="overflow-hidden"
              >
                <input
                  type="password"
                  placeholder="Enter password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-telegram-bg border border-telegram-border text-sm focus:outline-none focus:border-telegram-primary/50 transition-colors"
                />
              </motion.div>
            )}
          </div>

          {/* Expiration */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Clock className="w-5 h-5 text-telegram-primary" />
              Link Expiration
            </div>
            <div className="grid grid-cols-4 gap-2">
              {(['never', '1h', '1d', '7d'] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setExpiryType(type)}
                  className={`py-2.5 rounded-xl text-xs font-semibold transition-all ${
                    expiryType === type
                      ? 'bg-telegram-primary text-black'
                      : 'bg-telegram-hover/50 border border-telegram-border/50 hover:bg-telegram-hover'
                  }`}
                >
                  {type === 'never' ? 'Never' : type === '1h' ? '1 Hour' : type === '1d' ? '1 Day' : '7 Days'}
                </button>
              ))}
            </div>
            <button
              onClick={() => setExpiryType('custom')}
              className={`w-full py-2.5 rounded-xl text-xs font-semibold transition-all ${
                expiryType === 'custom'
                  ? 'bg-telegram-primary text-black'
                  : 'bg-telegram-hover/50 border border-telegram-border/50 hover:bg-telegram-hover'
              }`}
            >
              Custom: {customHours} hours
            </button>
            {expiryType === 'custom' && (
              <input
                type="number"
                min="1"
                value={customHours}
                onChange={(e) => setCustomHours(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-telegram-bg border border-telegram-border text-sm focus:outline-none focus:border-telegram-primary/50 transition-colors"
                placeholder="Enter hours"
              />
            )}
          </div>

          {/* Generate Button */}
          {!shareInfo && (
            <button
              onClick={handleGenerate}
              disabled={loading}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-telegram-primary to-telegram-secondary text-black font-bold text-base transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin"></span>
                  Generating...
                </span>
              ) : (
                'Generate Share Link'
              )}
            </button>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-center gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {/* Share Link */}
          {shareInfo && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              <div className="bg-telegram-hover/40 border border-telegram-border/50 rounded-xl p-4">
                <p className="text-xs text-telegram-subtext mb-2">Share Link</p>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={shareInfo.link}
                    className="flex-1 bg-telegram-bg border border-telegram-border rounded-lg px-3 py-2 text-sm truncate"
                  />
                  <button
                    onClick={handleCopy}
                    className={`p-2.5 rounded-xl transition-all ${
                      copied 
                        ? 'bg-green-500/20 text-green-400' 
                        : 'bg-telegram-primary/15 text-telegram-primary hover:bg-telegram-primary/25'
                    }`}
                  >
                    {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {shareInfo.has_password && (
                <div className="flex items-center gap-2 text-sm text-green-400">
                  <Shield className="w-4 h-4" />
                  Password protected
                </div>
              )}

              {shareInfo.expires_at && (
                <div className="flex items-center gap-2 text-sm text-telegram-subtext">
                  <Clock className="w-4 h-4" />
                  Expires: {new Date(shareInfo.expires_at * 1000).toLocaleString()}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={handleCopy}
                  className="flex-1 py-3 rounded-xl bg-telegram-primary text-black font-semibold text-sm transition-all hover:opacity-90 active:scale-[0.98]"
                >
                  {copied ? 'Copied!' : 'Copy Link'}
                </button>
                <button
                  onClick={() => {
                    setShareInfo(null);
                    setPassword('');
                    setRequirePassword(false);
                  }}
                  className="px-6 py-3 rounded-xl bg-telegram-hover/50 text-telegram-text font-semibold text-sm transition-all hover:bg-telegram-hover"
                >
                  Create Another
                </button>
              </div>
            </motion.div>
          )}
        </div>
      </motion.div>
    </div>
  );
}