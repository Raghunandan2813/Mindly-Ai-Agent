// lib/summarization/scorer.ts
// Computes priority scores and handles vector embeddings + saving of distilled session summaries.

import { supabaseAdmin, supabase } from '../supabase';
import { getEmbedding } from '../embedService';
import { GeneratedSummary } from './summarizer';

const db = supabaseAdmin || supabase;

/**
 * Computes priority score for a summary.
 * 
 * Score logic:
 * - Base score: 5
 * - +3 for messageCount > 50
 * - +2 for decisions made
 * - +2 for bugs resolved / problems solved
 * - +1 for action items
 * - +1 for every 10 messages over 20
 * - -1 for every month old (decay)
 * - Clamped strictly between 1 and 10
 */
export function calculatePriorityScore(
  summary: string,
  messageCount: number,
  hasDecisions: boolean,
  hasActionItems: boolean,
  createdAt: Date = new Date()
): number {
  let score = 5; // Base score

  // Boost for long sessions
  if (messageCount > 50) {
    score += 3;
  }

  // Boost for decisions made
  if (hasDecisions) {
    score += 2;
  }

  // Boost for bugs resolved / problems solved
  const lowercaseSummary = summary.toLowerCase();
  const bugWords = ['fixed', 'resolved', 'solution', 'bug fixed', 'problem solved', 'issue fixed', 'patched', 'debugged', 'repaired'];
  const hasBugFix = bugWords.some(word => lowercaseSummary.includes(word));
  if (hasBugFix) {
    score += 2;
  }

  // Boost for commitments / action items
  if (hasActionItems) {
    score += 1;
  }

  // Boost for every 10 messages over 20
  if (messageCount > 20) {
    score += Math.floor((messageCount - 20) / 10);
  }

  // Time decay: -1 point per month of age
  const now = new Date();
  const monthsDiff = (now.getFullYear() - createdAt.getFullYear()) * 12 + (now.getMonth() - createdAt.getMonth());
  score -= Math.max(0, monthsDiff);

  // Clamp score between 1 and 10
  return Math.max(1, Math.min(10, score));
}

/**
 * Saves a completed session summary with score and embeddings to Supabase.
 */
export async function saveSessionSummary(
  userId: string,
  sessionId: string,
  genSummary: GeneratedSummary,
  messageCount: number,
  durationMinutes: number
): Promise<any> {
  const { summary, hasDecisions, hasActionItems, topics } = genSummary;

  // 1. Calculate Priority Score
  const priority = calculatePriorityScore(summary, messageCount, hasDecisions, hasActionItems);

  // 2. Generate Vector Embedding of the summary
  let embedding: number[] | null = null;
  try {
    embedding = await getEmbedding(summary);
  } catch (err: any) {
    console.error(`[Scorer] Failed to generate embedding for summary:`, err.message);
  }

  // 3. Save to database
  const { data, error } = await db
    .from('session_summaries')
    .insert({
      user_id: userId,
      session_id: sessionId,
      summary,
      topics,
      priority,
      message_count: messageCount,
      duration_minutes: durationMinutes,
      has_decisions: hasDecisions,
      has_action_items: hasActionItems,
      embedding
    })
    .select()
    .single();

  if (error) {
    console.error(`[Scorer] Failed to save session summary to database:`, error.message);
    throw error;
  }

  console.log(`[Scorer] Session summary for ${sessionId.slice(-6)} saved successfully with priority: ${priority}`);
  return data;
}
