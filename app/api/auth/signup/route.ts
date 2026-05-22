// app/api/auth/signup/route.ts
// POST: Register a new user. Supports standard real email verification (production) and pre-confirmed admin bypass (local dev).
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, createSupabaseServer } from '@/lib/supabase';
import { isValidEmail, isStrongPassword } from '@/lib/auth';

interface SignupBody {
  email: string;
  password: string;
  displayName: string;
  country: string;
}

export async function POST(req: NextRequest) {
  try {
    const { email, password, displayName, country }: SignupBody = await req.json();

    // 1. Validate metadata fields
    if (!displayName || typeof displayName !== 'string' || !displayName.trim()) {
      return NextResponse.json({ error: 'Please enter your name.' }, { status: 400 });
    }
    if (displayName.trim().length > 50) {
      return NextResponse.json({ error: 'Name cannot exceed 50 characters.' }, { status: 400 });
    }
    if (!country || typeof country !== 'string' || !country.trim()) {
      return NextResponse.json({ error: 'Please enter your country.' }, { status: 400 });
    }

    // 2. Validate email format & trusted providers
    if (!email || !isValidEmail(email)) {
      return NextResponse.json(
        { error: 'Please enter a valid email address (e.g., user@example.com)' },
        { status: 400 }
      );
    }

    const trustedDomains = ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'icloud.com'];
    const emailDomain = email.split('@')[1]?.toLowerCase().trim();
    
    if (!trustedDomains.includes(emailDomain)) {
      return NextResponse.json(
        { error: 'Registration is restricted to trusted email providers (Gmail, Yahoo, Outlook, Hotmail, iCloud) to secure accounts.' },
        { status: 400 }
      );
    }

    // 3. Validate password strength
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
        options: {
          data: {
            display_name: displayName.trim(),
            country: country.trim(),
            profile_photo: 'gradient-indigo',
          }
        }
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

      // Synchronize with profiles table immediately to reserve the display name
      if (data.user && supabaseAdmin) {
        await supabaseAdmin.from('profiles').upsert({
          id: data.user.id,
          display_name: displayName.trim(),
          country: country.trim(),
          profile_photo: 'gradient-indigo'
        });
      }

      return NextResponse.json({
        success: true,
        message: 'A verification code has been sent to your email. Please check your inbox!',
        userId: data.user?.id,
        requiresOtp: true,
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
        user_metadata: {
          display_name: displayName.trim(),
          country: country.trim(),
          profile_photo: 'gradient-indigo',
        }
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

      // Synchronize with profiles table immediately
      await supabaseAdmin.from('profiles').upsert({
        id: data.user.id,
        display_name: displayName.trim(),
        country: country.trim(),
        profile_photo: 'gradient-indigo'
      });

      return NextResponse.json({
        success: true,
        message: 'Account created and verified successfully!',
        userId: data.user?.id,
        requiresOtp: false,
      });
    }

  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Something went wrong. Please try again.' },
      { status: 500 }
    );
  }
}
