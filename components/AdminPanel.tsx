/**
 * Admin Panel Component
 * Password-protected interface for managing character system instructions
 */

'use client';

import { useState, useEffect } from 'react';
import { Character, characters } from '@/lib/characters';

interface AdminPanelProps {
  onClose: () => void;
}

interface InstructionData {
  characterId: string;
  characterName: string;
  defaultInstruction: string;
  defaultVoiceName: string;
  customInstruction: {
    systemInstruction: string;
    voiceName: string;
    updatedAt: string;
    updatedBy?: string;
  } | null;
  activeInstruction: string;
  activeVoiceName: string;
}

export function AdminPanel({ onClose }: AdminPanelProps) {
  const [step, setStep] = useState<'password' | 'editor'>('password');
  const [password, setPassword] = useState('');
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Editor state
  const [selectedCharacter, setSelectedCharacter] = useState<Character>(characters[0]);
  const [instructionData, setInstructionData] = useState<InstructionData | null>(null);
  const [editedInstruction, setEditedInstruction] = useState('');
  const [editedVoiceName, setEditedVoiceName] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);

  /**
   * Handle password submission
   */
  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await fetch('/api/admin/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Authentication failed');
      }

      setSessionToken(data.sessionToken);
      setStep('editor');
      setPassword(''); // Clear password from memory
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Load instruction data for selected character
   */
  const loadInstructionData = async (characterId: string) => {
    if (!sessionToken) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/instructions/${characterId}`, {
        headers: {
          Authorization: `Bearer ${sessionToken}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to load instruction data');
      }

      const data = await response.json();
      setInstructionData(data);
      setEditedInstruction(data.activeInstruction);
      setEditedVoiceName(data.activeVoiceName);
    } catch (err: any) {
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Save updated instruction
   */
  const handleSave = async () => {
    if (!sessionToken || !instructionData) return;

    setLoading(true);
    setError(null);
    setSaveSuccess(false);

    try {
      const response = await fetch(`/api/admin/instructions/${selectedCharacter.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({
          systemInstruction: editedInstruction,
          voiceName: editedVoiceName,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save instruction');
      }

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);

      // Reload data
      await loadInstructionData(selectedCharacter.id);
    } catch (err: any) {
      setError(err.message || 'Failed to save');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Reset to default instruction
   */
  const handleResetToDefault = async () => {
    if (!sessionToken || !instructionData) return;

    if (!confirm('Are you sure you want to reset to the default instruction?')) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/instructions/${selectedCharacter.id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${sessionToken}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to reset instruction');
      }

      // Reload data
      await loadInstructionData(selectedCharacter.id);
    } catch (err: any) {
      setError(err.message || 'Failed to reset');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Load instruction data when character changes
   */
  useEffect(() => {
    if (step === 'editor' && sessionToken) {
      loadInstructionData(selectedCharacter.id);
    }
  }, [selectedCharacter, step, sessionToken]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white p-6 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold">Admin Panel</h2>
            <p className="text-sm opacity-90 mt-1">System Instruction Management</p>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-2 transition-all"
            aria-label="Close"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-100px)]">
          {/* Password Step */}
          {step === 'password' && (
            <form onSubmit={handlePasswordSubmit} className="max-w-md mx-auto">
              <div className="text-center mb-6">
                <div className="text-6xl mb-4">🔐</div>
                <h3 className="text-xl font-semibold text-gray-800 mb-2">
                  Enter Admin Password
                </h3>
                <p className="text-sm text-gray-600">
                  This area is restricted to authorized administrators only
                </p>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="Enter password"
                  autoFocus
                  required
                />
              </div>

              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !password}
                className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-medium py-3 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Verifying...' : 'Access Admin Panel'}
              </button>
            </form>
          )}

          {/* Editor Step */}
          {step === 'editor' && (
            <div>
              {/* Character Selection */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Character
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {characters.map((char) => (
                    <button
                      key={char.id}
                      onClick={() => setSelectedCharacter(char)}
                      className={`p-4 rounded-lg border-2 transition-all ${
                        selectedCharacter.id === char.id
                          ? 'border-purple-600 bg-purple-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="text-3xl mb-2">{char.avatar}</div>
                      <div className="text-sm font-medium text-gray-800">{char.name}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Loading State */}
              {loading && !instructionData && (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
                  <p className="text-gray-600">Loading...</p>
                </div>
              )}

              {/* Editor */}
              {instructionData && (
                <div>
                  {/* Status */}
                  {instructionData.customInstruction && (
                    <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="flex items-start gap-2">
                        <svg className="w-5 h-5 text-blue-600 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                          <path
                            fillRule="evenodd"
                            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                            clipRule="evenodd"
                          />
                        </svg>
                        <div className="text-sm">
                          <p className="font-medium text-blue-800">Custom Instruction Active</p>
                          <p className="text-blue-700 mt-1">
                            Last updated: {new Date(instructionData.customInstruction.updatedAt).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Voice Name */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Voice Name (Gemini voice)
                    </label>
                    <input
                      type="text"
                      value={editedVoiceName}
                      onChange={(e) => setEditedVoiceName(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="e.g., Puck, Kore, Charon"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Default: {instructionData.defaultVoiceName}
                    </p>
                  </div>

                  {/* System Instruction Editor */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      System Instruction
                    </label>
                    <textarea
                      value={editedInstruction}
                      onChange={(e) => setEditedInstruction(e.target.value)}
                      className="w-full h-96 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent font-mono text-sm"
                      placeholder="Enter system instruction..."
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      This instruction will be locked into the ephemeral token and sent to Gemini
                    </p>
                  </div>

                  {/* Error Display */}
                  {error && (
                    <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                      {error}
                    </div>
                  )}

                  {/* Success Display */}
                  {saveSuccess && (
                    <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
                      ✅ Instruction saved successfully! New connections will use this instruction.
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex gap-3">
                    <button
                      onClick={handleSave}
                      disabled={loading || !editedInstruction || !editedVoiceName}
                      className="flex-1 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-medium py-3 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loading ? 'Saving...' : 'Save Custom Instruction'}
                    </button>
                    <button
                      onClick={handleResetToDefault}
                      disabled={loading || !instructionData.customInstruction}
                      className="px-6 bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium py-3 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Reset to Default
                    </button>
                  </div>

                  {/* Default Instruction Reference */}
                  <details className="mt-6">
                    <summary className="cursor-pointer text-sm font-medium text-gray-700 hover:text-gray-900">
                      View Default Instruction
                    </summary>
                    <pre className="mt-2 p-4 bg-gray-50 border border-gray-200 rounded-lg text-xs overflow-x-auto whitespace-pre-wrap">
                      {instructionData.defaultInstruction}
                    </pre>
                  </details>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
