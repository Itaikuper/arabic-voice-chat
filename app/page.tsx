'use client';

import { useState, useEffect } from 'react';
import { VoiceChat } from '@/components/VoiceChat';
import { CharacterSelection } from '@/components/CharacterSelection';
import { Character } from '@/lib/characters';

export default function Home() {
  const [apiKey, setApiKey] = useState<string>('');
  const [isConfigured, setIsConfigured] = useState(false);
  const [selectedCharacter, setSelectedCharacter] = useState<Character | null>(null);
  const [inputKey, setInputKey] = useState('');
  const [showError, setShowError] = useState(false);

  useEffect(() => {
    const envKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (envKey && envKey !== 'your_api_key_here') {
      setApiKey(envKey);
      setIsConfigured(true);
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputKey.trim() || !inputKey.startsWith('AIza')) {
      setShowError(true);
      return;
    }
    setApiKey(inputKey);
    setIsConfigured(true);
    setShowError(false);
  };

  const handleSelectCharacter = (character: Character) => {
    setSelectedCharacter(character);
  };

  const handleBackToCharacterSelection = () => {
    setSelectedCharacter(null);
  };

  const handleBackToApiKey = () => {
    setIsConfigured(false);
    setSelectedCharacter(null);
    setInputKey('');
  };

  // Show VoiceChat if character is selected
  if (isConfigured && selectedCharacter) {
    return (
      <VoiceChat
        apiKey={apiKey}
        character={selectedCharacter}
        onBack={handleBackToCharacterSelection}
      />
    );
  }

  // Show CharacterSelection if API key is configured
  if (isConfigured) {
    return (
      <CharacterSelection
        onSelectCharacter={handleSelectCharacter}
        onBack={handleBackToApiKey}
      />
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8 bg-gradient-to-b from-gray-50 to-gray-100">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8">
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center">
            <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Arabic Voice Chat</h1>
          <p className="text-gray-600">Real-time conversation in Palestinian Arabic</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="apiKey" className="block text-sm font-medium text-gray-700 mb-2">
              Google Gemini API Key
            </label>
            <input
              type="password"
              id="apiKey"
              value={inputKey}
              onChange={(e) => {
                setInputKey(e.target.value);
                setShowError(false);
              }}
              placeholder="AIza..."
              className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${showError ? 'border-red-500' : 'border-gray-300'}`}
            />
            {showError && <p className="mt-2 text-sm text-red-600">Please enter a valid API key</p>}
          </div>

          <button type="submit" className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-medium py-3 rounded-lg transition-all duration-300 shadow-lg hover:shadow-xl">
            Start Conversation
          </button>
        </form>

        <div className="mt-8 pt-8 border-t border-gray-200">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">How to get your API key:</h3>
          <ol className="text-sm text-gray-600 space-y-2">
            <li className="flex gap-2">
              <span className="font-semibold text-blue-500">1.</span>
              <span>Visit <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">Google AI Studio</a></span>
            </li>
            <li className="flex gap-2">
              <span className="font-semibold text-blue-500">2.</span>
              <span>Create or select an API key</span>
            </li>
            <li className="flex gap-2">
              <span className="font-semibold text-blue-500">3.</span>
              <span>Copy and paste it above</span>
            </li>
          </ol>

          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              <div>
                <p className="text-sm text-blue-800"><strong>Security Note:</strong> Your API key is only stored in your browser and never sent to any server except Google's Gemini API.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8 text-center text-sm text-gray-500">
        <p>Powered by Google Gemini 2.5 Flash Native Audio</p>
      </div>
    </div>
  );
}
