// lib/proactive/scorer.ts
// Dynamic Scorer & Guardrails: rates raw insights, enforces 24h caps, checks opt-in status, and stores insights.

import { supabaseAdmin } from '../supabase';
import { RawInsight } from './analyzer';

export interface ScoredInsight {
  type: 'repetition' | 'commitment' | 'deadline' | 'pattern';
  message: string;
  suggestion: string;
  urgency_score: number;
  evidence_memory_ids: string[]; // Can be empty or mapped to references
  expires_at: string;
}

/**
 * Filter, score, and store proactive insights for a user.
 */
export async function scoreAndStoreInsights(userId: string, rawInsights: RawInsight[]): Promise<number> {
  if (!supabaseAdmin) {
    console.error('[Proactive Scorer] supabaseAdmin not available.');
    return 0;
  }

  try {
    // 1. Privacy Opt-In Guardrail: Retrieve user details to verify proactive status
    const { data: { user }, error: userErr } = await supabaseAdmin.auth.admin.getUserById(userId);
    if (userErr || !user) {
      console.warn(`[Proactive Scorer] Could not find user details for ${userId}:`, userErr);
      return 0;
    }

    const proactiveEnabled = user.user_metadata?.proactive_enabled === true;
    if (!proactiveEnabled) {
      console.log(`[Proactive Scorer] Proactive memory is DISABLED for user ${userId}. Skipping reflection.`);
      return 0;
    }

    // 2. Annoyance Guardrail: Check daily insight counts to enforce the "2 per 24 hours" limit
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count: dailyCount } = await supabaseAdmin
      .from('insights')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gt('created_at', twentyFourHoursAgo);

    if (dailyCount !== null && dailyCount >= 2) {
      console.log(`[Proactive Scorer] Daily cap of 2 insights reached for user ${userId}. Skipping.`);
      return 0;
    }

    let savedCount = 0;

    for (const raw of rawInsights) {
      // Annoyance Guardrail: Enforce the daily cap mid-loop
      if (dailyCount !== null && dailyCount + savedCount >= 2) break;

      // 3. Score Urgency Formula
      // Base score is raw urgency scaled from (1-10) to (10-100)
      let score = raw.urgency * 10;

      // Type-specific modifiers to reward high priority matches
      if (raw.type === 'commitment') {
        score += 15; // Commitments represent pending promises, boost!
      } else if (raw.type === 'deadline') {
        score += 25; // Imminent deadlines get high priority boost!
      } else if (raw.type === 'repetition') {
        score += 10; // Repetitions indicate friction, boost!
      }

      // Cap final score at 100
      score = Math.min(score, 100);

      // Threshold constraint: Must cross 70 to surface and interrupt the user
      if (score < 70) {
        console.log(`[Proactive Scorer] Insight discarded. Score ${score} < 70 threshold for: ${raw.insight}`);
        continue;
      }

      // 4. Duplicate Guardrail: Never surface duplicate or identical insights
      const { data: existing } = await supabaseAdmin
        .from('insights')
        .select('id')
        .eq('user_id', userId)
        .eq('message', raw.insight)
        .limit(1);

      if (existing && existing.length > 0) {
        console.log(`[Proactive Scorer] Duplicate insight prevented: "${raw.insight}"`);
        continue;
      }

      // 5. Store valid insight with a 48h expiration window
      const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

      const { error: insertErr } = await supabaseAdmin
        .from('insights')
        .insert({
          user_id: userId,
          type: raw.type,
          message: raw.insight,
          suggestion: raw.suggestion,
          urgency_score: score,
          is_acknowledged: false,
          evidence_memory_ids: [],
          expires_at: expiresAt
        });

      if (insertErr) {
        console.error(`[Proactive Scorer] Failed to store insight: ${insertErr.message}`);
      } else {
        console.log(`[Proactive Scorer] Stored insight successfully! Score: ${score} - "${raw.insight}"`);
        savedCount++;
      }
    }

    return savedCount;

  } catch (err) {
    console.error('[Proactive Scorer] Scoring operation failed:', err);
    return 0;
  }
}
