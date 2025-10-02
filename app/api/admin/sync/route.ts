/**
 * Character Instruction Sync API
 * Manual sync trigger for admin panel
 */

import { NextResponse } from 'next/server';
import { syncCharacterInstruction, getSyncStatus } from '@/lib/syncInstructions';
import { verifySession } from '../../verify/route';

/**
 * GET /api/admin/sync
 * Get sync status for all characters
 */
export async function GET(request: Request) {
  try {
    // Verify session
    const sessionToken = request.headers.get('Authorization')?.replace('Bearer ', '');
    if (!sessionToken || !verifySession(sessionToken)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const status = getSyncStatus();

    return NextResponse.json({ status });
  } catch (error: any) {
    console.error('❌ Error getting sync status:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get sync status' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/sync
 * Manually trigger sync for a character
 */
export async function POST(request: Request) {
  try {
    // Verify session
    const sessionToken = request.headers.get('Authorization')?.replace('Bearer ', '');
    if (!sessionToken || !verifySession(sessionToken)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { characterId, force = false } = body;

    if (!characterId) {
      return NextResponse.json(
        { error: 'characterId is required' },
        { status: 400 }
      );
    }

    const result = syncCharacterInstruction(characterId, force);

    console.log(`🔄 Manual sync: ${characterId} - ${result.message}`);

    return NextResponse.json({ result });
  } catch (error: any) {
    console.error('❌ Error syncing instruction:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to sync instruction' },
      { status: 500 }
    );
  }
}
