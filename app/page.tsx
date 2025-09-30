'use client';

import { useState } from 'react';
import { VoiceChat } from '@/components/VoiceChat';
import { CharacterSelection } from '@/components/CharacterSelection';
import { Character } from '@/lib/characters';

export default function Home() {
  const [selectedCharacter, setSelectedCharacter] = useState<Character | null>(null);

  const handleSelectCharacter = (character: Character) => {
    setSelectedCharacter(character);
  };

  const handleBackToCharacterSelection = () => {
    setSelectedCharacter(null);
  };

  // Show VoiceChat if character is selected
  if (selectedCharacter) {
    return (
      <VoiceChat
        character={selectedCharacter}
        onBack={handleBackToCharacterSelection}
      />
    );
  }

  // Show CharacterSelection by default
  return (
    <CharacterSelection
      onSelectCharacter={handleSelectCharacter}
    />
  );
}
