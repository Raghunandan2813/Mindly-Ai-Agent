// app/api/test-db/route.ts
// Database connection test with detailed debugging
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'NOT SET';

  try {
    // Test 1: Basic connection — list all tables (doesn't need any table to exist)
    const { data: tables, error: tablesError } = await supabase
      .rpc('match_messages', {
        query_embedding: Array(384).fill(0),
        match_user_id: '00000000-0000-0000-0000-000000000000',
        match_count: 1
      });

    // Test 2: Try the messages table directly
    const { data, error } = await supabase
      .from('messages')
      .select('id')
      .limit(1);

    if (error) {
      return NextResponse.json({
        connected: false,
        supabaseUrl: url,
        error: error.message,
        code: error.code,
        details: error.details,
        hint: 'Check: 1) URL has no trailing slash 2) schema.sql ran successfully',
      }, { status: 500 });
    }

    return NextResponse.json({
      connected: true,
      supabaseUrl: url,
      message: '✅ Database connected successfully!',
      rowsFound: data?.length || 0,
    });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({
      connected: false,
      supabaseUrl: url,
      error: message,
    }, { status: 500 });
  }
}
