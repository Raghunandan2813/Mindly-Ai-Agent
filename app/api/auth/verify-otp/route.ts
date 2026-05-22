// app/api/auth/verify-otp/route.ts
// POST: Verify a 6-digit email OTP (for signup, recovery, magiclink, or invite).
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase';
import { isValidEmail } from '@/lib/auth';

interface VerifyOtpBody {
  email: string;
  token: string;
  type: 'signup' | 'recovery' | 'invite' | 'magiclink';
}

export async function POST(req: NextRequest) {
  try {
    const { email, token, type }: VerifyOtpBody = await req.json();

    // 1. Basic validation
    if (!email || !isValidEmail(email)) {
      return NextResponse.json(
        { error: 'Please provide a valid email address.' },
        { status: 400 }
      );
    }

    if (!token || token.length !== 6 || !/^\d+$/.test(token)) {
      return NextResponse.json(
        { error: 'Verification code must be exactly 6 digits.' },
        { status: 400 }
      );
    }

    if (!type) {
      return NextResponse.json(
        { error: 'Verification type is required.' },
        { status: 400 }
      );
    }

    // 2. Perform OTP verification
    const supabase = await createSupabaseServer();
    const { data, error } = await supabase.auth.verifyOtp({
      email: email.toLowerCase().trim(),
      token,
      type,
    });

    if (error) {
      console.error('Supabase OTP verification error:', error.message);
      return NextResponse.json(
        { error: error.message || 'Invalid or expired verification code.' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Email successfully verified!',
      user: data.user,
      session: data.session,
    });

  } catch (err: any) {
    console.error('Unexpected error in verify-otp API:', err);
    return NextResponse.json(
      { error: err.message || 'Something went wrong. Please try again.' },
      { status: 500 }
    );
  }
}
