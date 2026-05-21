// app/api/auth/sessions/route.ts
// Handles active device session audits, tenant-isolated listings, limits enforcement (max 3),
// and bulletproof global / session-level revocations using Supabase Admin client + Upstash Redis blocklists.

import { NextResponse } from 'next/server';
import { createSupabaseServer, supabaseAdmin } from '@/lib/supabase';
import { blocklistSession } from '@/lib/redis';
import { getMaxActiveSessions, getTierFromMetadata, jwtRemainingSeconds } from '@/lib/userSecurity';

// GET: Returns list of active sessions strictly isolated to the authenticated user.
export async function GET() {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized session context' }, { status: 401 });
  }

  try {
    const db = supabaseAdmin || supabase;
    // Strict isolation enforcement: WHERE user_id = authenticated_user_id
    const { data: sessions, error } = await db
      .from('active_sessions')
      .select('session_id, device_name, ip_address, user_agent, last_active, created_at')
      .eq('user_id', user.id)
      .order('last_active', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, sessions });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to list active sessions' }, { status: 500 });
  }
}

// POST: Registers a new active session, enforcing the strict 3-session ceiling for free-tier users.
export async function POST(request: Request) {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized session context' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { deviceName } = body;

    const userAgent = request.headers.get('user-agent') || 'Unknown Device';
    const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || '127.0.0.1';

    const db = supabaseAdmin || supabase;
    const tier = getTierFromMetadata(user.user_metadata);
    const maxSessions = getMaxActiveSessions(tier);

    const { data: { session: authSession } } = await supabase.auth.getSession();
    const blocklistTtl = jwtRemainingSeconds(authSession?.expires_at ?? null);

    // 1. Retrieve current active session counts for isolation check
    const { data: existingSessions, error: countErr } = await db
      .from('active_sessions')
      .select('session_id, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true });

    if (countErr) {
      return NextResponse.json({ error: countErr.message }, { status: 500 });
    }

    // 2. Enforce concurrent session ceiling (3 free / 10 pro)
    if (existingSessions && existingSessions.length >= maxSessions) {
      const oldestSession = existingSessions[0];

      await db.from('active_sessions').delete().eq('session_id', oldestSession.session_id);
      await blocklistSession(oldestSession.session_id, blocklistTtl);
    }

    // 3. Register the new active session
    const { data: newSession, error: insertErr } = await db
      .from('active_sessions')
      .insert({
        user_id: user.id,
        device_name: deviceName || 'Web Browser',
        ip_address: ipAddress,
        user_agent: userAgent,
      })
      .select('session_id')
      .single();

    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      sessionId: newSession.session_id,
      tier,
      maxSessions,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to register session' }, { status: 500 });
  }
}

// DELETE: Revokes a specific active session. Enforces strict user context validation.
export async function DELETE(request: Request) {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized session context' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json({ error: 'Missing sessionId parameter' }, { status: 400 });
    }

    const db = supabaseAdmin || supabase;
    const { data: { session: authSession } } = await supabase.auth.getSession();
    const blocklistTtl = jwtRemainingSeconds(authSession?.expires_at ?? null);

    // 1. Delete session from active_sessions table with strict ownership check
    const { data: deleted, error: deleteErr } = await db
      .from('active_sessions')
      .delete()
      .eq('session_id', sessionId)
      .eq('user_id', user.id)
      .select('session_id');

    if (deleteErr) {
      return NextResponse.json({ error: deleteErr.message }, { status: 500 });
    }

    if (!deleted || deleted.length === 0) {
      return NextResponse.json({ error: 'Session not found or permission denied' }, { status: 404 });
    }

    await blocklistSession(sessionId, blocklistTtl);

    return NextResponse.json({ success: true, message: 'Session successfully revoked' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to revoke session' }, { status: 500 });
  }
}

// PUT: Triggers global signout, revoking all active sessions for the user context.
export async function PUT() {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized session context' }, { status: 401 });
  }

  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Server configuration error: Admin client not available' }, { status: 500 });
  }

  try {
    // 1. Retrieve all active session IDs before wipe to blocklist them
    const { data: userSessions } = await supabaseAdmin
      .from('active_sessions')
      .select('session_id')
      .eq('user_id', user.id);

    const { data: { session: authSession } } = await supabase.auth.getSession();
    const blocklistTtl = jwtRemainingSeconds(authSession?.expires_at ?? null);

    if (userSessions && userSessions.length > 0) {
      for (const s of userSessions) {
        await blocklistSession(s.session_id, blocklistTtl);
      }
    }

    // 2. Clear all active_sessions database records for the user
    await supabaseAdmin.from('active_sessions').delete().eq('user_id', user.id);

    // 3. Trigger Supabase Global Sign Out (invalidates all stateless tokens)
    const { error: signOutErr } = await supabaseAdmin.auth.admin.signOut(user.id, 'global');

    if (signOutErr) {
      return NextResponse.json({ error: signOutErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Global session revocation executed successfully' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Global signout operation failed' }, { status: 500 });
  }
}
