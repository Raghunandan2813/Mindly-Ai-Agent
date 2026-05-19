// app/api/auth/profile/route.ts
// POST: Update user metadata profiles securely in Supabase.

import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase';

export async function POST(request: Request) {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized user context' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { proactive_enabled } = body;

    if (proactive_enabled === undefined) {
      return NextResponse.json({ error: 'Missing proactive_enabled value' }, { status: 400 });
    }

    const { data, error } = await supabase.auth.updateUser({
      data: { proactive_enabled }
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      proactive_enabled: data.user.user_metadata?.proactive_enabled === true
    });

  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Profile update failed' }, { status: 500 });
  }
}
