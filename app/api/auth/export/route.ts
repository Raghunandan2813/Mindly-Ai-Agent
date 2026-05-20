// app/api/auth/export/route.ts
// GET: Fetch or asynchronously generate secure user data archives.
// Mitigates serverless resource crashes by switching to non-blocking storage uploads for large histories.
// Sanitizes sensitive values and enforces strict JWT-based authenticated user locks.

import { NextResponse } from 'next/server';
import { createSupabaseServer, supabaseAdmin } from '@/lib/supabase';

// Regex patterns to scrub accidental raw secrets from export outputs (Defense in Depth)
const REDACTION_PATTERNS = [
  { name: 'API Key', regex: /(sk-[a-zA-Z0-9]{20,})|(AIzaSy[a-zA-Z0-9\-_]{35})/g },
  { name: 'Credit Card', regex: /\b(?:\d[ -]*?){13,16}\b/g },
  { name: 'Secret Token', regex: /bearer\s+[a-zA-Z0-9\-._~+/]+=*/gi }
];

function doubleScrubText(text: string): string {
  if (!text) return text;
  let scrubbed = text;
  for (const { regex, name } of REDACTION_PATTERNS) {
    scrubbed = scrubbed.replace(regex, `[REDACTED_${name.toUpperCase().replace(/\s+/g, '_')}]`);
  }
  return scrubbed;
}

export async function GET(request: Request) {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized user context' }, { status: 401 });
  }

  const userId = user.id;
  const db = supabaseAdmin || supabase;

  try {
    // 1. Authenticated User Stats Count Checks (Tamper-proof count check using JWT)
    const { count: msgCount } = await db
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    const { count: nodesCount } = await db
      .from('memory_nodes')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    const totalRecords = (msgCount || 0) + (nodesCount || 0);

    // Parse status polling flags
    const { searchParams } = new URL(request.url);
    const checkStatus = searchParams.get('status') === 'true';

    if (checkStatus) {
      const statusData = user.user_metadata?.export_status || 'idle';
      const downloadUrl = user.user_metadata?.export_url || '';
      return NextResponse.json({ status: statusData, url: downloadUrl });
    }

    // 2. High Footprint Strategy (Async Offloading to prevent serverless function memory crashes)
    if (totalRecords > 300) {
      console.log(`[Export API] High user data footprint detected (${totalRecords} items). Starting async storage generation...`);

      // Update user metadata to 'processing'
      await supabase.auth.updateUser({
        data: { export_status: 'processing', export_url: '' }
      });

      // Background process: compile, filter, scrub, and upload to Supabase Storage
      (async () => {
        try {
          const { data: nodes } = await db
            .from('memory_nodes')
            .select('label, node_type, content, metadata, created_at, updated_at')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

          const { data: summaries } = await db
            .from('session_summaries')
            .select('session_id, summary, topics, priority, message_count, duration_minutes, created_at')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

          const { data: messages } = await db
            .from('messages')
            .select('role, content, session_id, created_at, was_redacted')
            .eq('user_id', userId)
            .order('created_at', { ascending: true });

          // Scrub messages and nodes
          const cleanHistory = (messages || []).map(m => ({
            role: m.role,
            content: doubleScrubText(m.content),
            sessionId: m.session_id,
            createdAt: m.created_at,
            wasRedacted: m.was_redacted === true
          }));

          const cleanNodes = (nodes || []).map(n => ({
            ...n,
            content: doubleScrubText(n.content)
          }));

          const exportPayload = {
            exportedAt: new Date().toISOString(),
            info: 'Mindly AI Secure Data Archive (Asynchronous)',
            user: { id: userId, email: user.email },
            memories: cleanNodes,
            summaries: summaries || [],
            chatHistory: cleanHistory
          };

          const fileContent = JSON.stringify(exportPayload, null, 2);
          const filepath = `exports/${userId}/mindly_export_${Date.now()}.json`;

          // Save payload to a private bucket
          const { error: uploadErr } = await db.storage
            .from('exports')
            .upload(filepath, Buffer.from(fileContent), {
              contentType: 'application/json',
              cacheControl: '60',
              upsert: true
            });

          if (uploadErr) {
            console.error('[Export Worker] Private storage upload exception:', uploadErr.message);
            if (supabaseAdmin) {
              await supabaseAdmin.auth.admin.updateUserById(userId, {
                user_metadata: { export_status: 'failed' }
              });
            }
            return;
          }

          // Signed URL valid for 24 hours (86400 seconds)
          const { data: signedData, error: signErr } = await db.storage
            .from('exports')
            .createSignedUrl(filepath, 86400);

          if (signErr) {
            console.error('[Export Worker] Signed URL generation failure:', signErr.message);
          }

          const exportUrl = signedData?.signedUrl || '';

          // Update user metadata with ready status and final link
          if (supabaseAdmin) {
            await supabaseAdmin.auth.admin.updateUserById(userId, {
              user_metadata: { export_status: 'ready', export_url: exportUrl }
            });
          }

        } catch (workerErr: any) {
          console.error('[Export Worker] Exception in async pipeline:', workerErr.message);
          if (supabaseAdmin) {
            await supabaseAdmin.auth.admin.updateUserById(userId, {
              user_metadata: { export_status: 'failed' }
            });
          }
        }
      })();

      return NextResponse.json({
        success: true,
        async: true,
        message: 'Your history is large. Generation has started in the background. Please wait a few seconds and download.'
      });
    }

    // 3. Fast Synchronous Export (For standard footprint users)
    const { data: nodes } = await db
      .from('memory_nodes')
      .select('label, node_type, content, metadata, created_at, updated_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    const { data: summaries } = await db
      .from('session_summaries')
      .select('session_id, summary, topics, priority, message_count, duration_minutes, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    const { data: messages } = await db
      .from('messages')
      .select('role, content, session_id, created_at, was_redacted')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    // Scrub messages and nodes prior to serialization
    const cleanHistory = (messages || []).map(m => ({
      role: m.role,
      content: doubleScrubText(m.content),
      sessionId: m.session_id,
      createdAt: m.created_at,
      wasRedacted: m.was_redacted === true
    }));

    const cleanNodes = (nodes || []).map(n => ({
      ...n,
      content: doubleScrubText(n.content)
    }));

    const exportPayload = {
      exportedAt: new Date().toISOString(),
      info: 'Mindly AI Secure Data Archive (Fast)',
      user: { id: userId, email: user.email },
      memories: cleanNodes,
      summaries: summaries || [],
      chatHistory: cleanHistory
    };

    return new Response(JSON.stringify(exportPayload, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="mindly_ai_memory_export_${userId.slice(0, 8)}.json"`
      }
    });

  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Data export execution failed' }, { status: 500 });
  }
}
