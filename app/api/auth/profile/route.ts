// app/api/auth/profile/route.ts
// POST: Update user profile metadata and synchronized profiles table securely.
// Features XSS sanitization, length boundaries, unique name verification, and read-only email safeguards.

import { NextResponse } from 'next/server';
import { createSupabaseServer, supabaseAdmin } from '@/lib/supabase';

// Regular expression ensuring strictly alphanumeric, spaces, dots, dashes, underscores, and apostrophes.
const NAME_REGEX = /^[a-zA-Z0-9\s.\-_']{1,50}$/;

export async function POST(request: Request) {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized user context' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { displayName, profilePhoto, proactiveEnabled, memoryEnabled, memoryRetentionPeriod, email } = body;

    // 1. Strict Email Protection
    if (email !== undefined && email !== user.email) {
      return NextResponse.json({
        error: 'Security Warning: Email address is read-only and cannot be manually modified.'
      }, { status: 400 });
    }

    const updateData: Record<string, any> = {};
    let sanitizedName = '';

    // 2. Display Name Sanitization & Validation (XSS Prevention)
    if (displayName !== undefined) {
      // Strip any HTML tags completely using a robust tag-stripping scanner
      const stripped = displayName.replace(/<\/?[^>]+(>|$)/g, "").trim();

      if (!stripped) {
        return NextResponse.json({ error: 'Display name cannot be empty.' }, { status: 400 });
      }

      if (stripped.length > 50) {
        return NextResponse.json({ error: 'Display name cannot exceed 50 characters.' }, { status: 400 });
      }

      if (!NAME_REGEX.test(stripped)) {
        return NextResponse.json({
          error: 'Display name can only contain letters, numbers, spaces, dots, dashes, underscores, and apostrophes.'
        }, { status: 400 });
      }

      sanitizedName = stripped;
      updateData.display_name = sanitizedName;
    }

    if (profilePhoto !== undefined) {
      updateData.profile_photo = profilePhoto;
    }
    if (proactiveEnabled !== undefined) {
      updateData.proactive_enabled = proactiveEnabled;
    }
    if (memoryEnabled !== undefined) {
      updateData.memory_enabled = memoryEnabled;
    }
    if (memoryRetentionPeriod !== undefined) {
      updateData.memory_retention_period = memoryRetentionPeriod;
    }

    const db = supabaseAdmin || supabase;

    // 3. Unique Display Name Verification & Profile Table synchronization
    if (sanitizedName) {
      // Check if display name is already claimed in profiles table (excluding active user)
      const { data: existing, error: checkErr } = await db
        .from('profiles')
        .select('id')
        .eq('display_name', sanitizedName)
        .neq('id', user.id)
        .maybeSingle();

      if (checkErr && checkErr.code !== 'PGRST116') {
        console.warn('[Profile API] Profiles table not initialized yet. Skipping hard unique checks...');
      } else if (existing) {
        return NextResponse.json({
          error: 'This display name is already taken by another user. Please choose a unique name.'
        }, { status: 400 });
      }

      // Upsert into profiles table
      try {
        const { error: upsertErr } = await db
          .from('profiles')
          .upsert({
            id: user.id,
            display_name: sanitizedName,
            profile_photo: profilePhoto || user.user_metadata?.profile_photo || 'gradient-indigo'
          });

        if (upsertErr) {
          if (upsertErr.code === '23505') {
            return NextResponse.json({
              error: 'This display name is already taken by another user. Please choose a unique name.'
            }, { status: 400 });
          }
          console.error('[Profile API] Synchronized profiles update failed:', upsertErr);
        }
      } catch (upsertCatch) {
        console.error('[Profile API] Synchronized profiles upsert exception:', upsertCatch);
      }
    }

    // 4. Update core user metadata in Supabase auth system
    const { data: authData, error: authErr } = await supabase.auth.updateUser({
      data: updateData
    });

    if (authErr) {
      return NextResponse.json({ error: authErr.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      user: {
        displayName: authData.user.user_metadata?.display_name || '',
        profilePhoto: authData.user.user_metadata?.profile_photo || '',
        proactiveEnabled: authData.user.user_metadata?.proactive_enabled === true,
        memoryEnabled: authData.user.user_metadata?.memory_enabled !== false,
        memoryRetentionPeriod: authData.user.user_metadata?.memory_retention_period || 'forever'
      }
    });

  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Profile update failed' }, { status: 500 });
  }
}
