// app/api/auth/signup/route.ts
// POST: Register a new user. Supports standard real email verification (production) and pre-confirmed admin bypass (local dev).
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, createSupabaseServer } from '@/lib/supabase';
import { isValidEmail, isStrongPassword } from '@/lib/auth';

interface SignupBody {
  email: string;
  password: string;
}

export async function POST(req: NextRequest) {
  try {
    const { email, password }: SignupBody = await req.json();

    // 1. Validate email format
    if (!email || !isValidEmail(email)) {
      return NextResponse.json(
        { error: 'Please enter a valid email address (e.g., user@example.com)' },
        { status: 400 }
      );
    }

    // 2. Validate password strength
    const passwordCheck = isStrongPassword(password);
    if (!passwordCheck.valid) {
      return NextResponse.json(
        { error: passwordCheck.message },
        { status: 400 }
      );
    }

    const enforceVerification = process.env.ENABLE_REAL_EMAIL_VERIFICATION === 'true';

    if (enforceVerification) {
      // Branch A: Production Enforced Real Verification (sends real email confirmation link)
      const supabase = await createSupabaseServer();
      const { data, error } = await supabase.auth.signUp({
        email: email.toLowerCase().trim(),
        password,
      });

      if (error) {
        console.error('Supabase Sign-Up Error:', error);
        if (error.message.includes('already registered')) {
          return NextResponse.json(
            { error: 'An account with this email already exists' },
            { status: 409 }
          );
        }
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      return NextResponse.json({
        success: true,
        message: 'A verification link has been sent to your email. Please check your inbox!',
        userId: data.user?.id,
      });

    } else {
      // Branch B: Local Development Friction-free Bypass (pre-confirmed, no rate limits)
      if (!supabaseAdmin) {
        return NextResponse.json(
          { error: 'Supabase admin client key is not configured.' },
          { status: 500 }
        );
      }

      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email: email.toLowerCase().trim(),
        password: password,
        email_confirm: true, // Auto-confirms instantly
      });

      if (error) {
        if (error.message.includes('already registered') || error.message.includes('email_exists')) {
          return NextResponse.json(
            { error: 'An account with this email already exists' },
            { status: 409 }
          );
        }
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      return NextResponse.json({
        success: true,
        message: 'Account created and verified successfully!',
        userId: data.user?.id,
      });
    }

  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Something went wrong. Please try again.' },
      { status: 500 }
    );
  }
}
