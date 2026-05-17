// app/api/memories/route.ts
// GET: Fetch all user memories. DELETE: Remove a memory by ID.
import { NextRequest, NextResponse } from 'next/server';
import { supabase, supabaseAdmin } from '@/lib/supabase';

const db = supabaseAdmin || supabase;

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get('userId');
  if (!userId) return NextResponse.json({ memories: [] });

  const { data } = await db
    .from('messages')
    .select('id, role, content, created_at, session_id')
    .eq('user_id', userId)
    .eq('role', 'user')
    .order('created_at', { ascending: false })
    .limit(100);

  return NextResponse.json({ memories: data || [] });
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id');
  const userId = req.nextUrl.searchParams.get('userId');

  if (!id || !userId) {
    return NextResponse.json({ error: 'Missing id or userId' }, { status: 400 });
  }

  const { error } = await db
    .from('messages')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}