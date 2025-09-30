/**
 * Server-Side System Instruction Storage
 * Manages custom system instructions for characters
 * Uses JSON file for persistent storage
 */

import fs from 'fs';
import path from 'path';

const STORE_FILE = path.join(process.cwd(), 'data', 'instructions.json');

export interface StoredInstruction {
  characterId: string;
  systemInstruction: string;
  voiceName: string;
  updatedAt: string;
  updatedBy?: string;
}

interface InstructionStore {
  instructions: Record<string, StoredInstruction>;
}

/**
 * Ensure data directory exists
 */
function ensureDataDir() {
  const dataDir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

/**
 * Read instruction store from disk
 */
function readStore(): InstructionStore {
  try {
    ensureDataDir();

    if (!fs.existsSync(STORE_FILE)) {
      return { instructions: {} };
    }

    const data = fs.readFileSync(STORE_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading instruction store:', error);
    return { instructions: {} };
  }
}

/**
 * Write instruction store to disk
 */
function writeStore(store: InstructionStore): void {
  try {
    ensureDataDir();
    fs.writeFileSync(STORE_FILE, JSON.stringify(store, null, 2), 'utf-8');
  } catch (error) {
    console.error('Error writing instruction store:', error);
    throw error;
  }
}

/**
 * Get custom instruction for a character
 * Returns null if no custom instruction exists
 */
export function getCustomInstruction(characterId: string): StoredInstruction | null {
  const store = readStore();
  return store.instructions[characterId] || null;
}

/**
 * Set custom instruction for a character
 */
export function setCustomInstruction(
  characterId: string,
  systemInstruction: string,
  voiceName: string,
  updatedBy?: string
): void {
  const store = readStore();

  store.instructions[characterId] = {
    characterId,
    systemInstruction,
    voiceName,
    updatedAt: new Date().toISOString(),
    updatedBy,
  };

  writeStore(store);
}

/**
 * Delete custom instruction for a character (revert to default)
 */
export function deleteCustomInstruction(characterId: string): void {
  const store = readStore();
  delete store.instructions[characterId];
  writeStore(store);
}

/**
 * Get all custom instructions
 */
export function getAllCustomInstructions(): Record<string, StoredInstruction> {
  const store = readStore();
  return store.instructions;
}
