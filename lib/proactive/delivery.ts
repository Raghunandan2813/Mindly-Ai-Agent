// lib/proactive/delivery.ts
// Delivery Helper layer: fetches and updates dynamic insights, abstracting database operations for front-end routes.

import { supabaseAdmin, supabase, createSupabaseServer } from '../supabase';

// Helper to determine the right database client
async function getDb() {
  if (supabaseAdmin) return supabaseAdmin;
  return await createSupabaseServer();
}

export interface InsightRecord {
  id: string;
  type: 'repetition' | 'commitment' | 'deadline' | 'pattern';
  message: string;
  suggestion: string;
  urgency_score: number;
  is_acknowledged: boolean;
  created_at: string;
}

/**
 * Retrieve all currently active, non-expired, and unacknowledged insights for a user.
 */
export async function getActiveInsights(userId: string): Promise<InsightRecord[]> {
  const db = await getDb();
  const nowStr = new Date().toISOString();

  const { data, error } = await db
    .from('insights')
    .select('id, type, message, suggestion, urgency_score, is_acknowledged, created_at')
    .eq('user_id', userId)
    .eq('is_acknowledged', false)
    .gt('expires_at', nowStr)
    .order('urgency_score', { ascending: false });

  if (error) {
    console.error(`[Proactive Delivery] Failed to fetch active insights: ${error.message}`);
    return [];
  }

  return (data as InsightRecord[]) || [];
}

/**
 * Permanently acknowledge (dismiss) a proactive insight.
 */
export async function acknowledgeInsight(userId: string, insightId: string): Promise<boolean> {
  const db = await getDb();

  const { error } = await db
    .from('insights')
    .update({ is_acknowledged: true })
    .eq('id', insightId)
    .eq('user_id', userId);

  if (error) {
    console.error(`[Proactive Delivery] Dismissal update failed: ${error.message}`);
    return false;
  }

  console.log(`[Proactive Delivery] Dismissed insight ${insightId} for user ${userId}`);
  return true;
}
