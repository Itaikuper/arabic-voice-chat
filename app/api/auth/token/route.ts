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
import { getCustomInstruction } from '@/lib/instructionStore';
import { syncAllCharacters } from '@/lib/syncInstructions';

// Track if we've already synced on this server instance
let hasSyncedOnStartup = false;

export async function POST(request: Request) {
  try {
    // Auto-sync character instructions on first request (lazy startup sync)
    if (!hasSyncedOnStartup) {
      try {
        const syncResults = syncAllCharacters(false); // Don't force, respect admin overrides
        const syncedCount = syncResults.filter(r => r.action === 'synced').length;
        const skippedCount = syncResults.filter(r => r.action === 'skipped-override').length;

        console.log('🔄 Auto-sync on startup:');
        console.log(`   ✅ Synced: ${syncedCount} characters`);
        console.log(`   ⏭️  Skipped: ${skippedCount} admin overrides`);

        syncResults.forEach(result => {
          if (result.action === 'synced') {
            console.log(`   📝 ${result.characterId}: ${result.message}`);
          } else if (result.action === 'skipped-override') {
            console.log(`   🔒 ${result.characterId}: ${result.message}`);
          }
        });

        hasSyncedOnStartup = true;
      } catch (syncError) {
        console.error('⚠️ Auto-sync failed (continuing with existing instructions):', syncError);
        // Don't fail the request if sync fails
      }
    }

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

    // Check for custom instruction override
    let finalSystemInstruction = systemInstruction;
    let finalVoiceName = voiceName;

    if (characterId) {
      const customInstruction = getCustomInstruction(characterId);
      if (customInstruction) {
        finalSystemInstruction = customInstruction.systemInstruction;
        finalVoiceName = customInstruction.voiceName;
        console.log(`🎨 Using custom system instruction for character: ${characterId}`);
      }
    }

    console.log(`🔐 Generating ephemeral token for character: ${characterId || 'default'}`);

    // Initialize Google GenAI client with master API key
    const client = new GoogleGenAI({ apiKey });

    // Set token expiration times
    const expireTime = new Date(Date.now() + 30 * 60 * 1000).toISOString(); // 30 minutes
    const newSessionExpireTime = new Date(Date.now() + 1 * 60 * 1000).toISOString(); // 1 minute

    // CRITICAL WORKAROUND: Don't send systemInstruction in ephemeral token!
    // Google GenAI SDK has a bug with non-ASCII (Arabic) characters in ephemeral token creation
    // Error: "Cannot convert argument to a ByteString because the character at index X has a value > 255"
    // Solution: Send systemInstruction from client-side in connect() config instead

    // Create ephemeral token with locked configuration (WITHOUT systemInstruction)
    const token = await client.authTokens.create({
      config: {
        uses: 1, // Single use token (but allows sessionResumption)
        expireTime: expireTime,
        newSessionExpireTime: newSessionExpireTime,
        liveConnectConstraints: {
          model: 'gemini-2.5-flash-native-audio-preview-09-2025',
          config: {
            sessionResumption: {}, // Allow reconnection with same token
            responseModalities: ['AUDIO'] as any, // Lock AUDIO only; client adds TEXT for transcription
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: {
                  voiceName: finalVoiceName,
                },
              },
            },
            // systemInstruction: REMOVED - sent from client instead
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

    // Return token to client WITH systemInstruction (client will send it in connect config)
    return NextResponse.json({
      token: token.name,
      expireTime: expireTime,
      newSessionExpireTime: newSessionExpireTime,
      systemInstruction: finalSystemInstruction, // Client needs this for connection config
      voiceName: finalVoiceName, // Also return voice for consistency
    });
  } catch (error: any) {
    console.error('❌ Failed to generate ephemeral token:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate token' },
      { status: 500 }
    );
  }
}
