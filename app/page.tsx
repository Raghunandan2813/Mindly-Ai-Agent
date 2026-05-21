// app/page.tsx
// Main application dashboard: premium monochrome sliding sidebar and active chat window.
'use client';
import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import ChatWindow from '@/components/ChatWindow';
import SettingsModal from '@/components/SettingsModal';

interface ChatSession {
  id: string;
  title: string;
  created_at: string;
}

export default function Home() {
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [proactiveEnabled, setProactiveEnabled] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const router = useRouter();

  // Helper to change sessions and save state
  const changeSession = (id: string | null) => {
    setSessionId(id);
    if (typeof window !== 'undefined') {
      if (id) {
        localStorage.setItem('mindly_last_session_id', id);
      } else {
        localStorage.removeItem('mindly_last_session_id');
      }
    }
  };

  // Fetch unique sessions for the user and auto-load the correct one
  const fetchSessions = useCallback(async (uid: string, initialLoad = false) => {
    try {
      const res = await fetch(`/api/sessions?userId=${uid}`);
      const data = await res.json();
      if (data.sessions) {
        setSessions(data.sessions);

        // Auto-select session on initial page load
        if (initialLoad && data.sessions.length > 0) {
          const savedSessionId = localStorage.getItem('mindly_last_session_id');
          const sessionExists = data.sessions.some((s: ChatSession) => s.id === savedSessionId);

          if (savedSessionId && sessionExists) {
            setSessionId(savedSessionId);
          } else {
            // Default to the most recent chat session
            setSessionId(data.sessions[0].id);
            localStorage.setItem('mindly_last_session_id', data.sessions[0].id);
          }
        }
      }
    } catch (err) {
      console.error('Failed to fetch sessions:', err);
    }
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const t = (localStorage.getItem('mindly_theme') as 'dark' | 'light') || 'dark';
      const scale = Number(localStorage.getItem('mindly_text_scale')) || 100;
      document.documentElement.setAttribute('data-theme', t);
      document.documentElement.style.fontSize = `${scale}%`;
    }

    // Check if user is logged in
    fetch('/api/auth/me')
      .then(res => res.json())
      .then(data => {
        if (data.userId) {
          setUserId(data.userId);
          setUserEmail(data.email || '');
          
          // Load proactive reflections configuration from API response
          const enabled = data.proactiveEnabled === true;
          setProactiveEnabled(enabled);
          if (typeof window !== 'undefined') {
            localStorage.setItem('mindly_proactive_enabled', enabled ? 'true' : 'false');
          }
          
          fetchSessions(data.userId, true);

          // Register device session for limit enforcement + revocation blocklist
          fetch('/api/auth/sessions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ deviceName: typeof navigator !== 'undefined' ? navigator.platform : 'Web Browser' }),
          })
            .then((r) => r.json())
            .then((sessionData) => {
              if (sessionData.sessionId && typeof window !== 'undefined') {
                localStorage.setItem('mindly_auth_session_id', sessionData.sessionId);
              }
            })
            .catch((err) => console.warn('[Session Registry] Registration skipped:', err));
        } else {
          router.push('/login');
        }
      })
      .catch(() => router.push('/login'))
      .finally(() => setLoading(false));
  }, [router, fetchSessions]);

  const toggleProactive = async () => {
    const nextVal = !proactiveEnabled;
    setProactiveEnabled(nextVal);
    
    if (typeof window !== 'undefined') {
      localStorage.setItem('mindly_proactive_enabled', nextVal ? 'true' : 'false');
    }

    try {
      // Synchronize with server Auth User Metadata so backend cron can read this status
      await fetch('/api/auth/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proactive_enabled: nextVal })
      });
      // Force trigger an event dispatch to notify ChatWindow immediately!
      window.dispatchEvent(new Event('storage'));
    } catch (err) {
      console.error('Failed to sync proactive settings profile:', err);
    }
  };

  const handleLogout = async () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('mindly_last_session_id');
      localStorage.removeItem('mindly_proactive_enabled');
      localStorage.removeItem('mindly_auth_session_id');
    }
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  };

  const handleNewChat = () => {
    changeSession(null);
    // Close sidebar on mobile when starting a new chat
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setSidebarOpen(false);
    }
  };

  const handleSessionCreated = () => {
    if (userId) {
      fetchSessions(userId, false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-primary)]">
        <div className="flex flex-col items-center gap-4">
          <div className="typing-indicator flex items-center gap-1">
            <span /><span /><span />
          </div>
          <p className="text-xs text-[var(--text-muted)] animate-pulse">Initializing your secure workspace...</p>
        </div>
      </div>
    );
  }

  if (!userId) return null;

  return (
    <div className="flex flex-col md:flex-row h-screen overflow-hidden bg-[var(--bg-primary)] text-[var(--text-primary)] font-sans">
      {/* Sliding Sidebar - Sessions List */}
      <div
        className={`fixed inset-y-0 left-0 z-30 w-full md:relative bg-[var(--bg-secondary)] flex flex-col overflow-hidden transition-all duration-300 ease-in-out ${
          sidebarOpen
            ? 'translate-x-0 md:translate-x-0 md:w-80'
            : '-translate-x-full md:-translate-x-full md:w-0'
        }`}
      >
        {/* Rigid inner container prevents wrapping/squishing during sliding animation */}
        {/* Rigid inner container prevents wrapping/squishing during sliding animation */}
        <div className="w-80 h-full flex flex-col flex-shrink-0 md:w-80">
          
          {/* Sidebar Header */}
          <div className="p-4 border-b border-[var(--border)] flex flex-col gap-4 bg-[var(--bg-secondary)]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-white flex items-center justify-center">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                    <rect x="3" y="3" width="18" height="18" rx="4" stroke="#000000" strokeWidth="2.5" />
                    <path d="M7 10l3 2.5-3 2.5" stroke="#000000" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                    <line x1="12" y1="15" x2="16" y2="15" stroke="#000000" strokeWidth="2.5" strokeLinecap="round" />
                  </svg>
                </div>
                <span className="font-bold tracking-tight text-sm text-[var(--text-primary)]">Mindly AI</span>
              </div>
              <button
                onClick={() => setSidebarOpen(false)}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors p-1 rounded-lg hover:bg-[var(--bg-card)]"
                title="Collapse Sidebar"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                  <line x1="9" y1="3" x2="9" y2="21"/>
                  <path d="M16 15l-3-3 3-3"/>
                </svg>
              </button>
            </div>

            {/* Premium, High-Contrast "New Chat" Button */}
            <button
              onClick={handleNewChat}
              className="w-full py-2.5 rounded-xl bg-[var(--text-primary)] hover:bg-[var(--text-secondary)] text-[var(--bg-primary)] font-semibold text-xs transition-all flex items-center justify-center gap-2 shadow-sm"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              New chat
            </button>
          </div>

          {/* Sidebar Content (Scrollable list of sessions) */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-[var(--bg-secondary)]">
            <div className="text-[var(--text-muted)] text-[0.65rem] tracking-wider font-semibold uppercase px-2.5">
              Recent Chats
            </div>

            {sessions.length === 0 ? (
              <div className="text-center py-10 px-4 text-xs text-[var(--text-muted)] leading-relaxed">
                No chats yet.
                <br />
                Start a new conversation!
              </div>
            ) : (
              <div className="space-y-1">
                {sessions.map((session) => {
                  const isActive = session.id === sessionId;
                  return (
                    <button
                      key={session.id}
                      onClick={() => changeSession(session.id)}
                      className={`w-full text-left px-3 py-2.5 rounded-xl flex items-center justify-between transition-all ${
                        isActive
                          ? 'bg-[var(--bg-card)] text-[var(--text-primary)] border border-[var(--border)]'
                          : 'bg-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card)]'
                      }`}
                    >
                      <span className="text-xs truncate max-w-[180px]">
                        {session.title || 'Untitled chat'}
                      </span>
                      <span className="text-[0.6rem] text-[var(--text-muted)]">
                        {new Date(session.created_at).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                        })}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Sidebar Footer */}
          <div className="p-4 border-t border-[var(--border)] bg-[var(--bg-secondary)] flex flex-col gap-3.5">
            {/* Proactive Reflections opt-in Toggle Switch Card */}
            <div className="p-3 rounded-2xl bg-gradient-to-r from-amber-500/[0.03] to-orange-500/[0.01] border border-amber-500/10 flex items-center justify-between shadow-sm">
              <div>
                <div className="text-[0.7rem] font-bold text-[var(--text-secondary)] flex items-center gap-1.5 uppercase font-mono tracking-wide">
                  <span className={`w-1.5 h-1.5 rounded-full ${proactiveEnabled ? 'bg-amber-400 animate-pulse' : 'bg-neutral-600'}`} />
                  Proactive reflections
                </div>
                <div className="text-[0.55rem] text-[var(--text-muted)] mt-0.5 leading-relaxed">
                  Reflect on thoughts autonomously
                </div>
              </div>
              <button
                onClick={toggleProactive}
                className={`w-9 h-5 rounded-full p-0.5 transition-all duration-300 cursor-pointer flex items-center ${
                  proactiveEnabled ? 'bg-amber-500 justify-end' : 'bg-[var(--bg-secondary)] justify-start'
                }`}
                title={proactiveEnabled ? "Disable Proactive reflections" : "Enable Proactive reflections"}
              >
                <div className="w-4 h-4 rounded-full bg-[var(--bg-primary)] shadow-sm" />
              </button>
            </div>

            {/* User Profile */}
            <div className="flex items-center gap-3 px-1">
              <div className="w-8 h-8 rounded-full bg-[var(--bg-card)] border border-[var(--border)] flex items-center justify-center font-bold text-xs text-[var(--text-secondary)]">
                {userEmail ? userEmail[0].toUpperCase() : 'U'}
              </div>
              <div className="flex-1 overflow-hidden">
                <div className="text-xs font-semibold text-[var(--text-secondary)] truncate">{userEmail}</div>
                <div className="text-[0.6rem] text-[var(--text-muted)] font-medium">Free Tier • Secured</div>
              </div>
            </div>

            {/* Quick Action Navigation Grid */}
            <div className="grid grid-cols-3 gap-1.5">
              <a
                href="/memories"
                className="py-2 rounded-xl bg-[var(--bg-card)] hover:bg-[var(--bg-input)] border border-[var(--border)] text-[0.65rem] font-medium text-center flex flex-col items-center justify-center gap-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all"
                title="Memory Vault"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                </svg>
                Vault
              </a>
              <button
                onClick={() => setSettingsOpen(true)}
                className="py-2 rounded-xl bg-[var(--bg-card)] hover:bg-[var(--bg-input)] border border-[var(--border)] text-[0.65rem] font-medium text-center flex flex-col items-center justify-center gap-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all"
                title="Settings"
              >
                <svg className="w-3.5 h-3.5 animate-[spin_12s_linear_infinite]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
                Settings
              </button>
              <button
                onClick={handleLogout}
                className="py-2 rounded-xl bg-[var(--bg-card)] hover:bg-[var(--bg-input)] border border-[var(--border)] text-[0.65rem] font-medium text-center flex flex-col items-center justify-center gap-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all"
                title="Sign out"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
                </svg>
                Sign out
              </button>
            </div>
          </div>

        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative bg-[var(--bg-primary)]">
        <div className="flex-1 h-full overflow-hidden font-sans">
          <ChatWindow
            userId={userId}
            sessionId={sessionId}
            setSessionId={setSessionId}
            onSessionCreated={handleSessionCreated}
            sidebarOpen={sidebarOpen}
            setSidebarOpen={setSidebarOpen}
          />
        </div>
      </div>

      {/* Glassmorphic Settings Overlay Modal */}
      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        userId={userId}
        proactiveEnabled={proactiveEnabled}
        onToggleProactive={toggleProactive}
      />
    </div>
  );
}
