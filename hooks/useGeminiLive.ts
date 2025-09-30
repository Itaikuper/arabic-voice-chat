/**
 * Custom hook for Gemini Live API connection
 * Manages WebSocket connection and audio streaming
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { GoogleGenAI, Modality } from '@google/genai';
import {
  float32To16BitPCM,
  int16ArrayToBase64,
  resampleAudio,
  AUDIO_WORKLET_CODE,
} from '@/lib/audio/audioUtils';
import { Character, getDefaultCharacter } from '@/lib/characters';

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

interface UseGeminiLiveOptions {
  character?: Character;
  onAudioData: (audioData: string) => void;
  onTranscript?: (text: string) => void;
  onError?: (error: Error) => void;
}

export function useGeminiLive({
  character,
  onAudioData,
  onTranscript,
  onError,
}: UseGeminiLiveOptions) {
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [isRecording, setIsRecording] = useState(false);

  // Refs to maintain state across renders
  const sessionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioWorkletNodeRef = useRef<AudioWorkletNode | null>(null);
  const responseQueueRef = useRef<any[]>([]);
  const isProcessingRef = useRef(false);
  const ephemeralTokenRef = useRef<string | null>(null);
  const tokenExpiryRef = useRef<string | null>(null);

  /**
   * Fetch ephemeral token from backend
   */
  const fetchEphemeralToken = useCallback(async () => {
    const activeCharacter = character || getDefaultCharacter();

    const response = await fetch('/api/auth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        characterId: activeCharacter.id,
        systemInstruction: activeCharacter.systemInstruction,
        voiceName: activeCharacter.voiceName,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to fetch token');
    }

    const data = await response.json();
    return data;
  }, [character]);

  /**
   * Initialize Gemini Live API connection
   */
  const connect = useCallback(async () => {
    try {
      setStatus('connecting');

      // Fetch ephemeral token from backend
      console.log('🔐 Fetching ephemeral token from backend...');
      const { token, expireTime } = await fetchEphemeralToken();
      ephemeralTokenRef.current = token;
      tokenExpiryRef.current = expireTime;
      console.log(`✅ Ephemeral token received (expires: ${expireTime})`);

      // Use ephemeral token as API key with v1alpha API version
      const ai = new GoogleGenAI({
        apiKey: token,
        httpOptions: { apiVersion: 'v1alpha' }
      });

      // Use provided character or default
      const activeCharacter = character || getDefaultCharacter();

      // Configuration for Palestinian Arabic conversation with character personality
      // Note: systemInstruction and voiceName are locked in the ephemeral token
      const config = {
        responseModalities: [Modality.AUDIO],
      };

      // Create Live API session
      const session = await ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        callbacks: {
          onopen: () => {
            console.log('✅ Gemini Live API connected');
            setStatus('connected');
          },
          onmessage: (message: any) => {
            responseQueueRef.current.push(message);

            // Process audio data
            if (message.data) {
              onAudioData(message.data);
            }

            // Process text transcript if available
            if (message.serverContent?.modelTurn?.parts) {
              const textPart = message.serverContent.modelTurn.parts.find(
                (part: any) => part.text
              );
              if (textPart?.text && onTranscript) {
                onTranscript(textPart.text);
              }
            }
          },
          onerror: (error: any) => {
            console.error('❌ Gemini Live API error:', error);
            setStatus('error');
            if (onError) {
              onError(new Error(error.message || 'Connection error'));
            }
          },
          onclose: (event: any) => {
            console.log('🔌 Gemini Live API closed:', event.reason);
            setStatus('disconnected');
          },
        },
        config,
      });

      sessionRef.current = session;
    } catch (error) {
      console.error('Failed to connect to Gemini Live API:', error);
      setStatus('error');
      if (onError) {
        onError(error as Error);
      }
    }
  }, [fetchEphemeralToken, character, onAudioData, onTranscript, onError]);

  /**
   * Start recording audio from microphone
   */
  const startRecording = useCallback(async () => {
    try {
      if (!sessionRef.current) {
        await connect();
      }

      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 48000, // We'll downsample to 16kHz
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      mediaStreamRef.current = stream;

      // Create AudioContext
      const audioContext = new AudioContext({ sampleRate: 48000 });
      audioContextRef.current = audioContext;

      // Create AudioWorklet for processing
      const workletBlob = new Blob([AUDIO_WORKLET_CODE], { type: 'application/javascript' });
      const workletUrl = URL.createObjectURL(workletBlob);
      await audioContext.audioWorklet.addModule(workletUrl);

      // Create nodes
      const source = audioContext.createMediaStreamSource(stream);
      const workletNode = new AudioWorkletNode(audioContext, 'audio-processor');
      audioWorkletNodeRef.current = workletNode;

      // Handle audio data from worklet
      workletNode.port.onmessage = (event) => {
        if (event.data.type === 'audio' && sessionRef.current) {
          const audioData = event.data.data as Float32Array;

          // Resample from 48kHz to 16kHz
          const resampled = resampleAudio(audioData, 48000, 16000);

          // Convert to 16-bit PCM
          const pcm16 = float32To16BitPCM(resampled);

          // Convert to base64
          const base64Audio = int16ArrayToBase64(pcm16);

          // Send to Gemini Live API
          sessionRef.current.sendRealtimeInput({
            audio: {
              data: base64Audio,
              mimeType: 'audio/pcm;rate=16000',
            },
          });
        }
      };

      // Connect nodes
      source.connect(workletNode);
      // Note: We don't connect to destination (speakers) to avoid feedback

      setIsRecording(true);
      console.log('🎤 Recording started');
    } catch (error) {
      console.error('Failed to start recording:', error);
      if (onError) {
        onError(error as Error);
      }
    }
  }, [connect, onError]);

  /**
   * Stop recording audio
   */
  const stopRecording = useCallback(() => {
    try {
      // Stop all audio tracks
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
      }

      // Close AudioWorklet
      if (audioWorkletNodeRef.current) {
        audioWorkletNodeRef.current.disconnect();
        audioWorkletNodeRef.current = null;
      }

      // Close AudioContext
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }

      setIsRecording(false);
      console.log('🛑 Recording stopped');
    } catch (error) {
      console.error('Failed to stop recording:', error);
    }
  }, []);

  /**
   * Disconnect from Gemini Live API
   */
  const disconnect = useCallback(() => {
    stopRecording();

    if (sessionRef.current) {
      sessionRef.current.close();
      sessionRef.current = null;
    }

    setStatus('disconnected');
  }, [stopRecording]);

  /**
   * Refresh ephemeral token and reconnect
   */
  const refreshToken = useCallback(async () => {
    if (status !== 'connected' && status !== 'connecting') {
      return;
    }

    console.log('🔄 Refreshing ephemeral token...');
    const wasRecording = isRecording;

    // Stop recording but keep session alive
    if (wasRecording) {
      stopRecording();
    }

    // Disconnect current session
    if (sessionRef.current) {
      sessionRef.current.close();
      sessionRef.current = null;
    }

    // Reconnect with new token
    await connect();

    // Resume recording if it was active
    if (wasRecording) {
      await startRecording();
    }
  }, [status, isRecording, stopRecording, connect, startRecording]);

  /**
   * Setup token refresh timer
   */
  useEffect(() => {
    if (!tokenExpiryRef.current || status !== 'connected') {
      return;
    }

    const expiryTime = new Date(tokenExpiryRef.current).getTime();
    const now = Date.now();
    const timeUntilExpiry = expiryTime - now;

    // Refresh token 2 minutes before expiration
    const refreshTime = timeUntilExpiry - 2 * 60 * 1000;

    if (refreshTime > 0) {
      console.log(`⏲️  Token refresh scheduled in ${Math.floor(refreshTime / 1000)} seconds`);
      const timeoutId = setTimeout(() => {
        refreshToken();
      }, refreshTime);

      return () => clearTimeout(timeoutId);
    }
  }, [tokenExpiryRef.current, status, refreshToken]);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    status,
    isRecording,
    connect,
    disconnect,
    startRecording,
    stopRecording,
    refreshToken,
  };
}
