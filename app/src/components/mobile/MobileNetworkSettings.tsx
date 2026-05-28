import { useState, useEffect } from 'react';
import { X, Globe, Shield, Activity, Gauge, CheckCircle, AlertCircle } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

interface ProxyConfig {
  enabled: boolean;
  proxy_type: string;
  host: string;
  port: number;
  username: string;
  password: string;
  secret: string;
}

interface VpnConfig {
  enabled: boolean;
  timeout_multiplier: number;
  retry_attempts: number;
  retry_base_backoff_ms: number;
  retry_max_backoff_ms: number;
  adaptive_polling: boolean;
  polling_min_sec: number;
  polling_max_sec: number;
  preferred_dc: string;
  dc_fallback_attempts: number;
  flood_wait_respect: boolean;
  peer_cache_size: number;
  bandwidth_limit_up_kbs: number;
  bandwidth_limit_down_kbs: number;
  chunk_size_kb: number;
  keep_alive_interval_sec: number;
  auto_detect_vpn: boolean;
}

interface NetworkConfigSnapshot {
  proxy: ProxyConfig;
  vpn: VpnConfig;
}

interface MobileNetworkSettingsProps {
  onClose: () => void;
}

export function MobileNetworkSettings({ onClose }: MobileNetworkSettingsProps) {
  const [activeTab, setActiveTab] = useState<'proxy' | 'vpn' | 'test'>('proxy');
  const [saving, setSaving] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [latency, setLatency] = useState<number | null>(null);

  // Local state for forms
  const [proxyEnabled, setProxyEnabled] = useState(false);
  const [proxyType, setProxyType] = useState<'socks5' | 'mtproto'>('socks5');
  const [proxyHost, setProxyHost] = useState('');
  const [proxyPort, setProxyPort] = useState('1080');
  const [proxyUsername, setProxyUsername] = useState('');
  const [proxyPassword, setProxyPassword] = useState('');
  const [proxySecret, setProxySecret] = useState('');

  const [vpnEnabled, setVpnEnabled] = useState(false);
  const [timeoutMultiplier, setTimeoutMultiplier] = useState(3);
  const [retryAttempts, setRetryAttempts] = useState(3);
  const [adaptivePolling, setAdaptivePolling] = useState(true);
  const [pollingMin, setPollingMin] = useState(15);
  const [pollingMax, setPollingMax] = useState(60);
  const [preferredDC, setPreferredDC] = useState('auto');
  const [dcFallback, setDcFallback] = useState(2);
  const [floodWait, setFloodWait] = useState(true);
  const [peerCache, setPeerCache] = useState(500);
  const [uploadLimit, setUploadLimit] = useState(0);
  const [downloadLimit, setDownloadLimit] = useState(0);
  const [chunkSize, setChunkSize] = useState(512);
  const [keepAlive, setKeepAlive] = useState(0);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const data = await invoke<NetworkConfigSnapshot>('cmd_get_network_config');
      
      // Populate form state
      setProxyEnabled(data.proxy.enabled);
      setProxyType(data.proxy.proxy_type as 'socks5' | 'mtproto');
      setProxyHost(data.proxy.host);
      setProxyPort(data.proxy.port.toString());
      setProxyUsername(data.proxy.username);
      setProxyPassword(data.proxy.password);
      setProxySecret(data.proxy.secret);

      setVpnEnabled(data.vpn.enabled);
      setTimeoutMultiplier(data.vpn.timeout_multiplier);
      setRetryAttempts(data.vpn.retry_attempts);
      setAdaptivePolling(data.vpn.adaptive_polling);
      setPollingMin(data.vpn.polling_min_sec);
      setPollingMax(data.vpn.polling_max_sec);
      setPreferredDC(data.vpn.preferred_dc);
      setDcFallback(data.vpn.dc_fallback_attempts);
      setFloodWait(data.vpn.flood_wait_respect);
      setPeerCache(data.vpn.peer_cache_size);
      setUploadLimit(data.vpn.bandwidth_limit_up_kbs);
      setDownloadLimit(data.vpn.bandwidth_limit_down_kbs);
      setChunkSize(data.vpn.chunk_size_kb);
      setKeepAlive(data.vpn.keep_alive_interval_sec);
    } catch (err) {
      toast.error(`Failed to load network config: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProxy = async () => {
    setSaving(true);
    try {
      const proxyConfig: ProxyConfig = {
        enabled: proxyEnabled,
        proxy_type: proxyType,
        host: proxyHost,
        port: parseInt(proxyPort) || 1080,
        username: proxyUsername,
        password: proxyPassword,
        secret: proxySecret,
      };
      await invoke('cmd_apply_proxy_settings', { config: proxyConfig });
      toast.success('Proxy settings saved');
    } catch (err) {
      toast.error(`Failed to save proxy settings: ${err}`);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveVpn = async () => {
    setSaving(true);
    try {
      const vpnConfig: VpnConfig = {
        enabled: vpnEnabled,
        timeout_multiplier: timeoutMultiplier,
        retry_attempts: retryAttempts,
        retry_base_backoff_ms: 1000,
        retry_max_backoff_ms: 30000,
        adaptive_polling: adaptivePolling,
        polling_min_sec: pollingMin,
        polling_max_sec: pollingMax,
        preferred_dc: preferredDC,
        dc_fallback_attempts: dcFallback,
        flood_wait_respect: floodWait,
        peer_cache_size: peerCache,
        bandwidth_limit_up_kbs: uploadLimit,
        bandwidth_limit_down_kbs: downloadLimit,
        chunk_size_kb: chunkSize,
        keep_alive_interval_sec: keepAlive,
        auto_detect_vpn: false,
      };
      await invoke('cmd_apply_vpn_settings', { config: vpnConfig });
      toast.success('VPN optimizer settings saved');
    } catch (err) {
      toast.error(`Failed to save VPN settings: ${err}`);
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setTestingConnection(true);
    setTestResult(null);
    try {
      const available = await invoke<boolean>('cmd_is_network_available');
      const latencyMs = await invoke<number>('cmd_check_latency');
      
      setLatency(latencyMs);
      setTestResult({
        success: available,
        message: available 
          ? `Connected! Latency: ${latencyMs}ms`
          : 'Connection failed. Check your network or proxy settings.'
      });
    } catch (err) {
      setTestResult({
        success: false,
        message: `Test failed: ${err}`
      });
    } finally {
      setTestingConnection(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-[100] bg-telegram-bg flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-telegram-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

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
        <h1 className="text-lg font-bold">Network Settings</h1>
        <div className="w-10" />
      </header>

      {/* Tab Bar */}
      <div className="flex border-b border-telegram-border bg-telegram-surface">
        {[
          { id: 'proxy' as const, label: 'Proxy', icon: Globe },
          { id: 'vpn' as const, label: 'VPN', icon: Shield },
          { id: 'test' as const, label: 'Test', icon: Activity },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex-1 flex items-center justify-center gap-2 py-4 text-sm font-semibold transition-colors border-b-2 ${
              activeTab === id
                ? 'text-telegram-primary border-telegram-primary'
                : 'text-telegram-subtext border-transparent hover:text-telegram-text'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {activeTab === 'proxy' && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-4"
          >
            {/* Enable Toggle */}
            <div className="flex items-center justify-between p-4 rounded-2xl bg-telegram-hover/30 border border-telegram-border/30">
              <div>
                <h3 className="text-sm font-semibold">Enable Proxy</h3>
                <p className="text-xs text-telegram-subtext mt-1">Route traffic through a proxy server</p>
              </div>
              <button
                onClick={() => setProxyEnabled(!proxyEnabled)}
                className={`relative w-12 h-7 rounded-full transition-colors ${
                  proxyEnabled ? 'bg-telegram-primary' : 'bg-telegram-border'
                }`}
              >
                <span className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 ${
                  proxyEnabled ? 'translate-x-6' : 'translate-x-1'
                }`} />
              </button>
            </div>

            {/* Proxy Type */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Proxy Type</label>
              <div className="grid grid-cols-2 gap-3">
                {(['socks5', 'mtproto'] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => setProxyType(type)}
                    className={`py-3 rounded-xl text-sm font-semibold transition-all ${
                      proxyType === type
                        ? 'bg-telegram-primary text-black'
                        : 'bg-telegram-hover/50 border border-telegram-border/50 hover:bg-telegram-hover'
                    }`}
                  >
                    {type.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            {/* Host & Port */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-sm font-medium">Host</label>
                <input
                  type="text"
                  value={proxyHost}
                  onChange={(e) => setProxyHost(e.target.value)}
                  placeholder="proxy.example.com"
                  className="w-full px-4 py-3 rounded-xl bg-telegram-hover/50 border border-telegram-border/50 text-sm focus:outline-none focus:border-telegram-primary/50"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Port</label>
                <input
                  type="number"
                  value={proxyPort}
                  onChange={(e) => setProxyPort(e.target.value)}
                  placeholder="1080"
                  className="w-full px-4 py-3 rounded-xl bg-telegram-hover/50 border border-telegram-border/50 text-sm focus:outline-none focus:border-telegram-primary/50"
                />
              </div>
            </div>

            {/* Credentials */}
            <div className="space-y-3">
              <div className="space-y-2">
                <label className="text-sm font-medium">Username (Optional)</label>
                <input
                  type="text"
                  value={proxyUsername}
                  onChange={(e) => setProxyUsername(e.target.value)}
                  placeholder="username"
                  className="w-full px-4 py-3 rounded-xl bg-telegram-hover/50 border border-telegram-border/50 text-sm focus:outline-none focus:border-telegram-primary/50"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Password (Optional)</label>
                <input
                  type="password"
                  value={proxyPassword}
                  onChange={(e) => setProxyPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-3 rounded-xl bg-telegram-hover/50 border border-telegram-border/50 text-sm focus:outline-none focus:border-telegram-primary/50"
                />
              </div>
              {proxyType === 'mtproto' && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Secret (MTProto)</label>
                  <input
                    type="password"
                    value={proxySecret}
                    onChange={(e) => setProxySecret(e.target.value)}
                    placeholder="abcdef123456..."
                    className="w-full px-4 py-3 rounded-xl bg-telegram-hover/50 border border-telegram-border/50 text-sm focus:outline-none focus:border-telegram-primary/50"
                  />
                </div>
              )}
            </div>

            {/* Save Button */}
            <button
              onClick={handleSaveProxy}
              disabled={saving}
              className="w-full py-4 rounded-2xl bg-telegram-primary text-black font-bold text-base transition-all hover:opacity-90 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Proxy Settings'}
            </button>
          </motion.div>
        )}

        {activeTab === 'vpn' && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-4"
          >
            {/* VPN Mode Toggle */}
            <div className="flex items-center justify-between p-4 rounded-2xl bg-telegram-hover/30 border border-telegram-border/30">
              <div>
                <h3 className="text-sm font-semibold">VPN Optimizer</h3>
                <p className="text-xs text-telegram-subtext mt-1">Optimize for unstable connections</p>
              </div>
              <button
                onClick={() => setVpnEnabled(!vpnEnabled)}
                className={`relative w-12 h-7 rounded-full transition-colors ${
                  vpnEnabled ? 'bg-telegram-primary' : 'bg-telegram-border'
                }`}
              >
                <span className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 ${
                  vpnEnabled ? 'translate-x-6' : 'translate-x-1'
                }`} />
              </button>
            </div>

            {vpnEnabled && (
              <>
                {/* Performance Settings */}
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-telegram-primary uppercase tracking-wider">Performance</h3>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <label className="text-sm font-medium">Timeout Multiplier</label>
                      <span className="text-sm text-telegram-primary font-mono">{timeoutMultiplier}x</span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="5"
                      value={timeoutMultiplier}
                      onChange={(e) => setTimeoutMultiplier(parseInt(e.target.value))}
                      className="w-full h-1.5 rounded-full appearance-none bg-telegram-border accent-telegram-primary cursor-pointer"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <label className="text-sm font-medium">Retry Attempts</label>
                      <span className="text-sm text-telegram-primary font-mono">{retryAttempts}</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="5"
                      value={retryAttempts}
                      onChange={(e) => setRetryAttempts(parseInt(e.target.value))}
                      className="w-full h-1.5 rounded-full appearance-none bg-telegram-border accent-telegram-primary cursor-pointer"
                    />
                  </div>

                  {/* Adaptive Polling */}
                  <div className="flex items-center justify-between p-4 rounded-xl bg-telegram-hover/30 border border-telegram-border/30">
                    <div>
                      <p className="text-sm font-medium">Adaptive Polling</p>
                      <p className="text-xs text-telegram-subtext mt-1">Auto-adjust update interval</p>
                    </div>
                    <button
                      onClick={() => setAdaptivePolling(!adaptivePolling)}
                      className={`relative w-11 h-6 rounded-full transition-colors ${
                        adaptivePolling ? 'bg-telegram-primary' : 'bg-telegram-border'
                      }`}
                    >
                      <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 ${
                        adaptivePolling ? 'translate-x-5' : 'translate-x-0'
                      }`} />
                    </button>
                  </div>
                </div>

                {/* DC Settings */}
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-telegram-primary uppercase tracking-wider">Data Centre</h3>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Preferred DC</label>
                    <select
                      value={preferredDC}
                      onChange={(e) => setPreferredDC(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl bg-telegram-hover/50 border border-telegram-border/50 text-sm focus:outline-none focus:border-telegram-primary/50"
                    >
                      <option value="auto">Auto</option>
                      <option value="dc1">DC 1</option>
                      <option value="dc2">DC 2</option>
                      <option value="dc3">DC 3</option>
                      <option value="dc4">DC 4</option>
                      <option value="dc5">DC 5</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <label className="text-sm font-medium">DC Fallback Attempts</label>
                      <span className="text-sm text-telegram-primary font-mono">{dcFallback}</span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="4"
                      value={dcFallback}
                      onChange={(e) => setDcFallback(parseInt(e.target.value))}
                      className="w-full h-1.5 rounded-full appearance-none bg-telegram-border accent-telegram-primary cursor-pointer"
                    />
                  </div>
                </div>

                {/* Bandwidth Control */}
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-telegram-primary uppercase tracking-wider flex items-center gap-2">
                    <Gauge className="w-4 h-4" />
                    Bandwidth Control
                  </h3>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <label className="text-sm font-medium">Upload Limit</label>
                      <span className="text-sm text-telegram-primary font-mono">
                        {uploadLimit === 0 ? 'Unlimited' : `${uploadLimit} KB/s`}
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="5120"
                      step="128"
                      value={uploadLimit}
                      onChange={(e) => setUploadLimit(parseInt(e.target.value))}
                      className="w-full h-1.5 rounded-full appearance-none bg-telegram-border accent-telegram-primary cursor-pointer"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <label className="text-sm font-medium">Download Limit</label>
                      <span className="text-sm text-telegram-primary font-mono">
                        {downloadLimit === 0 ? 'Unlimited' : `${downloadLimit} KB/s`}
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="5120"
                      step="128"
                      value={downloadLimit}
                      onChange={(e) => setDownloadLimit(parseInt(e.target.value))}
                      className="w-full h-1.5 rounded-full appearance-none bg-telegram-border accent-telegram-primary cursor-pointer"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Chunk Size</label>
                    <select
                      value={chunkSize}
                      onChange={(e) => setChunkSize(parseInt(e.target.value))}
                      className="w-full px-4 py-3 rounded-xl bg-telegram-hover/50 border border-telegram-border/50 text-sm focus:outline-none focus:border-telegram-primary/50"
                    >
                      <option value="128">128 KB</option>
                      <option value="256">256 KB</option>
                      <option value="512">512 KB</option>
                    </select>
                  </div>
                </div>

                {/* Advanced Settings */}
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-telegram-primary uppercase tracking-wider">Advanced</h3>
                  
                  <div className="flex items-center justify-between p-4 rounded-xl bg-telegram-hover/30 border border-telegram-border/30">
                    <div>
                      <p className="text-sm font-medium">Respect Flood Wait</p>
                      <p className="text-xs text-telegram-subtext mt-1">Auto-sleep on FLOOD_WAIT errors</p>
                    </div>
                    <button
                      onClick={() => setFloodWait(!floodWait)}
                      className={`relative w-11 h-6 rounded-full transition-colors ${
                        floodWait ? 'bg-telegram-primary' : 'bg-telegram-border'
                      }`}
                    >
                      <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 ${
                        floodWait ? 'translate-x-5' : 'translate-x-0'
                      }`} />
                    </button>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <label className="text-sm font-medium">Peer Cache Size</label>
                      <span className="text-sm text-telegram-primary font-mono">{peerCache}</span>
                    </div>
                    <input
                      type="range"
                      min="100"
                      max="2000"
                      step="100"
                      value={peerCache}
                      onChange={(e) => setPeerCache(parseInt(e.target.value))}
                      className="w-full h-1.5 rounded-full appearance-none bg-telegram-border accent-telegram-primary cursor-pointer"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <label className="text-sm font-medium">Keep-Alive Interval</label>
                      <span className="text-sm text-telegram-primary font-mono">
                        {keepAlive === 0 ? 'Disabled' : `${keepAlive}s`}
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="120"
                      step="30"
                      value={keepAlive}
                      onChange={(e) => setKeepAlive(parseInt(e.target.value))}
                      className="w-full h-1.5 rounded-full appearance-none bg-telegram-border accent-telegram-primary cursor-pointer"
                    />
                  </div>
                </div>
              </>
            )}

            {/* Save Button */}
            <button
              onClick={handleSaveVpn}
              disabled={saving}
              className="w-full py-4 rounded-2xl bg-telegram-primary text-black font-bold text-base transition-all hover:opacity-90 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save VPN Settings'}
            </button>
          </motion.div>
        )}

        {activeTab === 'test' && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-4"
          >
            <div className="text-center py-8 space-y-4">
              <div className="w-20 h-20 mx-auto rounded-full bg-telegram-hover/50 flex items-center justify-center">
                <Activity className="w-10 h-10 text-telegram-primary" />
              </div>
              <div>
                <h3 className="text-lg font-bold">Connection Test</h3>
                <p className="text-sm text-telegram-subtext mt-2">
                  Test your network connection to Telegram servers
                </p>
              </div>
            </div>

            <button
              onClick={handleTestConnection}
              disabled={testingConnection}
              className="w-full py-4 rounded-2xl bg-telegram-primary text-black font-bold text-base transition-all hover:opacity-90 disabled:opacity-50"
            >
              {testingConnection ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin"></span>
                  Testing...
                </span>
              ) : (
                'Run Connection Test'
              )}
            </button>

            {testResult && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`p-4 rounded-2xl border ${
                  testResult.success
                    ? 'bg-green-500/10 border-green-500/30'
                    : 'bg-red-500/10 border-red-500/30'
                }`}
              >
                <div className="flex items-center gap-3">
                  {testResult.success ? (
                    <CheckCircle className="w-6 h-6 text-green-400" />
                  ) : (
                    <AlertCircle className="w-6 h-6 text-red-400" />
                  )}
                  <div>
                    <p className={`font-semibold ${testResult.success ? 'text-green-400' : 'text-red-400'}`}>
                      {testResult.success ? 'Connected!' : 'Connection Failed'}
                    </p>
                    <p className="text-sm text-telegram-subtext mt-1">{testResult.message}</p>
                  </div>
                </div>
              </motion.div>
            )}

            {latency !== null && (
              <div className="p-4 rounded-2xl bg-telegram-hover/30 border border-telegram-border/30">
                <h4 className="text-sm font-semibold mb-3">Latency Results</h4>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-telegram-subtext">Current Latency</span>
                    <span className={`text-lg font-bold font-mono ${
                      latency < 100 ? 'text-green-400' : latency < 300 ? 'text-yellow-400' : 'text-red-400'
                    }`}>
                      {latency}ms
                    </span>
                  </div>
                  <div className="h-2 bg-telegram-bg rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all ${
                        latency < 100 ? 'bg-green-500' : latency < 300 ? 'bg-yellow-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${Math.max(10, 100 - latency / 3)}%` }}
                    />
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
}