// components/MessageBubble.tsx
// Renders a single chat message with monochrome minimalist styling and slide-in animation.
'use client';
import React from 'react';

interface MessageBubbleProps {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: Date;
}

export default function MessageBubble({ role, content, timestamp }: MessageBubbleProps) {
  const isUser = role === 'user';

  return (
    <div
      className={`flex w-full animate-fade-in-up ${isUser ? 'justify-end' : 'justify-start'}`}
      style={{ animationDelay: '0.05s' }}
    >
      <div className={`flex items-start gap-3 max-w-[80%] ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
        {/* Avatar */}
        <div
          className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border ${
            isUser
              ? 'bg-neutral-900 border-neutral-800 text-neutral-300'
              : 'bg-white border-neutral-200 text-black'
          }`}
        >
          {isUser ? 'U' : 'AI'}
        </div>

        {/* Bubble */}
        <div
          className={`px-4 py-3 rounded-2xl text-[0.93rem] leading-relaxed border ${
            isUser
              ? 'bg-neutral-900 border-neutral-800 text-white rounded-tr-md'
              : 'glass-card border-[#222222] text-[var(--text-primary)] rounded-tl-md'
          }`}
        >
          <p className="whitespace-pre-wrap break-words">{content}</p>
          {timestamp && (
            <p className={`text-[0.7rem] mt-2 ${isUser ? 'text-neutral-400' : 'text-[var(--text-muted)]'}`}>
              {timestamp.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
