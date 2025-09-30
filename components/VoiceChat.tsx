/**
 * Voice Chat Component
 * Main UI for real-time voice conversation with Gemini
 */

'use client';

import { useState, useCallback, useEffect } from 'react';
import { useGeminiLive } from '@/hooks/useGeminiLive';
import { AudioPlayer } from './AudioPlayer';
import { Character } from '@/lib/characters';

interface VoiceChatProps {
  apiKey: string;
  character: Character;
  onBack?: () => void;
}

export function VoiceChat({ apiKey, character, onBack }: VoiceChatProps) {
  const [transcript, setTranscript] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [audioPlayer, setAudioPlayer] = useState<any>(null);

  // Handle audio data from Gemini
  const handleAudioData = useCallback((audioData: string) => {
    // Queue audio for playback
    if ((window as any).__audioPlayer) {
      (window as any).__audioPlayer.enqueueAudio(audioData);
    }
  }, []);

  // Handle transcript updates
  const handleTranscript = useCallback((text: string) => {
    setTranscript((prev) => [...prev, `AI: ${text}`]);
  }, []);

  // Handle errors
  const handleError = useCallback((err: Error) => {
    setError(err.message);
    console.error('Error:', err);
  }, []);

  // Initialize Gemini Live
  const { status, isRecording, connect, disconnect, startRecording, stopRecording } =
    useGeminiLive({
      apiKey,
      character,
      onAudioData: handleAudioData,
      onTranscript: handleTranscript,
      onError: handleError,
    });

  // Get audio player instance
  useEffect(() => {
    const checkAudioPlayer = setInterval(() => {
      if ((window as any).__audioPlayer) {
        setAudioPlayer((window as any).__audioPlayer);
        clearInterval(checkAudioPlayer);
      }
    }, 100);

    return () => clearInterval(checkAudioPlayer);
  }, []);

  // Handle start button click
  const handleStart = async () => {
    setError(null);
    if (status === 'disconnected') {
      await connect();
    }
    await startRecording();
  };

  // Handle stop button click
  const handleStop = () => {
    stopRecording();
  };

  // Get status color
  const getStatusColor = () => {
    switch (status) {
      case 'connected':
        return 'bg-green-500';
      case 'connecting':
        return 'bg-yellow-500';
      case 'error':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  // Get status text
  const getStatusText = () => {
    switch (status) {
      case 'connected':
        return 'Connected';
      case 'connecting':
        return 'Connecting...';
      case 'error':
        return 'Error';
      default:
        return 'Disconnected';
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8 bg-gradient-to-b from-gray-50 to-gray-100">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-xl p-8">
        {/* Header with Character Info */}
        <div className="text-center mb-8">
          <div className="text-6xl mb-3">{character.avatar}</div>
          <h1 className="text-4xl font-bold text-gray-800 mb-1">
            {character.name}
          </h1>
          <p className="text-2xl text-gray-600 mb-3" dir="rtl">
            {character.nameArabic}
          </p>
          <p className="text-gray-500 text-sm">
            {character.description}
          </p>
        </div>

        {/* Status Indicator */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className={`w-3 h-3 rounded-full ${getStatusColor()}`} />
          <span className="text-sm font-medium text-gray-700">{getStatusText()}</span>
        </div>

        {/* Audio Player */}
        <div className="flex justify-center mb-8">
          <AudioPlayer />
        </div>

        {/* Recording Controls */}
        <div className="flex flex-col items-center gap-4 mb-8">
          {!isRecording ? (
            <button
              onClick={handleStart}
              disabled={status === 'connecting'}
              className="group relative w-24 h-24 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 disabled:from-gray-400 disabled:to-gray-500 transition-all duration-300 shadow-lg hover:shadow-xl disabled:cursor-not-allowed"
            >
              <div className="absolute inset-0 rounded-full bg-white opacity-0 group-hover:opacity-20 transition-opacity" />
              <svg
                className="w-10 h-10 mx-auto text-white"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          ) : (
            <button
              onClick={handleStop}
              className="group relative w-24 h-24 rounded-full bg-gradient-to-br from-red-500 to-pink-600 hover:from-red-600 hover:to-pink-700 transition-all duration-300 shadow-lg hover:shadow-xl animate-pulse"
            >
              <div className="absolute inset-0 rounded-full bg-white opacity-0 group-hover:opacity-20 transition-opacity" />
              <div className="w-8 h-8 mx-auto bg-white rounded-sm" />
            </button>
          )}

          <p className="text-sm text-gray-600 text-center">
            {isRecording ? 'Click to stop recording' : 'Click to start conversation'}
          </p>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-start gap-3">
              <svg
                className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
              <div>
                <h3 className="text-sm font-medium text-red-800">Error</h3>
                <p className="text-sm text-red-700 mt-1">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Transcript Display */}
        {transcript.length > 0 && (
          <div className="mt-8 p-4 bg-gray-50 rounded-lg max-h-64 overflow-y-auto">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Transcript</h3>
            <div className="space-y-2">
              {transcript.map((text, index) => (
                <p key={index} className="text-sm text-gray-600">
                  {text}
                </p>
              ))}
            </div>
          </div>
        )}

        {/* Instructions */}
        <div className="mt-8 pt-8 border-t border-gray-200">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Instructions:</h3>
          <ul className="text-sm text-gray-600 space-y-2">
            <li className="flex items-start gap-2">
              <span className="text-blue-500 mt-0.5">•</span>
              <span>Click the microphone button to start speaking</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-500 mt-0.5">•</span>
              <span>Speak naturally in Palestinian Arabic dialect</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-500 mt-0.5">•</span>
              <span>The AI will respond in spoken Arabic through your speakers</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-500 mt-0.5">•</span>
              <span>Click the stop button when you're done speaking</span>
            </li>
          </ul>

          {/* Change Character Button */}
          {onBack && (
            <div className="mt-6 text-center">
              <button
                onClick={onBack}
                className="inline-flex items-center gap-2 px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 text-sm font-medium rounded-lg transition-all duration-200"
                aria-label="Change character"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 19l-7-7m0 0l7-7m-7 7h18"
                  />
                </svg>
                Change Character
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="mt-8 text-center text-sm text-gray-500">
        <p>Powered by Google Gemini 2.5 Flash Native Audio</p>
      </div>
    </div>
  );
}
