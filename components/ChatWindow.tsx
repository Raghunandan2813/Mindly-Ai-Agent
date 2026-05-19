// components/ChatWindow.tsx
// Premium AI Agent chat interface — centered layout, floating input, structured responses.
'use client';
import React, { useState, useRef, useEffect, useCallback } from 'react';
import MessageBubble from './MessageBubble';
import MicButton from './MicButton';
import InsightBanner, { Insight } from './InsightBanner';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  recalledMemories?: string;
}

interface ChatWindowProps {
  userId: string;
  sessionId: string | null;
  setSessionId: (id: string | null) => void;
  onSessionCreated: () => void;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}

export default function ChatWindow({
  userId,
  sessionId,
  setSessionId,
  onSessionCreated,
  sidebarOpen,
  setSidebarOpen,
}: ChatWindowProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [memoriesUsed, setMemoriesUsed] = useState(0);
  const [latestAiMessageId, setLatestAiMessageId] = useState<string | null>(null);
  const [activeInsight, setActiveInsight] = useState<Insight | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  
  // Track if we need to bypass history reload when creating a session on the fly
  const skipHistoryFetchRef = useRef(false);

  // Clean markdown formatting before speaking replies out loud
  const cleanMarkdownForSpeech = (text: string) => {
    return text
      .replace(/```[\s\S]*?```/g, '[code block]') // skip code blocks
      .replace(/`([^`]+)`/g, '$1') // remove single backticks
      .replace(/[*#_\-\[\]]/g, '') // remove asterisks, hash signs, brackets, dashes
      .trim();
  };

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const handleTypingComplete = useCallback(() => {
    scrollToBottom();
  }, [scrollToBottom]);

  useEffect(() => {
    // Only scroll automatically on initial message load/add
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Load message history when sessionId changes
  useEffect(() => {
    if (skipHistoryFetchRef.current) {
      skipHistoryFetchRef.current = false; // Safely consume and reset the flag
      return;
    }

    setLatestAiMessageId(null);
    if (!sessionId) {
      setMessages([]);
      setMemoriesUsed(0);
      return;
    }

    setHistoryLoading(true);
    fetch(`/api/messages?sessionId=${sessionId}&userId=${userId}`)
      .then(res => res.json())
      .then(data => {
        if (data.messages) {
          const formatted = data.messages.map((m: any) => ({
            id: m.id,
            role: m.role,
            content: m.content,
            timestamp: new Date(m.created_at),
          }));
          setMessages(formatted);
        }
      })
      .catch(err => console.error('Failed to load messages:', err))
      .finally(() => setHistoryLoading(false));
  }, [sessionId, userId]);

  // Fetch active proactive insights if user is opted in
  useEffect(() => {
    if (!userId) return;

    const checkAndFetchInsights = () => {
      const optedIn = localStorage.getItem('mindly_proactive_enabled') === 'true';
      if (!optedIn) {
        setActiveInsight(null);
        return;
      }

      fetch(`/api/insights?userId=${userId}`)
        .then(res => res.json())
        .then(data => {
          if (data.insights && data.insights.length > 0) {
            setActiveInsight(data.insights[0]);
          } else {
            setActiveInsight(null);
          }
        })
        .catch(err => console.error('[Proactive UI] Insights fetch failed:', err));
    };

    checkAndFetchInsights();

    // Listen to changes in localStorage settings toggles dynamically
    window.addEventListener('storage', checkAndFetchInsights);

    // Re-check periodically in case cron job creates an insight in the background
    const interval = setInterval(checkAndFetchInsights, 60000);
    return () => {
      window.removeEventListener('storage', checkAndFetchInsights);
      clearInterval(interval);
    };
  }, [userId]);

  const handleInsightAction = async (message: string, suggestion: string) => {
    if (!activeInsight) return;
    const id = activeInsight.id;

    // Build the trigger prompt contextually
    const actionPromptText = `Regarding your active reflection: "${message}". ${suggestion}`;
    setInput(actionPromptText);

    // Dynamic focus & expand height
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        inputRef.current.style.height = 'auto';
        inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 160) + 'px';
      }
    }, 100);

    // Call POST API to mark as permanently dismissed
    await fetch('/api/insights', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, insightId: id })
    });

    setActiveInsight(null);
  };

  const handleInsightDismiss = async (id: string) => {
    await fetch('/api/insights', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, insightId: id })
    });
    setActiveInsight(null);
  };

  // Global keyboard shortcuts (Cmd+K / Ctrl+K to clear/new session, Escape to unfocus input)
  useEffect(() => {
    // Focus input on initial mount
    setTimeout(() => inputRef.current?.focus(), 150);

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Cmd+K or Ctrl+K: Clear session & start fresh
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        console.log('[Shortcut] Cmd/Ctrl + K: Starting a brand new chat session!');
        setSessionId(null);
        setMessages([]);
        setMemoriesUsed(0);
        setInput('');
        setTimeout(() => inputRef.current?.focus(), 50);
      }

      // Escape: Unfocus prompt input
      if (e.key === 'Escape') {
        if (document.activeElement === inputRef.current) {
          inputRef.current?.blur();
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [setSessionId, setMessages, setMemoriesUsed, setInput]);

  const sendMessage = async (textOverride?: string) => {
    const text = (typeof textOverride === 'string' ? textOverride : input).trim();
    if (!text || loading) return;

    // 🔴 Cancel any currently active browser speech synthesis
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMsg]);
    setLatestAiMessageId(null); // Clear previous typing state immediately
    setInput('');
    setLoading(true);

    try {
      const isNewSession = !sessionId;

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, userId, sessionId }),
      });

      const data = await res.json();

      if (res.ok) {
        const newAiMsgId = (Date.now() + 1).toString();
        const aiMsg: Message = {
          id: newAiMsgId,
          role: 'assistant',
          content: data.reply,
          timestamp: new Date(),
          recalledMemories: data.recalledMemories, // Bind dynamic long-term graph database facts
        };
        setLatestAiMessageId(newAiMsgId);
        setMessages(prev => [...prev, aiMsg]);
        setMemoriesUsed(data.memoriesUsed || 0);

        if (isNewSession && data.sessionId) {
          skipHistoryFetchRef.current = true; // Block history fetch when initializing session
          setSessionId(data.sessionId);
          onSessionCreated();
        }
      } else {
        const errorMsg: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: `Error: ${data.error || 'Something went wrong'}`,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, errorMsg]);
      }
    } catch {
      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Failed to connect. Please check your internet connection.',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Auto-resize textarea
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 160) + 'px';
  };

  return (
    <div className="flex flex-col h-full bg-black relative">
      {/* ─── Minimal Top Bar ─── */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-[#151515] bg-black/80 backdrop-blur-xl z-10">
        <div className="flex items-center gap-2.5">
          {/* Sidebar Toggle */}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="w-8 h-8 rounded-lg bg-[#0f0f0f] border border-[#1f1f1f] flex items-center justify-center hover:bg-[#1a1a1a] hover:border-[#333333] text-neutral-500 hover:text-white transition-all"
            title={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
          >
            {sidebarOpen ? (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="9" y1="3" x2="9" y2="21"/><path d="M16 15l-3-3 3-3"/>
              </svg>
            ) : (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="9" y1="3" x2="9" y2="21"/><path d="M12 9l3 3-3 3"/>
              </svg>
            )}
          </button>

          {/* Status indicator */}
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[0.7rem] text-neutral-500 font-medium">
              {sessionId ? `Session ${sessionId.slice(0, 6)}` : 'New session'}
            </span>
          </div>
        </div>

        {/* Memory recall indicator */}
        {memoriesUsed > 0 && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#0f0f0f] border border-[#1f1f1f]">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#737373" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
            </svg>
            <span className="text-[0.65rem] text-neutral-500 font-mono">{memoriesUsed} nodes recalled</span>
          </div>
        )}
      </div>

      {/* ─── Messages Area (Centered, Scrollable) ─── */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[800px] mx-auto px-5 py-6 space-y-6">
          {historyLoading ? (
            <div className="flex flex-col items-center justify-center h-[60vh]">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-neutral-600 animate-pulse" />
                <div className="w-1.5 h-1.5 rounded-full bg-neutral-600 animate-pulse" style={{ animationDelay: '0.15s' }} />
                <div className="w-1.5 h-1.5 rounded-full bg-neutral-600 animate-pulse" style={{ animationDelay: '0.3s' }} />
              </div>
              <p className="text-[0.7rem] text-neutral-600 mt-3 font-mono">Loading conversation...</p>
            </div>
          ) : messages.length === 0 ? (
            /* ─── Empty State ─── */
            <div className="flex flex-col items-center justify-center h-[60vh] text-center">
              {/* Terminal-style logo */}
              <div className="w-16 h-16 rounded-2xl bg-[#0a0a0a] border border-[#1f1f1f] flex items-center justify-center mb-6">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                  <rect x="3" y="3" width="18" height="18" rx="4" stroke="#333333" strokeWidth="1.5" />
                  <path d="M7 10l3 2.5-3 2.5" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  <line x1="12" y1="15" x2="16" y2="15" stroke="#555555" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-white mb-1 tracking-tight">What can I help you with?</h2>
              <p className="text-neutral-600 text-[0.8rem] max-w-sm mb-8">
                I remember everything across all sessions. Every fact, preference, and detail — permanently stored in my knowledge graph.
              </p>

              {/* Suggestion chips */}
              <div className="flex flex-wrap justify-center gap-2 max-w-md">
                {[
                  'Remember my dog is named Milo',
                  'What do you know about me?',
                  'Tell me something interesting',
                  'Help me brainstorm',
                ].map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => {
                      setInput(suggestion);
                      setTimeout(() => inputRef.current?.focus(), 50);
                    }}
                    className="px-3.5 py-2 rounded-xl bg-[#0f0f0f] border border-[#1f1f1f] text-[0.75rem] text-neutral-400 hover:text-white hover:border-[#333333] hover:bg-[#141414] transition-all"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((msg) => (
              <MessageBubble
                key={msg.id}
                role={msg.role}
                content={msg.content}
                timestamp={msg.timestamp}
                isNew={msg.id === latestAiMessageId}
                recalledMemories={msg.recalledMemories}
                onTypingComplete={handleTypingComplete}
              />
            ))
          )}

          {/* ─── AI Thinking Indicator ─── */}
          {loading && (
            <div className="animate-fade-in-up w-full">
              <div className="max-w-[720px] mx-auto flex items-start gap-3.5">
                <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-[#0f0f0f] border border-[#2a2a2a] flex items-center justify-center">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <rect x="3" y="3" width="18" height="18" rx="4" stroke="#555555" strokeWidth="1.5" />
                    <path d="M7 10l3 2.5-3 2.5" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    <line x1="12" y1="15" x2="16" y2="15" stroke="#777777" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[0.7rem] font-semibold text-neutral-400 uppercase tracking-wider">Mindly</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-neutral-600 animate-pulse" />
                    <div className="w-1.5 h-1.5 rounded-full bg-neutral-600 animate-pulse" style={{ animationDelay: '0.15s' }} />
                    <div className="w-1.5 h-1.5 rounded-full bg-neutral-600 animate-pulse" style={{ animationDelay: '0.3s' }} />
                    <span className="text-[0.65rem] text-neutral-700 ml-2 font-mono">thinking...</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* ─── Floating Input Bar ─── */}
      <div className="border-t border-[#151515] bg-black/90 backdrop-blur-xl px-5 py-4">
        <div className="max-w-[800px] mx-auto">
          {activeInsight && (
            <InsightBanner
              insight={activeInsight}
              onAction={handleInsightAction}
              onDismiss={handleInsightDismiss}
            />
          )}
          <div className="flex items-end gap-3 bg-[#0c0c0c] border border-[#1f1f1f] rounded-2xl px-4 py-2.5 focus-within:border-[#333333] transition-colors">
            <textarea
              ref={inputRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Message Mindly..."
              rows={1}
              className="flex-1 resize-none bg-transparent text-[0.9rem] text-[#e5e5e5] placeholder-neutral-700 outline-none min-h-[28px] max-h-[160px] leading-relaxed py-0.5"
              disabled={loading || historyLoading}
            />

            {/* 🎙️ Whisper Voice Recorder Trigger */}
            <MicButton
              onTranscriptReceived={(text) => {
                setInput(text);
                // Automatically focus and auto-expand the input textarea for review
                setTimeout(() => {
                  if (inputRef.current) {
                    inputRef.current.focus();
                    inputRef.current.style.height = 'auto';
                    inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 160) + 'px';
                  }
                }, 50);
              }}
              isDisabled={loading || historyLoading}
            />

            <button
              onClick={() => sendMessage()}
              disabled={!input.trim() || loading || historyLoading}
              className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-all disabled:opacity-20 disabled:cursor-not-allowed bg-white hover:bg-neutral-200 text-black"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 19V5" /><path d="M5 12l7-7 7 7" />
              </svg>
            </button>
          </div>
          <p className="text-center text-[0.6rem] text-neutral-800 mt-2 font-mono">
            Mindly remembers everything · Knowledge graph powered
          </p>
        </div>
      </div>
    </div>
  );
}
