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
import { SpeechAnalysisResult } from '@/lib/audio/speechAnalysis';

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface UsageMetrics {
  inputSeconds: number;
  outputSeconds: number;
}

interface UseGeminiLiveOptions {
  character?: Character;
  onAudioData: (audioData: string) => void;
  onTranscript?: (text: string) => void;
  onError?: (error: Error) => void;
  onUsageUpdate?: (metrics: UsageMetrics) => void;
  onAnalysisResult?: (result: SpeechAnalysisResult) => void;
  enableAnalysis?: boolean; // Enable speech analysis feature
  analysisIntervalSeconds?: number; // How often to analyze (default: 10 seconds)
}

export function useGeminiLive({
  character,
  onAudioData,
  onTranscript,
  onError,
  onUsageUpdate,
  onAnalysisResult,
  enableAnalysis = false,
  analysisIntervalSeconds = 10,
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

  // Usage tracking refs
  const inputAudioStartRef = useRef<number>(0);
  const outputAudioStartRef = useRef<number>(0);
  const totalInputSecondsRef = useRef<number>(0);
  const totalOutputSecondsRef = useRef<number>(0);

  // Audio analysis refs
  const audioBufferRef = useRef<Float32Array[]>([]);
  const analysisTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isAnalyzingRef = useRef(false);

  /**
   * Analyze buffered audio
   */
  const analyzeBufferedAudio = useCallback(async () => {
    if (!enableAnalysis || isAnalyzingRef.current || audioBufferRef.current.length === 0) {
      return;
    }

    try {
      isAnalyzingRef.current = true;

      // Concatenate all buffered audio chunks
      const totalLength = audioBufferRef.current.reduce((sum, chunk) => sum + chunk.length, 0);
      const combinedAudio = new Float32Array(totalLength);

      let offset = 0;
      for (const chunk of audioBufferRef.current) {
        combinedAudio.set(chunk, offset);
        offset += chunk.length;
      }

      // Clear buffer after combining
      audioBufferRef.current = [];

      // Convert Float32Array to WAV blob
      const wavBlob = createWavBlob(combinedAudio, 48000);

      // Send to analysis API
      const formData = new FormData();
      formData.append('file', wavBlob, 'audio.wav');

      const response = await fetch('/api/analyze', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && onAnalysisResult) {
          onAnalysisResult(data.results);
        }
      } else {
        console.warn('Speech analysis failed:', await response.text());
      }
    } catch (error) {
      console.error('Error analyzing speech:', error);
    } finally {
      isAnalyzingRef.current = false;
    }
  }, [enableAnalysis, onAnalysisResult]);

  /**
   * Create WAV blob from Float32Array audio data
   */
  const createWavBlob = (audioData: Float32Array, sampleRate: number): Blob => {
    const numChannels = 1;
    const bitsPerSample = 16;
    const bytesPerSample = bitsPerSample / 8;
    const blockAlign = numChannels * bytesPerSample;

    // Convert Float32 to Int16
    const int16Data = float32To16BitPCM(audioData);

    // Create WAV header
    const wavHeader = new ArrayBuffer(44);
    const view = new DataView(wavHeader);

    // "RIFF" chunk descriptor
    view.setUint32(0, 0x52494646, false); // "RIFF"
    view.setUint32(4, 36 + int16Data.byteLength, true); // File size - 8
    view.setUint32(8, 0x57415645, false); // "WAVE"

    // "fmt " sub-chunk
    view.setUint32(12, 0x666d7420, false); // "fmt "
    view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
    view.setUint16(20, 1, true); // AudioFormat (1 for PCM)
    view.setUint16(22, numChannels, true); // NumChannels
    view.setUint32(24, sampleRate, true); // SampleRate
    view.setUint32(28, sampleRate * blockAlign, true); // ByteRate
    view.setUint16(32, blockAlign, true); // BlockAlign
    view.setUint16(34, bitsPerSample, true); // BitsPerSample

    // "data" sub-chunk
    view.setUint32(36, 0x64617461, false); // "data"
    view.setUint32(40, int16Data.byteLength, true); // Subchunk2Size

    // Combine header and audio data
    return new Blob([wavHeader, int16Data.buffer as ArrayBuffer], { type: 'audio/wav' });
  };

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

              // Track output audio (24kHz, base64 encoded PCM)
              try {
                const audioBase64 = message.data;
                const binaryString = atob(audioBase64);
                const bytesLength = binaryString.length;
                const samplesCount = bytesLength / 2; // 16-bit = 2 bytes per sample
                const durationSeconds = samplesCount / 24000; // 24kHz output

                totalOutputSecondsRef.current += durationSeconds;

                // Notify usage update
                if (onUsageUpdate) {
                  onUsageUpdate({
                    inputSeconds: totalInputSecondsRef.current,
                    outputSeconds: totalOutputSecondsRef.current,
                  });
                }
              } catch (error) {
                console.error('Error tracking output audio duration:', error);
              }
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

      // Track input audio start time
      inputAudioStartRef.current = Date.now();

      // Handle audio data from worklet
      workletNode.port.onmessage = (event) => {
        if (event.data.type === 'audio' && sessionRef.current) {
          const audioData = event.data.data as Float32Array;

          // Buffer audio for analysis if enabled
          if (enableAnalysis) {
            audioBufferRef.current.push(new Float32Array(audioData));
          }

          // Calculate duration of this audio chunk
          const chunkDurationSeconds = audioData.length / 48000;
          totalInputSecondsRef.current += chunkDurationSeconds;

          // Notify usage update
          if (onUsageUpdate) {
            onUsageUpdate({
              inputSeconds: totalInputSecondsRef.current,
              outputSeconds: totalOutputSecondsRef.current,
            });
          }

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

      // Start periodic analysis if enabled
      if (enableAnalysis) {
        analysisTimerRef.current = setInterval(() => {
          analyzeBufferedAudio();
        }, analysisIntervalSeconds * 1000);
        console.log(`🔬 Speech analysis enabled (interval: ${analysisIntervalSeconds}s)`);
      }
    } catch (error) {
      console.error('Failed to start recording:', error);
      if (onError) {
        onError(error as Error);
      }
    }
  }, [connect, onError, enableAnalysis, analysisIntervalSeconds, analyzeBufferedAudio]);

  /**
   * Stop recording audio
   */
  const stopRecording = useCallback(() => {
    try {
      // Stop analysis timer
      if (analysisTimerRef.current) {
        clearInterval(analysisTimerRef.current);
        analysisTimerRef.current = null;
        console.log('🔬 Speech analysis stopped');
      }

      // Analyze any remaining buffered audio
      if (enableAnalysis && audioBufferRef.current.length > 0) {
        analyzeBufferedAudio();
      }

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
  }, [enableAnalysis, analyzeBufferedAudio]);

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
