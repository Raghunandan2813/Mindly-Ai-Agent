// app/page.tsx
// Main application dashboard: sidebar of chat sessions and active chat window.
'use client';
import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import ChatWindow from '@/components/ChatWindow';

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

  const router = useRouter();

  // Fetch unique sessions for the user
  const fetchSessions = useCallback(async (uid: string) => {
    try {
      const res = await fetch(`/api/sessions?userId=${uid}`);
      const data = await res.json();
      if (data.sessions) {
        setSessions(data.sessions);
      }
    } catch (err) {
      console.error('Failed to fetch sessions:', err);
    }
  }, []);

  useEffect(() => {
    // Check if user is logged in
    fetch('/api/auth/me')
      .then(res => res.json())
      .then(data => {
        if (data.userId) {
          setUserId(data.userId);
          setUserEmail(data.email || '');
          fetchSessions(data.userId);
        } else {
          router.push('/login');
        }
      })
      .catch(() => router.push('/login'))
      .finally(() => setLoading(false));
  }, [router, fetchSessions]);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  };

  const handleNewChat = () => {
    setSessionId(null);
  };

  const handleSessionCreated = () => {
    if (userId) {
      fetchSessions(userId);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-primary)]">
        <div className="flex flex-col items-center gap-4">
          <div className="typing-indicator flex items-center gap-1">
            <span /><span /><span />
          </div>
          <p className="text-xs text-[var(--text-muted)] animate-pulse">Initializing Synapse Memory Link...</p>
        </div>
      </div>
    );
  }

  if (!userId) return null;

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--bg-primary)] text-[var(--text-primary)]">
      {/* Sidebar - Sessions List */}
      <div
        className={`${
          sidebarOpen ? 'w-80' : 'w-0'
        } transition-all duration-300 ease-in-out border-r border-[var(--border)] bg-[var(--bg-secondary)] flex flex-col overflow-hidden relative z-20`}
      >
        {/* Sidebar Header */}
        <div className="p-4 border-b border-[var(--border)] flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🧠</span>
              <span className="font-bold tracking-wider text-sm gradient-text">SYNAPSE AI</span>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="md:hidden text-[var(--text-muted)] hover:text-white"
            >
              ✕
            </button>
          </div>
          <button
            onClick={handleNewChat}
            className="w-full btn-primary py-3 rounded-xl flex items-center justify-center gap-2 text-sm font-medium"
          >
            <span>➕</span> New Chat
          </button>
        </div>

        {/* Sidebar Content (Scrollable list of sessions) */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          <div className="text-[var(--text-muted)] text-[10px] uppercase font-bold tracking-widest px-2 mb-2">
            Conversations
          </div>
          {sessions.length === 0 ? (
            <div className="text-center py-8 px-4 text-xs text-[var(--text-muted)] leading-relaxed">
              No conversations yet. Start a new chat to begin!
            </div>
          ) : (
            sessions.map((session) => {
              const isActive = session.id === sessionId;
              return (
                <button
                  key={session.id}
                  onClick={() => setSessionId(session.id)}
                  className={`w-full text-left px-3 py-3 rounded-xl flex flex-col gap-1 transition-all group relative overflow-hidden ${
                    isActive
                      ? 'bg-gradient-to-r from-indigo-500/10 to-cyan-500/10 border border-indigo-500/30'
                      : 'hover:bg-white/5 border border-transparent'
                  }`}
                >
                  {isActive && (
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-indigo-500 to-cyan-500" />
                  )}
                  <span
                    className={`text-sm truncate font-medium ${
                      isActive ? 'text-[var(--accent-cyan)] font-semibold' : 'text-[var(--text-primary)]'
                    }`}
                  >
                    {session.title || 'Untitled Session'}
                  </span>
                  <span className="text-[10px] text-[var(--text-muted)] group-hover:text-[var(--text-primary)] transition-colors">
                    {new Date(session.created_at).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                    })}
                  </span>
                </button>
              );
            })
          )}
        </div>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-[var(--border)] bg-black/20 flex flex-col gap-3">
          <div className="flex items-center gap-3 px-1">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center font-bold text-xs text-white">
              {userEmail ? userEmail[0].toUpperCase() : 'U'}
            </div>
            <div className="flex-1 overflow-hidden">
              <div className="text-xs font-semibold text-[var(--text-primary)] truncate">{userEmail}</div>
              <div className="text-[10px] text-[var(--text-muted)]">Verified Synapse Link</div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-1">
            <a
              href="/memories"
              className="btn-ghost py-2 rounded-lg text-xs font-semibold text-center flex items-center justify-center gap-1.5"
            >
              📂 Vault
            </a>
            <button
              onClick={handleLogout}
              className="btn-ghost py-2 rounded-lg text-xs font-semibold text-center flex items-center justify-center gap-1.5 hover:text-red-400"
            >
              🚪 Logout
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
        {/* Toggle Button for mobile/hidden sidebar */}
        {!sidebarOpen && (
          <button
            onClick={() => setSidebarOpen(true)}
            className="absolute left-4 top-4 z-30 w-10 h-10 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)] flex items-center justify-center hover:bg-white/5 transition-colors"
          >
            ☰
          </button>
        )}
        <div className="flex-1 h-full overflow-hidden">
          <ChatWindow
            userId={userId}
            sessionId={sessionId}
            setSessionId={setSessionId}
            onSessionCreated={handleSessionCreated}
          />
        </div>
      </div>
    </div>
  );
}
