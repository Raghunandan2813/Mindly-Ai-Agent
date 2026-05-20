// lib/summarization/summarizer.ts
// Summarizes a conversation session using the configured AI provider.

const SUMMARIZATION_PROMPT = `You are summarizing a conversation between a developer and their AI assistant. 

Extract and structure the following details:
1. TOPIC: What was the main subject discussed?
2. PROBLEMS: What issues or bugs were mentioned?
3. DECISIONS: What decisions were made?
4. SOLUTIONS: What fixes or solutions were found?
5. ACTION ITEMS: What did the developer say they would do?
6. KEY FACTS: Any important facts, numbers, names, technologies mentioned?

Rules:
- Write as extremely dense, factual bullet points. No filler words or preambles.
- Max 200 words total.
- A developer should be able to read this in 30 seconds and know exactly what happened in the session.`;

export interface GeneratedSummary {
  summary: string;
  hasDecisions: boolean;
  hasActionItems: boolean;
  topics: string[];
}

/**
 * Sends a list of session messages to the configured LLM provider for summarization.
 */
export async function generateSessionSummary(messages: any[]): Promise<GeneratedSummary> {
  const provider = (process.env.PROVIDER || 'gemini').toLowerCase();
  const groqApiKey = process.env.GROQ_API_KEY;
  const geminiApiKey = process.env.GEMINI_API_KEY;
  const openrouterApiKey = process.env.OPENROUTER_API_KEY;

  // Format the conversation log
  const conversationText = messages
    .map(m => `${m.role.toUpperCase()}: ${m.content}`)
    .join('\n\n');

  let rawSummary = '';

  try {
    if (provider === 'gemini' && geminiApiKey) {
      const { GoogleGenerativeAI } = await import('@google/generative-ai');
      const genAI = new GoogleGenerativeAI(geminiApiKey);
      const model = genAI.getGenerativeModel({
        model: 'gemini-2.0-flash',
        systemInstruction: { parts: [{ text: SUMMARIZATION_PROMPT }], role: 'user' },
      });
      const result = await model.generateContent(conversationText);
      rawSummary = result.response.text();

    } else if (provider === 'groq' && groqApiKey) {
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
            { role: 'system', content: SUMMARIZATION_PROMPT },
            { role: 'user', content: conversationText },
          ],
          temperature: 0.1,
        }),
      });

      if (!response.ok) {
        throw new Error(`Groq failed: ${response.statusText}`);
      }

      const data = await response.json();
      rawSummary = data.choices?.[0]?.message?.content || '';

    } else if (provider === 'openrouter' && openrouterApiKey) {
      const modelName = process.env.OPENROUTER_MODEL || 'meta-llama/llama-3.1-8b-instruct:free';
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openrouterApiKey}`,
          'HTTP-Referer': 'http://localhost:3000',
          'X-Title': 'Mindly AI Summarizer',
        },
        body: JSON.stringify({
          model: modelName,
          messages: [
            { role: 'system', content: SUMMARIZATION_PROMPT },
            { role: 'user', content: conversationText },
          ],
          temperature: 0.1,
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenRouter failed: ${response.statusText}`);
      }

      const data = await response.json();
      rawSummary = data.choices?.[0]?.message?.content || '';

    } else if (provider === 'ollama') {
      const ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434';
      const modelName = process.env.OLLAMA_MODEL || 'llama3';

      const response = await fetch(`${ollamaUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: modelName,
          messages: [
            { role: 'system', content: SUMMARIZATION_PROMPT },
            { role: 'user', content: conversationText },
          ],
          stream: false,
        }),
      });

      if (!response.ok) {
        throw new Error(`Ollama failed: ${response.statusText}`);
      }

      const data = await response.json();
      rawSummary = data.message?.content || '';
    } else {
      throw new Error(`Unsupported or unconfigured AI provider for summarization: ${provider}`);
    }

    rawSummary = rawSummary.trim();

    // Heuristically extract metadata flags
    const lowercaseSummary = rawSummary.toLowerCase();
    const hasDecisions = lowercaseSummary.includes('decision') || lowercaseSummary.includes('decided to') || lowercaseSummary.includes('going with');
    const hasActionItems = lowercaseSummary.includes('action item') || lowercaseSummary.includes('todo') || lowercaseSummary.includes('will do');

    // Basic topic tag extraction (heuristics based on keywords, capped at 5)
    const possibleTopics = ['auth', 'database', 'jwt', 'middleware', 'css', 'design', 'bug', 'typescript', 'testing', 'security', 'api', 'state', 'vector', 'insights', 'cron'];
    const extractedTopics = possibleTopics.filter(t => lowercaseSummary.includes(t));

    return {
      summary: rawSummary,
      hasDecisions,
      hasActionItems,
      topics: extractedTopics.slice(0, 5),
    };

  } catch (err: any) {
    console.error('[Summarizer] Failed to generate summary:', err.message);
    throw err;
  }
}
