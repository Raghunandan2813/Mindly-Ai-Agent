// app/memories/page.tsx
// Memory Vault: view knowledge graph as a list or interactive graph visualization.
'use client';
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import MemoryPanel from '@/components/MemoryPanel';
import MemoryGraph from '@/components/MemoryGraph';

interface MemoryNode {
  id: string;
  label: string;
  node_type: string;
  content: string;
  created_at: string;
  metadata?: Record<string, any>;
}

interface MemoryEdge {
  id: string;
  source_id: string;
  target_id: string;
  relation: string;
  strength: number;
}

export default function MemoriesPage() {
  const [nodes, setNodes] = useState<MemoryNode[]>([]);
  const [edges, setEdges] = useState<MemoryEdge[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [view, setView] = useState<'list' | 'graph'>('list');
  const router = useRouter();

  useEffect(() => {
    fetch('/api/auth/me')
      .then(res => res.json())
      .then(data => {
        if (!data.userId) { router.push('/login'); return; }
        setUserId(data.userId);
        return fetch(`/api/memories?userId=${data.userId}`);
      })
      .then(res => res?.json())
      .then(data => {
        if (data?.nodes) setNodes(data.nodes);
        if (data?.edges) setEdges(data.edges);
      })
      .catch(() => router.push('/login'))
      .finally(() => setLoading(false));
  }, [router]);

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/memories?id=${id}&userId=${userId}`, { method: 'DELETE' });
    if (res.ok) {
      setNodes(prev => prev.filter(n => n.id !== id));
      setEdges(prev => prev.filter(e => e.source_id !== id && e.target_id !== id));
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-black">
      {/* Header */}
      <nav className="flex items-center justify-between px-4 sm:px-6 py-3.5 border-b border-[#222222] bg-[#0c0c0c]">
        <div className="flex items-center">
          <a href="/" className="btn-ghost text-xs px-2.5 py-1.5 sm:px-3 sm:py-2">
            ← Back<span className="hidden sm:inline"> to Chat</span>
          </a>
        </div>
        <h1 className="text-sm sm:text-base font-semibold text-white tracking-tight">Memory Vault</h1>
        
        {/* View Toggle */}
        <div className="flex items-center gap-0.5 bg-[#141414] rounded-lg p-0.5 border border-[#222222]">
          <button
            onClick={() => setView('list')}
            className={`px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-md text-xs font-medium transition-all ${
              view === 'list' ? 'bg-white text-black' : 'text-neutral-400 hover:text-white'
            }`}
          >
            List
          </button>
          <button
            onClick={() => setView('graph')}
            className={`px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-md text-xs font-medium transition-all ${
              view === 'graph' ? 'bg-white text-black' : 'text-neutral-400 hover:text-white'
            }`}
          >
            Graph
          </button>
        </div>
      </nav>

      {/* Content */}
      {view === 'list' ? (
        <div className="flex-1 max-w-3xl w-full mx-auto px-6 py-8">
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-white tracking-tight">Knowledge Graph</h2>
            <p className="text-neutral-500 text-sm mt-1">Entities, facts, and relationships extracted from your conversations</p>
          </div>
          <MemoryPanel nodes={nodes} edges={edges} onDelete={handleDelete} loading={loading} />
        </div>
      ) : (
        <div className="flex-1 p-4">
          <div className="mb-4">
            <h2 className="text-xl font-bold text-white tracking-tight">Neural Memory Map</h2>
            <p className="text-neutral-500 text-xs mt-1">Click nodes to inspect • Drag to reposition • Connections show relationships</p>
          </div>
          <div className="h-[calc(100vh-160px)]">
            <MemoryGraph nodes={nodes} edges={edges} onDeleteNode={handleDelete} />
          </div>
        </div>
      )}
    </div>
  );
}
