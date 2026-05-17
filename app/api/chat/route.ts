// app/api/chat/route.ts
// POST: Process incoming user messages, retrieve related memories, prompt AI (with fallback), and save new memories.
import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { saveMessage, searchMemories } from '@/lib/memoryService';
import { v4 as uuidv4 } from 'uuid';

interface ChatRequestBody {
  message: string;
  sessionId?: string;
  userId: string;
}

// Highly reliable list of active free models on OpenRouter
const OPENROUTER_FREE_FALLBACKS = [
  'baidu/cobuddy:free',
  'meta-llama/llama-3.1-8b-instruct:free',
  'qwen/qwen-2.5-7b-instruct:free',
  'google/gemma-2-9b-it:free',
  'meta-llama/llama-3.2-3b-instruct:free',
  'microsoft/phi-3-medium-128k-instruct:free',
  'meta-llama/llama-3-8b-instruct:free',
];

export async function POST(req: NextRequest) {
  try {
    const { message, sessionId, userId }: ChatRequestBody = await req.json();

    if (!userId || !message)
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

    const sid = sessionId || uuidv4();
    const provider = (process.env.PROVIDER || 'gemini').toLowerCase();

    // 1. fetch relevant memories from ALL sessions
    const memories = await searchMemories(userId, message);

    const memoryContext = memories.length > 0
      ? memories.map(m =>
        `[${new Date(m.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}] ${m.role}: ${m.content}`
      ).join('\n')
      : 'No past conversations yet.';

    const systemPrompt = `You are a helpful AI assistant with perfect memory of every past conversation with this user across all sessions and dates.

Here is what you remember from past conversations:
---
${memoryContext}
---

Rules:
- Use this memory to give contextual, personalized answers
- If asked "what did I ask on [date]?" search the memory above and answer precisely
- If asked "what did we talk about?" summarize from the memory above
- Never say you don't remember — if it's not in memory, say "I don't have a record of that"
- Be natural, don't quote the memory verbatim, just use it`;

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

    // 3. save both messages to memory
    await saveMessage(userId, 'user', message, sid);
    await saveMessage(userId, 'assistant', reply, sid);

    return NextResponse.json({ reply, sessionId: sid, memoriesUsed: memories.length });

  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : 'Unknown error';
    console.error('Chat API Error:', errMsg);
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}