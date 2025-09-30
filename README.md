# Arabic Voice Chat 🎤

A real-time voice conversation application that enables natural conversations in Palestinian Arabic dialect using Google's Gemini 2.5 Flash Native Audio model.

## Features

- Real-time voice-to-voice conversation
- Palestinian Arabic dialect support  
- Low-latency audio streaming via WebSockets
- Native audio processing (16-bit PCM, 16kHz input / 24kHz output)
- Voice Activity Detection
- Secure API key handling
- Modern, responsive UI
- Built with Next.js 15 and TypeScript

## Getting Started

### Prerequisites

- Node.js 20+ and npm
- Google Gemini API key (get at https://aistudio.google.com/apikey)
- Modern browser with microphone support

### Installation

1. Navigate to the project and install dependencies:
   ```bash
   cd arabic-voice-chat
   npm install
   ```

2. Configure your API key (option A or B):

   **Option A:** Environment variable
   ```bash
   cp .env.example .env.local
   # Edit .env.local and add: NEXT_PUBLIC_GEMINI_API_KEY=your_key_here
   ```

   **Option B:** Enter at runtime in the UI

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Open http://localhost:3000

## Usage

1. Enter your API key (if not in .env.local)
2. Click the microphone button
3. Speak in Palestinian Arabic
4. Listen to the AI's response
5. Click stop when done

## Architecture

- **Direct WebSocket** connection to Gemini Live API
- **Web Audio API** for mic capture and playback
- **Real-time PCM audio** conversion
- **Model:** gemini-2.5-flash-native-audio-preview-09-2025

## Security

- API keys stored in browser memory only
- Direct client-to-API communication
- Environment variables git-ignored
- HTTPS recommended for production

## Testing

```bash
npx playwright test
```

## License

MIT

Built with Google Gemini API | Next.js | Tailwind CSS
