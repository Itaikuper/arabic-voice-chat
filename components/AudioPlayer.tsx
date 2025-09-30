/**
 * Audio Player Component
 * Handles playback of audio responses from Gemini Live API
 */

'use client';

import { useEffect, useRef, useState } from 'react';
import { base64ToInt16Array, int16ToFloat32 } from '@/lib/audio/audioUtils';

interface AudioPlayerProps {
  onPlaybackComplete?: () => void;
}

export function AudioPlayer({ onPlaybackComplete }: AudioPlayerProps) {
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioQueueRef = useRef<string[]>([]);
  const isPlayingRef = useRef(false);
  const [isPlaying, setIsPlaying] = useState(false);

  /**
   * Initialize audio context
   */
  useEffect(() => {
    // Create AudioContext without forcing sample rate - let browser use native hardware rate
    // This prevents poor quality resampling by the browser
    audioContextRef.current = new AudioContext();

    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  /**
   * Play audio from base64 string
   */
  const playAudio = async (base64Audio: string) => {
    if (!audioContextRef.current) return;

    try {
      const audioContext = audioContextRef.current;

      // Convert base64 to audio buffer
      const int16Array = base64ToInt16Array(base64Audio);
      const float32Array = int16ToFloat32(int16Array);

      // Apply gentle fade-in/fade-out to prevent clicks
      const fadeLength = Math.min(Math.floor(float32Array.length * 0.01), 240); // 1% or max 10ms at 24kHz
      for (let i = 0; i < fadeLength; i++) {
        const fade = i / fadeLength;
        float32Array[i] *= fade; // Fade in
        float32Array[float32Array.length - 1 - i] *= fade; // Fade out
      }

      // Create AudioBuffer with proper sample rate
      // Gemini outputs 24kHz, but we create buffer that browser will resample properly
      const audioBuffer = audioContext.createBuffer(
        1, // mono
        float32Array.length,
        24000 // Source is 24kHz (Gemini output)
      );

      // Copy data to buffer
      audioBuffer.getChannelData(0).set(float32Array);

      // Create source node with better quality resampling
      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;

      // Add gain node for smooth volume control
      const gainNode = audioContext.createGain();
      gainNode.gain.value = 1.0;

      source.connect(gainNode);
      gainNode.connect(audioContext.destination);

      // Play audio
      source.start();

      // Wait for audio to finish
      await new Promise<void>((resolve) => {
        source.onended = () => resolve();
      });
    } catch (error) {
      console.error('Failed to play audio:', error);
    }
  };

  /**
   * Process audio queue
   */
  const processQueue = async () => {
    if (isPlayingRef.current || audioQueueRef.current.length === 0) {
      return;
    }

    isPlayingRef.current = true;
    setIsPlaying(true);

    while (audioQueueRef.current.length > 0) {
      const audioData = audioQueueRef.current.shift();
      if (audioData) {
        await playAudio(audioData);
      }
    }

    isPlayingRef.current = false;
    setIsPlaying(false);

    if (onPlaybackComplete) {
      onPlaybackComplete();
    }
  };

  /**
   * Add audio to queue
   */
  const enqueueAudio = (base64Audio: string) => {
    audioQueueRef.current.push(base64Audio);
    processQueue();
  };

  /**
   * Clear audio queue
   */
  const clearQueue = () => {
    audioQueueRef.current = [];
  };

  // Expose methods via ref
  useEffect(() => {
    (window as any).__audioPlayer = {
      enqueueAudio,
      clearQueue,
    };

    return () => {
      delete (window as any).__audioPlayer;
    };
  }, []);

  return (
    <div className="flex items-center gap-2">
      {isPlaying && (
        <div className="flex gap-1">
          <div className="w-1 h-4 bg-green-500 animate-pulse" style={{ animationDelay: '0ms' }} />
          <div className="w-1 h-4 bg-green-500 animate-pulse" style={{ animationDelay: '150ms' }} />
          <div className="w-1 h-4 bg-green-500 animate-pulse" style={{ animationDelay: '300ms' }} />
        </div>
      )}
    </div>
  );
}
