// lib/supabaseClient.ts
// Client-safe Supabase instance. Uses createBrowserClient from @supabase/ssr to automatically enforce the secure PKCE code exchange flow for Next.js.
import { createBrowserClient } from '@supabase/ssr';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase client environment variables.');
}

export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);
