// app/api/cron/security-cleanup/route.ts
// Daily job: expired locks, stale sessions, expired API tokens, old export files.

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized CRON trigger' }, { status: 401 });
  }

  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Supabase admin client not initialized' }, { status: 500 });
  }

  try {
    const { error } = await supabaseAdmin.rpc('execute_security_cleanups');

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      message: 'Security cleanup routine executed',
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Security cleanup failed';
    console.error('[Cron Security Cleanup]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
