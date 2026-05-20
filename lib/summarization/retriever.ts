// lib/summarization/retriever.ts
// Handles vector-based semantic retrieval of high-priority session summaries.

import { supabaseAdmin, supabase } from '../supabase';
import { getEmbedding } from '../embedService';
import { getFriendlyDateLabel } from '../memoryService';

const db = supabaseAdmin || supabase;

export interface SummaryMatch {
  id: string;
  session_id: string;
  summary: string;
  topics: string[];
  priority: number;
  message_count: number;
  duration_minutes: number;
  has_decisions: boolean;
  has_action_items: boolean;
  created_at: string;
  similarity: number;
}

/**
 * Performs a vector similarity search on session summaries.
 */
export async function searchSessionSummaries(
  userId: string,
  query: string,
  minSimilarity = 0.65
): Promise<SummaryMatch[]> {
  try {
    const embedding = await getEmbedding(query);

    const { data: matches, error } = await db.rpc('match_session_summaries', {
      query_embedding: embedding,
      match_user_id: userId,
      match_count: 3
    });

    if (error) {
      console.error(`[Summary Retriever] RPC match_session_summaries failed:`, error.message);
      return [];
    }

    if (!matches || matches.length === 0) {
      return [];
    }

    // Filter by similarity threshold
    const filteredMatches = (matches as SummaryMatch[]).filter(m => m.similarity >= minSimilarity);

    console.log(`[Summary Retriever] Found ${filteredMatches.length} summaries matching query "${query}" above threshold ${minSimilarity}`);
    return filteredMatches;
  } catch (err: any) {
    console.error(`[Summary Retriever] Search failed:`, err.message);
    return [];
  }
}

/**
 * Formats a list of summary matches into a highly dense context block for the LLM.
 */
export function formatSummaryMatches(matches: SummaryMatch[]): string {
  if (matches.length === 0) return '';

  const parts: string[] = [];
  parts.push('=== DISTILLED SESSION SUMMARIES (High Priority Context) ===');

  matches.forEach(m => {
    const dateLabel = getFriendlyDateLabel(m.created_at || new Date().toISOString());
    const topicTags = m.topics && m.topics.length > 0 ? m.topics.join(', ') : 'general';
    const decisionBadge = m.has_decisions ? ' [Decisions Made]' : '';
    const actionBadge = m.has_action_items ? ' [Action Items]' : '';

    parts.push(
      `[${dateLabel}] [Session: ${m.session_id.slice(-6)}] Priority: ${m.priority}/10 (${m.message_count} msgs, ${m.duration_minutes} mins)${decisionBadge}${actionBadge}\nTopics: ${topicTags}\nSummary:\n${m.summary}\n`
    );
  });

  parts.push('===========================================================');
  return parts.join('\n');
}
