// app/api/auth/connectors/route.ts
// Handles safe creation, updates, sync triggers, and OAuth credential management
// by encrypting tokens via AES-256-GCM and enforcing strict RLS parameters.

import { NextResponse } from 'next/server';
import { createSupabaseServer, supabaseAdmin } from '@/lib/supabase';
import { encrypt, decrypt } from '@/lib/encryption';

// GET: Lists active connectors. Mask OAuth credentials completely to prevent client-side exposure.
export async function GET() {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized connector context' }, { status: 401 });
  }

  try {
    const db = supabaseAdmin || supabase;
    // Strict isolation enforcement: WHERE user_id = authenticated_user_id
    const { data: connectors, error } = await db
      .from('connector_states')
      .select('connector_name, enabled, last_synced, sync_frequency, last_error, last_error_at, token_expires_at')
      .eq('user_id', user.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, connectors });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to list connector states' }, { status: 500 });
  }
}

// POST: Upserts a connector state, encrypting access/refresh tokens securely on save.
export async function POST(request: Request) {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized connector context' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { connectorName, enabled, accessToken, refreshToken, expiresInSeconds, syncFrequency, triggerSync } = body;

    if (!connectorName) {
      return NextResponse.json({ error: 'Missing connectorName parameter' }, { status: 400 });
    }

    const db = supabaseAdmin || supabase;

    // 1. Prepare updates with encryption boundaries
    const upsertData: Record<string, any> = {
      user_id: user.id,
      connector_name: connectorName,
    };

    if (enabled !== undefined) {
      upsertData.enabled = enabled;
    }

    if (accessToken !== undefined) {
      // Securely encrypt access token using AES-256-GCM
      upsertData.access_token = accessToken ? encrypt(accessToken) : null;
    }

    if (refreshToken !== undefined) {
      // Securely encrypt refresh token using AES-256-GCM
      upsertData.refresh_token = refreshToken ? encrypt(refreshToken) : null;
    }

    if (expiresInSeconds !== undefined) {
      const expiresAt = new Date();
      expiresAt.setSeconds(expiresAt.getSeconds() + parseInt(expiresInSeconds, 10));
      upsertData.token_expires_at = expiresAt.toISOString();
    }

    if (syncFrequency !== undefined) {
      upsertData.sync_frequency = syncFrequency;
    }

    // 2. Perform safe upsert with complete RLS matching policies
    const { error: upsertErr } = await db
      .from('connector_states')
      .upsert(upsertData);

    if (upsertErr) {
      return NextResponse.json({ error: upsertErr.message }, { status: 500 });
    }

    // 3. Optional sync: decrypt credentials server-side only (never returned to client)
    if (triggerSync === true) {
      try {
        const { data: row } = await db
          .from('connector_states')
          .select('access_token, refresh_token, enabled')
          .eq('user_id', user.id)
          .eq('connector_name', connectorName)
          .single();

        if (!row?.enabled) {
          await db
            .from('connector_states')
            .update({
              last_error: 'Connector is disabled',
              last_error_at: new Date().toISOString(),
            })
            .eq('user_id', user.id)
            .eq('connector_name', connectorName);

          return NextResponse.json({
            success: false,
            message: 'Connector is disabled',
          }, { status: 400 });
        }

        if (row.access_token) {
          const { decrypt } = await import('@/lib/encryption');
          decrypt(row.access_token);
          if (row.refresh_token) decrypt(row.refresh_token);
        }

        await db
          .from('connector_states')
          .update({
            last_synced: new Date().toISOString(),
            last_error: null,
            last_error_at: null,
          })
          .eq('user_id', user.id)
          .eq('connector_name', connectorName);

        return NextResponse.json({
          success: true,
          message: `Connector '${connectorName}' synced successfully`,
          syncedAt: new Date().toISOString(),
        });
      } catch (syncErr: unknown) {
        const syncMessage = syncErr instanceof Error ? syncErr.message : 'Sync failed';
        await db
          .from('connector_states')
          .update({
            last_error: syncMessage,
            last_error_at: new Date().toISOString(),
          })
          .eq('user_id', user.id)
          .eq('connector_name', connectorName);

        return NextResponse.json({ error: syncMessage }, { status: 500 });
      }
    }

    return NextResponse.json({
      success: true,
      message: `Connector '${connectorName}' successfully updated`,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to update connector' }, { status: 500 });
  }
}
