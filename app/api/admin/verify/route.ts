/**
 * Admin Password Verification API
 * Verifies admin password and returns session token
 */

import { NextResponse } from 'next/server';
import crypto from 'crypto';

// Session storage (in-memory for simplicity)
// In production, use Redis or proper session management
const sessions = new Map<string, { createdAt: number }>();

// Session lifetime: 30 minutes
const SESSION_LIFETIME = 30 * 60 * 1000;

/**
 * Clean up expired sessions
 */
function cleanupExpiredSessions() {
  const now = Date.now();
  for (const [token, session] of sessions.entries()) {
    if (now - session.createdAt > SESSION_LIFETIME) {
      sessions.delete(token);
    }
  }
}

/**
 * Verify admin password and create session
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { password } = body;

    if (!password) {
      return NextResponse.json(
        { error: 'Password is required' },
        { status: 400 }
      );
    }

    // Get admin password from environment
    const adminPassword = process.env.ADMIN_PASSWORD || '0502';

    // Verify password
    if (password !== adminPassword) {
      console.log('❌ Admin authentication failed: Invalid password');
      return NextResponse.json(
        { error: 'Invalid password' },
        { status: 401 }
      );
    }

    // Clean up old sessions
    cleanupExpiredSessions();

    // Generate session token
    const sessionToken = crypto.randomBytes(32).toString('hex');
    sessions.set(sessionToken, { createdAt: Date.now() });

    console.log('✅ Admin authenticated successfully');

    return NextResponse.json({
      success: true,
      sessionToken,
      expiresIn: SESSION_LIFETIME / 1000, // seconds
    });
  } catch (error: any) {
    console.error('❌ Admin verification error:', error);
    return NextResponse.json(
      { error: error.message || 'Verification failed' },
      { status: 500 }
    );
  }
}

/**
 * Verify if session token is valid
 */
export function verifySession(sessionToken: string): boolean {
  cleanupExpiredSessions();

  const session = sessions.get(sessionToken);
  if (!session) {
    return false;
  }

  const now = Date.now();
  return now - session.createdAt < SESSION_LIFETIME;
}
