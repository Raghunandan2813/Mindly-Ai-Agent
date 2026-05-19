// app/api/voice/route.ts
// POST: Accepts recorded audio files, uploads them to Groq Whisper, and returns plain transcribed text.
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const audioFile = formData.get('file') as File;

    if (!audioFile) {
      return NextResponse.json({ error: 'No audio file provided.' }, { status: 400 });
    }

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'Groq API Key is not configured on the server.' }, { status: 500 });
    }

    const language = formData.get('language') as string || 'auto';

    // 1. Prepare multipart/form-data payload for Groq Whisper
    const groqFormData = new FormData();
    
    // Convert to standard Blob and append with explicit filename to fix serialization issues in Node fetch
    const arrayBuffer = await audioFile.arrayBuffer();
    const blob = new Blob([arrayBuffer], { type: audioFile.type || 'audio/webm' });
    
    groqFormData.append('file', blob, audioFile.name || 'recording.webm');
    groqFormData.append('model', 'whisper-large-v3-turbo');
    groqFormData.append('response_format', 'json');

    // Specify preferred language if set and not in auto mode
    if (language && language !== 'auto') {
      groqFormData.append('language', language);
    }

    console.log(`[Voice API] Sending audio blob (${audioFile.size} bytes) to Groq Whisper (language: ${language})...`);

    // 2. Query Groq Audio Transcriptions API
    const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
      body: groqFormData,
    });

    if (!response.ok) {
      const errDetail = await response.text();
      console.error('[Voice API Error] Groq translation failed:', errDetail);
      
      // Write detailed error to a file for analysis
      try {
        const fs = require('fs');
        const logContent = `[${new Date().toISOString()}]
Audio File Details:
- Name: ${audioFile.name}
- Type: ${audioFile.type}
- Size: ${audioFile.size} bytes

Groq Response:
${errDetail}
----------------------------------------\n`;
        fs.appendFileSync('groq_error.log', logContent);
      } catch (logErr) {
        console.error('Failed to write to groq_error.log:', logErr);
      }

      return NextResponse.json({ error: 'Failed to transcribe audio from Groq Whisper API.' }, { status: response.status });
    }

    const data = await response.json();
    console.log('[Voice API Success] Transcription returned:', data.text);

    return NextResponse.json({ text: data.text || '' });
  } catch (err: any) {
    console.error('[Voice API Exception]:', err);
    return NextResponse.json({ error: err.message || 'Internal server error.' }, { status: 500 });
  }
}
