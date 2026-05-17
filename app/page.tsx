// app/page.tsx
// Main application dashboard: premium monochrome sliding sidebar and active chat window.
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
    // Check if user is logged in
    fetch('/api/auth/me')
      .then(res => res.json())
      .then(data => {
        if (data.userId) {
          setUserId(data.userId);
          setUserEmail(data.email || '');
          fetchSessions(data.userId, true); // true indicates initial page load
        } else {
          router.push('/login');
        }
      })
      .catch(() => router.push('/login'))
      .finally(() => setLoading(false));
  }, [router, fetchSessions]);

  const handleLogout = async () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('mindly_last_session_id');
    }
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  };

  const handleNewChat = () => {
    changeSession(null);
  };

  const handleSessionCreated = () => {
    if (userId) {
      fetchSessions(userId, false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="flex flex-col items-center gap-4">
          <div className="typing-indicator flex items-center gap-1">
            <span /><span /><span />
          </div>
          <p className="text-xs text-neutral-500 animate-pulse">Initializing your secure workspace...</p>
        </div>
      </div>
    );
  }

  if (!userId) return null;

  return (
    <div className="flex h-screen overflow-hidden bg-black text-[#f5f5f5] font-sans">
      {/* Sliding Sidebar - Sessions List */}
      <div
        className={`${
          sidebarOpen ? 'w-80 border-r border-[#1a1a1a]' : 'w-0 border-r-0'
        } transition-all duration-300 ease-in-out bg-[#0c0c0c] flex flex-col overflow-hidden relative z-20 flex-shrink-0`}
      >
        {/* Rigid inner container prevents wrapping/squishing during sliding animation */}
        <div className="w-80 h-full flex flex-col flex-shrink-0">
          
          {/* Sidebar Header */}
          <div className="p-4 border-b border-[#151515] flex flex-col gap-4 bg-[#0c0c0c]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-white flex items-center justify-center">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                    <rect x="3" y="3" width="18" height="18" rx="4" stroke="#000000" strokeWidth="2.5" />
                    <path d="M7 10l3 2.5-3 2.5" stroke="#000000" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                    <line x1="12" y1="15" x2="16" y2="15" stroke="#000000" strokeWidth="2.5" strokeLinecap="round" />
                  </svg>
                </div>
                <span className="font-bold tracking-tight text-sm text-white">Mindly AI</span>
              </div>
              <button
                onClick={() => setSidebarOpen(false)}
                className="text-neutral-500 hover:text-white transition-colors p-1 rounded-lg hover:bg-neutral-900"
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
              className="w-full py-2.5 rounded-xl bg-white hover:bg-neutral-200 text-black font-semibold text-xs transition-all flex items-center justify-center gap-2 shadow-sm"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              New chat
            </button>
          </div>

          {/* Sidebar Content (Scrollable list of sessions) */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-[#0c0c0c]">
            <div className="text-neutral-500 text-[0.65rem] tracking-wider font-semibold uppercase px-2.5">
              Recent Chats
            </div>

            {sessions.length === 0 ? (
              <div className="text-center py-10 px-4 text-xs text-neutral-600 leading-relaxed">
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
                          ? 'bg-[#181818] text-white border border-[#2a2a2a]'
                          : 'bg-transparent text-neutral-400 hover:text-white hover:bg-[#121212]'
                      }`}
                    >
                      <span className="text-xs truncate max-w-[180px]">
                        {session.title || 'Untitled chat'}
                      </span>
                      <span className="text-[0.6rem] text-neutral-600">
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
          <div className="p-4 border-t border-[#151515] bg-[#0c0c0c] flex flex-col gap-3.5">
            {/* User Profile */}
            <div className="flex items-center gap-3 px-1">
              <div className="w-8 h-8 rounded-full bg-[#181818] border border-[#2a2a2a] flex items-center justify-center font-bold text-xs text-neutral-300">
                {userEmail ? userEmail[0].toUpperCase() : 'U'}
              </div>
              <div className="flex-1 overflow-hidden">
                <div className="text-xs font-semibold text-neutral-300 truncate">{userEmail}</div>
                <div className="text-[0.6rem] text-neutral-500 font-medium">Free Tier • Secured</div>
              </div>
            </div>

            {/* Quick Action Navigation Grid */}
            <div className="grid grid-cols-2 gap-2">
              <a
                href="/memories"
                className="py-2 rounded-xl bg-[#121212] hover:bg-[#181818] border border-[#222222] text-xs font-medium text-center flex items-center justify-center gap-1.5 text-neutral-300 hover:text-white transition-all"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                </svg>
                Memory Vault
              </a>
              <button
                onClick={handleLogout}
                className="py-2 rounded-xl bg-[#121212] hover:bg-[#181818] border border-[#222222] text-xs font-medium text-center flex items-center justify-center gap-1.5 text-neutral-400 hover:text-white transition-all"
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
      <div className="flex-1 flex flex-col h-full overflow-hidden relative bg-black">
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
    </div>
  );
}
