// app/api/sessions/delete-summary/route.ts
// API endpoint to delete a specific session summary.

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, supabase } from '@/lib/supabase';

const db = supabaseAdmin || supabase;

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const summaryId = searchParams.get('summaryId');
    const userId = searchParams.get('userId');

    if (!summaryId || !userId) {
      return NextResponse.json({ error: 'Missing summaryId or userId parameter' }, { status: 400 });
    }

    const { error } = await db
      .from('session_summaries')
      .delete()
      .eq('id', summaryId)
      .eq('user_id', userId);

    if (error) {
      console.error('[API Delete-Summary] DB delete error:', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log(`[API Delete-Summary] Deleted summary ${summaryId} for user ${userId}`);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[API Delete-Summary] Exception:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
