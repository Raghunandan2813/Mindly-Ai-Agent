// lib/memoryService.ts
// Lightweight message storage (no embeddings) + graph-based memory retrieval.
import { supabaseAdmin, supabase, createSupabaseServer } from './supabase';
import { searchGraphMemory } from './graphMemoryService';

// Dynamic client resolver to ensure we are always authenticated on Vercel
async function getDb() {
    if (supabaseAdmin) return supabaseAdmin;
    return await createSupabaseServer();
}

export interface MemoryRecord {
    id: string;
    content: string;
    role: string;
    created_at: string;
    session_id?: string;
}

/**
 * Save a raw message to the messages table (no embedding — lightweight).
 */
export async function saveMessage(
    userId: string,
    role: string,
    content: string,
    sessionId: string
): Promise<void> {
    const db = await getDb();
    await db.from('messages').insert({
        user_id: userId, role, content,
        session_id: sessionId
    });
}

import { detectDateRange } from './dateDetect';

export function getFriendlyDateLabel(dateStr: string): string {
    const d = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const dDate = d.toDateString();
    if (dDate === today.toDateString()) {
        return `Today, ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
    } else if (dDate === yesterday.toDateString()) {
        return `Yesterday, ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
    } else {
        return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });
    }
}

/**
 * Search memories using knowledge graph semantic search OR precise date-based filtering.
 * Never mixes both for the same query.
 */
export async function searchMemories(
    userId: string,
    query: string,
    sessionId?: string
): Promise<string> {
    const dateRange = detectDateRange(query);

    if (dateRange) {
        console.log(`[Memory Search] Date reference detected in query "${query}". Using precise date filter...`);
        const db = await getDb();

        let queryBuilder = db
            .from('messages')
            .select('role, content, created_at, session_id')
            .eq('user_id', userId)
            .gte('created_at', dateRange.from.toISOString())
            .lte('created_at', dateRange.to.toISOString())
            .order('created_at', { ascending: true });

        // Exclude current session messages from memory retrieval (already visible in chat history)
        if (sessionId) {
            queryBuilder = queryBuilder.neq('session_id', sessionId);
        }

        const { data: logs, error } = await queryBuilder;

        if (error) {
            console.error('[Memory Search] Date query failed:', error.message);
            return 'No memories found for that date period due to query exception.';
        }

        if (!logs || logs.length === 0) {
            return `I don't have any record of conversations from that date.`;
        }

        const formatted = logs.map(msg => {
            const dateLabel = getFriendlyDateLabel(msg.created_at || new Date().toISOString());
            return `[${dateLabel}] ${msg.role === 'user' ? 'user' : 'assistant'}: ${msg.content}`;
        });

        return formatted.join('\n');
    }

    // No time reference -> use semantic knowledge graph search
    console.log(`[Memory Search] No date reference in query "${query}". Using semantic knowledge graph...`);
    return searchGraphMemory(userId, query);
}

/**
 * Retrieve the most recent raw messages across other sessions to serve as chronological short-term conversational context.
 */
export async function getRecentChatLogs(userId: string, limit = 20, excludeSessionId?: string): Promise<string> {
    const db = await getDb();

    let query = db
        .from('messages')
        .select('role, content, session_id, created_at')
        .eq('user_id', userId);

    if (excludeSessionId) {
        query = query.neq('session_id', excludeSessionId);
    }

    const { data: logs } = await query
        .order('created_at', { ascending: false })
        .limit(limit);

    if (!logs || logs.length === 0) return 'No recent chat history.';

    // Reverse to chronological order
    const chronological = [...logs].reverse();

    return chronological
        .map(log => {
            const dateLabel = getFriendlyDateLabel(log.created_at || new Date().toISOString());
            return `[${dateLabel}] [Session: ${log.session_id ? log.session_id.slice(-6) : 'unknown'}] ${log.role === 'user' ? 'USER' : 'ASSISTANT'}: ${log.content}`;
        })
        .join('\n');
}
