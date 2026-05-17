// app/api/test-auth/route.ts
// Test auth by signing up and logging in a test user
// Visit: http://localhost:3000/api/test-auth
import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase';

export async function GET() {
  const testEmail = 'memorytest2@gmail.com';
  const testPassword = 'TestPass123';

  try {
    const supabase = await createSupabaseServer();

    // Step 1: Try to sign up
    const { data: signupData, error: signupError } = await supabase.auth.signUp({
      email: testEmail,
      password: testPassword,
    });

    // Step 2: Try to login
    const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
      email: testEmail,
      password: testPassword,
    });

    // Step 3: Check who is logged in
    const { data: { user } } = await supabase.auth.getUser();

    return NextResponse.json({
      step1_signup: signupError ? `⚠️ ${signupError.message}` : '✅ Signup works!',
      step2_login: loginError ? `❌ ${loginError.message}` : '✅ Login works!',
      step3_session: user ? {
        status: '✅ User is logged in!',
        userId: user.id,
        email: user.email,
      } : '❌ No active session',
      note: 'You can see this user in Supabase → Authentication → Users',
    });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
