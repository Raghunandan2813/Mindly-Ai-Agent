// app/api/auth/redaction-log/route.ts
// Exposes data redaction logs, ensuring strict tenant-isolated GET retrievals
// and secure write logging for background or runtime pre-save redaction filters.

import { NextResponse } from 'next/server';
import { createSupabaseServer, supabaseAdmin } from '@/lib/supabase';

// GET: Returns data redaction audit events strictly isolated to the authenticated user.
export async function GET() {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized logging context' }, { status: 401 });
  }

  try {
    const db = supabaseAdmin || supabase;
    // Strict isolation enforcement: WHERE user_id = authenticated_user_id
    const { data: logs, error } = await db
      .from('redaction_logs')
      .select('id, session_id, redacted_type, redacted_placeholder, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, logs });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to list redaction logs' }, { status: 500 });
  }
}

// POST: Allows secure internal/pre-save handlers to save audit records of redacted components.
export async function POST(request: Request) {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized logging context' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { sessionId, redactedType, redactedPlaceholder } = body;

    if (!redactedType) {
      return NextResponse.json({ error: 'Missing redactedType parameter' }, { status: 400 });
    }

    const db = supabaseAdmin || supabase;

    // Log the redaction event
    const { data: newLog, error: insertErr } = await db
      .from('redaction_logs')
      .insert({
        user_id: user.id,
        session_id: sessionId || null, // Plain text string, fully nullable
        redacted_type: redactedType,
        redacted_placeholder: redactedPlaceholder || '[REDACTED]',
      })
      .select('id')
      .single();

    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, logId: newLog.id });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to record redaction event' }, { status: 500 });
  }
}
