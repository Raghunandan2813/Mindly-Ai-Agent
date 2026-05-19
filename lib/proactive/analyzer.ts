// lib/proactive/analyzer.ts
// Background reflection analyzer: sweeps recent logs & graph memories to extract proactive patterns via AI.

import { getRecentChatLogs } from '../memoryService';
import { searchGraphMemory } from '../graphMemoryService';

export interface RawInsight {
  type: 'repetition' | 'commitment' | 'deadline' | 'pattern';
  insight: string;
  suggestion: string;
  urgency: number; // 1-10 scale
  evidence: string[]; // Quotes or evidence lines from memory
}

const ANALYZER_PROMPT = `You are a developer's Proactive Mindly AI Reflection Engine. 
Your goal is to inspect the developer's raw short-term chat logs and permanent long-term memory graph facts, identify actionable insights, and package them into high-fidelity proactive recommendations.

Identify up to 3 distinct patterns of the following types:
1. "repetition": Topics, systems, or bugs mentioned repeatedly (3+ times) in a short window where the user displays genuine difficulty or friction (NOT just progressive coding).
2. "commitment": Commitments, goals, or promises the user stated they would do (e.g. "I'll push the PR", "I need to fix the db") which remain unresolved.
3. "deadline": Approaching calendar events, timelines, or times referenced that are imminent.
4. "pattern": General workflows, productivity anomalies, or habits spanning weeks.

Rules for accuracy and safety:
- CRITICAL: Distinguish active progress from actual friction/stagnation. If the user mentions "database" multiple times because they are writing code successfully, that is NOT friction. Do not create repetition alerts unless they are blocked, stuck, or repeatedly hitting issues.
- Direct suggestions: Write suggestions to speak directly to the user like an incredibly supportive, smart technical advisor with an amazing memory.
- Output absolute JSON only. Do not include markdown, comments, or explanations outside the JSON structure.

Return your response in this exact JSON structure:
{
  "insights": [
    {
      "type": "repetition | commitment | deadline | pattern",
      "insight": "Description of what was found",
      "suggestion": "Friendly recommendation or prompt to display to the user",
      "urgency": 7,
      "evidence": ["Evidence log line 1", "Evidence log line 2"]
    }
  ]
}`;

/**
 * Execute the proactive AI analysis for a specific user.
 */
export async function analyzeUserMemory(userId: string): Promise<RawInsight[]> {
  const provider = (process.env.PROVIDER || 'gemini').toLowerCase();
  const groqApiKey = process.env.GROQ_API_KEY;
  const geminiApiKey = process.env.GEMINI_API_KEY;

  // 1. Retrieve raw conversational data and context
  const [shortTermLogs, longTermFacts] = await Promise.all([
    getRecentChatLogs(userId, 30), // Pull up to 30 logs to have a complete view
    searchGraphMemory(userId, 'current active developer focus and technical issues')
  ]);

  const conversationText = `
=== CURRENT CLOCK / DATE ===
${new Date().toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short' })}

=== LONG-TERM GRAPH FACTS ===
${longTermFacts}

=== SHORT-TERM MESSAGE HISTORY ===
${shortTermLogs}
`;

  try {
    let rawResponse = '';

    if (provider === 'groq' && groqApiKey) {
      const modelName = process.env.GROQ_MODEL || 'llama-3.1-8b-instant';
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${groqApiKey}`,
        },
        body: JSON.stringify({
          model: modelName,
          messages: [
            { role: 'system', content: ANALYZER_PROMPT },
            { role: 'user', content: conversationText },
          ],
          temperature: 0.2,
          response_format: { type: "json_object" }
        }),
      });

      if (!response.ok) {
        console.error(`[Proactive Analyzer] Groq failed: ${response.statusText}`);
        return [];
      }

      const data = await response.json();
      rawResponse = data.choices?.[0]?.message?.content || '';

    } else if (provider === 'gemini' && geminiApiKey) {
      const { GoogleGenerativeAI } = await import('@google/generative-ai');
      const genAI = new GoogleGenerativeAI(geminiApiKey);
      const model = genAI.getGenerativeModel({
        model: 'gemini-2.0-flash',
        systemInstruction: { parts: [{ text: ANALYZER_PROMPT }], role: 'user' },
      });
      const result = await model.generateContent(conversationText);
      rawResponse = result.response.text();

    } else {
      // Direct fallback using other available key or openrouter
      console.warn(`[Proactive Analyzer] Unsupported or unconfigured AI provider: ${provider}`);
      return [];
    }

    // Clean and parse the json object
    const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return [];

    const parsed = JSON.parse(jsonMatch[0]);
    if (!parsed || !Array.isArray(parsed.insights)) {
      return [];
    }

    return parsed.insights as RawInsight[];

  } catch (err) {
    console.error('[Proactive Analyzer] Reflection sweep failed:', err);
    return [];
  }
}
