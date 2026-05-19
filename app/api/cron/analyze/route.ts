// app/api/cron/analyze/route.ts
// Vercel Cron Endpoint: Sweeps active users, runs the AI analyzer, and scores new insights in the background.

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { analyzeUserMemory } from '@/lib/proactive/analyzer';
import { scoreAndStoreInsights } from '@/lib/proactive/scorer';

export const maxDuration = 60; // Allow serverless route to execute up to 60 seconds (safe for reflection loops)

export async function GET(request: Request) {
  // 1. Security Check: Protect cron execution on Vercel
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (process.env.NODE_ENV === 'production' && cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized cron trigger' }, { status: 401 });
  }

  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Database admin context unavailable' }, { status: 500 });
  }

  try {
    // 2. Performance Heuristic: Sweep ONLY active users from the last 24 hours
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: messages, error: msgErr } = await supabaseAdmin
      .from('messages')
      .select('user_id')
      .gt('created_at', twentyFourHoursAgo);

    if (msgErr) {
      console.error('[Cron Sweep] Failed to sweep recent active messages:', msgErr.message);
      return NextResponse.json({ error: msgErr.message }, { status: 500 });
    }

    if (!messages || messages.length === 0) {
      return NextResponse.json({ message: 'No active users found in the last 24 hours. Skipping analyzer.' });
    }

    // Filter unique user IDs
    const activeUserIds = Array.from(new Set(messages.map(m => m.user_id)));
    console.log(`[Cron Sweep] Identified ${activeUserIds.length} active users to analyze:`, activeUserIds);

    const sweepResults: Record<string, any> = {};

    // 3. Process each active user's reflection pipeline sequentially
    for (const userId of activeUserIds) {
      console.log(`[Cron Sweep] Starting reflection loop for User: ${userId}`);
      
      // Analyze memory context (calls AI model)
      const rawInsights = await analyzeUserMemory(userId);
      console.log(`[Cron Sweep] AI generated ${rawInsights.length} raw insights for user ${userId}`);

      // Score, check guardrails, and store
      const storedCount = await scoreAndStoreInsights(userId, rawInsights);
      
      sweepResults[userId] = {
        generated: rawInsights.length,
        stored: storedCount
      };
    }

    return NextResponse.json({
      status: 'success',
      sweepCount: activeUserIds.length,
      results: sweepResults
    });

  } catch (err: any) {
    console.error('[Cron Sweep] Fatal error during sweep loop:', err);
    return NextResponse.json({ error: err.message || 'Fatal sweep error' }, { status: 500 });
  }
}
