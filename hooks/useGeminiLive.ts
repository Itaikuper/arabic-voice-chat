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

export interface ConversationTurn {
  speaker: 'user' | 'ai';
  text: string;
  timestamp: Date;
}

export interface PhaseInfo {
  currentPhase: number;           // 0, 1, 2, 3
  turnCount: number;
  estimatedMinutes: number;
  characterType: string;
  phase2Eligible: boolean;
  phase3Eligible: boolean;
  phase2Threshold?: number;
  phase3Threshold?: number;
  nextPhaseInfo: string;
}

interface UseGeminiLiveOptions {
  character?: Character;
  onAudioData: (audioData: string) => void;
  onTranscript?: (text: string) => void;
  onError?: (error: Error) => void;
  onUsageUpdate?: (metrics: UsageMetrics) => void;
  onAnalysisResult?: (result: SpeechAnalysisResult) => void;
  onPhaseUpdate?: (phaseInfo: PhaseInfo) => void;
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
  onPhaseUpdate,
  enableAnalysis = false,
  analysisIntervalSeconds = 10,
}: UseGeminiLiveOptions) {
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [isRecording, setIsRecording] = useState(false);
  const [conversationHistory, setConversationHistory] = useState<ConversationTurn[]>([]);

  // Phase tracking state
  const [currentPhase, setCurrentPhase] = useState(0);
  const previousPhaseRef = useRef(0);
  const recordingStartTimeRef = useRef<number | null>(null);

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
  const analysisServiceAvailableRef = useRef<boolean | null>(null);

  // Audio recording refs for transcription
  const userAudioChunksRef = useRef<Float32Array[]>([]);
  const aiAudioChunksRef = useRef<Int16Array[]>([]);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  /**
   * Analyze buffered audio
   */
  const analyzeBufferedAudio = useCallback(async () => {
    if (!enableAnalysis || isAnalyzingRef.current || audioBufferRef.current.length === 0) {
      return;
    }

    try {
      // Check analysis service availability lazily once
      if (analysisServiceAvailableRef.current === null) {
        try {
          const health = await fetch('/api/analyze', { method: 'GET' });
          analysisServiceAvailableRef.current = health.ok;
          if (!health.ok) {
            console.warn('Speech analysis unavailable; skipping analysis this session');
            return;
          }
        } catch {
          analysisServiceAvailableRef.current = false;
          console.warn('Speech analysis unreachable; skipping analysis this session');
          return;
        }
      }

      if (!analysisServiceAvailableRef.current) {
        return;
      }

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
        const txt = await response.text();
        console.warn('Speech analysis failed:', txt);
        // If service reports unavailable, disable for the rest of session
        if (response.status === 503) {
          analysisServiceAvailableRef.current = false;
        }
      }
    } catch (error) {
      console.error('Error analyzing speech:', error);
      // Network-level failure: disable further attempts this session
      analysisServiceAvailableRef.current = false;
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
      // IMPORTANT: We need both AUDIO and TEXT modalities to get native transcription
      const config = {
        responseModalities: [Modality.AUDIO, Modality.TEXT],
        inputAudioTranscription: {}, // Enable user speech transcription
        outputAudioTranscription: {}, // Enable AI speech transcription
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

            // Debug: Log ALL parts of the message to understand structure
            if (message.serverContent?.modelTurn) {
              console.log('📨 Full message parts:', {
                hasData: !!message.data,
                hasInputTranscription: !!message.serverContent?.inputTranscription,
                hasOutputTranscription: !!message.serverContent?.outputTranscription,
                modelTurnParts: message.serverContent?.modelTurn?.parts?.map((part: any) => ({
                  type: Object.keys(part)[0],
                  hasText: !!part.text,
                  hasThought: !!part.thought,
                  textPreview: part.text ? part.text.substring(0, 50) + '...' : undefined,
                  thoughtPreview: part.thought ? part.thought.substring(0, 50) + '...' : undefined,
                })),
              });
            }

            // Debug: Log message structure (only relevant parts for transcript)
            if (message.serverContent?.inputTranscription || message.serverContent?.outputTranscription) {
              console.log('📨 Transcript message received:', {
                hasInputTranscription: !!message.serverContent?.inputTranscription,
                inputText: message.serverContent?.inputTranscription?.text,
                hasOutputTranscription: !!message.serverContent?.outputTranscription,
                outputText: message.serverContent?.outputTranscription?.text,
              });
            }

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

                // Store AI audio for transcription (decode base64 to Int16Array)
                const int16Array = new Int16Array(samplesCount);
                for (let i = 0; i < samplesCount; i++) {
                  const byte1 = binaryString.charCodeAt(i * 2);
                  const byte2 = binaryString.charCodeAt(i * 2 + 1);
                  int16Array[i] = byte1 | (byte2 << 8);
                }
                aiAudioChunksRef.current.push(int16Array);

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

            // Capture input transcription (user speech) - from native API
            if (message.serverContent?.inputTranscription?.text) {
              const userText = message.serverContent.inputTranscription.text;
              console.log('📝 User transcript (native):', userText);
              setConversationHistory((prev) => [
                ...prev,
                {
                  speaker: 'user',
                  text: userText,
                  timestamp: new Date(),
                },
              ]);
            }

            // Capture output transcription (AI speech) - ONLY use native transcription
            // With responseModalities: ['TEXT', 'AUDIO'], Gemini provides native transcription
            if (message.serverContent?.outputTranscription?.text) {
              const aiText = message.serverContent.outputTranscription.text;
              console.log('🎙️ AI transcript (native):', aiText);
              setConversationHistory((prev) => [
                ...prev,
                {
                  speaker: 'ai',
                  text: aiText,
                  timestamp: new Date(),
                },
              ]);
              // Also call the legacy callback
              if (onTranscript) {
                onTranscript(aiText);
              }
            }

            // ALSO capture text parts from modelTurn (if transcription is missing)
            // This catches the "text" part that the SDK warning mentions
            if (!message.serverContent?.outputTranscription?.text && message.serverContent?.modelTurn?.parts) {
              const textParts = message.serverContent.modelTurn.parts
                .filter((part: any) => part.text)
                .map((part: any) => part.text);

              if (textParts.length > 0) {
                const combinedText = textParts.join(' ');
                console.log('📝 AI text part (fallback):', combinedText);
                setConversationHistory((prev) => [
                  ...prev,
                  {
                    speaker: 'ai',
                    text: combinedText,
                    timestamp: new Date(),
                  },
                ]);
                if (onTranscript) {
                  onTranscript(combinedText);
                }
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

          // Store user audio for transcription
          userAudioChunksRef.current.push(new Float32Array(audioData));

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

      // Track recording start time for real-time phase transitions
      if (!recordingStartTimeRef.current) {
        recordingStartTimeRef.current = Date.now();
        console.log('⏱️  Recording session started at:', new Date().toLocaleTimeString());
      }

      setIsRecording(true);
      console.log('🎤 Recording started');

      // Start periodic analysis if enabled and available
      if (enableAnalysis) {
        // Reset availability for new session; will be checked lazily
        analysisServiceAvailableRef.current = null;
        analysisTimerRef.current = setInterval(() => {
          analyzeBufferedAudio();
        }, analysisIntervalSeconds * 1000);
        console.log(`🔬 Speech analysis scheduled (interval: ${analysisIntervalSeconds}s)`);
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
   * Phase detection logic - detect phase transitions based on conversation
   */
  useEffect(() => {
    if (!character) return;

    const turnCount = Math.floor(conversationHistory.length / 2);
    const estimatedMinutesFromTurns = Math.round(turnCount * 1.5);

    // Calculate real elapsed time in minutes
    const realElapsedMinutes = recordingStartTimeRef.current
      ? Math.floor((Date.now() - recordingStartTimeRef.current) / 1000 / 60)
      : 0;

    // Use the maximum of turn-based time or real time for phase transitions
    const estimatedMinutes = Math.max(estimatedMinutesFromTurns, realElapsedMinutes);

    // Debug logging (only in development)
    if (process.env.NODE_ENV === 'development') {
      console.log(`[Phase Debug] Phase: ${currentPhase}, Turns: ${turnCount}, TurnTime: ${estimatedMinutesFromTurns}min, RealTime: ${realElapsedMinutes}min, Using: ${estimatedMinutes}min`);
    }

    // Get last user message to check for triggers
    const lastUserMessage = conversationHistory
      .filter(turn => turn.speaker === 'user')
      .slice(-1)[0]?.text || '';

    // Phase 0 → 1: Detect security keywords (flexible) OR time fallback
    const normalizeArabic = (text: string) => {
      return text.replace(/[\u064B-\u065F]/g, '').toLowerCase();
    };

    const securityKeywords = [
      'أمني', 'امني', 'أمنيات', 'امنيات', 'أمنية', 'امنية',
      'نشاط', 'أنشطة', 'نشاطات',
      'حاجز', 'حجار', 'مظاهر', 'رمي'
    ];

    const normalized = normalizeArabic(lastUserMessage);
    const hasSecurityKeyword = securityKeywords.some(kw =>
      normalized.includes(normalizeArabic(kw))
    );

    const timeElapsed = estimatedMinutes >= 7; // Fallback: 7 minutes

    if (currentPhase === 0 && (hasSecurityKeyword || timeElapsed)) {
      const trigger = hasSecurityKeyword
        ? `security keyword detected: "${lastUserMessage.substring(0, 30)}..."`
        : `${realElapsedMinutes} min elapsed (real time fallback)`;
      console.log(`🔄 Phase 0 → 1: ${trigger}`);
      console.log(`⏱️  Time tracking - Turns: ${estimatedMinutesFromTurns}min, Real: ${realElapsedMinutes}min, Used: ${estimatedMinutes}min`);
      setCurrentPhase(1);
      return;
    }

    // Phase 1 → 2: Time + Eligibility
    if (
      currentPhase === 1 &&
      character.phase2Eligible &&
      character.phase2RequiredMinutes &&
      estimatedMinutes >= character.phase2RequiredMinutes
    ) {
      console.log(`🔄 Phase 1 → 2: ${estimatedMinutes} min elapsed (threshold: ${character.phase2RequiredMinutes})`);
      setCurrentPhase(2);
      return;
    }

    // Phase 2 → 3: Time + Eligibility
    if (
      currentPhase === 2 &&
      character.phase3Eligible &&
      character.phase3RequiredMinutes &&
      estimatedMinutes >= character.phase3RequiredMinutes
    ) {
      console.log(`🔄 Phase 2 → 3: ${estimatedMinutes} min elapsed (threshold: ${character.phase3RequiredMinutes})`);
      setCurrentPhase(3);
      return;
    }
  }, [conversationHistory, currentPhase, character]);

  /**
   * Context injection - inject phase-specific context when phase changes
   */
  useEffect(() => {
    if (!character || !sessionRef.current || !character.phaseContexts) return;

    if (currentPhase !== previousPhaseRef.current) {
      const phaseKey = `phase${currentPhase}` as 'phase0' | 'phase1' | 'phase2' | 'phase3';
      const newContext = character.phaseContexts[phaseKey];

      if (newContext) {
        console.log(`💉 Injecting Phase ${currentPhase} context for ${character.name}`);
        try {
          sessionRef.current.sendRealtimeInput({
            text: `[PHASE ${currentPhase} CONTEXT]\n${newContext}`
          });
        } catch (error) {
          console.error('Error injecting context:', error);
        }
      }

      previousPhaseRef.current = currentPhase;
    }
  }, [currentPhase, character]);

  /**
   * Emit phase updates to parent component
   */
  useEffect(() => {
    if (!onPhaseUpdate || !character) return;

    const turnCount = Math.floor(conversationHistory.length / 2);
    const estimatedMinutes = Math.round(turnCount * 1.5);

    // Calculate next phase info
    let nextPhaseInfo = 'N/A';
    if (currentPhase === 0) {
      nextPhaseInfo = 'Phase 1 when interrogator mentions "أمنيات"';
    } else if (currentPhase === 1 && character.phase2Eligible && character.phase2RequiredMinutes) {
      const remaining = character.phase2RequiredMinutes - estimatedMinutes;
      nextPhaseInfo = remaining > 0
        ? `Phase 2 in ~${remaining} min`
        : `Phase 2 eligible now`;
    } else if (currentPhase === 2 && character.phase3Eligible && character.phase3RequiredMinutes) {
      const remaining = character.phase3RequiredMinutes - estimatedMinutes;
      nextPhaseInfo = remaining > 0
        ? `Phase 3 in ~${remaining} min`
        : `Phase 3 eligible now`;
    } else if (currentPhase === 1 && !character.phase2Eligible) {
      nextPhaseInfo = 'Stays in Phase 1 (Type A - Never confesses)';
    } else if (currentPhase === 2 && !character.phase3Eligible) {
      nextPhaseInfo = 'Stays in Phase 2 (Type B - Probes but refuses)';
    }

    onPhaseUpdate({
      currentPhase,
      turnCount,
      estimatedMinutes,
      characterType: character.confessionType,
      phase2Eligible: character.phase2Eligible,
      phase3Eligible: character.phase3Eligible,
      phase2Threshold: character.phase2RequiredMinutes,
      phase3Threshold: character.phase3RequiredMinutes,
      nextPhaseInfo,
    });
  }, [currentPhase, conversationHistory, character, onPhaseUpdate]);

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
   * Clear conversation history
   */
  const clearConversationHistory = useCallback(() => {
    setConversationHistory([]);
  }, []);

  /**
   * Generate formatted transcript from conversation history
   */
  const generateTranscript = useCallback(() => {
    console.log('📝 Formatting conversation transcript...');

    if (conversationHistory.length === 0) {
      return 'No conversation to transcribe.';
    }

    // Use dynamic character name and initial (fallback to AI/A)
    const aiName = (character?.name || 'AI').trim();
    const aiInitial = aiName.charAt(0) || 'A';

    // Format the conversation history in the requested style:
    // User (U): ...\nName (N): ...
    let transcript = '';

    conversationHistory.forEach((turn) => {
      const label = turn.speaker === 'user' ? 'User (U)' : `${aiName} (${aiInitial})`;
      transcript += `${label}: ${turn.text}\n`;
    });

    console.log('✅ Transcript formatted successfully');
    return transcript;
  }, [conversationHistory, character]);

  /**
   * Generate high-fidelity transcript by uploading recorded audio to backend
   * Falls back to quick transcript if audio is missing
   */
  const generateHighFidelityTranscript = useCallback(async (): Promise<string> => {
    try {
      // Combine user audio chunks (Float32 @ 48k) -> WAV
      let userBlob: Blob | null = null;
      if (userAudioChunksRef.current.length > 0) {
        const total = userAudioChunksRef.current.reduce((s, c) => s + c.length, 0);
        const combined = new Float32Array(total);
        let off = 0;
        for (const chunk of userAudioChunksRef.current) {
          combined.set(chunk, off);
          off += chunk.length;
        }
        userBlob = createWavBlob(combined, 48000);
      }

      // Combine AI audio chunks (Int16 @ 24k) -> WAV
      let aiBlob: Blob | null = null;
      if (aiAudioChunksRef.current.length > 0) {
        const totalSamples = aiAudioChunksRef.current.reduce((s, c) => s + c.length, 0);
        const combined = new Int16Array(totalSamples);
        let off = 0;
        for (const chunk of aiAudioChunksRef.current) {
          combined.set(chunk, off);
          off += chunk.length;
        }
        aiBlob = createWavFromInt16(combined, 24000);
      }

      if (!userBlob && !aiBlob) {
        return 'No audio captured to transcribe.';
      }

      const form = new FormData();
      if (userBlob) form.append('userAudio', userBlob, 'user.wav');
      if (aiBlob) form.append('aiAudio', aiBlob, 'ai.wav');

      const resp = await fetch('/api/transcribe', { method: 'POST', body: form });
      if (!resp.ok) {
        const txt = await resp.text();
        throw new Error(`Transcription failed: ${resp.status} ${txt}`);
      }
      const data = await resp.json();
      const text = data?.transcript || '';
      return text || 'No transcript generated';
    } catch (e) {
      console.error('High-fidelity transcription error:', e);
      return 'Transcription service unavailable. Try the quick transcript.';
    }
  }, []);

  /**
   * Generate transcript with fallback: use quick history; if empty, use high-fidelity
   */
  const generateTranscriptAuto = useCallback(async (): Promise<string> => {
    const quick = generateTranscript();
    if (quick && quick.trim() && quick !== 'No conversation to transcribe.') {
      return quick;
    }
    return await generateHighFidelityTranscript();
  }, [generateTranscript, generateHighFidelityTranscript]);

  /**
   * Create WAV blob from Int16Array audio data
   */
  const createWavFromInt16 = (audioData: Int16Array, sampleRate: number): Blob => {
    const numChannels = 1;
    const bitsPerSample = 16;
    const bytesPerSample = bitsPerSample / 8;
    const blockAlign = numChannels * bytesPerSample;

    // Create WAV header
    const wavHeader = new ArrayBuffer(44);
    const view = new DataView(wavHeader);

    // "RIFF" chunk descriptor
    view.setUint32(0, 0x52494646, false); // "RIFF"
    view.setUint32(4, 36 + audioData.byteLength, true); // File size - 8
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
    view.setUint32(40, audioData.byteLength, true); // Subchunk2Size

    // Combine header and audio data
    return new Blob([wavHeader, audioData.buffer as ArrayBuffer], { type: 'audio/wav' });
  };

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
    conversationHistory,
    clearConversationHistory,
    generateTranscript,
    generateTranscriptAuto,
  };
}
