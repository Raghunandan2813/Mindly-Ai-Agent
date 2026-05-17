'use client';
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import MemoryPanel, { Memory } from '@/components/MemoryPanel';

export default function MemoriesPage() {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
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
      .then(data => { if (data?.memories) setMemories(data.memories); })
      .catch(() => router.push('/login'))
      .finally(() => setLoading(false));
  }, [router]);

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/memories?id=${id}&userId=${userId}`, { method: 'DELETE' });
    if (res.ok) setMemories(prev => prev.filter(m => m.id !== id));
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <nav className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)] bg-[var(--bg-secondary)]">
        <div className="flex items-center gap-3">
          <a href="/" className="btn-ghost text-xs px-3 py-2">← Back to Chat</a>
        </div>
        <h1 className="text-base font-semibold text-[var(--text-primary)]">Memory Vault</h1>
        <div className="w-24" />
      </nav>

      {/* Content */}
      <div className="flex-1 max-w-3xl w-full mx-auto px-6 py-8">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-white tracking-tight">Your Memories</h2>
          <p className="text-[var(--text-muted)] text-sm mt-1">Everything the AI remembers about your conversations</p>
        </div>
        <MemoryPanel memories={memories} onDelete={handleDelete} loading={loading} />
      </div>
    </div>
  );
}
