// app/api/auth/logout/route.ts
// POST: Sign out user and clear session cookies
import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase';

export async function POST() {
  const supabase = await createSupabaseServer();
  await supabase.auth.signOut();
  return NextResponse.json({ success: true, message: 'Logged out' });
}
