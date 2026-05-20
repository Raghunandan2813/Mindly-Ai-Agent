// app/api/sessions/last-summary/route.ts
// API endpoint to retrieve or on-the-fly generate the most recent session summary for a user.

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, supabase } from '@/lib/supabase';

const db = supabaseAdmin || supabase;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');
    const currentSessionId = searchParams.get('currentSessionId');

    if (!userId) {
      return NextResponse.json({ error: 'Missing userId parameter' }, { status: 400 });
    }

    // 1. Identify the user's most recent session that is DIFFERENT from the current session
    let query = db
      .from('messages')
      .select('session_id')
      .eq('user_id', userId);

    if (currentSessionId) {
      query = query.neq('session_id', currentSessionId);
    }

    const { data: lastMsg, error: msgError } = await query
      .order('created_at', { ascending: false })
      .limit(1);

    if (msgError) {
      console.error('[API Last-Summary] Failed to find last message:', msgError.message);
      return NextResponse.json({ error: msgError.message }, { status: 500 });
    }

    if (lastMsg && lastMsg.length > 0 && lastMsg[0].session_id) {
      const prevSessionId = lastMsg[0].session_id;

      // 2. Safely resolve or generate summary using the distributed lock-protected summarizer
      const { summarizeSession } = await import('@/lib/summarization/process');
      const resolvedSummary = await summarizeSession(userId, prevSessionId);
      if (resolvedSummary) {
        return NextResponse.json({ summary: resolvedSummary });
      }
    }

    // 4. Fallback: If the most recent session is not eligible or has no messages, 
    // fetch the single absolute most recent summary in the database
    let fallbackQuery = db
      .from('session_summaries')
      .select('id, session_id, summary, topics, priority, message_count, duration_minutes, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (currentSessionId) {
      fallbackQuery = fallbackQuery.neq('session_id', currentSessionId);
    }

    const { data: fallbackSummaries } = await fallbackQuery.limit(1);

    if (fallbackSummaries && fallbackSummaries.length > 0) {
      return NextResponse.json({ summary: fallbackSummaries[0] });
    }

    return NextResponse.json({ summary: null });
  } catch (err: any) {
    console.error('[API Last-Summary] Exception:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
