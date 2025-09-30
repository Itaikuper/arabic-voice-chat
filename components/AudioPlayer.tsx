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
    // Create AudioContext with 24kHz sample rate (Gemini output)
    audioContextRef.current = new AudioContext({ sampleRate: 24000 });

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
      // Convert base64 to audio buffer
      const int16Array = base64ToInt16Array(base64Audio);
      const float32Array = int16ToFloat32(int16Array);

      // Create AudioBuffer
      const audioBuffer = audioContextRef.current.createBuffer(
        1, // mono
        float32Array.length,
        24000 // 24kHz sample rate (Gemini output)
      );

      // Copy data to buffer
      audioBuffer.getChannelData(0).set(float32Array);

      // Create source node
      const source = audioContextRef.current.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContextRef.current.destination);

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
