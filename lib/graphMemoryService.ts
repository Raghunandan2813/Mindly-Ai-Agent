// lib/graphMemoryService.ts
// Core knowledge graph engine: extract entities from conversations, store as nodes+edges,
// and perform semantic + graph-traversal memory retrieval.

import { supabaseAdmin, supabase } from './supabase';
import { getEmbedding } from './embedService';

const db = supabaseAdmin || supabase;

// ============================================================
// Types
// ============================================================

export interface MemoryNode {
  id: string;
  label: string;
  node_type: string;
  content: string;
  metadata: Record<string, any>;
  created_at: string;
  updated_at?: string;
  similarity?: number;
}

export interface MemoryEdge {
  id: string;
  source_id: string;
  target_id: string;
  relation: string;
  strength: number;
  created_at: string;
}

interface ExtractedFact {
  label: string;
  type: string;
  content: string;
}

interface ExtractedRelation {
  source_label: string;
  target_label: string;
  relation: string;
}

interface ExtractionResult {
  nodes: ExtractedFact[];
  edges: ExtractedRelation[];
}

// ============================================================
// Fact Extraction — Uses AI to extract entities + relations
// ============================================================

const EXTRACTION_PROMPT = `You are a knowledge graph extractor. From the conversation below, extract key facts, entities, preferences, and relationships about the USER.

Rules:
- Extract ONLY information about the user (their name, pets, preferences, skills, locations, people they mention, etc.)
- Do NOT extract generic/trivial information (e.g. "user said hello")
- Each node should represent a distinct entity or fact
- Each edge should represent a relationship between two entities
- Use simple, lowercase labels (e.g. "milo", "golden retriever", "pizza")
- Use clear relationship types (e.g. "has_pet", "likes", "works_at", "is_a", "lives_in")
- If no meaningful facts can be extracted, return empty arrays

Respond ONLY with valid JSON in this exact format (no markdown, no explanation):
{"nodes":[{"label":"milo","type":"pet","content":"User's dog named Milo"}],"edges":[{"source_label":"user","target_label":"milo","relation":"has_pet"}]}`;

/**
 * Uses the current AI provider to extract entities and relationships from a conversation turn.
 */
async function extractFacts(userMessage: string, aiReply: string): Promise<ExtractionResult> {
  const conversationText = `USER: ${userMessage}\nASSISTANT: ${aiReply}`;
  const provider = (process.env.PROVIDER || 'gemini').toLowerCase();

  try {
    let rawResponse = '';

    if (provider === 'gemini') {
      const { GoogleGenerativeAI } = await import('@google/generative-ai');
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) return { nodes: [], edges: [] };

      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({
        model: 'gemini-2.0-flash',
        systemInstruction: { parts: [{ text: EXTRACTION_PROMPT }], role: 'user' },
      });
      const result = await model.generateContent(conversationText);
      rawResponse = result.response.text();

    } else if (provider === 'openrouter') {
      const apiKey = process.env.OPENROUTER_API_KEY;
      if (!apiKey) return { nodes: [], edges: [] };

      const modelName = process.env.OPENROUTER_MODEL || 'meta-llama/llama-3.1-8b-instruct:free';
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': 'http://localhost:3000',
          'X-Title': 'Memory Agent',
        },
        body: JSON.stringify({
          model: modelName,
          messages: [
            { role: 'system', content: EXTRACTION_PROMPT },
            { role: 'user', content: conversationText },
          ],
          temperature: 0.1, // Low temp for structured extraction
        }),
      });

      const data = await res.json();
      rawResponse = data.choices?.[0]?.message?.content || '';

    } else if (provider === 'groq') {
      const apiKey = process.env.GROQ_API_KEY;
      if (!apiKey) return { nodes: [], edges: [] };

      const modelName = process.env.GROQ_MODEL || 'llama-3.1-8b-instant';
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: modelName,
          messages: [
            { role: 'system', content: EXTRACTION_PROMPT },
            { role: 'user', content: conversationText },
          ],
          temperature: 0.1,
          response_format: { type: "json_object" }
        }),
      });

      const data = await res.json();
      rawResponse = data.choices?.[0]?.message?.content || '';

    } else if (provider === 'ollama') {
      const ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434';
      const modelName = process.env.OLLAMA_MODEL || 'llama3';

      const res = await fetch(`${ollamaUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: modelName,
          messages: [
            { role: 'system', content: EXTRACTION_PROMPT },
            { role: 'user', content: conversationText },
          ],
          stream: false,
        }),
      });

      const data = await res.json();
      rawResponse = data.message?.content || '';
    }

    // Parse JSON from the AI response (handle markdown code blocks)
    const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { nodes: [], edges: [] };

    const parsed = JSON.parse(jsonMatch[0]) as ExtractionResult;

    // Validate structure
    if (!Array.isArray(parsed.nodes)) parsed.nodes = [];
    if (!Array.isArray(parsed.edges)) parsed.edges = [];

    return parsed;

  } catch (err) {
    console.error('[GraphMemory] Extraction failed:', err);
    return { nodes: [], edges: [] };
  }
}

// ============================================================
// Node CRUD — Upsert/dedup nodes, create edges
// ============================================================

/**
 * Find an existing node by label (case-insensitive) for a user, or create a new one.
 */
async function mergeOrCreateNode(
  userId: string,
  label: string,
  nodeType: string,
  content: string
): Promise<string> {
  const normalizedLabel = label.toLowerCase().trim();

  // Check if node with same label already exists for this user
  const { data: existing } = await db
    .from('memory_nodes')
    .select('id, content')
    .eq('user_id', userId)
    .ilike('label', normalizedLabel)
    .limit(1);

  if (existing && existing.length > 0) {
    // Update existing node with richer content if new content is longer
    const existingNode = existing[0];
    const newContentLength = (content || '').length;
    const oldContentLength = (existingNode.content || '').length;
    
    if (newContentLength > oldContentLength) {
      const embedding = await getEmbedding(content);
      await db
        .from('memory_nodes')
        .update({ content, embedding, updated_at: new Date().toISOString() })
        .eq('id', existingNode.id);
    }
    return existingNode.id;
  }

  // Create new node
  const embedding = await getEmbedding(content);
  const { data: newNode, error } = await db
    .from('memory_nodes')
    .insert({
      user_id: userId,
      label: normalizedLabel,
      node_type: nodeType,
      content,
      embedding,
    })
    .select('id')
    .single();

  if (error) {
    console.error('[GraphMemory] Failed to create node:', error.message);
    throw error;
  }

  return newNode.id;
}

/**
 * Create an edge between two nodes if it doesn't already exist.
 * If it exists, increase the strength (reinforcement).
 */
async function mergeOrCreateEdge(
  userId: string,
  sourceId: string,
  targetId: string,
  relation: string
): Promise<void> {
  const normalizedRelation = relation.toLowerCase().trim();

  // Check if edge already exists
  const { data: existing } = await db
    .from('memory_edges')
    .select('id, strength')
    .eq('user_id', userId)
    .eq('source_id', sourceId)
    .eq('target_id', targetId)
    .eq('relation', normalizedRelation)
    .limit(1);

  if (existing && existing.length > 0) {
    // Reinforce existing edge
    await db
      .from('memory_edges')
      .update({ strength: (existing[0].strength || 1) + 0.5 })
      .eq('id', existing[0].id);
    return;
  }

  // Create new edge
  await db.from('memory_edges').insert({
    user_id: userId,
    source_id: sourceId,
    target_id: targetId,
    relation: normalizedRelation,
  });
}

// ============================================================
// Public API
// ============================================================

/**
 * Extract facts from a conversation turn and store as graph nodes + edges.
 * This runs asynchronously (fire-and-forget) to avoid blocking the chat response.
 */
export async function extractAndStoreNodes(
  userId: string,
  userMessage: string,
  aiReply: string
): Promise<void> {
  try {
    const extraction = await extractFacts(userMessage, aiReply);

    if (extraction.nodes.length === 0) {
      console.log('[GraphMemory] No facts extracted from this turn.');
      return;
    }

    console.log(`[GraphMemory] Extracted ${extraction.nodes.length} nodes, ${extraction.edges.length} edges`);

    // First, ensure a "user" root node exists
    const userNodeId = await mergeOrCreateNode(userId, 'user', 'person', 'The user themselves');

    // Create/merge all extracted nodes
    const labelToId: Record<string, string> = { user: userNodeId };

    for (const node of extraction.nodes) {
      const nodeId = await mergeOrCreateNode(userId, node.label, node.type, node.content);
      labelToId[node.label.toLowerCase().trim()] = nodeId;
    }

    // Create/merge all extracted edges
    for (const edge of extraction.edges) {
      const sourceLabel = edge.source_label.toLowerCase().trim();
      const targetLabel = edge.target_label.toLowerCase().trim();

      const sourceId = labelToId[sourceLabel];
      const targetId = labelToId[targetLabel];

      if (sourceId && targetId && sourceId !== targetId) {
        await mergeOrCreateEdge(userId, sourceId, targetId, edge.relation);
      }
    }

    console.log('[GraphMemory] Graph updated successfully.');

  } catch (err) {
    console.error('[GraphMemory] extractAndStoreNodes failed:', err);
    // Non-blocking: don't throw, just log
  }
}

/**
 * Search the knowledge graph for relevant context.
 * Combines semantic similarity search on nodes + 1-hop graph traversal.
 */
export async function searchGraphMemory(
  userId: string,
  query: string
): Promise<string> {
  try {
    const contextParts: string[] = [];
    const visitedNodeIds = new Set<string>();

    // ─── PART 1: Core Profile Facts (Always fetch root 'user' node neighbors) ───
    const { data: rootNodeArray } = await db
      .from('memory_nodes')
      .select('id, label, node_type, content')
      .eq('user_id', userId)
      .eq('label', 'user')
      .limit(1);

    if (rootNodeArray && rootNodeArray.length > 0) {
      const rootNode = rootNodeArray[0];
      visitedNodeIds.add(rootNode.id);
      
      const { data: rootNeighbors } = await db.rpc('get_node_neighbors', {
        node_id: rootNode.id,
        match_user_id: userId,
      });

      if (rootNeighbors && rootNeighbors.length > 0) {
        contextParts.push('=== Core User Profile (Permanent Facts) ===');
        for (const neighbor of rootNeighbors) {
          visitedNodeIds.add(neighbor.neighbor_id);
          const arrow = neighbor.direction === 'outgoing' ? '→' : '←';
          contextParts.push(
            `* User [${neighbor.relation}] ${neighbor.neighbor_label}: ${neighbor.neighbor_content}`
          );
        }
        contextParts.push('============================================\n');
      }
    }

    // ─── PART 2: Contextual Vector Search Facts ───
    const embedding = await getEmbedding(query);
    const { data: semanticNodes } = await db.rpc('match_nodes', {
      query_embedding: embedding,
      match_user_id: userId,
      match_count: 8,
    });

    if (semanticNodes && semanticNodes.length > 0) {
      const contextualParts: string[] = [];

      for (const node of (semanticNodes as MemoryNode[])) {
        if (visitedNodeIds.has(node.id)) continue;
        visitedNodeIds.add(node.id);

        contextualParts.push(`[${node.node_type.toUpperCase()}] ${node.label}: ${node.content}`);

        // Get neighbors of the matched node (1-hop traversal)
        const { data: neighbors } = await db.rpc('get_node_neighbors', {
          node_id: node.id,
          match_user_id: userId,
        });

        if (neighbors && neighbors.length > 0) {
          for (const neighbor of neighbors) {
            if (!visitedNodeIds.has(neighbor.neighbor_id)) {
              visitedNodeIds.add(neighbor.neighbor_id);
              const arrow = neighbor.direction === 'outgoing' ? '→' : '←';
              contextualParts.push(
                `  ${arrow} [${neighbor.relation}] ${neighbor.neighbor_label}: ${neighbor.neighbor_content}`
              );
            }
          }
        }
      }

      if (contextualParts.length > 0) {
        contextParts.push('=== Contextual Conversation Memories ===');
        contextParts.push(...contextualParts);
        contextParts.push('=========================================');
      }
    }

    if (contextParts.length === 0) {
      return 'No memories stored yet.';
    }

    return contextParts.join('\n');

  } catch (err) {
    console.error('[GraphMemory] searchGraphMemory failed:', err);
    return 'Memory search encountered an error.';
  }
}

/**
 * Get all nodes and edges for a user (for graph visualization).
 */
export async function getUserGraph(userId: string): Promise<{ nodes: MemoryNode[]; edges: MemoryEdge[] }> {
  const { data: nodes } = await db
    .from('memory_nodes')
    .select('id, label, node_type, content, metadata, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  const { data: edges } = await db
    .from('memory_edges')
    .select('id, source_id, target_id, relation, strength, created_at')
    .eq('user_id', userId);

  return {
    nodes: (nodes as MemoryNode[]) || [],
    edges: (edges as MemoryEdge[]) || [],
  };
}

/**
 * Delete a node and all its connected edges.
 */
export async function deleteNode(userId: string, nodeId: string): Promise<void> {
  // Edges will be cascade-deleted automatically thanks to ON DELETE CASCADE
  await db
    .from('memory_nodes')
    .delete()
    .eq('id', nodeId)
    .eq('user_id', userId);
}
