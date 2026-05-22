// app/api/auth/forgot-password/route.ts
// POST: Initiate secure password recovery by sending a reset link via Supabase Auth.
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    if (!email || typeof email !== 'string' || !email.trim()) {
      return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 });
    }

    const supabase = await createSupabaseServer();
    const origin = req.nextUrl.origin;

    const { error } = await supabase.auth.resetPasswordForEmail(email.toLowerCase().trim(), {
      redirectTo: `${origin}/reset-password`,
    });

    if (error) {
      console.error('Reset Password Error:', error.message);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: 'A password reset link has been sent. The link is valid for 5 minutes. Please check your inbox!',
    });
  } catch (err: any) {
    console.error('Unexpected Forgot Password exception:', err);
    return NextResponse.json(
      { error: err.message || 'Something went wrong. Please try again.' },
      { status: 500 }
    );
  }
}
