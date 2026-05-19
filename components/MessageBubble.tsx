// components/MessageBubble.tsx
// Premium AI Agent message rendering — full-width blocks with code syntax highlighting and memory consoles.
'use client';
import React, { useState, useEffect, useRef } from 'react';

interface MessageBubbleProps {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: Date;
  isNew?: boolean;
  recalledMemories?: string; // Transparent Developer under-the-hood context
  onTypingComplete?: () => void;
}

export default function MessageBubble({
  role,
  content,
  timestamp,
  isNew = false,
  recalledMemories,
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
          <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-[#0f0f0f] border border-[#2a2a2a] flex items-center justify-center mt-0.5 animate-pulse">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <rect x="3" y="3" width="18" height="18" rx="4" stroke="#737373" strokeWidth="1.5" />
              <path d="M7 10l3 2.5-3 2.5" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              <line x1="12" y1="15" x2="16" y2="15" stroke="#a3a3a3" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>

          {/* Response content */}
          <div className="flex-1 min-w-0">
            {/* Agent label */}
            <div className="flex items-center justify-between mb-1.5 select-none">
              <div className="flex items-center gap-2">
                <span className="text-[0.7rem] font-semibold text-neutral-400 uppercase tracking-wider">Mindly AI</span>
                {timestamp && (
                  <span className="text-[0.6rem] text-neutral-700 font-mono">
                    {timestamp.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </div>
            </div>

            {/* Response text with typing cursor indicator */}
            <div className="text-[0.9rem] text-[#d4d4d4] leading-[1.75] whitespace-pre-wrap break-words">
              {formatAIResponse(displayedText)}
              {isTyping && (
                <span className="inline-block w-1.5 h-3.5 ml-1 bg-neutral-400 align-middle animate-pulse" />
              )}
            </div>

            {/* Expandable Memory Console (Injected Context transparency logs) */}
            {recalledMemories && (
              <div className="mt-4 max-w-full">
                <details className="group/inspect bg-[#080808]/50 border border-[#141414] rounded-xl overflow-hidden transition-all duration-300">
                  <summary className="flex items-center justify-between px-3.5 py-2.5 text-[0.7rem] font-mono text-neutral-500 hover:text-white cursor-pointer select-none">
                    <div className="flex items-center gap-2">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-neutral-600 group-open/inspect:rotate-90 transition-transform duration-200">
                        <polyline points="9 18 15 12 9 6"/>
                      </svg>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-neutral-600">
                        <polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/>
                      </svg>
                      <span className="font-semibold text-neutral-400 group-open/inspect:text-white">SYS_MEM // Context Log</span>
                    </div>
                    <span className="text-[0.6rem] text-neutral-600 font-bold group-open/inspect:hidden">click to inspect</span>
                    <span className="text-[0.6rem] text-emerald-500 font-bold hidden group-open/inspect:inline">active recalled nodes</span>
                  </summary>
                  <div className="px-4 py-3 bg-[#030303] border-t border-[#121212] font-mono text-[0.72rem] text-neutral-400 leading-relaxed overflow-x-auto whitespace-pre-wrap max-h-60 overflow-y-auto">
                    {recalledMemories}
                  </div>
                </details>
              </div>
            )}
          </div>
        </div>

        {/* Subtle divider */}
        <div className="mt-5 border-b border-[#151515]" />
      </div>
    </div>
  );
}

// ============================================================
// Custom Markdown CodeBlock and Regex Tokenizer components
// ============================================================

interface Token {
  text: string;
  type: string;
}

function tokenize(code: string, language: string): Token[] {
  const lang = language.toLowerCase();
  let masterRegex;
  
  // Categorize languages by their structural comment delimiters and keywords
  const hashCommentLangs = ['py', 'python', 'bash', 'sh', 'shell', 'zsh', 'yaml', 'yml', 'toml', 'dockerfile', 'docker', 'r', 'perl', 'pl'];
  const sqlLangs = ['sql', 'psql', 'mysql', 'sqlite'];

  if (hashCommentLangs.includes(lang)) {
    // 1. Languages using '#' comments (Python, Shell scripts, YAML config, Dockerfiles, etc.)
    masterRegex = /(#.*)|("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')|(\b(?:def|class|return|import|from|as|if|else|elif|for|while|in|is|not|and|or|try|except|with|print|True|False|None|sudo|echo|cd|ls|mkdir|rm|cp|mv|chmod|chown|grep|awk|sed|curl|wget|tar|zip|unzip|git|npm|pip|docker|run|cmd|entrypoint|expose|env|copy|add|volume|user|workdir|from)\b)|(\b\d+(?:\.\d+)?\b)|(\b[a-zA-Z_]\w*(?=\s*\())/g;
  } else if (sqlLangs.includes(lang)) {
    // 2. SQL database languages (using '--' comments)
    masterRegex = /(--.*)|('(?:\\.|[^'\\])*')|(\b(?:SELECT|FROM|WHERE|INSERT|INTO|UPDATE|SET|DELETE|CREATE|TABLE|JOIN|ON|AND|OR|GROUP|BY|ORDER|LIMIT|RETURNING|LEFT|RIGHT|INNER|OUTER|AS|DEFAULT|NULL|TRUE|FALSE|TEXT|INTEGER|TIMESTAMP|UUID|VECTOR)\b)/gi;
  } else {
    // 3. C-Style languages (JS, TS, Java, C++, C#, C, Go, Rust, PHP, Swift, Kotlin, Dart) + Universal Fallback
    // This guarantees that even if the AI outputs code in an unspecified language, they still get beautiful highlighted blocks!
    masterRegex = /(\/\/.*|\/\*[\s\S]*?\*\/)|("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`)|(\b(?:const|let|var|function|return|import|export|from|class|extends|if|else|for|while|new|this|async|await|try|catch|true|false|null|undefined|interface|type|public|private|static|readonly|string|number|boolean|any|void|struct|fn|func|int|float|double|char|bool|namespace|using|impl|pub|mut|use)\b)|(\b\d+(?:\.\d+)?\b)|(\b[a-zA-Z_]\w*(?=\s*\())/g;
  }

  const tokens: Token[] = [];
  let lastIndex = 0;
  let match;

  while ((match = masterRegex.exec(code)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({ text: code.slice(lastIndex, match.index), type: 'plain' });
    }

    if (match[1]) {
      tokens.push({ text: match[0], type: 'comment' });
    } else if (match[2]) {
      tokens.push({ text: match[0], type: 'string' });
    } else if (match[3]) {
      tokens.push({ text: match[0], type: 'keyword' });
    } else if (match[4]) {
      tokens.push({ text: match[0], type: 'number' });
    } else if (match[5]) {
      tokens.push({ text: match[0], type: 'function' });
    }

    lastIndex = masterRegex.lastIndex;
  }

  if (lastIndex < code.length) {
    tokens.push({ text: code.slice(lastIndex), type: 'plain' });
  }

  return tokens;
}

function CodeBlock({ code, language }: { code: string; language: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const tokens = tokenize(code, language);

  return (
    <div className="my-4 rounded-xl bg-[#030303] border border-[#1a1a1a] overflow-hidden group/code relative">
      {/* Code Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-[#080808] border-b border-[#141414] select-none">
        <span className="text-[0.62rem] font-bold text-neutral-500 font-mono tracking-wider uppercase">
          {language || 'code'}
        </span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#0f0f0f] border border-[#1f1f1f] text-[0.65rem] text-neutral-400 hover:text-white hover:border-[#333333] hover:bg-[#141414] transition-all cursor-pointer font-mono"
        >
          {copied ? (
            <>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              <span className="text-emerald-500 font-medium">Copied!</span>
            </>
          ) : (
            <>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
              </svg>
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      {/* Token Code Area */}
      <pre className="p-4 text-[0.82rem] text-[#cccccc] font-mono overflow-x-auto leading-relaxed whitespace-pre bg-transparent scrollbar-thin">
        <code>
          {tokens.map((token, i) => {
            if (token.type === 'comment') {
              return <span key={i} className="text-neutral-600 italic">{token.text}</span>;
            }
            if (token.type === 'string') {
              return <span key={i} className="text-emerald-400">{token.text}</span>;
            }
            if (token.type === 'keyword') {
              return <span key={i} className="text-sky-400 font-semibold">{token.text}</span>;
            }
            if (token.type === 'number') {
              return <span key={i} className="text-amber-400">{token.text}</span>;
            }
            if (token.type === 'function') {
              return <span key={i} className="text-yellow-200">{token.text}</span>;
            }
            return <span key={i}>{token.text}</span>;
          })}
        </code>
      </pre>
    </div>
  );
}

/**
 * Custom Markdown and formatting parser.
 * Perfectly splits code blocks, bold strings, and inline monospace phrases.
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

    // High-fidelity Syntax Highlighter Code Block
    parts.push(
      <CodeBlock
        key={`code-${match.index}`}
        code={match[2].trim()}
        language={match[1] || 'code'}
      />
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
          className="px-1.5 py-0.5 rounded bg-[#161616] border border-[#262626] text-[0.82rem] text-neutral-300 font-mono"
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
