/**
 * API Route: Generate transcript from recorded conversation audio
 * Uses Gemini REST API directly for reliable audio transcription
 */

import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'GOOGLE_GEMINI_API_KEY not configured' },
        { status: 500 }
      );
    }

    // Get audio files from form data
    const formData = await request.formData();
    const userAudioFile = formData.get('userAudio') as File | null;
    const aiAudioFile = formData.get('aiAudio') as File | null;

    if (!userAudioFile && !aiAudioFile) {
      return NextResponse.json(
        { error: 'No audio provided' },
        { status: 400 }
      );
    }

    console.log('🎬 Transcribing conversation audio...');
    if (userAudioFile) console.log(`User audio: ${userAudioFile.size} bytes`);
    if (aiAudioFile) console.log(`AI audio: ${aiAudioFile.size} bytes`);

    // Convert files to base64
    const userAudioBytes = userAudioFile ? Buffer.from(await userAudioFile.arrayBuffer()) : null;
    const aiAudioBytes = aiAudioFile ? Buffer.from(await aiAudioFile.arrayBuffer()) : null;

    // Create prompt for transcription
    const promptBoth = `You are transcribing an Arabic conversation between a user and an AI assistant named Omar.

The user is speaking Palestinian Arabic dialect, and Omar is responding in Palestinian Arabic.

I will provide you with two audio files:
1. User audio: Contains only the user's speech
2. AI audio: Contains only Omar's (AI assistant) responses

Please transcribe this conversation and format it as follows:
User (U): [user's words in Arabic]
Omar (O): [Omar's words in Arabic]
U: [user's words]
O: [Omar's words]

Important:
- Transcribe ALL speech accurately in Arabic
- Maintain the chronological order of the conversation
- Use "U:" for user and "O:" for Omar
- Include Palestinian Arabic dialect variations and colloquialisms
- If any speech is unclear, use [unclear] marker

Start the transcription now:`;

    const promptSingleUser = `You are transcribing an Arabic speech track spoken by the user in Palestinian Arabic dialect.

Please transcribe the audio and format each line as:
User (U): [words in Arabic]

Important:
- Transcribe ALL speech accurately in Arabic
- Include Palestinian Arabic dialect variations and colloquialisms
- If any speech is unclear, use [unclear] marker

Start the transcription now:`;

    const promptSingleAI = `You are transcribing an Arabic speech track spoken by an AI assistant named Omar in Palestinian Arabic.

Please transcribe the audio and format each line as:
Omar (O): [words in Arabic]

Important:
- Transcribe ALL speech accurately in Arabic
- Include Palestinian Arabic dialect variations and colloquialisms
- If any speech is unclear, use [unclear] marker

Start the transcription now:`;

    // Build payload (camelCase per REST schema)
    const buildPayload = (prompt: string) => ({
      contents: [
        {
          role: 'user',
          parts: [
            { text: prompt },
            ...(userAudioBytes
              ? [
                  {
                    inlineData: {
                      mimeType: 'audio/wav',
                      data: userAudioBytes.toString('base64'),
                    },
                  },
                ]
              : []),
            ...(aiAudioBytes
              ? [
                  {
                    inlineData: {
                      mimeType: 'audio/wav',
                      data: aiAudioBytes.toString('base64'),
                    },
                  },
                ]
              : []),
          ],
        },
      ],
    });

    const modelAttempts = [
      { version: 'v1beta', model: 'gemini-2.0-flash-exp' },
      { version: 'v1beta', model: 'gemini-1.5-pro-002' },
      { version: 'v1beta', model: 'gemini-1.5-flash-002' },
      { version: 'v1beta', model: 'gemini-1.5-flash' },
    ];

    let data: any = null;
    let lastErr: string | null = null;
    const prompt = userAudioBytes && aiAudioBytes ? promptBoth : (userAudioBytes ? promptSingleUser : promptSingleAI);

    for (const a of modelAttempts) {
      try {
        const url = `https://generativelanguage.googleapis.com/${a.version}/models/${a.model}:generateContent?key=${apiKey}`;
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(buildPayload(prompt)),
        });
        if (!res.ok) {
          lastErr = `Gemini API error: ${res.status} ${await res.text()}`;
          continue;
        }
        data = await res.json();
        break;
      } catch (e: any) {
        lastErr = String(e);
      }
    }

    if (!data) {
      throw new Error(lastErr || 'Gemini transcription failed');
    }

    const transcript = data.candidates?.[0]?.content?.parts?.[0]?.text || 'No transcript generated';

    console.log('✅ Transcript generated successfully');

    return NextResponse.json({
      success: true,
      transcript,
    });
  } catch (error) {
    console.error('Transcription error:', error);
    return NextResponse.json(
      { error: 'Transcription failed', details: String(error) },
      { status: 500 }
    );
  }
}
