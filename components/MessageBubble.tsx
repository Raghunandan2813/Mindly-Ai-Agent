// components/MessageBubble.tsx
// Premium AI Agent message rendering — full-width blocks with word-by-word typing effect.
'use client';
import React, { useState, useEffect, useRef } from 'react';

interface MessageBubbleProps {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: Date;
  isNew?: boolean;
  onTypingComplete?: () => void;
}

export default function MessageBubble({
  role,
  content,
  timestamp,
  isNew = false,
  onTypingComplete,
}: MessageBubbleProps) {
  const isUser = role === 'user';
  
  // Set initial state: empty string if it's a new assistant message that needs to type, full content otherwise
  const [displayedText, setDisplayedText] = useState(isUser || !isNew ? content : '');
  const [isTyping, setIsTyping] = useState(!isUser && isNew);
  const typingTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Word-by-word typewriter effect for new AI responses
  useEffect(() => {
    if (isUser || !isNew) {
      setDisplayedText(content);
      setIsTyping(false);
      return;
    }

    setIsTyping(true);
    const words = content.split(/(\s+)/); // Keep spaces for perfect spacing
    let currentWordIndex = 0;
    let accumulatedText = '';

    setDisplayedText('');

    const typeWord = () => {
      if (currentWordIndex < words.length) {
        accumulatedText += words[currentWordIndex];
        setDisplayedText(accumulatedText);
        currentWordIndex++;
        
        // Trigger scroll down callback while typing
        if (onTypingComplete) {
          onTypingComplete();
        }

        // Dynamic timing: faster for long text, slower for short text (averages 25ms per word)
        const delay = words.length > 100 ? 12 : 25;
        typingTimerRef.current = setTimeout(typeWord, delay);
      } else {
        setIsTyping(false);
        if (onTypingComplete) {
          onTypingComplete();
        }
      }
    };

    typeWord();

    return () => {
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content, isUser, isNew]); 
  // We explicitly exclude onTypingComplete from dependencies to prevent function-reference re-runs!

  if (isUser) {
    // ─── User message: clean, minimal, right-aligned prompt ───
    return (
      <div className="animate-fade-in-up flex justify-end w-full" style={{ animationDelay: '0.03s' }}>
        <div className="max-w-[720px] w-full flex justify-end">
          <div className="max-w-[85%] px-5 py-3.5 rounded-2xl rounded-br-md bg-[#1a1a1a] border border-[#2a2a2a]">
            <p className="text-[0.9rem] text-[#e5e5e5] leading-relaxed whitespace-pre-wrap break-words">
              {content}
            </p>
            {timestamp && (
              <p className="text-[0.65rem] text-neutral-600 mt-2 text-right font-mono">
                {timestamp.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ─── AI Response: full-width structured block with accent bar ───
  return (
    <div className="animate-fade-in-up w-full" style={{ animationDelay: '0.05s' }}>
      <div className="max-w-[720px] mx-auto">
        <div className="flex items-start gap-3.5">
          {/* AI Avatar */}
          <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-[#0f0f0f] border border-[#2a2a2a] flex items-center justify-center mt-0.5">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <rect x="3" y="3" width="18" height="18" rx="4" stroke="#555555" strokeWidth="1.5" />
              <path d="M7 10l3 2.5-3 2.5" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              <line x1="12" y1="15" x2="16" y2="15" stroke="#777777" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>

          {/* Response content */}
          <div className="flex-1 min-w-0">
            {/* Agent label */}
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-[0.7rem] font-semibold text-neutral-400 uppercase tracking-wider">Mindly</span>
              {timestamp && (
                <span className="text-[0.6rem] text-neutral-700 font-mono">
                  {timestamp.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </div>

            {/* Response text with typing cursor indicator */}
            <div className="text-[0.9rem] text-[#d4d4d4] leading-[1.75] whitespace-pre-wrap break-words">
              {formatAIResponse(displayedText)}
              {isTyping && (
                <span className="inline-block w-1.5 h-3.5 ml-1 bg-neutral-400 animate-pulse align-middle" />
              )}
            </div>
          </div>
        </div>

        {/* Subtle divider */}
        <div className="mt-5 border-b border-[#151515]" />
      </div>
    </div>
  );
}

/**
 * Lightweight formatter: handles bold (**text**), inline code (`code`),
 * and code blocks (```code```) without a full markdown library.
 */
function formatAIResponse(text: string): React.ReactNode {
  // Split by code blocks first
  const codeBlockRegex = /```(\w*)\n?([\s\S]*?)```/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;

  const processed = text;
  const regex = new RegExp(codeBlockRegex);

  while ((match = regex.exec(processed)) !== null) {
    // Text before code block
    if (match.index > lastIndex) {
      parts.push(
        <span key={`text-${lastIndex}`}>
          {formatInlineText(processed.slice(lastIndex, match.index))}
        </span>
      );
    }

    // Code block
    parts.push(
      <pre
        key={`code-${match.index}`}
        className="my-3 px-4 py-3 rounded-lg bg-[#0a0a0a] border border-[#1f1f1f] text-[0.8rem] text-[#b0b0b0] font-mono overflow-x-auto"
      >
        {match[1] && (
          <div className="text-[0.6rem] text-neutral-600 uppercase tracking-wider mb-2">{match[1]}</div>
        )}
        <code>{match[2].trim()}</code>
      </pre>
    );

    lastIndex = match.index + match[0].length;
  }

  // Remaining text after last code block
  if (lastIndex < processed.length) {
    parts.push(
      <span key={`text-${lastIndex}`}>
        {formatInlineText(processed.slice(lastIndex))}
      </span>
    );
  }

  return parts.length > 0 ? parts : formatInlineText(text);
}

function formatInlineText(text: string): React.ReactNode {
  // Handle **bold** and `inline code`
  const inlineRegex = /(\*\*(.+?)\*\*|`(.+?)`)/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;

  while ((match = inlineRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    if (match[2]) {
      // Bold text
      parts.push(
        <strong key={match.index} className="text-white font-semibold">{match[2]}</strong>
      );
    } else if (match[3]) {
      // Inline code
      parts.push(
        <code
          key={match.index}
          className="px-1.5 py-0.5 rounded bg-[#1a1a1a] border border-[#2a2a2a] text-[0.82rem] text-neutral-300 font-mono"
        >
          {match[3]}
        </code>
      );
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : text;
}
