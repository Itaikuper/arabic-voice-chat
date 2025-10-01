# Speech Analysis Feature

Real-time Arabic speech fluency and confidence analysis for the voice chat application.

## Overview

This feature analyzes the user's Arabic speech in real-time to assess:
- **Fluency**: Speech rate, articulation, pause patterns
- **Confidence**: Voice intensity, pitch stability, voice quality
- **Proficiency**: Overall speaking ability based on acoustic features

## Architecture

```
┌─────────────────┐
│  Browser Audio  │
│   (Microphone)  │
└────────┬────────┘
         │
         ├─────────────────────────┐
         │                         │
         v                         v
┌────────────────┐         ┌──────────────┐
│  Gemini API    │         │ Audio Buffer │
│  (for chat)    │         │  (analysis)  │
└────────────────┘         └──────┬───────┘
                                   │
                                   │ Every 10s
                                   v
                          ┌────────────────┐
                          │  /api/analyze  │
                          │  (Next.js API) │
                          └────────┬───────┘
                                   │
                                   v
                          ┌────────────────┐
                          │  Python Service│
                          │  (Parselmouth) │
                          └────────┬───────┘
                                   │
                                   v
                          ┌────────────────┐
                          │ Analysis Results│
                          │  (JSON scores) │
                          └────────┬───────┘
                                   │
                                   v
                          ┌────────────────┐
                          │  FluencyMeter  │
                          │   (Component)  │
                          └────────────────┘
```

## Setup Instructions

### 1. Install Python Dependencies

```bash
cd python-service
python -m venv venv

# Windows
venv\Scripts\activate

# Linux/Mac
source venv/bin/activate

pip install -r requirements.txt
```

### 2. Start the Python Analysis Service

```bash
python analyze.py
```

The service will run on http://localhost:8000

Check health: http://localhost:8000/health
API docs: http://localhost:8000/docs

### 3. Configure Environment Variables (Optional)

Add to `.env.local`:

```env
PYTHON_SERVICE_URL=http://localhost:8000
```

### 4. Enable Analysis in Your App

Update your component to enable analysis:

```tsx
import { VoiceChat } from '@/components/VoiceChat';

// Enable analysis feature
<VoiceChat
  character={selectedCharacter}
  enableAnalysis={true}
/>
```

## How It Works

### Audio Processing

1. **Capture**: Browser captures microphone audio at 48kHz
2. **Buffering**: Audio chunks are buffered in memory (Float32Array)
3. **Analysis Trigger**: Every 10 seconds (configurable), buffered audio is analyzed
4. **Conversion**: Audio is converted to WAV format for Python service
5. **Processing**: Python service uses Parselmouth (Praat) to extract features
6. **Display**: Results are shown in real-time via FluencyMeter component

### Analyzed Features

#### Pitch (Frequency)
- **Mean/Std/Min/Max**: Voice pitch statistics in Hz
- **Coefficient of Variation**: Pitch stability (lower = more confident)

#### Intensity (Loudness)
- Mean, standard deviation, and maximum intensity in dB
- Higher values indicate louder, more confident speech

#### Voice Quality
- **HNR (Harmonics-to-Noise Ratio)**: Voice clarity (>10 dB is good)
- **Jitter**: Frequency variation (<0.01 is good)
- **Shimmer**: Amplitude variation (<0.05 is good)

#### Timing
- **Speech Rate**: Syllables per minute including pauses (optimal: 150-200)
- **Articulation Rate**: Syllables per minute excluding pauses (optimal: 180-250)
- **Pause Ratio**: Percentage of time in silence

### Scoring Algorithm

#### Confidence Score (0-100)
Based on:
- Intensity: Higher = more confident (65+ dB is good)
- Pitch Stability: Lower CV = more stable = more confident
- Voice Quality: High HNR, low jitter/shimmer = better quality

#### Fluency Score (0-100)
Based on:
- Speech Rate: 150-200 syllables/min is optimal
- Pause Ratio: <20% is excellent, <30% is good
- Articulation Rate: 180-250 syllables/min is optimal

#### Overall Score
Average of confidence and fluency scores, adjusted for hesitation/filler words.

## API Reference

### POST /api/analyze

Analyze audio file for fluency and confidence.

**Request:**
```
Content-Type: multipart/form-data
file: <audio file> (WAV, WebM, or OGG)
```

**Response:**
```json
{
  "success": true,
  "filename": "audio.wav",
  "results": {
    "duration": 5.2,
    "pitch": {
      "mean": 180.5,
      "std": 25.3,
      "coefficient_of_variation": 14.02
    },
    "intensity": {
      "mean": 62.5,
      "std": 5.8,
      "max": 75.2
    },
    "voice_quality": {
      "harmonics_to_noise_ratio": 12.5,
      "jitter": 0.008,
      "shimmer": 0.04
    },
    "timing": {
      "speaking_time": 4.5,
      "silence_time": 0.7,
      "pause_ratio": 13.46,
      "speech_rate": 175.5,
      "articulation_rate": 200.0
    },
    "scores": {
      "confidence": 78.5,
      "fluency": 85.2,
      "overall": 81.85
    }
  }
}
```

### GET /api/analyze

Health check endpoint.

**Response:**
```json
{
  "status": "healthy",
  "pythonService": {
    "status": "healthy",
    "service": "speech-analysis"
  }
}
```

## Configuration Options

### In `useGeminiLive` Hook

```typescript
useGeminiLive({
  // ... other options
  enableAnalysis: true,              // Enable/disable analysis
  analysisIntervalSeconds: 10,       // How often to analyze (default: 10s)
  onAnalysisResult: (result) => {    // Callback for results
    console.log('Analysis:', result);
  }
})
```

### In VoiceChat Component

```tsx
<VoiceChat
  character={character}
  enableAnalysis={true}              // Enable analysis feature
/>
```

## Arabic Filler Words Detection

The system detects common Arabic filler words:

- يعني (ya'ni) - "means"
- وﷲ / والله (wallah) - "by God"
- اه (eh) - hesitation sound
- مثلا (mathalan) - "for example"
- يعني كذا - "like this"
- And more...

These are counted and used to adjust fluency scores.

## Troubleshooting

### Python Service Not Running

**Error**: `Speech analysis service is not running`

**Solution**: Start the Python service:
```bash
cd python-service
python analyze.py
```

### No Analysis Results

**Possible causes**:
1. `enableAnalysis` is set to `false`
2. Python service is not running
3. Audio buffer is empty (speak for at least 10 seconds)

### Low Scores Despite Good Speech

**Possible causes**:
1. Microphone quality/placement
2. Background noise
3. Speaking too softly or too quickly
4. Algorithm calibration (scores are relative)

### Analysis Takes Too Long

**Solutions**:
1. Increase `analysisIntervalSeconds` (e.g., 15 or 20 seconds)
2. Check Python service logs for performance issues
3. Ensure Python dependencies are properly installed

## Future Enhancements

### Planned Features

1. **Enhanced Arabic Dialect Detection**
   - Distinguish between Palestinian, Egyptian, Gulf, Levantine dialects
   - Dialect consistency scoring

2. **Pronunciation Assessment**
   - Phoneme-level analysis
   - Compare to native speaker patterns

3. **Advanced NLP Integration**
   - Real-time transcription analysis
   - Grammar and vocabulary assessment
   - Semantic coherence scoring

4. **Historical Tracking**
   - Store analysis results over time
   - Progress visualization
   - Personalized improvement suggestions

5. **Machine Learning Enhancement**
   - Train on Palestinian Arabic specific corpus
   - Personalized scoring based on user baseline
   - Emotion and sentiment analysis

### Integration with OpenSMILE

For more advanced analysis, consider integrating OpenSMILE:

```python
# Example: Extract 1582 features with OpenSMILE
import opensmile

smile = opensmile.Smile(
    feature_set=opensmile.FeatureSet.ComParE_2016,
    feature_level=opensmile.FeatureLevel.Functionals,
)

features = smile.process_file('audio.wav')
```

## Performance Considerations

### Client-Side
- Audio buffering uses minimal memory (~5-10 MB per 10s)
- WAV conversion happens in browser
- No impact on Gemini Live API performance

### Server-Side
- Python service analyzes 10s of audio in <1 second
- FastAPI handles concurrent requests
- Parselmouth is efficient and battle-tested

### Network
- WAV files are ~1 MB per 10 seconds of audio
- Analysis requests are asynchronous
- No blocking of chat functionality

## Privacy & Security

- Audio is analyzed in real-time and not stored
- Python service runs locally (localhost)
- No data sent to external services
- All analysis happens on your machine

## Testing

### Manual Testing

1. Start Python service
2. Start Next.js app with `enableAnalysis={true}`
3. Start recording and speak for 10+ seconds
4. Verify FluencyMeter appears with scores
5. Check console for analysis results

### API Testing

Test the Python service directly:

```bash
# Using curl
curl -X POST http://localhost:8000/analyze \
  -F "file=@test_audio.wav"

# Or visit http://localhost:8000/docs for interactive API testing
```

### Health Check

```bash
curl http://localhost:8000/health
```

## Credits

- **Parselmouth**: Python interface to Praat (https://github.com/YannickJadoul/Parselmouth)
- **Praat**: Phonetics software by Paul Boersma and David Weenink
- **FastAPI**: Modern web framework for Python APIs

## License

This feature is part of the Arabic Voice Chat application and follows the same license.
