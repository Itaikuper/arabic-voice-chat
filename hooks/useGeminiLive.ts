/**
 * Custom hook for Gemini Live API connection
 * Manages WebSocket connection and audio streaming
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { GoogleGenAI, Modality } from '@google/genai';
import type { LiveIncomingMessage } from '@google/genai';
import {
  float32To16BitPCM,
  int16ArrayToBase64,
  resampleAudio,
  AUDIO_WORKLET_CODE,
} from '@/lib/audio/audioUtils';

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

interface UseGeminiLiveOptions {
  apiKey: string;
  onAudioData: (audioData: string) => void;
  onTranscript?: (text: string) => void;
  onError?: (error: Error) => void;
}

export function useGeminiLive({
  apiKey,
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
  const responseQueueRef = useRef<LiveIncomingMessage[]>([]);
  const isProcessingRef = useRef(false);

  /**
   * Initialize Gemini Live API connection
   */
  const connect = useCallback(async () => {
    try {
      setStatus('connecting');

      const ai = new GoogleGenAI({ apiKey });

      // Configuration for Palestinian Arabic conversation
      const config = {
        responseModalities: [Modality.AUDIO],
        systemInstruction: `You are a helpful AI assistant that speaks Palestinian Arabic dialect (اللهجة الفلسطينية).

IMPORTANT INSTRUCTIONS:
- Always respond in spoken Palestinian Arabic dialect
- Use natural, conversational Palestinian Arabic
- Be friendly, warm, and helpful
- Keep responses concise and natural
- Use common Palestinian expressions and phrases
- Respond as if you're having a casual conversation with a friend

Examples of Palestinian Arabic style:
- Use "كيفك؟" instead of "كيف حالك؟"
- Use "شو؟" for "what?"
- Use "مش" for negation
- Use colloquial vocabulary that Palestinians use in daily conversation

Remember: The user is speaking to you in Palestinian Arabic, so match their dialect and speaking style naturally.`,
      };

      // Create Live API session
      const session = await ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        callbacks: {
          onopen: () => {
            console.log('✅ Gemini Live API connected');
            setStatus('connected');
          },
          onmessage: (message: LiveIncomingMessage) => {
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
  }, [apiKey, onAudioData, onTranscript, onError]);

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
  };
}
