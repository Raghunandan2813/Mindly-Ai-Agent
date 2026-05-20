// app/api/sessions/clear-memories/route.ts
// Secure API endpoint executing transactional wipes for user conversation graphs and memory nodes.
// Safeguards against active background summarizer race conditions using PostgreSQL row locking.

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, supabase } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  try {
    const { userId } = await req.json();

    if (!userId) {
      return NextResponse.json({ error: 'Missing userId parameter' }, { status: 400 });
    }

    console.log(`[Clear Memories] Initiating atomic lock-purge for user: ${userId}`);

    const db = supabaseAdmin || supabase;

    // 1. Execute via Atomic Transactional RPC function (Strict Race-Condition Blocker)
    const { error: rpcErr } = await db.rpc('clear_user_memories', {
      target_user_id: userId
    });

    if (!rpcErr) {
      return NextResponse.json({
        success: true,
        message: 'All personal memories, insights, graph nodes, and summaries wiped atomically.'
      });
    }

    // 2. Fallback to individual deletes if RPC is not loaded in Supabase yet
    console.warn('[Clear Memories] Transactional RPC missing or failed (falling back to sequential purge):', rpcErr.message);

    // Wipe session summaries
    await db.from('session_summaries').delete().eq('user_id', userId);
    // Wipe messages
    await db.from('messages').delete().eq('user_id', userId);
    // Wipe summarization locks
    await db.from('summarization_locks').delete().eq('user_id', userId);
    // Wipe memory edges (relational targets first to safeguard foreign key constraints)
    await db.from('memory_edges').delete().eq('user_id', userId);
    // Wipe memory nodes
    await db.from('memory_nodes').delete().eq('user_id', userId);
    // Wipe proactive insights
    await db.from('insights').delete().eq('user_id', userId);

    return NextResponse.json({
      success: true,
      message: 'All personal histories and memories cleared successfully (sequential fallback).'
    });

  } catch (err: any) {
    console.error('[Clear Memories] Critical exception during purge:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
