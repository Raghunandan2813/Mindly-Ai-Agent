// lib/embedService.ts
// 100% FREE local vector embedding generator using transformers.js
// Runs the all-MiniLM-L6-v2 model directly on your machine — no API key needed.
import { pipeline, Pipeline } from '@xenova/transformers';

let embeddingPipeline: any = null;

async function getPipeline(): Promise<any> {
    if (!embeddingPipeline) {
        // First call downloads the model (~23MB), subsequent calls reuse it
        embeddingPipeline = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    }
    return embeddingPipeline;
}

export async function getEmbedding(text: string): Promise<number[]> {
    const pipe = await getPipeline();
    const output = await pipe(text, { pooling: 'mean', normalize: true }) as any;
    return Array.from(output.data as Float32Array);
}