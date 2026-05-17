// app/api/sessions/route.ts
// GET: Fetch all unique chat sessions for a user to display in the sidebar.
import { NextRequest, NextResponse } from 'next/server';
import { supabase, supabaseAdmin } from '@/lib/supabase';

const db = supabaseAdmin || supabase;

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get('userId');
  if (!userId) {
    return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
  }

  try {
    // Group by session_id and grab the first message to use as the title
    const { data, error } = await db
      .from('messages')
      .select('session_id, content, created_at, role')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (error) throw error;

    // Process messages to aggregate sessions with titles
    const sessionsMap: Record<string, { id: string; title: string; created_at: string }> = {};

    data?.forEach((msg) => {
      const sid = msg.session_id;
      if (!sid) return;

      if (!sessionsMap[sid]) {
        // Use the very first user message as the chat session title
        sessionsMap[sid] = {
          id: sid,
          title: msg.content.length > 30 ? msg.content.slice(0, 30) + '...' : msg.content,
          created_at: msg.created_at,
        };
      } else if (msg.role === 'user' && sessionsMap[sid].title.startsWith('assistant:')) {
        // Fallback to user message title if assistant spoke first somehow
        sessionsMap[sid].title = msg.content.length > 30 ? msg.content.slice(0, 30) + '...' : msg.content;
      }
    });

    const sessions = Object.values(sessionsMap).sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    return NextResponse.json({ sessions });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
