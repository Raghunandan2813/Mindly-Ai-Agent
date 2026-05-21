// app/api/auth/api-tokens/route.ts
// Handles cryptographic CLI API token lifecycle: safe SHA-256 hashed generation, lists, revocations,
// and high-speed sub-millisecond lookups with Upstash Redis rate limit protection.

import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { createSupabaseServer, supabaseAdmin } from '@/lib/supabase';
import { checkRateLimit } from '@/lib/redis';

// GET: Lists active API tokens. Never returns the SHA-256 hashes to prevent leakage.
export async function GET() {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized credentials context' }, { status: 401 });
  }

  try {
    const db = supabaseAdmin || supabase;
    const { data: tokens, error } = await db
      .from('api_tokens')
      .select('id, name, scope, expires_at, last_used_at, is_revoked, created_at')
      .eq('user_id', user.id)
      .eq('is_revoked', false)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, tokens });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to list API tokens' }, { status: 500 });
  }
}

// POST: Generates a new API token, hashes it using SHA-256, and returns the plaintext key once.
export async function POST(request: Request) {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized credentials context' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { name, scope, durationDays } = body;

    // 1. Generate standard secure key prefixed for identification
    const rawToken = `mindly_${crypto.randomBytes(24).toString('hex')}`;
    const tokenHash = crypto.createHash('sha256').update(rawToken).update('utf8').digest('hex');

    const days = parseInt(durationDays, 10) || 90;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + days);

    const db = supabaseAdmin || supabase;

    // 2. Save the SHA-256 hash safely to the database
    const { error: insertErr } = await db
      .from('api_tokens')
      .insert({
        user_id: user.id,
        token_hash: tokenHash,
        name: name || 'CLI Client',
        scope: scope || 'read:write',
        expires_at: expiresAt.toISOString(),
      });

    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    // Return the cleartext key exactly ONCE to the generator
    return NextResponse.json({
      success: true,
      token: rawToken,
      name: name || 'CLI Client',
      scope: scope || 'read:write',
      expiresAt: expiresAt.toISOString(),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to generate token' }, { status: 500 });
  }
}

// DELETE: Revokes an active API token.
export async function DELETE(request: Request) {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized credentials context' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const tokenId = searchParams.get('tokenId');

    if (!tokenId) {
      return NextResponse.json({ error: 'Missing tokenId parameter' }, { status: 400 });
    }

    const db = supabaseAdmin || supabase;

    // Soft delete by setting is_revoked to true and strict user_id checking
    const { data: revokedRows, error: updateErr } = await db
      .from('api_tokens')
      .update({ is_revoked: true })
      .eq('id', tokenId)
      .eq('user_id', user.id)
      .select('id');

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    if (!revokedRows || revokedRows.length === 0) {
      return NextResponse.json({ error: 'Token not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'API token successfully revoked' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to revoke token' }, { status: 500 });
  }
}

// PUT: High-frequency token verification endpoint with Upstash rate-limiting guards.
export async function PUT(request: Request) {
  // 1. Enforce IP rate limiting to prevent brute-force token exhaustion
  const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || '127.0.0.1';
  const { allowed, remaining } = await checkRateLimit(ipAddress);

  if (!allowed) {
    return NextResponse.json(
      { error: 'Security Warning: Too many authentication attempts. Please try again in 15 minutes.' },
      { status: 429 }
    );
  }

  try {
    const { token } = await request.json();
    if (!token) {
      return NextResponse.json({ error: 'Missing token body' }, { status: 400 });
    }

    // 2. Hash token using SHA-256 for high-speed sub-millisecond lookup
    const tokenHash = crypto.createHash('sha256').update(token).update('utf8').digest('hex');

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Server configuration error: Admin context not available' }, { status: 500 });
    }

    const { data: dbToken, error } = await supabaseAdmin
      .from('api_tokens')
      .select('id, user_id, scope, expires_at, is_revoked')
      .eq('token_hash', tokenHash)
      .single();

    // 3. Validate existence, revocation, and expiration thresholds
    if (error || !dbToken || dbToken.is_revoked || new Date(dbToken.expires_at) < new Date()) {
      return NextResponse.json({ error: 'Invalid or expired API token' }, { status: 401 });
    }

    // 4. Update audit metrics asynchronously
    await supabaseAdmin
      .from('api_tokens')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', dbToken.id);

    return NextResponse.json({
      success: true,
      authenticated: true,
      userId: dbToken.user_id,
      scope: dbToken.scope,
      remainingRateLimitAttempts: remaining,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Token verification execution failed' }, { status: 500 });
  }
}
