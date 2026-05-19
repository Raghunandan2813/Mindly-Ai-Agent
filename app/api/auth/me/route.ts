// app/api/auth/me/route.ts
// GET: Check who is currently logged in, returning unique id, email, and proactive configuration metadata.

import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase';

export async function GET() {
  const supabase = await createSupabaseServer();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    return NextResponse.json({ userId: null });
  }

  return NextResponse.json({
    userId: user.id,
    email: user.email,
    proactiveEnabled: user.user_metadata?.proactive_enabled === true
  });
}
