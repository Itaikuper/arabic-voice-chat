/**
 * System Instruction Synchronization Utility
 * Manages syncing between code defaults (lib/characters.ts) and runtime overrides (data/instructions.json)
 *
 * Architecture:
 * - Code is the source of truth
 * - JSON file stores runtime overrides from admin panel
 * - Auto-sync on startup ensures code changes propagate
 * - Admin can deliberately override and prevent auto-sync
 */

import { characters, getCharacterById } from './characters';
import {
  getCustomInstruction,
  setCustomInstruction,
  StoredInstruction
} from './instructionStore';

export interface SyncResult {
  characterId: string;
  action: 'up-to-date' | 'synced' | 'skipped-override' | 'error';
  codeVersion: string;
  customVersion?: string;
  message: string;
}

/**
 * Compare semantic versions
 * Returns: 1 if v1 > v2, -1 if v1 < v2, 0 if equal
 */
function compareVersions(v1: string, v2: string): number {
  const parts1 = v1.split('.').map(Number);
  const parts2 = v2.split('.').map(Number);

  for (let i = 0; i < 3; i++) {
    if (parts1[i] > parts2[i]) return 1;
    if (parts1[i] < parts2[i]) return -1;
  }

  return 0;
}

/**
 * Check if a character's custom instruction is outdated
 */
export function isCustomInstructionOutdated(characterId: string): boolean {
  const character = getCharacterById(characterId);
  if (!character) return false;

  const customInstruction = getCustomInstruction(characterId);
  if (!customInstruction) return false; // No custom override = not outdated

  // Parse version from custom instruction metadata
  // Custom instructions store updatedAt timestamp, not version
  // We'll compare based on code lastUpdated vs custom updatedAt
  const codeDate = new Date(character.lastUpdated);
  const customDate = new Date(customInstruction.updatedAt);

  return codeDate > customDate;
}

/**
 * Sync a single character's instruction from code to storage
 * Only syncs if code version is newer than custom version
 */
export function syncCharacterInstruction(
  characterId: string,
  force: boolean = false
): SyncResult {
  const character = getCharacterById(characterId);

  if (!character) {
    return {
      characterId,
      action: 'error',
      codeVersion: 'unknown',
      message: `Character '${characterId}' not found in code`,
    };
  }

  const customInstruction = getCustomInstruction(characterId);

  // No custom override exists - create initial sync
  if (!customInstruction) {
    setCustomInstruction(
      characterId,
      character.systemInstruction,
      character.voiceName,
      'auto-sync'
    );

    return {
      characterId,
      action: 'synced',
      codeVersion: character.version,
      message: `Initial sync: v${character.version}`,
    };
  }

  // Check if custom instruction is outdated
  const codeDate = new Date(character.lastUpdated);
  const customDate = new Date(customInstruction.updatedAt);
  const isOutdated = codeDate > customDate;

  // Up to date
  if (!isOutdated && !force) {
    return {
      characterId,
      action: 'up-to-date',
      codeVersion: character.version,
      customVersion: customInstruction.updatedAt,
      message: 'Custom instruction is up-to-date',
    };
  }

  // Check if admin deliberately overrode (updatedBy !== 'system' or 'auto-sync')
  const isDeliberateOverride =
    customInstruction.updatedBy &&
    customInstruction.updatedBy !== 'system' &&
    customInstruction.updatedBy !== 'auto-sync';

  // Skip auto-sync if deliberately overridden (unless forced)
  if (isDeliberateOverride && !force) {
    return {
      characterId,
      action: 'skipped-override',
      codeVersion: character.version,
      customVersion: customInstruction.updatedAt,
      message: `Skipped: Admin override by ${customInstruction.updatedBy}`,
    };
  }

  // Sync from code to storage
  setCustomInstruction(
    characterId,
    character.systemInstruction,
    character.voiceName,
    force ? 'force-sync' : 'auto-sync'
  );

  return {
    characterId,
    action: 'synced',
    codeVersion: character.version,
    customVersion: customInstruction.updatedAt,
    message: `Synced from v${character.version} (${force ? 'forced' : 'auto'})`,
  };
}

/**
 * Sync all characters from code to storage
 * Call this on server startup
 */
export function syncAllCharacters(force: boolean = false): SyncResult[] {
  const results: SyncResult[] = [];

  for (const character of characters) {
    const result = syncCharacterInstruction(character.id, force);
    results.push(result);
  }

  return results;
}

/**
 * Get sync status for all characters
 */
export function getSyncStatus(): Array<{
  characterId: string;
  characterName: string;
  codeVersion: string;
  codeLastUpdated: string;
  hasCustomOverride: boolean;
  customUpdatedAt?: string;
  customUpdatedBy?: string;
  isOutdated: boolean;
  isDeliberateOverride: boolean;
}> {
  return characters.map(character => {
    const customInstruction = getCustomInstruction(character.id);
    const isOutdated = isCustomInstructionOutdated(character.id);
    const isDeliberateOverride =
      customInstruction?.updatedBy !== 'system' &&
      customInstruction?.updatedBy !== 'auto-sync';

    return {
      characterId: character.id,
      characterName: character.name,
      codeVersion: character.version,
      codeLastUpdated: character.lastUpdated,
      hasCustomOverride: !!customInstruction,
      customUpdatedAt: customInstruction?.updatedAt,
      customUpdatedBy: customInstruction?.updatedBy,
      isOutdated,
      isDeliberateOverride,
    };
  });
}
