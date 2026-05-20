// lib/apiTokenAuth.ts
// Validates Bearer CLI tokens (SHA-256) or cookie sessions for API routes.

import crypto from 'crypto';
import { createSupabaseServer, supabaseAdmin } from './supabase';
import { checkRateLimit } from './redis';

export interface AuthenticatedCaller {
  userId: string;
  scope: string;
  via: 'cookie' | 'token';
}

function extractBearerToken(request: Request): string | null {
  const auth = request.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  const token = auth.slice(7).trim();
  return token.startsWith('mindly_') ? token : null;
}

async function validateApiToken(
  token: string,
  ipAddress: string
): Promise<AuthenticatedCaller | null> {
  const { allowed } = await checkRateLimit(ipAddress);
  if (!allowed) return null;

  if (!supabaseAdmin) return null;

  const tokenHash = crypto.createHash('sha256').update(token).update('utf8').digest('hex');

  const { data: dbToken, error } = await supabaseAdmin
    .from('api_tokens')
    .select('id, user_id, scope, expires_at, is_revoked')
    .eq('token_hash', tokenHash)
    .single();

  if (error || !dbToken || dbToken.is_revoked || new Date(dbToken.expires_at) < new Date()) {
    return null;
  }

  await supabaseAdmin
    .from('api_tokens')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', dbToken.id);

  return {
    userId: dbToken.user_id,
    scope: dbToken.scope || 'read:write',
    via: 'token',
  };
}

/**
 * Authenticate via Supabase session cookie or `Authorization: Bearer mindly_...` CLI token.
 */
export async function authenticateRequest(request: Request): Promise<AuthenticatedCaller | null> {
  const bearer = extractBearerToken(request);
  const ipAddress =
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() || '127.0.0.1';

  if (bearer) {
    return validateApiToken(bearer, ipAddress);
  }

  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  return { userId: user.id, scope: 'read:write', via: 'cookie' };
}

export function requireWriteScope(caller: AuthenticatedCaller): boolean {
  return caller.scope === 'read:write' || caller.scope === 'write' || caller.scope === 'admin';
}
