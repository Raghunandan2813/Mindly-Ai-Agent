// app/api/auth/callback/route.ts
// Secure GET route: Handles both OAuth code exchanges (Google) and Email OTP verification (token_hash) for Server-Side Cookies.
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  console.log('🚀 Auth Callback Route Received URL:', request.url);
  
  // 1. Get all potential parameters from redirect URL
  const code = requestUrl.searchParams.get('code');
  const token_hash = requestUrl.searchParams.get('token_hash');
  const type = requestUrl.searchParams.get('type') as any; // 'signup', 'invite', 'recovery', etc.
  const errorMsg = requestUrl.searchParams.get('error_description');

  if (errorMsg) {
    console.error('Auth redirect callback error:', errorMsg);
    return NextResponse.redirect(`${requestUrl.origin}/login?error=${encodeURIComponent(errorMsg)}`);
  }

  // 2. Branch A: Email confirmation link clicked (Token Hash verification)
  if (token_hash && type) {
    try {
      const supabase = await createSupabaseServer();
      const { error } = await supabase.auth.verifyOtp({
        token_hash,
        type,
      });

      if (!error) {
        // Successfully verified and logged in! Redirect home
        return NextResponse.redirect(`${requestUrl.origin}/`);
      }

      console.error('Email Verification OTP Error:', error.message);
      return NextResponse.redirect(`${requestUrl.origin}/login?error=${encodeURIComponent(error.message)}`);
    } catch (err: any) {
      console.error('OTP verify unexpected exception:', err);
      return NextResponse.redirect(`${requestUrl.origin}/login?error=Unexpected OTP callback exception`);
    }
  }

  // 3. Branch B: Google/Third-party OAuth login (Authorization Code Exchange)
  if (code) {
    try {
      const supabase = await createSupabaseServer();
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      
      if (!error) {
        // Successfully authenticated! Redirect home
        return NextResponse.redirect(`${requestUrl.origin}/`);
      }
      
      console.error('OAuth Code Exchange Error:', error.message);
      return NextResponse.redirect(`${requestUrl.origin}/login?error=${encodeURIComponent(error.message)}`);
    } catch (err: any) {
      console.error('Callback OAuth unexpected exception:', err);
      return NextResponse.redirect(`${requestUrl.origin}/login?error=Unexpected OAuth callback exception`);
    }
  }

  // Fallback if neither code nor token_hash is present
  console.warn('Auth callback triggered without code or token_hash');
  return NextResponse.redirect(`${requestUrl.origin}/login?error=Authentication callback missing code or verification token`);
}
