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
            Select Interrogation Scenario
          </h1>
          <p className="text-lg text-gray-600" dir="rtl">
            اختار سيناريو الاستجواب
          </p>
          <p className="text-sm text-gray-500 mt-2">
            Police Interrogation Training Simulator - Palestinian Arabic Dialect
          </p>
        </div>

        {/* Character Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {characters.map((character) => (
            <div
              key={character.id}
              className="bg-white rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 p-8 flex flex-col transform hover:-translate-y-1"
            >
              {/* Character Image */}
              {character.image ? (
                <div className="w-full h-48 mb-4 relative overflow-hidden rounded-lg">
                  <img
                    src={character.image}
                    alt={character.name}
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="text-7xl mb-4 text-center">{character.avatar}</div>
              )}

              {/* Name */}
              <h2 className="text-2xl font-bold text-gray-800 mb-1 text-center">
                {character.name}
              </h2>
              <p className="text-lg text-gray-600 mb-1 text-center" dir="rtl">
                {character.nameArabic}
              </p>
              <p className="text-sm text-gray-500 mb-4 text-center">
                Age: {character.age}
              </p>

              {/* Difficulty & Experience Badges */}
              <div className="flex gap-2 mb-4 justify-center flex-wrap">
                {/* Difficulty Badge */}
                <div
                  className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    character.difficultyLevel === 'high'
                      ? 'bg-red-100 text-red-700'
                      : character.difficultyLevel === 'medium'
                      ? 'bg-yellow-100 text-yellow-700'
                      : 'bg-green-100 text-green-700'
                  }`}
                >
                  {character.difficultyLevel.toUpperCase()} DIFFICULTY
                </div>

                {/* Experience Badge */}
                <div
                  className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    character.experienceLevel === 'experienced'
                      ? 'bg-orange-100 text-orange-700'
                      : 'bg-blue-100 text-blue-700'
                  }`}
                >
                  {character.experienceLevel === 'experienced' ? 'EXPERIENCED' : 'FIRST-TIME'}
                </div>
              </div>

              {/* Cooperation Level */}
              <div className="mb-4">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs font-semibold text-gray-600">Cooperation Level:</span>
                  <span className={`text-xs font-bold ${
                    character.cooperationLevel === 'high'
                      ? 'text-green-600'
                      : character.cooperationLevel === 'medium'
                      ? 'text-yellow-600'
                      : 'text-red-600'
                  }`}>
                    {character.cooperationLevel.toUpperCase()}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${
                      character.cooperationLevel === 'high'
                        ? 'bg-green-500 w-4/5'
                        : character.cooperationLevel === 'medium'
                        ? 'bg-yellow-500 w-1/2'
                        : 'bg-red-500 w-1/4'
                    }`}
                  />
                </div>
              </div>

              {/* Description */}
              <p className="text-gray-700 text-center mb-2 leading-relaxed text-sm">
                {character.description}
              </p>
              <p className="text-gray-600 text-center mb-4 leading-relaxed text-sm" dir="rtl">
                {character.descriptionArabic}
              </p>

              {/* Scenario */}
              <div className="bg-gray-50 rounded-lg p-3 mb-6">
                <p className="text-xs font-semibold text-gray-500 mb-1">SCENARIO:</p>
                <p className="text-xs text-gray-700 leading-relaxed">
                  {character.scenario}
                </p>
              </div>

              {/* Select Button */}
              <button
                onClick={() => onSelectCharacter(character)}
                className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-medium py-3 rounded-lg transition-all duration-300 shadow-md hover:shadow-xl"
                aria-label={`Select ${character.name}`}
              >
                Start Interrogation
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
