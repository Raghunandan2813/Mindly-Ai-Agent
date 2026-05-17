// components/MemoryPanel.tsx
// Beautiful monochrome memory vault explorer with search, filters, and delete.
'use client';
import React, { useState } from 'react';

export interface Memory {
  id: string;
  role: string;
  content: string;
  created_at: string;
  session_id: string;
}

interface MemoryPanelProps {
  memories: Memory[];
  onDelete: (id: string) => void;
  loading: boolean;
}

export default function MemoryPanel({ memories, onDelete, loading }: MemoryPanelProps) {
  const [search, setSearch] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);

  const filtered = memories.filter(m =>
    m.content.toLowerCase().includes(search.toLowerCase())
  );

  // Group memories by date
  const grouped = filtered.reduce<Record<string, Memory[]>>((acc, m) => {
    const date = new Date(m.created_at).toLocaleDateString('en-IN', {
      day: 'numeric', month: 'long', year: 'numeric'
    });
    if (!acc[date]) acc[date] = [];
    acc[date].push(m);
    return acc;
  }, {});

  const handleDelete = async (id: string) => {
    setDeleting(id);
    await onDelete(id);
    setDeleting(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="typing-indicator flex items-center gap-1">
          <span /><span /><span />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 bg-black text-[#f5f5f5]">
      {/* Search */}
      <div className="relative">
        <svg className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
        </svg>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search your memories..."
          className="input-dark pl-11"
        />
      </div>

      {/* Stats bar */}
      <div className="flex items-center gap-4 text-xs text-[var(--text-muted)]">
        <span className="memory-pill">{memories.length} total memories</span>
        {search && <span className="memory-pill">{filtered.length} matching</span>}
      </div>

      {/* Empty state */}
      {filtered.length === 0 && (
        <div className="text-center py-16">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] flex items-center justify-center">
            <span className="text-3xl opacity-40">🧠</span>
          </div>
          <p className="text-[var(--text-muted)] text-sm">
            {search ? 'No memories match your search' : 'No memories yet — start chatting to build your memory vault'}
          </p>
        </div>
      )}

      {/* Memory list grouped by date */}
      {Object.entries(grouped).map(([date, items]) => (
        <div key={date}>
          <h3 className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider mb-3 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-white" />
            {date}
          </h3>
          <div className="space-y-2">
            {items.map((m, idx) => (
              <div
                key={m.id}
                className="glass-card glass-card-hover px-4 py-3 flex items-start justify-between gap-3 animate-fade-in-up"
                style={{ animationDelay: `${idx * 0.03}s` }}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[var(--text-primary)] leading-relaxed break-words">
                    {m.content}
                  </p>
                  <div className="flex items-center gap-3 mt-2">
                    <span className="text-[10px] text-[var(--text-muted)]">
                      {new Date(m.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--bg-input)] text-[var(--text-muted)] border border-[var(--border)]">
                      {m.session_id?.slice(0, 8)}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(m.id)}
                  disabled={deleting === m.id}
                  className="flex-shrink-0 p-1.5 rounded-lg hover:bg-white/10 text-[var(--text-muted)] hover:text-white transition-colors"
                  title="Delete memory"
                >
                  {deleting === m.id ? (
                    <span className="text-xs">...</span>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                    </svg>
                  )}
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
