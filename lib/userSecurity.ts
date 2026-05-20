// lib/userSecurity.ts
// Server-side tier resolution and model routing (never trust client settings for paid models).

export type SubscriptionTier = 'free' | 'pro';

const FREE_TIER_GROQ_MODEL = 'llama-3.1-8b-instant';
const FREE_TIER_GEMINI_MODEL = 'gemini-2.0-flash';
const FREE_TIER_OPENROUTER_MODEL = 'meta-llama/llama-3.1-8b-instruct:free';

const PREMIUM_GROQ_MODELS = new Set([
  'llama-3.3-70b-versatile',
  'llama-3.1-70b-versatile',
  'mixtral-8x7b-32768',
]);

const PREMIUM_GEMINI_MODELS = new Set(['gemini-2.0-pro-exp', 'gemini-1.5-pro']);

export function getTierFromMetadata(metadata?: Record<string, unknown> | null): SubscriptionTier {
  const raw = metadata?.subscription_tier ?? metadata?.plan ?? metadata?.tier;
  if (raw === 'pro' || raw === 'paid' || raw === 'premium') return 'pro';
  return 'free';
}

export function getMaxActiveSessions(tier: SubscriptionTier): number {
  return tier === 'pro' ? 10 : 3;
}

/** Seconds until JWT/session expiry; minimum 60s for Redis TTL. */
export function jwtRemainingSeconds(expiresAtUnix?: number | null): number {
  if (!expiresAtUnix) return 86400;
  const remaining = expiresAtUnix - Math.floor(Date.now() / 1000);
  return Math.max(60, remaining);
}

export function selectGroqModelForMessage(message: string): string {
  const lowercaseMsg = message.toLowerCase();
  const complexKeywords = [
    'write a code', 'program', 'function', 'class in', 'algorithm',
    'analyze', 'compare', 'difference between', 'elaborate on',
    'explain in detail', 'architect', 'design a system', 'complex math',
    'solve', 'prove', 'derivation', 'step by step explanation',
  ];
  const isComplex =
    complexKeywords.some((keyword) => lowercaseMsg.includes(keyword)) || message.length > 300;
  return isComplex ? 'llama-3.3-70b-versatile' : FREE_TIER_GROQ_MODEL;
}

/**
 * Resolves the model name from DB tier + provider. Free tier cannot use premium/smart models.
 */
export function resolveServerModel(
  tier: SubscriptionTier,
  provider: string,
  requestedModel: string | undefined,
  message: string
): string {
  const p = provider.toLowerCase();

  if (tier === 'pro') {
    if (requestedModel) return requestedModel;
    if (p === 'groq') {
      return process.env.GROQ_MODEL && process.env.GROQ_MODEL !== FREE_TIER_GROQ_MODEL
        ? process.env.GROQ_MODEL
        : selectGroqModelForMessage(message);
    }
    if (p === 'gemini') return requestedModel || 'gemini-2.0-flash';
    if (p === 'openrouter') {
      return requestedModel || process.env.OPENROUTER_MODEL || FREE_TIER_OPENROUTER_MODEL;
    }
    if (p === 'ollama') return requestedModel || process.env.OLLAMA_MODEL || 'llama3';
    return requestedModel || FREE_TIER_GROQ_MODEL;
  }

  // Free tier — force economical defaults
  if (p === 'groq') return FREE_TIER_GROQ_MODEL;
  if (p === 'gemini') return FREE_TIER_GEMINI_MODEL;
  if (p === 'openrouter') return FREE_TIER_OPENROUTER_MODEL;
  if (p === 'ollama') return requestedModel || process.env.OLLAMA_MODEL || 'llama3';

  const model = (requestedModel || '').toLowerCase();
  if (
    model === 'smart' ||
    PREMIUM_GROQ_MODELS.has(requestedModel || '') ||
    PREMIUM_GEMINI_MODELS.has(requestedModel || '')
  ) {
    return FREE_TIER_GROQ_MODEL;
  }
  return requestedModel || FREE_TIER_GROQ_MODEL;
}
