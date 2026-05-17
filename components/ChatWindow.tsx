// components/ChatWindow.tsx
// Chat feed and input box. Dynamically loads message history when a sessionId is selected.
'use client';
import React, { useState, useRef, useEffect } from 'react';
import MessageBubble from './MessageBubble';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface ChatWindowProps {
  userId: string;
  sessionId: string | null;
  setSessionId: (id: string | null) => void;
  onSessionCreated: () => void;
}

export default function ChatWindow({ userId, sessionId, setSessionId, onSessionCreated }: ChatWindowProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [memoriesUsed, setMemoriesUsed] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Scroll to bottom whenever messages list changes
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Load message history when sessionId changes
  useEffect(() => {
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

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMsg]);
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
        const aiMsg: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: data.reply,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, aiMsg]);
        setMemoriesUsed(data.memoriesUsed || 0);

        if (isNewSession && data.sessionId) {
          // Update active session and refresh sidebar list
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

  return (
    <div className="flex flex-col h-full bg-[var(--bg-primary)]">
      {/* Header Bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)] bg-[var(--bg-secondary)]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#141414] border border-[#222222] flex items-center justify-center">
            <span className="text-white text-lg">🧠</span>
          </div>
          <div>
            <h1 className="text-lg font-semibold text-[var(--text-primary)]">
              {sessionId ? 'Active Session' : 'New Conversation'}
            </h1>
            <p className="text-xs text-[var(--text-muted)]">
              {sessionId ? `ID: ${sessionId.slice(0, 8)}...` : 'Ask me anything to start a session'}
            </p>
          </div>
        </div>
        {memoriesUsed > 0 && (
          <div className="memory-pill animate-slide-in">
            <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
            {memoriesUsed} memories recalled
          </div>
        )}
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
        {historyLoading ? (
          <div className="flex flex-col items-center justify-center h-full">
            <div className="typing-indicator flex items-center gap-1">
              <span /><span /><span />
            </div>
            <p className="text-xs text-[var(--text-muted)] mt-2">Retrieving conversation history...</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center gap-4">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-white/5 to-neutral-900/5 flex items-center justify-center border border-[var(--border)]">
              <span className="text-4xl">🧠</span>
            </div>
            <h2 className="text-xl font-semibold gradient-text">Start a Conversation</h2>
            <p className="text-[var(--text-muted)] text-sm max-w-md leading-relaxed">
              I remember everything across all our sessions. Start a new conversation and ask me questions to see how my semantic memory pulls answers across history!
            </p>
            <div className="flex flex-wrap justify-center gap-2 mt-2">
              {['Remember my dog is named Milo', 'What do you remember about me?', 'Tell me a riddle'].map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => setInput(suggestion)}
                  className="btn-ghost text-xs px-3 py-2"
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
            />
          ))
        )}

        {/* Typing indicator */}
        {loading && (
          <div className="flex items-start gap-3 animate-fade-in-up">
            <div className="w-8 h-8 rounded-full bg-white text-black border border-[#222222] flex items-center justify-center text-xs font-extrabold flex-shrink-0">
              AI
            </div>
            <div className="glass-card px-4 py-3 rounded-2xl rounded-tl-md">
              <div className="typing-indicator flex items-center gap-1">
                <span /><span /><span />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="px-6 py-4 border-t border-[var(--border)] bg-[var(--bg-secondary)]">
        <div className="flex items-end gap-3">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask me anything... I'll remember it forever"
            rows={1}
            className="input-dark flex-1 resize-none min-h-[48px] max-h-[120px]"
            style={{ lineHeight: '1.5' }}
            disabled={loading || historyLoading}
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || loading || historyLoading}
            className="btn-primary h-[48px] px-5 flex items-center gap-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m22 2-7 20-4-9-9-4 20-7z" />
              <path d="M22 2 11 13" />
            </svg>
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
