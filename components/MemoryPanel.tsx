// components/MemoryPanel.tsx
// Monochrome memory vault: displays knowledge graph nodes with type badges and connection counts.
'use client';
import React, { useState } from 'react';

export interface MemoryNode {
  id: string;
  label: string;
  node_type: string;
  content: string;
  created_at: string;
  metadata?: Record<string, any>;
}

export interface MemoryEdge {
  id: string;
  source_id: string;
  target_id: string;
  relation: string;
  strength: number;
}

interface MemoryPanelProps {
  nodes: MemoryNode[];
  edges: MemoryEdge[];
  onDelete: (id: string) => void;
  loading: boolean;
}

// Node type → icon mapping
const TYPE_ICONS: Record<string, string> = {
  person: '👤',
  pet: '🐾',
  preference: '⭐',
  fact: '📌',
  skill: '⚡',
  location: '📍',
  attribute: '🏷️',
};

export default function MemoryPanel({ nodes, edges, onDelete, loading }: MemoryPanelProps) {
  const [search, setSearch] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string | null>(null);

  const filtered = nodes.filter(n => {
    const matchesSearch = n.label.toLowerCase().includes(search.toLowerCase()) ||
      n.content.toLowerCase().includes(search.toLowerCase());
    const matchesType = !filterType || n.node_type === filterType;
    return matchesSearch && matchesType;
  });

  // Get unique node types for filter buttons
  const nodeTypes = [...new Set(nodes.map(n => n.node_type))];

  // Count connections for each node
  const connectionCount = (nodeId: string) =>
    edges.filter(e => e.source_id === nodeId || e.target_id === nodeId).length;

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
    <div className="space-y-6 bg-[var(--bg-primary)] text-[var(--text-primary)]">
      {/* Search */}
      <div className="relative">
        <svg className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
        </svg>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search your knowledge graph..."
          className="input-dark pl-11"
        />
      </div>

      {/* Stats + type filters */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="memory-pill">{nodes.length} nodes</span>
        <span className="memory-pill">{edges.length} connections</span>
        <div className="w-px h-4 bg-[var(--border)] mx-1" />
        <button
          onClick={() => setFilterType(null)}
          className={`px-2 py-1 rounded-lg transition-colors ${
            !filterType ? 'bg-[var(--text-primary)] text-[var(--bg-primary)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-input)]'
          }`}
        >
          All
        </button>
        {nodeTypes.map(type => (
          <button
            key={type}
            onClick={() => setFilterType(filterType === type ? null : type)}
            className={`px-2 py-1 rounded-lg transition-colors flex items-center gap-1 ${
              filterType === type ? 'bg-[var(--text-primary)] text-[var(--bg-primary)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-input)]'
            }`}
          >
            <span>{TYPE_ICONS[type] || '📄'}</span>
            {type}
          </button>
        ))}
      </div>

      {/* Empty state */}
      {filtered.length === 0 && (
        <div className="text-center py-16">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border)] flex items-center justify-center">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="2" y="2" width="20" height="20" rx="5" fill="var(--bg-primary)" stroke="var(--border)" strokeWidth="1.2" />
              <path d="M6 8l3 3-3 3" stroke="var(--text-primary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              <line x1="10" y1="14" x2="14" y2="14" stroke="var(--text-secondary)" strokeWidth="1.5" />
            </svg>
          </div>
          <p className="text-[var(--text-muted)] text-sm">
            {search ? 'No nodes match your search' : 'No memory nodes yet — start chatting to build your knowledge graph'}
          </p>
        </div>
      )}

      {/* Node list */}
      <div className="space-y-2">
        {filtered.map((node, idx) => {
          const connections = connectionCount(node.id);
          const connectedEdges = edges.filter(
            e => e.source_id === node.id || e.target_id === node.id
          );

          return (
            <div
              key={node.id}
              className="glass-card glass-card-hover px-4 py-3 animate-fade-in-up bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl"
              style={{ animationDelay: `${idx * 0.03}s` }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  {/* Node header */}
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-sm">{TYPE_ICONS[node.node_type] || '📄'}</span>
                    <span className="text-sm font-semibold text-[var(--text-primary)]">{node.label}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-secondary)] uppercase tracking-wider">
                      {node.node_type}
                    </span>
                    {connections > 0 && (
                      <span className="text-[10px] text-[var(--text-muted)]">
                        {connections} link{connections !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>

                  {/* Node content */}
                  <p className="text-xs text-[var(--text-secondary)] leading-relaxed break-words">
                    {node.content}
                  </p>

                  {/* Connected relations */}
                  {connectedEdges.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {connectedEdges.slice(0, 5).map(edge => (
                        <span
                          key={edge.id}
                          className="text-[9px] px-1.5 py-0.5 rounded bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-muted)]"
                        >
                          {edge.relation}
                        </span>
                      ))}
                      {connectedEdges.length > 5 && (
                        <span className="text-[9px] text-[var(--text-muted)]">+{connectedEdges.length - 5} more</span>
                      )}
                    </div>
                  )}

                  {/* Timestamp */}
                  <div className="mt-2">
                    <span className="text-[10px] text-[var(--text-muted)]">
                      {new Date(node.created_at).toLocaleDateString('en-IN', {
                        day: 'numeric', month: 'short', year: 'numeric',
                      })}
                    </span>
                  </div>
                </div>

                {/* Delete button */}
                {node.label !== 'user' && (
                  <button
                    onClick={() => handleDelete(node.id)}
                    disabled={deleting === node.id}
                    className="flex-shrink-0 p-1.5 rounded-lg hover:bg-white/10 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                    title="Delete node"
                  >
                    {deleting === node.id ? (
                      <span className="text-xs">...</span>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                      </svg>
                    )}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
