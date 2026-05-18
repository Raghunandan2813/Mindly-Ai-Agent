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

/**
 * Search memories using the knowledge graph.
 * Combines semantic vector search on nodes + 1-hop graph traversal.
 */
export async function searchMemories(
    userId: string,
    query: string
): Promise<string> {
    return searchGraphMemory(userId, query);
}

/**
 * Retrieve the most recent raw messages across all sessions to serve as chronological short-term conversational context.
 */
export async function getRecentChatLogs(userId: string, limit = 15): Promise<string> {
    const db = await getDb();
    const { data: logs } = await db
        .from('messages')
        .select('role, content, session_id, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

    if (!logs || logs.length === 0) return 'No recent chat history.';

    // Reverse to chronological order
    const chronological = [...logs].reverse();

    return chronological
        .map(log => `[Session: ${log.session_id ? log.session_id.slice(-6) : 'unknown'}] ${log.role === 'user' ? 'USER' : 'ASSISTANT'}: ${log.content}`)
        .join('\n');
}
