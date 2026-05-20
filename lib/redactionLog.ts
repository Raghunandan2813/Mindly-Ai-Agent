// lib/redactionLog.ts
// Persists redaction audit events to public.redaction_logs (service role or user context).

import { supabaseAdmin } from './supabase';

const TYPE_LABELS: Record<string, string> = {
  '[ANTHROPIC_KEY_REDACTED]': 'API Key',
  '[OPENAI_KEY_REDACTED]': 'API Key',
  '[GROQ_KEY_REDACTED]': 'API Key',
  '[GITHUB_TOKEN_REDACTED]': 'Secret Token',
  '[SLACK_TOKEN_REDACTED]': 'Secret Token',
  '[CARD_REDACTED]': 'Credit Card',
  '[PHONE_REDACTED]': 'Phone Number',
  '[DB_URL_REDACTED]': 'Database URL',
  '[AWS_KEY_REDACTED]': 'API Key',
};

function placeholderForType(rawType: string): string {
  if (rawType.includes('CARD')) return '[REDACTED_CARD]';
  if (rawType.includes('PHONE')) return '[REDACTED_PHONE]';
  if (rawType.includes('KEY') || rawType.includes('TOKEN')) return '[REDACTED_SECRET]';
  return '[REDACTED]';
}

export async function logRedactionEvent(
  userId: string,
  sessionId: string | null,
  redactedTypes: string[]
): Promise<void> {
  if (!supabaseAdmin || redactedTypes.length === 0) return;

  const uniqueTypes = [...new Set(redactedTypes)];

  for (const raw of uniqueTypes) {
    const redactedType = TYPE_LABELS[raw] || 'Sensitive Data';
    const redactedPlaceholder = placeholderForType(raw);

    const { error } = await supabaseAdmin.from('redaction_logs').insert({
      user_id: userId,
      session_id: sessionId,
      redacted_type: redactedType,
      redacted_placeholder: redactedPlaceholder,
    });

    if (error) {
      console.warn('[Redaction Log] Failed to persist audit row:', error.message);
    }
  }
}
