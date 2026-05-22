// app/api/auth/callback/route.ts
// Secure GET route: Handles both OAuth code exchanges (Google) and Email OTP verification (token_hash) for Server-Side Cookies.
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// Helper to create a Supabase client that writes session cookies to BOTH the Next.js cookie store and the redirected response headers.
async function createSupabaseCallbackClient(response: NextResponse) {
  const cookieStore = await cookies();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
            response.cookies.set(name, value, options);
          });
        } catch {
          // Ignore if called in read-only environment
        }
      },
    },
  });
}

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

  // 1.5. Special recovery redirect for implicit grant hash flows
  if (type === 'recovery' && !code && !token_hash) {
    console.log('🔄 Recovery flow detected with hash fragment. Redirecting directly to /reset-password');
    return NextResponse.redirect(`${requestUrl.origin}/reset-password`);
  }

  // 2. Branch A: Email confirmation link clicked (Token Hash verification)
  if (token_hash && type) {
    if (type === 'invite') {
      // Direct invite flow immediately to unified client confirm page to prevent consuming token or incorrect type failures
      return NextResponse.redirect(`${requestUrl.origin}/auth/confirm?token_hash=${token_hash}`);
    }

    const targetRedirectUrl = type === 'recovery' 
      ? `${requestUrl.origin}/reset-password` 
      : `${requestUrl.origin}/`;
    
    const response = NextResponse.redirect(targetRedirectUrl);

    try {
      const supabase = await createSupabaseCallbackClient(response);
      const { error } = await supabase.auth.verifyOtp({
        token_hash,
        type,
      });

      if (!error) {
        console.log(`✅ Token hash verified successfully for type: ${type}. Redirecting.`);
        return response;
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
    const targetRedirectUrl = type === 'recovery' 
      ? `${requestUrl.origin}/reset-password` 
      : type === 'invite' 
      ? `${requestUrl.origin}/auth/confirm` 
      : `${requestUrl.origin}/`;
      
    const response = NextResponse.redirect(targetRedirectUrl);

    try {
      const supabase = await createSupabaseCallbackClient(response);
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      
      if (!error) {
        console.log(`✅ Auth code exchanged successfully. Redirecting.`);
        return response;
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
