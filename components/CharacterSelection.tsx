/**
 * Character Selection Component
 * Displays character cards for user to choose their conversation partner
 */

'use client';

import { useState } from 'react';
import { Character, characters } from '@/lib/characters';
import { AdminPanel } from './AdminPanel';

interface CharacterSelectionProps {
  onSelectCharacter: (character: Character) => void;
}

export function CharacterSelection({ onSelectCharacter }: CharacterSelectionProps) {
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [clickCount, setClickCount] = useState(0);
  const [clickTimer, setClickTimer] = useState<NodeJS.Timeout | null>(null);

  /**
   * Handle triple-click on header to open admin panel
   */
  const handleHeaderClick = () => {
    setClickCount((prev) => prev + 1);

    // Clear existing timer
    if (clickTimer) {
      clearTimeout(clickTimer);
    }

    // Check for triple click
    if (clickCount + 1 >= 3) {
      setShowAdminPanel(true);
      setClickCount(0);
      setClickTimer(null);
    } else {
      // Reset count after 500ms
      const timer = setTimeout(() => {
        setClickCount(0);
      }, 500);
      setClickTimer(timer);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8 bg-gradient-to-b from-gray-50 to-gray-100">
      <div className="w-full max-w-6xl">
        {/* Header */}
        <div className="text-center mb-12">
          <h1
            onClick={handleHeaderClick}
            className="text-4xl font-bold text-gray-800 mb-3 cursor-default select-none"
          >
            Choose Your Conversation Partner
          </h1>
          <p className="text-lg text-gray-600">
            اختار مين بدك تحكي معه
          </p>
        </div>

        {/* Character Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {characters.map((character) => (
            <div
              key={character.id}
              className="bg-white rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 p-8 flex flex-col items-center transform hover:-translate-y-1"
            >
              {/* Avatar */}
              <div className="text-7xl mb-4">{character.avatar}</div>

              {/* Name */}
              <h2 className="text-2xl font-bold text-gray-800 mb-1">
                {character.name}
              </h2>
              <p className="text-xl text-gray-600 mb-4" dir="rtl">
                {character.nameArabic}
              </p>

              {/* Gender Badge */}
              <div
                className={`px-4 py-1 rounded-full text-sm font-medium mb-4 ${
                  character.gender === 'male'
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-pink-100 text-pink-700'
                }`}
              >
                {character.gender === 'male' ? '👨 Male' : '👩 Female'}
              </div>

              {/* Description */}
              <p className="text-gray-700 text-center mb-2 leading-relaxed">
                {character.description}
              </p>
              <p className="text-gray-600 text-center mb-6 leading-relaxed" dir="rtl">
                {character.descriptionArabic}
              </p>

              {/* Select Button */}
              <button
                onClick={() => onSelectCharacter(character)}
                className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-medium py-3 rounded-lg transition-all duration-300 shadow-md hover:shadow-xl"
                aria-label={`Select ${character.name}`}
              >
                Start Conversation
              </button>
            </div>
          ))}
        </div>

      </div>

      {/* Footer */}
      <div className="mt-12 text-center text-sm text-gray-500">
        <p>Powered by Google Gemini 2.5 Flash Native Audio</p>
      </div>

      {/* Admin Panel Modal */}
      {showAdminPanel && (
        <AdminPanel onClose={() => setShowAdminPanel(false)} />
      )}
    </div>
  );
}
