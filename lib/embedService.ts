// lib/embedService.ts
// 100% FREE local vector embedding generator using transformers.js
// Runs the all-MiniLM-L6-v2 model directly on your machine — no API key needed.
import { pipeline, Pipeline, env } from '@xenova/transformers';

// Configure Xenova to cache models in the writable /tmp folder in Serverless environments (like Vercel)
env.cacheDir = '/tmp/.cache';

let embeddingPipeline: any = null;

async function getPipeline(): Promise<any> {
    if (!embeddingPipeline) {
        // First call downloads the model (~23MB), subsequent calls reuse it
        embeddingPipeline = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    }
    return embeddingPipeline;
}

/**
 * Generates a 384-dimensional vector embedding.
 * Uses Hugging Face's Free Serverless Inference API as primary (ideal for serverless Vercel)
 * and falls back to local in-memory transformers.js as a secondary safeguard.
 */
export async function getEmbedding(text: string): Promise<number[]> {
    const cleanedText = text.replace(/\n/g, ' ').trim();
    
    // Attempt 1: Query Hugging Face's Free Serverless API (Zero Native Binaries, ultra-fast on Vercel)
    try {
        const response = await fetch(
            'https://api-inference.huggingface.co/models/sentence-transformers/all-MiniLM-L6-v2',
            {
                headers: { 'Content-Type': 'application/json' },
                method: 'POST',
                body: JSON.stringify({ inputs: cleanedText }),
                // Set a reasonable timeout so we fall back quickly if API is rate-limited
                signal: AbortSignal.timeout(5000)
            }
        );

        if (response.ok) {
            const result = await response.json();
            if (Array.isArray(result) && typeof result[0] === 'number') {
                return result;
            } else if (Array.isArray(result) && Array.isArray(result[0])) {
                return result[0];
            }
        }
        console.warn('Hugging Face API returned non-ok status, falling back to local transformers...');
    } catch (err: any) {
        console.warn('Hugging Face API call failed or timed out, falling back to local transformers:', err.message || err);
    }

    // Attempt 2: Fall back to local transformers.js (Runs locally on your PC perfectly)
    const pipe = await getPipeline();
    const output = await pipe(cleanedText, { pooling: 'mean', normalize: true }) as any;
    return Array.from(output.data as Float32Array);
}