// app/api/chat/route.ts
// POST: Process incoming user messages, retrieve graph-based memories, prompt AI, and extract knowledge nodes.
import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { saveMessage, searchMemories, getRecentChatLogs } from '@/lib/memoryService';
import { extractAndStoreNodes } from '@/lib/graphMemoryService';
import { supabase, supabaseAdmin } from '@/lib/supabase';
import { v4 as uuidv4 } from 'uuid';

interface ChatRequestBody {
  message: string;
  sessionId?: string;
  userId: string;
}

// Active free models on OpenRouter (May 2026)
const OPENROUTER_FREE_FALLBACKS = [
  'deepseek/deepseek-v4-flash:free',
  'qwen/qwen3-coder:free',
  'nvidia/nemotron-3-super-120b-a12b:free',
  'google/gemma-4-31b-it:free',
  'qwen/qwen3-next-80b-a3b-instruct:free',
  'nvidia/nemotron-3-nano-30b-a3b:free',
  'openrouter/free',
];

function selectGroqModel(message: string): string {
  const lowercaseMsg = message.toLowerCase();
  
  // Complex tasks heuristics (e.g. coding, planning, system design, math)
  const complexKeywords = [
    'write a code', 'program', 'function', 'class in', 'algorithm', 
    'analyze', 'compare', 'difference between', 'elaborate on', 
    'explain in detail', 'architect', 'design a system', 'complex math',
    'solve', 'prove', 'derivation', 'step by step explanation'
  ];
  
  const isComplex = complexKeywords.some(keyword => lowercaseMsg.includes(keyword)) || message.length > 300;
  
  if (isComplex) {
    console.log(`[Groq Model Tiering] Query classified as COMPLEX. Routing to llama-3.3-70b-versatile...`);
    return 'llama-3.3-70b-versatile';
  }
  
  console.log(`[Groq Model Tiering] Query classified as SIMPLE. Routing to llama-3.1-8b-instant...`);
  return 'llama-3.1-8b-instant';
}

export async function POST(req: NextRequest) {
  try {
    const { message, sessionId, userId }: ChatRequestBody = await req.json();

    if (!userId || !message)
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

    // ─── Zero-Dependency PostgreSQL Rate Limiter ───
    // Throttles at a configurable threshold (default 20/min) per user to safeguard Groq quotas
    try {
      const db = supabaseAdmin || supabase;
      const rateLimitThreshold = Number(process.env.RATE_LIMIT_MAX_PER_MINUTE) || 20;
      const oneMinuteAgo = new Date(Date.now() - 60000).toISOString();
      
      const { count } = await db
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('role', 'user')
        .gt('created_at', oneMinuteAgo);

      if (count && count >= rateLimitThreshold) {
        console.warn(`[Rate Limit Exceeded] User ${userId} blocked. (Requests in last min: ${count}/${rateLimitThreshold})`);
        return NextResponse.json(
          { error: `Rate limit exceeded. You can send a maximum of ${rateLimitThreshold} messages per minute.` },
          { status: 429 }
        );
      }
    } catch (err) {
      console.warn('[Rate Limit Skip] Bypassing verification due to db exception:', err);
    }

    const sid = sessionId || uuidv4();
    const provider = (process.env.PROVIDER || 'gemini').toLowerCase();

    // 1. Retrieve hybrid memory context (Knowledge Graph facts + chronological raw logs)
    const [memoryContext, recentLogsContext] = await Promise.all([
      searchMemories(userId, message),
      getRecentChatLogs(userId, 15) // Get the last 15 messages across all sessions
    ]);

    const systemPrompt = `You are a helpful AI assistant with perfect memory of past conversations with this user across all sessions, dates, and chats.

To help you remember, here is the context retrieved from the database for this user:

=== LONG-TERM MEMORY (Knowledge Graph Facts) ===
${memoryContext}
================================================

=== SHORT-TERM MEMORY (Recent Conversation Logs Across Sessions) ===
${recentLogsContext}
=====================================================================

Rules & Instructions:
- Carefully inspect BOTH the Long-Term Knowledge Graph and the Short-Term Recent Logs context above.
- If the user asks about what was discussed in their previous sessions or recent turns (e.g., ticket comparisons, trip planning, yesterday's chat, etc.), refer directly to the "SHORT-TERM MEMORY" logs above and summarize it perfectly.
- If asked personal details, facts, or preferences, use the "LONG-TERM MEMORY" knowledge graph to personalize your answer.
- Always sound natural and responsive. Avoid referencing internal details like "Session IDs" or repeating context tags in your reply. Just talk to the user like a friend with an amazing memory.`;

    let reply = '';

    // 2. Query selected AI provider
    if (provider === 'gemini') {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) throw new Error('GEMINI_API_KEY is not set.');
      
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({
        model: 'gemini-2.0-flash',
        systemInstruction: { parts: [{ text: systemPrompt }], role: 'user' },
      });
      const result = await model.generateContent(message);
      reply = result.response.text();

    } else if (provider === 'openrouter') {
      const apiKey = process.env.OPENROUTER_API_KEY;
      if (!apiKey) throw new Error('OPENROUTER_API_KEY is not set.');

      // Try the configured model first, then fall back if it fails
      const preferredModel = process.env.OPENROUTER_MODEL || 'meta-llama/llama-3.1-8b-instruct:free';
      const modelsToTry = [preferredModel, ...OPENROUTER_FREE_FALLBACKS.filter(m => m !== preferredModel)];
      
      let success = false;
      let lastError = '';

      for (const modelName of modelsToTry) {
        try {
          console.log(`[OpenRouter] Attempting to query model: ${modelName}`);
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
                { role: 'system', content: systemPrompt },
                { role: 'user', content: message }
              ],
            }),
          });

          const data = await res.json();

          if (!res.ok) {
            const errMsg = data.error?.message || res.statusText;
            console.warn(`[OpenRouter] Model ${modelName} failed: ${errMsg}`);
            lastError = errMsg;
            continue; // try next model
          }

          reply = data.choices?.[0]?.message?.content || '';
          if (reply) {
            console.log(`[OpenRouter] Successfully got response using: ${modelName}`);
            success = true;
            break; // we got a reply!
          }
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : 'Unknown fetch error';
          console.warn(`[OpenRouter] Network failure for ${modelName}: ${errMsg}`);
          lastError = errMsg;
        }
      }

      if (!success) {
        throw new Error(`OpenRouter failed for all models. Last error: ${lastError}`);
      }

    } else if (provider === 'groq') {
      const apiKey = process.env.GROQ_API_KEY;
      if (!apiKey) throw new Error('GROQ_API_KEY is not set.');

      // Smart Model Tiering: Default to heuristic classification unless a custom non-default GROQ_MODEL is explicitly overridden
      const modelName = process.env.GROQ_MODEL && process.env.GROQ_MODEL !== 'llama-3.1-8b-instant'
        ? process.env.GROQ_MODEL
        : selectGroqModel(message);

      let response: Response | null = null;
      let attempts = 0;
      const maxAttempts = 3;
      let delay = 2000; // Start with 2 seconds

      while (attempts < maxAttempts) {
        attempts++;
        try {
          response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model: modelName,
              messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: message }
              ],
            }),
          });

          // If rate limited, sleep and retry with exponential backoff
          if (response.status === 429) {
            console.warn(`[Groq Rate Limit] Hit 429 (Attempt ${attempts}/${maxAttempts}). Retrying in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            delay *= 2; // Double delay: 2s -> 4s
            continue;
          }

          break; // Exit loop if successful or other status code
        } catch (err) {
          console.warn(`[Groq Fetch Error] Attempt ${attempts}/${maxAttempts} failed:`, err);
          if (attempts >= maxAttempts) throw err;
          await new Promise(resolve => setTimeout(resolve, delay));
          delay *= 2;
        }
      }

      if (!response || !response.ok) {
        const errorData = response ? await response.json().catch(() => ({})) : {};
        const errMsg = errorData.error?.message || response?.statusText || 'Fetch failed';
        throw new Error(`Groq error: ${errMsg}`);
      }

      const data = await response.json();
      reply = data.choices?.[0]?.message?.content || 'No response from Groq';

    } else if (provider === 'ollama') {
      const ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434';
      const modelName = process.env.OLLAMA_MODEL || 'llama3';

      const res = await fetch(`${ollamaUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: modelName,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: message }
          ],
          stream: false,
        }),
      });

      if (!res.ok) {
        throw new Error(`Ollama error: Ensure Ollama is running and model '${modelName}' is pulled.`);
      }

      const data = await res.json();
      reply = data.message?.content || 'No response from Ollama';

    } else {
      throw new Error(`Unknown provider: ${provider}`);
    }

    // 3. Save both raw messages to conversation log (lightweight, no embeddings)
    await saveMessage(userId, 'user', message, sid);
    await saveMessage(userId, 'assistant', reply, sid);

    // 4. ASYNC: Extract knowledge graph nodes in the background (non-blocking)
    extractAndStoreNodes(userId, message, reply).catch(err => {
      console.error('[Chat] Background graph extraction failed:', err);
    });

    const memoriesCount = (memoryContext.match(/(\*|\[)/g) || []).length;

    return NextResponse.json({ 
      reply, 
      sessionId: sid, 
      memoriesUsed: memoriesCount,
      recalledMemories: memoryContext && memoryContext !== 'No memories stored yet.' ? memoryContext : null
    });

  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : 'Unknown error';
    console.error('Chat API Error:', errMsg);
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}