/**
 * Ephemeral Token API Route
 * Provisions short-lived tokens for secure client-to-Gemini connections
 *
 * Security:
 * - Master API key stored server-side only (never exposed to client)
 * - Tokens expire after 30 minutes of connection time
 * - Tokens must be used within 1 minute to start new sessions
 * - Tokens locked to specific model and configuration
 */

import { GoogleGenAI } from '@google/genai';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    // Get master API key from environment (server-side only)
    const apiKey = process.env.GOOGLE_GEMINI_API_KEY;

    if (!apiKey) {
      console.error('❌ GOOGLE_GEMINI_API_KEY not found in environment');
      return NextResponse.json(
        { error: 'Server configuration error: API key not configured' },
        { status: 500 }
      );
    }

    // Parse request body to get character configuration
    const body = await request.json();
    const { characterId, systemInstruction, voiceName } = body;

    if (!systemInstruction || !voiceName) {
      return NextResponse.json(
        { error: 'Missing required parameters: systemInstruction and voiceName' },
        { status: 400 }
      );
    }

    console.log(`🔐 Generating ephemeral token for character: ${characterId || 'default'}`);

    // Initialize Google GenAI client with master API key
    const client = new GoogleGenAI({ apiKey });

    // Set token expiration times
    const expireTime = new Date(Date.now() + 30 * 60 * 1000).toISOString(); // 30 minutes
    const newSessionExpireTime = new Date(Date.now() + 1 * 60 * 1000).toISOString(); // 1 minute

    // Create ephemeral token with locked configuration
    const token = await client.authTokens.create({
      config: {
        uses: 1, // Single use token (but allows sessionResumption)
        expireTime: expireTime,
        newSessionExpireTime: newSessionExpireTime,
        liveConnectConstraints: {
          model: 'gemini-2.5-flash-native-audio-preview-09-2025',
          config: {
            sessionResumption: {}, // Allow reconnection with same token
            responseModalities: ['AUDIO'] as any,
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: {
                  voiceName: voiceName,
                },
              },
            },
            systemInstruction: systemInstruction,
          },
        },
        httpOptions: {
          apiVersion: 'v1alpha',
        },
      },
    });

    console.log(`✅ Ephemeral token generated: ${token.name}`);
    console.log(`⏰ Token expires at: ${expireTime}`);
    console.log(`⏰ New session window closes at: ${newSessionExpireTime}`);

    // Return token to client
    return NextResponse.json({
      token: token.name,
      expireTime: expireTime,
      newSessionExpireTime: newSessionExpireTime,
    });
  } catch (error: any) {
    console.error('❌ Failed to generate ephemeral token:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate token' },
      { status: 500 }
    );
  }
}
