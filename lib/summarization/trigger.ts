// lib/summarization/trigger.ts
// Analyzes message count, duration, and token sizes to determine if a session should be collapsed into a summary.

import { supabaseAdmin, supabase } from '../supabase';

const db = supabaseAdmin || supabase;

export interface SessionStats {
  messageCount: number;
  durationMinutes: number;
  totalCharacters: number;
  shouldSummarize: boolean;
  messages: any[];
}

/**
 * Evaluates whether a specific session meets the criteria for summarization.
 * 
 * Criteria:
 * - Message count > 10
 * - OR Session duration > 15 minutes
 * - OR Total characters > 8000 (~2000 tokens)
 */
export async function evaluateSessionEligibility(userId: string, sessionId: string): Promise<SessionStats> {
  if (!userId || !sessionId) {
    return { messageCount: 0, durationMinutes: 0, totalCharacters: 0, shouldSummarize: false, messages: [] };
  }

  // Fetch all messages belonging to the user and session
  const { data: logs, error } = await db
    .from('messages')
    .select('id, role, content, created_at')
    .eq('user_id', userId)
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error(`[Summarization Trigger] Failed to fetch session logs:`, error.message);
    return { messageCount: 0, durationMinutes: 0, totalCharacters: 0, shouldSummarize: false, messages: [] };
  }

  if (!logs || logs.length === 0) {
    return { messageCount: 0, durationMinutes: 0, totalCharacters: 0, shouldSummarize: false, messages: [] };
  }

  const messageCount = logs.length;

  // Calculate duration in minutes between first and last message
  const firstMsgTime = new Date(logs[0].created_at).getTime();
  const lastMsgTime = new Date(logs[logs.length - 1].created_at).getTime();
  const durationMs = lastMsgTime - firstMsgTime;
  const durationMinutes = Math.max(1, Math.round(durationMs / 60000));

  // Calculate total characters (approximate token calculation: 4 chars = 1 token, 2000 tokens = 8000 chars)
  const totalCharacters = logs.reduce((sum, log) => sum + (log.content || '').length, 0);

  // Trigger evaluation: in dev mode, summarize if there are at least 2 messages to make testing instant!
  const isDev = process.env.NODE_ENV === 'development';
  const shouldSummarize = isDev 
    ? messageCount >= 2 
    : (messageCount > 10 || durationMinutes > 15 || totalCharacters > 8000);

  console.log(`[Summarization Trigger] Session ${sessionId.slice(-6)} stats - Messages: ${messageCount}, Duration: ${durationMinutes} mins, Characters: ${totalCharacters}. Should Summarize? ${shouldSummarize} (isDev: ${isDev})`);

  return {
    messageCount,
    durationMinutes,
    totalCharacters,
    shouldSummarize,
    messages: logs
  };
}
