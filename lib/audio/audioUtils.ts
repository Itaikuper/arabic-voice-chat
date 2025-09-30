/**
 * Audio utilities for Gemini Live API
 * Handles PCM conversion and audio streaming
 */

/**
 * Convert Float32Array audio data to 16-bit PCM format
 * Required format for Gemini Live API: 16-bit PCM, 16kHz, mono
 */
export function float32To16BitPCM(float32Array: Float32Array): Int16Array {
  const int16Array = new Int16Array(float32Array.length);
  for (let i = 0; i < float32Array.length; i++) {
    // Clamp values to [-1, 1] range
    const clamped = Math.max(-1, Math.min(1, float32Array[i]));
    // Convert to 16-bit integer
    int16Array[i] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
  }
  return int16Array;
}

/**
 * Convert Int16Array to base64 string
 */
export function int16ArrayToBase64(int16Array: Int16Array): string {
  const uint8Array = new Uint8Array(int16Array.buffer);
  let binary = '';
  const len = uint8Array.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(uint8Array[i]);
  }
  return btoa(binary);
}

/**
 * Convert base64 audio to Int16Array for playback
 */
export function base64ToInt16Array(base64: string): Int16Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return new Int16Array(bytes.buffer);
}

/**
 * Convert Int16Array to Float32Array for Web Audio API playback
 */
export function int16ToFloat32(int16Array: Int16Array): Float32Array {
  const float32Array = new Float32Array(int16Array.length);
  for (let i = 0; i < int16Array.length; i++) {
    // Convert 16-bit integer to float in range [-1, 1]
    // Use symmetric scaling to avoid distortion
    float32Array[i] = int16Array[i] / 0x8000;
  }
  return float32Array;
}

/**
 * Resample audio from source sample rate to target sample rate
 * Uses cubic interpolation for better quality (reduces metallic artifacts)
 */
export function resampleAudio(
  audioData: Float32Array,
  sourceSampleRate: number,
  targetSampleRate: number
): Float32Array {
  if (sourceSampleRate === targetSampleRate) {
    return audioData;
  }

  const ratio = sourceSampleRate / targetSampleRate;
  const newLength = Math.round(audioData.length / ratio);
  const result = new Float32Array(newLength);

  for (let i = 0; i < newLength; i++) {
    const position = i * ratio;
    const index = Math.floor(position);
    const fraction = position - index;

    // Cubic interpolation using 4 points for smoother results
    const y0 = audioData[Math.max(0, index - 1)] || 0;
    const y1 = audioData[index] || 0;
    const y2 = audioData[Math.min(audioData.length - 1, index + 1)] || 0;
    const y3 = audioData[Math.min(audioData.length - 1, index + 2)] || 0;

    // Catmull-Rom spline interpolation
    const a0 = -0.5 * y0 + 1.5 * y1 - 1.5 * y2 + 0.5 * y3;
    const a1 = y0 - 2.5 * y1 + 2 * y2 - 0.5 * y3;
    const a2 = -0.5 * y0 + 0.5 * y2;
    const a3 = y1;

    const frac2 = fraction * fraction;
    const frac3 = frac2 * fraction;

    result[i] = a0 * frac3 + a1 * frac2 + a2 * fraction + a3;
  }

  return result;
}

/**
 * Create an AudioWorklet processor for real-time audio processing
 * This runs in a separate thread for low-latency processing
 */
export const AUDIO_WORKLET_CODE = `
class AudioProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.bufferSize = 4096; // Process in chunks
    this.buffer = new Float32Array(this.bufferSize);
    this.bufferIndex = 0;
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    if (input.length > 0) {
      const inputChannel = input[0]; // Mono channel

      for (let i = 0; i < inputChannel.length; i++) {
        this.buffer[this.bufferIndex++] = inputChannel[i];

        // Send buffer when full
        if (this.bufferIndex >= this.bufferSize) {
          this.port.postMessage({
            type: 'audio',
            data: this.buffer.slice(0)
          });
          this.bufferIndex = 0;
        }
      }
    }

    return true; // Keep processor alive
  }
}

registerProcessor('audio-processor', AudioProcessor);
`;
