// app/api/auth/me/route.ts
// GET: Check who is currently logged in, returning unique id, email, and proactive configuration metadata.

import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase';
import { getTierFromMetadata } from '@/lib/userSecurity';

export async function GET() {
  const supabase = await createSupabaseServer();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    return NextResponse.json({ userId: null });
  }

  return NextResponse.json({
    userId: user.id,
    email: user.email,
    createdAt: user.created_at,
    displayName: user.user_metadata?.display_name || '',
    profilePhoto: user.user_metadata?.profile_photo || '',
    proactiveEnabled: user.user_metadata?.proactive_enabled === true,
    memoryEnabled: user.user_metadata?.memory_enabled !== false,
    memoryRetentionPeriod: user.user_metadata?.memory_retention_period || 'forever',
    subscriptionTier: getTierFromMetadata(user.user_metadata),
  });
}
