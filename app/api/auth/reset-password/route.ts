// app/api/auth/reset-password/route.ts
// POST: Reset user password securely under an active recovery session context.
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServer, supabaseAdmin } from '@/lib/supabase';
import { isStrongPassword } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const { password } = await req.json();

    if (!password || typeof password !== 'string') {
      return NextResponse.json({ error: 'Please enter a password.' }, { status: 400 });
    }

    // Validate password strength
    const passwordCheck = isStrongPassword(password);
    if (!passwordCheck.valid) {
      return NextResponse.json({ error: passwordCheck.message }, { status: 400 });
    }

    const supabase = await createSupabaseServer();
    
    // Check if we have a valid authenticated user session (set during verifyOtp callback)
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Session expired or invalid reset link. Please request a new password reset.' },
        { status: 401 }
      );
    }

    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      console.error('Password Update Error:', updateError.message);
      return NextResponse.json({ error: updateError.message }, { status: 400 });
    }

    // Perform a true server-side global signout using admin access
    if (!supabaseAdmin) {
      console.error('supabaseAdmin is not configured.');
      return NextResponse.json({ error: 'Server configuration error.' }, { status: 500 });
    }

    const { error: signOutError } = await supabaseAdmin.auth.admin.signOut(user.id, 'global');
    if (signOutError) {
      console.error('Global Admin Signout Error:', signOutError.message);
      // Proceed anyway since the password has been updated, but log the warning.
    }

    return NextResponse.json({
      success: true,
      message: 'Your password has been successfully reset! All active sessions have been invalidated.',
    });
  } catch (err: any) {
    console.error('Unexpected Reset Password exception:', err);
    return NextResponse.json(
      { error: err.message || 'Something went wrong. Please try again.' },
      { status: 500 }
    );
  }
}
