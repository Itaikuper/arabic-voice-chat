# Speech Analysis Python Service

This service uses Parselmouth (Python interface to Praat) to analyze speech for fluency and confidence metrics.

## Installation

```bash
cd python-service
python -m venv venv

# Windows
venv\Scripts\activate

# Linux/Mac
source venv/bin/activate

pip install -r requirements.txt
```

## Running the Service

```bash
python analyze.py
```

The service will start on http://localhost:8000

- API Documentation: http://localhost:8000/docs
- Health Check: http://localhost:8000/health

## API Endpoints

### POST /analyze

Upload an audio file for analysis.

**Request:**
- Method: POST
- Content-Type: multipart/form-data
- Body: file (audio/wav, audio/webm, audio/ogg)

**Response:**
```json
{
  "success": true,
  "filename": "sample.wav",
  "results": {
    "duration": 5.2,
    "pitch": {
      "mean": 180.5,
      "std": 25.3,
      "min": 120.0,
      "max": 250.0,
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

## Metrics Explained

### Pitch (Frequency)
- **Mean/Std/Min/Max**: Voice pitch statistics in Hz
- **Coefficient of Variation**: Lower = more stable = more confident

### Intensity (Loudness)
- Measured in dB
- Higher values indicate louder, more confident speech

### Voice Quality
- **HNR (Harmonics-to-Noise Ratio)**: Higher = clearer voice (> 10 is good)
- **Jitter**: Frequency variation (< 0.01 is good)
- **Shimmer**: Amplitude variation (< 0.05 is good)

### Timing
- **Speech Rate**: Syllables per minute (including pauses)
- **Articulation Rate**: Syllables per minute (excluding pauses)
- **Pause Ratio**: % of time spent in silence

### Scores (0-100)
- **Confidence**: Based on intensity, pitch stability, voice quality
- **Fluency**: Based on speech rate, pause ratio, articulation
- **Overall**: Average of confidence and fluency

## Integration with Next.js

The Next.js app should call this service via API routes to analyze audio chunks from the voice chat.
