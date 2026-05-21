// app/api/auth/stats/route.ts
// GET: Fetch counts of all memories stored for the active user context in Supabase.

import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase';

export async function GET() {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized user context' }, { status: 401 });
  }

  try {
    // Count Memory Nodes (distilled facts)
    const { count: nodesCount, error: nodesErr } = await supabase
      .from('memory_nodes')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);

    // Count Session Summaries
    const { count: summariesCount, error: summariesErr } = await supabase
      .from('session_summaries')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);

    // Count Raw Messages
    const { count: messagesCount, error: messagesErr } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);

    if (nodesErr || summariesErr || messagesErr) {
      console.error('[Stats API] DB count error:', { nodesErr, summariesErr, messagesErr });
    }

    return NextResponse.json({
      success: true,
      nodesCount: nodesCount || 0,
      summariesCount: summariesCount || 0,
      messagesCount: messagesCount || 0,
      totalMemories: (nodesCount || 0) + (summariesCount || 0)
    });

  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Stats retrieval failed' }, { status: 500 });
  }
}
