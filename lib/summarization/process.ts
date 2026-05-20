// lib/summarization/process.ts
// Central lock-protected workflow to evaluate, generate, and save session summaries.

import { supabaseAdmin, supabase } from '../supabase';
import { redactSensitiveData } from '../security';

const db = supabaseAdmin || supabase;

/**
 * Executes a locked, race-condition-proof summarization sequence for a user session.
 */
export async function summarizeSession(
  userId: string,
  sessionId: string
): Promise<any | null> {
  if (!userId || !sessionId) return null;

  // Step 1 — check if summary already exists
  const { data: existing, error: existErr } = await db
    .from('session_summaries')
    .select('id, session_id, summary, topics, priority, message_count, duration_minutes, created_at')
    .eq('user_id', userId)
    .eq('session_id', sessionId)
    .limit(1);

  if (existErr) {
    console.error('[SummarizeSession] Database check failed:', existErr.message);
  }

  if (existing && existing.length > 0) {
    console.log(`[SummarizeSession] Session ${sessionId.slice(-6)} already summarized, skipping`);
    return existing[0];
  }

  // Step 2 — try to acquire lock
  // if another process already has lock, this insert fails
  const { error: lockError } = await db
    .from('summarization_locks')
    .insert({ session_id: sessionId, user_id: userId });

  if (lockError) {
    // lock already exists — another process is summarizing
    console.log(`[SummarizeSession] Session ${sessionId.slice(-6)} already being summarized, skipping`);
    return null;
  }

  try {
    // Step 3 — fetch messages for this session (never summarize flagged messages)
    const { data: messages, error: fetchErr } = await db
      .from('messages')
      .select('id, role, content, created_at')
      .eq('user_id', userId)
      .eq('session_id', sessionId)
      .eq('is_flagged', false)
      .order('created_at', { ascending: true });

    if (fetchErr || !messages || messages.length === 0) {
      console.log(`[SummarizeSession] No unflagged messages found for session ${sessionId.slice(-6)}, stopping`);
      return null;
    }

    // Step 4 — check eligibility count
    const { evaluateSessionEligibility } = await import('./trigger');
    const stats = await evaluateSessionEligibility(userId, sessionId);
    if (!stats.shouldSummarize) {
      console.log(`[SummarizeSession] Session ${sessionId.slice(-6)} does not qualify for summarization, skipping`);
      return null;
    }

    // Step 5 — generate summary
    const { generateSessionSummary } = await import('./summarizer');
    const genSummary = await generateSessionSummary(stats.messages);

    // Step 6 — validate summary before saving
    if (!genSummary || !genSummary.summary || genSummary.summary.trim().length < 50) {
      console.warn('[SummarizeSession] Summary too short, skipping save');
      return null;
    }

    // Step 7/8 — embed and save summary (redacting sensitive data from summary too!)
    const { redacted } = redactSensitiveData(genSummary.summary);
    genSummary.summary = redacted;

    const { saveSessionSummary } = await import('./scorer');
    const savedSummary = await saveSessionSummary(userId, sessionId, genSummary, stats.messageCount, stats.durationMinutes);
    return savedSummary;

  } catch (err: any) {
    console.error(`[SummarizeSession] Exception during summarization sequence:`, err.message);
    return null;
  } finally {
    // Step 9 — always release lock even if something failed
    await db
      .from('summarization_locks')
      .delete()
      .eq('session_id', sessionId)
      .eq('user_id', userId);
  }
}
