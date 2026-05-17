// lib/memoryService.ts
// Core memory management: save, retrieve, and search memories.
import { supabase, supabaseAdmin } from './supabase';

// Use admin client for server-side operations to bypass RLS, fallback to public client
const db = supabaseAdmin || supabase;
import { getEmbedding } from './embedService';
import { detectDateRange } from './dateDetect';

export interface MemoryRecord {
    id: string;
    content: string;
    role: string;
    created_at: string;
    session_id?: string;
}

export async function saveMessage(
    userId: string,
    role: string,
    content: string,
    sessionId: string
): Promise<void> {
    const embedding = await getEmbedding(content);
    await db.from('messages').insert({
        user_id: userId, role, content,
        embedding, session_id: sessionId
    });
}

export async function searchMemories(
    userId: string,
    query: string
): Promise<MemoryRecord[]> {
    const embedding = await getEmbedding(query);

    // 1. semantic search
    const { data: semantic } = await db.rpc('match_messages', {
        query_embedding: embedding,
        match_user_id: userId,
        match_count: 15
    });

    // 2. time-based search
    const range = detectDateRange(query);
    let timeResults: MemoryRecord[] = [];
    if (range) {
        const { data } = await db
            .from('messages')
            .select('id, content, role, created_at')
            .eq('user_id', userId)
            .gte('created_at', range.from.toISOString())
            .lte('created_at', range.to.toISOString())
            .order('created_at', { ascending: false })
            .limit(20);
        timeResults = (data as MemoryRecord[]) || [];
    }

    // merge + deduplicate
    const all = [...((semantic as MemoryRecord[]) || []), ...timeResults];
    const seen = new Set<string>();
    return all.filter((m) => {
        if (seen.has(m.id)) return false;
        seen.add(m.id); return true;
    }).slice(0, 20);
}
