# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Real-time voice conversation application for Palestinian Arabic dialect using Google's Gemini 2.5 Flash Native Audio model. Direct WebSocket connection from browser to Gemini Live API for low-latency voice-to-voice interaction.

## Development Commands

```bash
# Development server (uses Turbopack)
npm run dev

# Production build
npm build

# Linting
npm run lint

# Run all tests
npx playwright test

# Run specific test file
npx playwright test tests/app.spec.ts

# Run tests in headed mode
npx playwright test --headed

# Show test report
npx playwright show-report
```

## Architecture Overview

### Audio Pipeline Flow
1. **Input**: Browser microphone → Web Audio API → AudioWorklet processor → 48kHz Float32 PCM
2. **Processing**: Resample 48kHz → 16kHz → Convert Float32 → Int16 → Base64 encode
3. **Transport**: WebSocket → Gemini Live API (native audio model)
4. **Output**: Base64 PCM response → Int16 → Float32 → AudioContext playback (24kHz)

### Core Components

**`hooks/useGeminiLive.ts`** - Custom React hook managing the entire Gemini Live API lifecycle:
- WebSocket connection management
- AudioContext and AudioWorklet setup for mic capture
- Real-time audio streaming (sends chunks every 4096 samples)
- Audio resampling from 48kHz to 16kHz (Gemini requirement)
- PCM format conversion and base64 encoding
- Response handling and audio data queueing

**`lib/audio/audioUtils.ts`** - Low-level audio utilities:
- `float32To16BitPCM()` - Convert Web Audio format to Gemini format
- `int16ToFloat32()` - Convert Gemini response to Web Audio format
- `resampleAudio()` - Linear interpolation resampling
- `AUDIO_WORKLET_CODE` - AudioWorklet processor (runs in separate thread for low latency)

**`components/VoiceChat.tsx`** - Main conversation UI
**`components/AudioPlayer.tsx`** - Handles playback of AI responses
**`app/page.tsx`** - Landing page with API key input

### Key Technical Details

- **Model**: `gemini-2.5-flash-native-audio-preview-09-2025`
- **System instruction**: Configured for Palestinian Arabic dialect responses
- **Audio format (input)**: 16-bit PCM, 16kHz, mono
- **Audio format (output)**: 16-bit PCM, 24kHz, mono
- **Processing**: AudioWorklet runs in separate thread for low-latency capture
- **No backend**: Direct browser-to-API communication
- **API key storage**: Browser memory only (localStorage or env var)

### Native Dependencies (Windows)

On Windows, Tailwind CSS v4 requires platform-specific native binaries:
- `@tailwindcss/oxide-win32-x64-msvc` - Tailwind CSS native engine
- `lightningcss-win32-x64-msvc` - Lightning CSS native parser

If you see "Cannot find module" errors for these, run:
```bash
npm install --force @tailwindcss/oxide-win32-x64-msvc lightningcss-win32-x64-msvc
```

## Project Configuration

- **Next.js 15** with Turbopack for fast builds
- **Tailwind CSS v4** with PostCSS
- **TypeScript** strict mode
- **Playwright** for E2E testing
- **ESLint** for code quality
