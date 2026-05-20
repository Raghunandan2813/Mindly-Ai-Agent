// components/SettingsModal.tsx
// Ultra-premium glassmorphic Settings modal. Supports dynamic profiles, memory toggles,
// retention calibration, GDPR exports, security shields, and full account cascading purges.

'use client';
import React, { useState, useEffect, useRef } from 'react';
import SecuritySettingsPanels from '@/components/SecuritySettingsPanels';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  proactiveEnabled: boolean;
  onToggleProactive: () => void;
}

type TabType = 'profile' | 'ai' | 'memory' | 'security' | 'appearance';

interface ActiveSessionRow {
  session_id: string;
  device_name: string;
  ip_address: string;
  last_active: string;
  created_at: string;
}

interface ApiTokenRow {
  id: string;
  name: string;
  scope: string;
  expires_at: string;
  last_used_at: string | null;
  created_at: string;
}

interface RedactionLogRow {
  id: string;
  session_id: string | null;
  redacted_type: string;
  redacted_placeholder: string;
  created_at: string;
}

interface ConnectorRow {
  connector_name: string;
  enabled: boolean;
  last_synced: string | null;
  sync_frequency: string;
  last_error: string | null;
}

export default function SettingsModal({
  isOpen,
  onClose,
  userId,
  proactiveEnabled,
  onToggleProactive
}: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>('profile');

  // Loading and feedback states
  const [loading, setLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  
  // Stats state
  const [stats, setStats] = useState({
    nodesCount: 0,
    summariesCount: 0,
    messagesCount: 0,
    totalMemories: 0
  });

  // Profile fields
  const [displayName, setDisplayName] = useState('');
  const [profilePhoto, setProfilePhoto] = useState('gradient-indigo'); // Default gradient key or URL
  const [email, setEmail] = useState('');
  const [createdAtDate, setCreatedAtDate] = useState('');

  // AI Settings
  const [provider, setProvider] = useState('gemini');
  const [model, setModel] = useState('gemini-2.0-flash');

  // Memory states
  const [memoryEnabled, setMemoryEnabled] = useState(true);
  const [memoryRetentionPeriod, setMemoryRetentionPeriod] = useState('forever');
  const [contextSize, setContextSize] = useState(20);
  const [summarizeThreshold, setSummarizeThreshold] = useState(10);
  const [graphEnabled, setGraphEnabled] = useState(true);

  // Security states
  const [injectionShield, setInjectionShield] = useState(true);
  const [redactionEnabled, setRedactionEnabled] = useState(true);

  // Danger states
  const [wipeConfirm, setWipeConfirm] = useState('');
  const [wipeLoading, setWipeLoading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Upload state
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Export states
  const [exportLoading, setExportLoading] = useState(false);
  const [exportStatus, setExportStatus] = useState<'idle' | 'processing' | 'ready' | 'failed'>('idle');
  const [exportUrl, setExportUrl] = useState('');

  // Appearance
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [textScale, setTextScale] = useState(100);

  // Security management
  const [activeSessions, setActiveSessions] = useState<ActiveSessionRow[]>([]);
  const [apiTokens, setApiTokens] = useState<ApiTokenRow[]>([]);
  const [redactionLogs, setRedactionLogs] = useState<RedactionLogRow[]>([]);
  const [connectors, setConnectors] = useState<ConnectorRow[]>([]);
  const [newTokenName, setNewTokenName] = useState('CLI Client');
  const [generatedToken, setGeneratedToken] = useState('');
  const [connectorTokenInput, setConnectorTokenInput] = useState('');
  const [subscriptionTier, setSubscriptionTier] = useState('free');

  // Pre-configured elegant gradients for avatar selection
  const gradients: Record<string, string> = {
    'gradient-indigo': 'from-indigo-500 to-purple-600',
    'gradient-sunset': 'from-orange-400 to-rose-500',
    'gradient-emerald': 'from-emerald-400 to-teal-600',
    'gradient-cyan': 'from-cyan-400 to-blue-600',
    'gradient-gold': 'from-amber-400 to-yellow-600',
  };

  const applyAppearance = (nextTheme: 'dark' | 'light', scale: number) => {
    if (typeof document === 'undefined') return;
    document.documentElement.setAttribute('data-theme', nextTheme);
    document.documentElement.style.fontSize = `${scale}%`;
  };

  const fetchSecurityData = async () => {
    try {
      const [sessionsRes, tokensRes, logsRes, connectorsRes] = await Promise.all([
        fetch('/api/auth/sessions'),
        fetch('/api/auth/api-tokens'),
        fetch('/api/auth/redaction-log'),
        fetch('/api/auth/connectors'),
      ]);
      if (sessionsRes.ok) {
        const d = await sessionsRes.json();
        setActiveSessions(d.sessions || []);
      }
      if (tokensRes.ok) {
        const d = await tokensRes.json();
        setApiTokens(d.tokens || []);
      }
      if (logsRes.ok) {
        const d = await logsRes.json();
        setRedactionLogs(d.logs || []);
      }
      if (connectorsRes.ok) {
        const d = await connectorsRes.json();
        setConnectors(d.connectors || []);
      }
    } catch (err) {
      console.error('Failed to load security panel data:', err);
    }
  };

  // Fetch full settings and stats on mount/open
  useEffect(() => {
    if (!isOpen) return;

    const fetchProfile = async () => {
      try {
        const res = await fetch('/api/auth/me');
        if (res.ok) {
          const data = await res.json();
          if (data.userId) {
            setDisplayName(data.displayName || '');
            setProfilePhoto(data.profilePhoto || 'gradient-indigo');
            setEmail(data.email || '');
            setCreatedAtDate(data.createdAt ? new Date(data.createdAt).toLocaleDateString(undefined, {
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            }) : '');
            setMemoryEnabled(data.memoryEnabled !== false);
            setMemoryRetentionPeriod(data.memoryRetentionPeriod || 'forever');
            setSubscriptionTier(data.subscriptionTier || 'free');
          }
        }
      } catch (err) {
        console.error('Failed to fetch profile info:', err);
      }
    };

    const fetchStats = async () => {
      try {
        const res = await fetch('/api/auth/stats');
        if (res.ok) {
          const data = await res.json();
          setStats({
            nodesCount: data.nodesCount || 0,
            summariesCount: data.summariesCount || 0,
            messagesCount: data.messagesCount || 0,
            totalMemories: data.totalMemories || 0
          });
        }
      } catch (err) {
        console.error('Failed to fetch stats:', err);
      }
    };

    fetchProfile();
    fetchStats();

    if (typeof window !== 'undefined') {
      setProvider(localStorage.getItem('mindly_provider') || 'gemini');
      setModel(localStorage.getItem('mindly_model') || 'gemini-2.0-flash');
      setContextSize(Number(localStorage.getItem('mindly_context_size')) || 20);
      setSummarizeThreshold(Number(localStorage.getItem('mindly_summarize_threshold')) || 10);
      setGraphEnabled(localStorage.getItem('mindly_graph_enabled') !== 'false');
      setInjectionShield(localStorage.getItem('mindly_injection_shield') !== 'false');
      setRedactionEnabled(localStorage.getItem('mindly_redaction_enabled') !== 'false');
      setTheme((localStorage.getItem('mindly_theme') as 'dark' | 'light') || 'dark');
      setTextScale(Number(localStorage.getItem('mindly_text_scale')) || 100);
      applyAppearance(
        (localStorage.getItem('mindly_theme') as 'dark' | 'light') || 'dark',
        Number(localStorage.getItem('mindly_text_scale')) || 100
      );
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && activeTab === 'security') {
      fetchSecurityData();
    }
  }, [isOpen, activeTab]);

  // Handle asynchronous polling for large data exports
  useEffect(() => {
    if (exportStatus !== 'processing') return;

    let intervalId = setInterval(async () => {
      try {
        const res = await fetch('/api/auth/export?status=true');
        if (res.ok) {
          const data = await res.json();
          setExportStatus(data.status);
          if (data.status === 'ready' && data.url) {
            setExportUrl(data.url);
            setExportLoading(false);
            clearInterval(intervalId);
            // Trigger automatic download
            const link = document.createElement('a');
            link.href = data.url;
            link.setAttribute('download', `mindly_ai_memory_export.json`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
          } else if (data.status === 'failed') {
            setExportLoading(false);
            setErrorMessage('Archive export failed. Please try again later.');
            clearInterval(intervalId);
          }
        }
      } catch (err) {
        console.error('[Export Status Check] Error checking export status:', err);
      }
    }, 3000);

    return () => clearInterval(intervalId);
  }, [exportStatus]);

  const saveSetting = (key: string, value: string) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(key, value);
    }
  };

  const handleProviderChange = (newProvider: string) => {
    setProvider(newProvider);
    saveSetting('mindly_provider', newProvider);

    let defaultModel = '';
    if (newProvider === 'gemini') defaultModel = 'gemini-2.0-flash';
    else if (newProvider === 'groq') defaultModel = 'llama-3.1-8b-instant';
    else if (newProvider === 'openrouter') defaultModel = 'meta-llama/llama-3.1-8b-instruct:free';
    else if (newProvider === 'ollama') defaultModel = 'llama3';

    setModel(defaultModel);
    saveSetting('mindly_model', defaultModel);
  };

  // Profile image upload
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      alert('Security Warning: Image size exceeds strict 2MB ceiling.');
      return;
    }

    setUploading(true);
    setErrorMessage('');
    setSaveSuccess('');

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/auth/profile/upload', {
        method: 'POST',
        body: formData
      });

      const data = await res.json();
      if (res.ok) {
        setProfilePhoto(data.profilePhotoUrl);
        setSaveSuccess('Profile photo uploaded and reprocessed successfully!');
        setTimeout(() => setSaveSuccess(''), 3000);
      } else {
        setErrorMessage(data.error || 'Failed to upload photo.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Upload exception occurred.');
    } finally {
      setUploading(false);
    }
  };

  // Save profile and metadata settings
  const handleSaveProfile = async (updates: Record<string, any>) => {
    setLoading(true);
    setSaveSuccess('');
    setErrorMessage('');

    try {
      const res = await fetch('/api/auth/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      const data = await res.json();
      if (res.ok) {
        setSaveSuccess('Settings saved successfully!');
        if (updates.displayName !== undefined) {
          setDisplayName(data.user.displayName);
        }
        setTimeout(() => setSaveSuccess(''), 2000);
      } else {
        setErrorMessage(data.error || 'Failed to save profile settings.');
      }
    } catch (err: any) {
      setErrorMessage(`Error saving: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Safe Archive Export
  const handleExportData = async (e: React.MouseEvent) => {
    e.preventDefault();
    setExportLoading(true);
    setErrorMessage('');
    setExportStatus('idle');

    try {
      const res = await fetch('/api/auth/export');
      if (res.headers.get('content-type')?.includes('application/json')) {
        const data = await res.json();
        if (data.async) {
          setExportStatus('processing');
          setSaveSuccess('Archive processing started. Fetching download links...');
        } else if (data.error) {
          setErrorMessage(data.error);
          setExportLoading(false);
        } else {
          // Fallback parsing
          setExportLoading(false);
        }
      } else {
        // Direct synchronous attachment stream download
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `mindly_ai_memory_export_${userId.slice(0, 8)}.json`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setExportLoading(false);
        setSaveSuccess('Data exported successfully!');
        setTimeout(() => setSaveSuccess(''), 3000);
      }
    } catch (err: any) {
      setErrorMessage(`Export failed: ${err.message}`);
      setExportLoading(false);
    }
  };

  // Nuclear wipe of memories
  const handleWipeMemories = async () => {
    if (wipeConfirm.trim().toLowerCase() !== 'delete') {
      alert('Please type "DELETE" exactly to confirm.');
      return;
    }

    setWipeLoading(true);
    try {
      const res = await fetch('/api/sessions/clear-memories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });

      const data = await res.json();
      if (res.ok) {
        alert(data.message || 'All memories cleared successfully!');
        setWipeConfirm('');
        window.location.reload();
      } else {
        alert(data.error || 'Failed to clear memories.');
      }
    } catch (err: any) {
      alert(`Wipe error: ${err.message}`);
    } finally {
      setWipeLoading(false);
    }
  };

  // Nuclear account delete (cascades everything with 24-hour grace window)
  const handleDeleteAccount = async () => {
    if (deleteConfirm.trim() !== 'DELETE ACCOUNT') {
      alert('Please type "DELETE ACCOUNT" exactly to confirm.');
      return;
    }

    setDeleteLoading(true);
    setErrorMessage('');
    try {
      const res = await fetch('/api/auth/delete-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmText: deleteConfirm })
      });

      const data = await res.json();
      if (res.ok) {
        alert('SUCCESS: Your account has been scheduled for permanent deletion in 24 hours. All active sessions are immediately terminated.');
        window.location.href = '/login';
      } else {
        setErrorMessage(data.error || 'Failed to delete account.');
      }
    } catch (err: any) {
      setErrorMessage(`Account delete error: ${err.message}`);
    } finally {
      setDeleteLoading(false);
    }
  };

  if (!isOpen) return null;

  const isGradient = profilePhoto && profilePhoto.startsWith('gradient-');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--bg-primary)]/75 backdrop-blur-md animate-[fadeIn_0.2s_ease-out]">
      {/* Modal Card container */}
      <div className="w-[660px] h-[560px] rounded-3xl bg-[var(--bg-card)] border border-[var(--border)] flex overflow-hidden shadow-2xl relative text-left">
        
        {/* Left pane: Navigation Tabs */}
        <div className="w-52 bg-[var(--bg-card)] border-r border-[var(--border)] p-5 flex flex-col justify-between">
          <div className="space-y-6">
            <div>
              <div className="text-xs font-bold text-[var(--text-primary)] tracking-tight flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                Workspace Settings
              </div>
              <div className="text-[0.6rem] text-[var(--text-muted)] mt-1 font-mono uppercase tracking-widest">
                Configure Mindly AI
              </div>
            </div>

            <nav className="space-y-1.5">
              <button
                onClick={() => setActiveTab('profile')}
                className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-2.5 transition-all ${
                  activeTab === 'profile'
                    ? 'bg-[var(--bg-secondary)] text-[var(--text-primary)] border border-[var(--border)]'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card)]'
                }`}
              >
                Profile
              </button>
              <button
                onClick={() => setActiveTab('ai')}
                className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-2.5 transition-all ${
                  activeTab === 'ai'
                    ? 'bg-[var(--bg-secondary)] text-[var(--text-primary)] border border-[var(--border)]'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card)]'
                }`}
              >
                AI Engines
              </button>
              <button
                onClick={() => setActiveTab('memory')}
                className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-2.5 transition-all ${
                  activeTab === 'memory'
                    ? 'bg-[var(--bg-secondary)] text-[var(--text-primary)] border border-[var(--border)]'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card)]'
                }`}
              >
                Memory Settings
              </button>
              <button
                onClick={() => setActiveTab('security')}
                className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-2.5 transition-all ${
                  activeTab === 'security'
                    ? 'bg-[var(--bg-secondary)] text-[var(--text-primary)] border border-[var(--border)]'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card)]'
                }`}
              >
                Security Safeguards
              </button>
              <button
                onClick={() => setActiveTab('appearance')}
                className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-2.5 transition-all ${
                  activeTab === 'appearance'
                    ? 'bg-[var(--bg-secondary)] text-[var(--text-primary)] border border-[var(--border)]'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card)]'
                }`}
              >
                Appearance
              </button>
            </nav>
          </div>

          <div className="space-y-2">
            {saveSuccess && (
              <div className="text-[0.65rem] font-bold text-center text-emerald-400 py-1 bg-emerald-950/20 border border-emerald-900/40 rounded-lg animate-pulse">
                {saveSuccess}
              </div>
            )}
            {errorMessage && (
              <div className="text-[0.65rem] font-bold text-center text-red-400 py-1.5 px-2 bg-red-950/20 border border-red-900/40 rounded-lg max-h-16 overflow-y-auto leading-relaxed">
                {errorMessage}
              </div>
            )}
            <button
              onClick={onClose}
              className="w-full py-2 rounded-xl bg-[var(--bg-card)] hover:bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] text-xs font-semibold transition-all"
            >
              Close Settings
            </button>
          </div>
        </div>

        {/* Right pane: Content Area */}
        <div className="flex-1 p-6 overflow-y-auto bg-[var(--bg-card)]">
          
          {/* TAB 0: PROFILE SETTINGS */}
          {activeTab === 'profile' && (
            <div className="space-y-5 animate-[fadeIn_0.15s_ease-out]">
              <div>
                <h3 className="text-sm font-bold text-[var(--text-primary)]">Profile Customization</h3>
                <p className="text-[0.7rem] text-[var(--text-muted)] mt-1 leading-relaxed">
                  Manage display metadata, profile identifiers, and account status.
                </p>
              </div>

              {/* Profile Photo selector */}
              <div className="space-y-2.5">
                <label className="text-[0.65rem] font-bold text-[var(--text-secondary)] uppercase tracking-wider block">
                  Select Profile Avatar Style or Upload Image
                </label>
                <div className="flex items-center gap-4">
                  {/* Active avatar preview */}
                  <div 
                    className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg border border-[var(--border)] overflow-hidden transition-all flex-shrink-0 ${
                      isGradient ? `bg-gradient-to-br ${gradients[profilePhoto] || 'from-indigo-500 to-purple-600'}` : 'bg-[var(--bg-secondary)]'
                    }`}
                  >
                    {isGradient ? (
                      <span className="text-lg font-bold text-[var(--text-primary)] uppercase">
                        {displayName ? displayName.slice(0, 2) : email.slice(0, 2)}
                      </span>
                    ) : (
                      <img src={profilePhoto} alt="User Avatar" className="w-full h-full object-cover" />
                    )}
                  </div>

                  <div className="space-y-2 flex-1">
                    {/* Gradient picks */}
                    <div className="flex items-center gap-2">
                      {Object.keys(gradients).map((gKey) => (
                        <button
                          key={gKey}
                          onClick={() => {
                            setProfilePhoto(gKey);
                            handleSaveProfile({ profilePhoto: gKey });
                          }}
                          className={`w-5.5 h-5.5 rounded-full bg-gradient-to-br ${gradients[gKey]} border transition-all ${
                            profilePhoto === gKey ? 'border-white scale-110 shadow-md' : 'border-transparent hover:scale-105'
                          }`}
                          title={gKey.replace('gradient-', '')}
                        />
                      ))}
                    </div>

                    {/* Image file uploader input */}
                    <div className="flex items-center gap-2">
                      <input 
                        type="file" 
                        ref={fileInputRef} 
                        onChange={handlePhotoUpload} 
                        accept="image/jpeg,image/png,image/gif"
                        className="hidden" 
                      />
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                        className="px-3 py-1 rounded-lg bg-[var(--bg-secondary)] hover:bg-[var(--bg-input)] border border-[var(--border)] text-[0.65rem] text-[var(--text-secondary)] transition-all font-semibold"
                      >
                        {uploading ? 'Sanitizing upload...' : 'Upload custom photo (Max 2MB)'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Display name input */}
              <div className="space-y-2">
                <label className="text-[0.65rem] font-bold text-[var(--text-secondary)] uppercase tracking-wider block">
                  Display Name
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Enter your name"
                    className="flex-1 p-2.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border)] text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--border)] transition-colors"
                  />
                  <button
                    onClick={() => handleSaveProfile({ displayName })}
                    disabled={loading}
                    className="px-4 py-2.5 rounded-xl bg-white hover:bg-neutral-200 text-black text-xs font-bold transition-all disabled:opacity-40"
                  >
                    Save
                  </button>
                </div>
              </div>

              {/* Email (Read-only) */}
              <div className="space-y-2">
                <label className="text-[0.65rem] font-bold text-[var(--text-secondary)] uppercase tracking-wider block">
                  Email Address (Read Only)
                </label>
                <input
                  type="email"
                  value={email}
                  disabled
                  className="w-full p-2.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border)] text-xs font-mono text-[var(--text-muted)] cursor-not-allowed"
                />
              </div>

              {/* Metadata attributes (Read-only) */}
              <div className="flex items-center justify-between text-[0.65rem] text-[var(--text-muted)] font-mono">
                <span>Account Created:</span>
                <span>{createdAtDate || 'Retrieving...'}</span>
              </div>

              <div className="h-px bg-[var(--bg-secondary)]" />

              {/* NUCLEAR DELETE ACCOUNT CASCADE */}
              <div className="space-y-3">
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-red-400">Schedule Account Deletion</h4>
                  <p className="text-[0.65rem] text-[var(--text-muted)] leading-relaxed">
                    Places your account into a **24-hour grace deletion queue**. Active sessions will be blocklisted and terminated immediately. You can contact support to cancel deletion before the 24-hour window expires.
                  </p>
                </div>

                <div className="p-3 rounded-2xl bg-red-950/10 border border-red-900/20 space-y-3">
                  <input
                    type="text"
                    value={deleteConfirm}
                    onChange={(e) => setDeleteConfirm(e.target.value)}
                    placeholder='Type "DELETE ACCOUNT" to confirm'
                    className="w-full p-2 rounded-xl bg-[var(--bg-card)] border border-red-950/40 text-xs font-mono text-red-300 focus:outline-none focus:border-red-900 transition-colors"
                  />
                  <button
                    onClick={handleDeleteAccount}
                    disabled={deleteLoading || deleteConfirm !== 'DELETE ACCOUNT'}
                    className="w-full py-2 rounded-xl bg-red-650 hover:bg-red-700 text-[var(--text-primary)] font-bold text-xs transition-all disabled:opacity-30 shadow"
                  >
                    {deleteLoading ? 'Placing in deletion queue...' : 'Confirm Account Deletion (24h Grace)'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 1: AI ENGINES */}
          {activeTab === 'ai' && (
            <div className="space-y-5 animate-[fadeIn_0.15s_ease-out]">
              <div>
                <h3 className="text-sm font-bold text-[var(--text-primary)]">AI Language Engines</h3>
                <p className="text-[0.7rem] text-[var(--text-muted)] mt-1 leading-relaxed">
                  Route your memory context and prompts to preferred server providers.
                </p>
              </div>

              {/* Provider dropdown selector */}
              <div className="space-y-2">
                <label className="text-[0.65rem] font-bold text-[var(--text-secondary)] uppercase tracking-wider block">
                  Select Provider
                </label>
                <select
                  value={provider}
                  onChange={(e) => handleProviderChange(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border)] text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--border)] transition-colors"
                >
                  <option value="gemini">Google Gemini 2.0 (Standard)</option>
                  <option value="groq">Groq Cloud (Ultra-Fast)</option>
                  <option value="openrouter">OpenRouter Router (Global Free Tier)</option>
                  <option value="ollama">Ollama (Fully Local Dev)</option>
                </select>
              </div>

              {/* Custom Model Input */}
              <div className="space-y-2">
                <label className="text-[0.65rem] font-bold text-[var(--text-secondary)] uppercase tracking-wider flex items-center justify-between">
                  <span>Model Identifier</span>
                  <span className="text-[0.55rem] text-[var(--text-muted)] font-mono">Current: {model}</span>
                </label>
                <input
                  type="text"
                  value={model}
                  onChange={(e) => {
                    setModel(e.target.value);
                    saveSetting('mindly_model', e.target.value);
                  }}
                  placeholder="e.g. gemini-2.0-flash"
                  className="w-full p-2.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border)] text-xs font-mono text-[var(--text-primary)] focus:outline-none focus:border-[var(--border)] transition-colors"
                />
              </div>

              {/* Smart Quick Tags */}
              <div className="space-y-2">
                <span className="text-[0.55rem] font-bold text-[var(--text-muted)] uppercase tracking-wider block">
                  Recommended Models (Click to select)
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {provider === 'gemini' && (
                    <>
                      <button onClick={() => { setModel('gemini-2.0-flash'); saveSetting('mindly_model', 'gemini-2.0-flash'); }} className="px-2 py-1 rounded bg-[var(--bg-card)] border border-[var(--border)] text-[0.6rem] font-mono hover:border-[var(--border-glow)] text-[var(--text-secondary)]">gemini-2.0-flash</button>
                      <button onClick={() => { setModel('gemini-2.0-pro-exp'); saveSetting('mindly_model', 'gemini-2.0-pro-exp'); }} className="px-2 py-1 rounded bg-[var(--bg-card)] border border-[var(--border)] text-[0.6rem] font-mono hover:border-[var(--border-glow)] text-[var(--text-secondary)]">gemini-2.0-pro</button>
                    </>
                  )}
                  {provider === 'groq' && (
                    <>
                      <button onClick={() => { setModel('llama-3.1-8b-instant'); saveSetting('mindly_model', 'llama-3.1-8b-instant'); }} className="px-2 py-1 rounded bg-[var(--bg-card)] border border-[var(--border)] text-[0.6rem] font-mono hover:border-[var(--border-glow)] text-[var(--text-secondary)]">llama-3.1-8b</button>
                      <button onClick={() => { setModel('llama-3.3-70b-versatile'); saveSetting('mindly_model', 'llama-3.3-70b-versatile'); }} className="px-2 py-1 rounded bg-[var(--bg-card)] border border-[var(--border)] text-[0.6rem] font-mono hover:border-[var(--border-glow)] text-[var(--text-secondary)]">llama-3.3-70b</button>
                    </>
                  )}
                  {provider === 'openrouter' && (
                    <>
                      <button onClick={() => { setModel('meta-llama/llama-3.1-8b-instruct:free'); saveSetting('mindly_model', 'meta-llama/llama-3.1-8b-instruct:free'); }} className="px-2 py-1 rounded bg-[var(--bg-card)] border border-[var(--border)] text-[0.6rem] font-mono hover:border-[var(--border-glow)] text-[var(--text-secondary)]">llama-3.1:free</button>
                      <button onClick={() => { setModel('deepseek/deepseek-chat:free'); saveSetting('mindly_model', 'deepseek/deepseek-chat:free'); }} className="px-2 py-1 rounded bg-[var(--bg-card)] border border-[var(--border)] text-[0.6rem] font-mono hover:border-[var(--border-glow)] text-[var(--text-secondary)]">deepseek-chat:free</button>
                    </>
                  )}
                  {provider === 'ollama' && (
                    <>
                      <button onClick={() => { setModel('llama3'); saveSetting('mindly_model', 'llama3'); }} className="px-2 py-1 rounded bg-[var(--bg-card)] border border-[var(--border)] text-[0.6rem] font-mono hover:border-[var(--border-glow)] text-[var(--text-secondary)]">llama3</button>
                      <button onClick={() => { setModel('mistral'); saveSetting('mindly_model', 'mistral'); }} className="px-2 py-1 rounded bg-[var(--bg-card)] border border-[var(--border)] text-[0.6rem] font-mono hover:border-[var(--border-glow)] text-[var(--text-secondary)]">mistral</button>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: MEMORY SETTINGS */}
          {activeTab === 'memory' && (
            <div className="space-y-5 animate-[fadeIn_0.15s_ease-out]">
              <div>
                <h3 className="text-sm font-bold text-[var(--text-primary)]">Memory & Context Settings</h3>
                <p className="text-[0.7rem] text-[var(--text-muted)] mt-1 leading-relaxed">
                  Calibrate memory state, retention ranges, and data ownership compliance.
                </p>
              </div>

              {/* Memory on/off Toggle */}
              <div className="flex items-start justify-between gap-4 p-3 rounded-2xl bg-[var(--bg-card)] border border-[var(--border)]">
                <div className="space-y-1">
                  <div className="text-xs font-bold text-[var(--text-primary)]">Enable Session Memory</div>
                  <div className="text-[0.65rem] text-[var(--text-muted)] leading-relaxed">
                    When off, conversations are private and will not save to your long-term memory vault or graph nodes.
                  </div>
                </div>
                <button
                  onClick={() => {
                    const nextVal = !memoryEnabled;
                    setMemoryEnabled(nextVal);
                    handleSaveProfile({ memoryEnabled: nextVal });
                  }}
                  className={`w-9 h-5 rounded-full p-0.5 transition-all duration-300 cursor-pointer flex items-center flex-shrink-0 ${
                    memoryEnabled ? 'bg-[var(--text-primary)] justify-end' : 'bg-[var(--bg-input)] justify-start'
                  }`}
                >
                  <div className="w-4 h-4 rounded-full bg-[var(--bg-primary)] shadow-sm" />
                </button>
              </div>

              {/* Memory retention period dropdown */}
              <div className="space-y-2">
                <label className="text-[0.65rem] font-bold text-[var(--text-secondary)] uppercase tracking-wider block">
                  Memory Retention Period
                </label>
                <select
                  value={memoryRetentionPeriod}
                  onChange={(e) => {
                    setMemoryRetentionPeriod(e.target.value);
                    handleSaveProfile({ memoryRetentionPeriod: e.target.value });
                  }}
                  className="w-full p-2.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border)] text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--border)] transition-colors"
                >
                  <option value="forever">Keep forever (Default)</option>
                  <option value="1 year">Retain for 1 Year</option>
                  <option value="6 months">Retain for 6 Months</option>
                  <option value="3 months">Retain for 3 Months</option>
                </select>
              </div>

              {/* Stored memories stats card */}
              <div className="p-3.5 rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] space-y-3 font-mono text-[0.65rem]">
                <div className="text-[var(--text-secondary)] font-bold uppercase text-[0.6rem] tracking-wider">
                  Data Vault Utilization
                </div>
                <div className="grid grid-cols-3 gap-2 text-center border-b border-[var(--border)] pb-2">
                  <div>
                    <div className="text-[var(--text-primary)] text-xs font-bold">{stats.nodesCount}</div>
                    <div className="text-[var(--text-muted)] text-[0.55rem]">Entities</div>
                  </div>
                  <div>
                    <div className="text-[var(--text-primary)] text-xs font-bold">{stats.summariesCount}</div>
                    <div className="text-[var(--text-muted)] text-[0.55rem]">Summaries</div>
                  </div>
                  <div>
                    <div className="text-[var(--text-primary)] text-xs font-bold">{stats.messagesCount}</div>
                    <div className="text-[var(--text-muted)] text-[0.55rem]">Messages</div>
                  </div>
                </div>
                <div className="flex items-center justify-between text-[var(--text-secondary)] pt-1">
                  <span>Total Memory Footprint:</span>
                  <span className="font-bold text-[var(--text-primary)]">{stats.totalMemories} Nodes Stored</span>
                </div>
              </div>

              {/* Data Export & Nuclear clear grid */}
              <div className="grid grid-cols-2 gap-3.5">
                {/* Export Data button */}
                <div className="space-y-2">
                  <span className="text-[0.6rem] font-bold text-[var(--text-secondary)] uppercase tracking-wider block">
                    Own Your Data
                  </span>
                  <button
                    onClick={handleExportData}
                    disabled={exportLoading}
                    className="w-full py-2.5 rounded-xl bg-[var(--bg-secondary)] hover:bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] font-bold text-xs transition-all flex items-center justify-center gap-1.5 shadow text-center disabled:opacity-40"
                  >
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                    {exportStatus === 'processing' ? 'Generating archive...' : 'Export Data (JSON)'}
                  </button>
                </div>

                {/* Nuclear Clear All memories */}
                <div className="space-y-2">
                  <span className="text-[0.6rem] font-bold text-red-400 uppercase tracking-wider block">
                    Nuclear Option
                  </span>
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      value={wipeConfirm}
                      onChange={(e) => setWipeConfirm(e.target.value)}
                      placeholder='Type "DELETE"'
                      className="w-20 p-2 rounded-xl bg-[var(--bg-card)] border border-red-950/40 text-xs font-mono text-red-300 focus:outline-none focus:border-red-900 transition-colors"
                    />
                    <button
                      onClick={handleWipeMemories}
                      disabled={wipeLoading || wipeConfirm.trim().toLowerCase() !== 'delete'}
                      className="flex-1 py-2.5 rounded-xl bg-red-650 hover:bg-red-700 text-[var(--text-primary)] font-bold text-xs transition-all disabled:opacity-30 shadow"
                    >
                      {wipeLoading ? 'Clearing...' : 'Clear All'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Range context size and extra details */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between text-[0.65rem] font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                  <span>Short-Term sliding window</span>
                  <span className="text-[0.65rem] text-[var(--text-secondary)] font-mono">{contextSize} messages</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="50"
                  value={contextSize}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setContextSize(val);
                    saveSetting('mindly_context_size', val.toString());
                  }}
                  className="w-full accent-white bg-[var(--bg-card)] rounded-lg cursor-pointer h-1"
                />
              </div>

              {/* Toggles */}
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="text-xs font-bold text-[var(--text-primary)]">Asynchronous Knowledge Graph</div>
                    <div className="text-[0.65rem] text-[var(--text-muted)] leading-relaxed">
                      Automatically extract structural facts and relationships between topics in the background.
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      const nextVal = !graphEnabled;
                      setGraphEnabled(nextVal);
                      saveSetting('mindly_graph_enabled', nextVal ? 'true' : 'false');
                    }}
                    className={`w-9 h-5 rounded-full p-0.5 transition-all duration-300 cursor-pointer flex items-center flex-shrink-0 ${
                      graphEnabled ? 'bg-[var(--text-primary)] justify-end' : 'bg-[var(--bg-input)] justify-start'
                    }`}
                  >
                    <div className="w-4 h-4 rounded-full bg-[var(--bg-primary)] shadow-sm" />
                  </button>
                </div>

                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="text-xs font-bold text-[var(--text-primary)]">Proactive Reflections</div>
                    <div className="text-[0.65rem] text-[var(--text-muted)] leading-relaxed">
                      Allow the engine to generate predictive reminders and personalized banner notifications based on past sessions.
                    </div>
                  </div>
                  <button
                    onClick={onToggleProactive}
                    className={`w-9 h-5 rounded-full p-0.5 transition-all duration-300 cursor-pointer flex items-center flex-shrink-0 ${
                      proactiveEnabled ? 'bg-amber-500 justify-end' : 'bg-[var(--bg-input)] justify-start'
                    }`}
                  >
                    <div className="w-4 h-4 rounded-full bg-[var(--bg-primary)] shadow-sm" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: SECURITY */}
          {activeTab === 'security' && (
            <div className="space-y-6 animate-[fadeIn_0.15s_ease-out]">
              <div>
                <h3 className="text-sm font-bold text-[var(--text-primary)]">Security Safeguards</h3>
                <p className="text-[0.7rem] text-[var(--text-muted)] mt-1 leading-relaxed">
                  Turn protective filters on or off. Keep your LLM safe from cost leaks and malicious commands.
                </p>
              </div>

              {/* Prompt Injection Blocker Toggle */}
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-1.5">
                     Prompt Injection Blocker
                    <span className="text-[0.55rem] font-mono px-1.5 py-0.5 rounded bg-emerald-950/60 border border-emerald-900/50 text-emerald-400">Layer 3</span>
                  </div>
                  <div className="text-[0.65rem] text-[var(--text-muted)] leading-relaxed">
                    Scans all input messages for persona-override or jailbreak patterns and halts LLM processing if a threat is found.
                  </div>
                </div>
                <button
                  onClick={() => {
                    const nextVal = !injectionShield;
                    setInjectionShield(nextVal);
                    saveSetting('mindly_injection_shield', nextVal ? 'true' : 'false');
                  }}
                  className={`w-9 h-5 rounded-full p-0.5 transition-all duration-300 cursor-pointer flex items-center flex-shrink-0 ${
                    injectionShield ? 'bg-[var(--text-primary)] justify-end' : 'bg-[var(--bg-input)] justify-start'
                  }`}
                >
                  <div className="w-4 h-4 rounded-full bg-[var(--bg-primary)] shadow-sm" />
                </button>
              </div>

              <div className="h-px bg-[var(--bg-secondary)]" />

              {/* Sensitive Data Redactor Toggle */}
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-1.5">
                    Data Redactor & Sanitizer
                    <span className="text-[0.55rem] font-mono px-1.5 py-0.5 rounded bg-emerald-950/60 border border-emerald-900/50 text-emerald-400">Pre-Save</span>
                  </div>
                  <div className="text-[0.65rem] text-[var(--text-muted)] leading-relaxed">
                    Extracts and replaces API keys, database connection strings, passwords, and credit cards with secure placeholders before saving to the database.
                  </div>
                </div>
                <button
                  onClick={() => {
                    const nextVal = !redactionEnabled;
                    setRedactionEnabled(nextVal);
                    saveSetting('mindly_redaction_enabled', nextVal ? 'true' : 'false');
                  }}
                  className={`w-9 h-5 rounded-full p-0.5 transition-all duration-300 cursor-pointer flex items-center flex-shrink-0 ${
                    redactionEnabled ? 'bg-[var(--text-primary)] justify-end' : 'bg-[var(--bg-input)] justify-start'
                  }`}
                >
                  <div className="w-4 h-4 rounded-full bg-[var(--bg-primary)] shadow-sm" />
                </button>
              </div>
              <SecuritySettingsPanels
                subscriptionTier={subscriptionTier}
                activeSessions={activeSessions}
                apiTokens={apiTokens}
                redactionLogs={redactionLogs}
                connectors={connectors}
                newTokenName={newTokenName}
                setNewTokenName={setNewTokenName}
                generatedToken={generatedToken}
                setGeneratedToken={setGeneratedToken}
                connectorTokenInput={connectorTokenInput}
                setConnectorTokenInput={setConnectorTokenInput}
                onClose={onClose}
                fetchSecurityData={fetchSecurityData}
                setSaveSuccess={setSaveSuccess}
                setErrorMessage={setErrorMessage}
              />
            </div>
          )}

          {activeTab === 'appearance' && (
            <div className="space-y-6 animate-[fadeIn_0.15s_ease-out]">
              <div>
                <h3 className="text-sm font-bold text-[var(--text-primary)]">Appearance</h3>
                <p className="text-[0.7rem] text-[var(--text-muted)] mt-1">Theme and text scale.</p>
              </div>
              <select
                value={theme}
                onChange={(e) => {
                  const next = e.target.value as 'dark' | 'light';
                  setTheme(next);
                  saveSetting('mindly_theme', next);
                  applyAppearance(next, textScale);
                }}
                className="w-full p-2.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border)] text-xs text-[var(--text-primary)]"
              >
                <option value="dark">Dark</option>
                <option value="light">Light</option>
              </select>
              <label className="text-[0.65rem] font-bold text-[var(--text-secondary)] uppercase tracking-wider block">
                Text scale ({textScale}%)
              </label>
              <input
                type="range"
                min={85}
                max={125}
                value={textScale}
                onChange={(e) => {
                  const scale = Number(e.target.value);
                  setTextScale(scale);
                  saveSetting('mindly_text_scale', String(scale));
                  applyAppearance(theme, scale);
                }}
                className="w-full accent-white"
              />
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
