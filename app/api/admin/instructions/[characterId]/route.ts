/**
 * Admin Instructions Management API
 * Get and update system instructions for characters
 */

import { NextResponse } from 'next/server';
import {
  getCustomInstruction,
  setCustomInstruction,
  deleteCustomInstruction,
} from '@/lib/instructionStore';
import { getCharacterById } from '@/lib/characters';
import { verifySession } from '../../verify/route';

/**
 * GET /api/admin/instructions/[characterId]
 * Get current system instruction for a character
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ characterId: string }> }
) {
  try {
    const { characterId } = await params;

    // Verify session
    const sessionToken = request.headers.get('Authorization')?.replace('Bearer ', '');
    if (!sessionToken || !verifySession(sessionToken)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get character
    const character = getCharacterById(characterId);
    if (!character) {
      return NextResponse.json(
        { error: 'Character not found' },
        { status: 404 }
      );
    }

    // Get custom instruction if exists
    const customInstruction = getCustomInstruction(characterId);

    return NextResponse.json({
      characterId,
      characterName: character.name,
      defaultInstruction: character.systemInstruction,
      defaultVoiceName: character.voiceName,
      customInstruction: customInstruction
        ? {
            systemInstruction: customInstruction.systemInstruction,
            voiceName: customInstruction.voiceName,
            updatedAt: customInstruction.updatedAt,
            updatedBy: customInstruction.updatedBy,
          }
        : null,
      activeInstruction: customInstruction?.systemInstruction || character.systemInstruction,
      activeVoiceName: customInstruction?.voiceName || character.voiceName,
    });
  } catch (error: any) {
    console.error('❌ Error getting instruction:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get instruction' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/instructions/[characterId]
 * Update system instruction for a character
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ characterId: string }> }
) {
  try {
    const { characterId } = await params;

    // Verify session
    const sessionToken = request.headers.get('Authorization')?.replace('Bearer ', '');
    if (!sessionToken || !verifySession(sessionToken)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get character
    const character = getCharacterById(characterId);
    if (!character) {
      return NextResponse.json(
        { error: 'Character not found' },
        { status: 404 }
      );
    }

    // Parse body
    const body = await request.json();
    const { systemInstruction, voiceName } = body;

    if (!systemInstruction || !voiceName) {
      return NextResponse.json(
        { error: 'systemInstruction and voiceName are required' },
        { status: 400 }
      );
    }

    // Save custom instruction
    setCustomInstruction(characterId, systemInstruction, voiceName, 'admin');

    console.log(`✅ System instruction updated for character: ${characterId}`);

    return NextResponse.json({
      success: true,
      characterId,
      message: 'System instruction updated successfully',
    });
  } catch (error: any) {
    console.error('❌ Error updating instruction:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update instruction' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/instructions/[characterId]
 * Reset to default system instruction
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ characterId: string }> }
) {
  try {
    const { characterId } = await params;

    // Verify session
    const sessionToken = request.headers.get('Authorization')?.replace('Bearer ', '');
    if (!sessionToken || !verifySession(sessionToken)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get character
    const character = getCharacterById(characterId);
    if (!character) {
      return NextResponse.json(
        { error: 'Character not found' },
        { status: 404 }
      );
    }

    // Delete custom instruction
    deleteCustomInstruction(characterId);

    console.log(`✅ System instruction reset to default for character: ${characterId}`);

    return NextResponse.json({
      success: true,
      characterId,
      message: 'System instruction reset to default',
    });
  } catch (error: any) {
    console.error('❌ Error resetting instruction:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to reset instruction' },
      { status: 500 }
    );
  }
}
