// app/api/cron/purge-expired/route.ts
// GET: Scheduled daily routine executing age-based purging of messages, summaries, and graph nodes.
// Evaluates per-user memory retention settings (3 months, 6 months, 1 year) and wipes expired personal files.

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(request: Request) {
  // Simple auth key validation to secure cron triggers (e.g. from Vercel Cron or GitHub Actions)
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized CRON trigger' }, { status: 401 });
  }

  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Supabase admin client not initialized' }, { status: 500 });
  }

  const results: any[] = [];

  try {
    // 1. Fetch all users from Supabase Auth admin system
    const { data: { users }, error: listErr } = await supabaseAdmin.auth.admin.listUsers();

    if (listErr) {
      throw new Error(`Failed to list users: ${listErr.message}`);
    }

    const now = Date.now();

    for (const user of users) {
      const retention = user.user_metadata?.memory_retention_period || 'forever';

      if (retention === 'forever') {
        continue; // Skip users requesting absolute storage retention
      }

      let days = 0;
      if (retention === '3 months') days = 90;
      else if (retention === '6 months') days = 180;
      else if (retention === '1 year') days = 365;

      if (days === 0) continue;

      const cutoffDate = new Date(now - days * 24 * 60 * 60 * 1000).toISOString();

      console.log(`[Cron Purge] Purging records older than ${retention} (Cutoff: ${cutoffDate}) for user ${user.id}`);

      // 2. Safely delete expired records from relational databases
      // Wipe message history
      const { count: deletedMsgs } = await supabaseAdmin
        .from('messages')
        .delete()
        .eq('user_id', user.id)
        .lt('created_at', cutoffDate);

      // Wipe session summaries
      const { count: deletedSummaries } = await supabaseAdmin
        .from('session_summaries')
        .delete()
        .eq('user_id', user.id)
        .lt('created_at', cutoffDate);

      // Wipe memory edges (relational targets first to safeguard foreign key constraints)
      const { count: deletedEdges } = await supabaseAdmin
        .from('memory_edges')
        .delete()
        .eq('user_id', user.id)
        .lt('created_at', cutoffDate);

      // Wipe memory nodes
      const { count: deletedNodes } = await supabaseAdmin
        .from('memory_nodes')
        .delete()
        .eq('user_id', user.id)
        .lt('created_at', cutoffDate);

      // Wipe expired insights
      const { count: deletedInsights } = await supabaseAdmin
        .from('insights')
        .delete()
        .eq('user_id', user.id)
        .lt('created_at', cutoffDate);

      results.push({
        userId: user.id,
        retention,
        cutoffDate,
        purged: {
          messages: deletedMsgs || 0,
          summaries: deletedSummaries || 0,
          nodes: deletedNodes || 0,
          edges: deletedEdges || 0,
          insights: deletedInsights || 0
        }
      });
    }

    // 3. Process grace-period deletion queue (Permanently purge accounts queued > 24 hours ago)
    const isoNow = new Date().toISOString();
    const { data: queueItems } = await supabaseAdmin
      .from('deletion_queue')
      .select('user_id')
      .lte('scheduled_for', isoNow);

    const permanentPurges: string[] = [];

    if (queueItems && queueItems.length > 0) {
      for (const item of queueItems) {
        console.log(`[Cron Deletion] Executing scheduled permanent cascade purge for user ID: ${item.user_id}`);
        
        // Permanent delete triggers foreign key cascades across all public tables atomically
        const { error: delErr } = await supabaseAdmin.auth.admin.deleteUser(item.user_id);
        if (delErr) {
          console.error(`[Cron Deletion] Permanent delete user ${item.user_id} failed:`, delErr.message);
        } else {
          permanentPurges.push(item.user_id);
        }
      }
    }

    return NextResponse.json({
      success: true,
      timestamp: isoNow,
      retentionPurges: results,
      permanentPurgesCount: permanentPurges.length,
      permanentPurgesList: permanentPurges
    });

  } catch (err: any) {
    console.error('[Cron Purge] Critical error during retention run:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
