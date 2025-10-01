"""
Speech Analysis Service using Parselmouth (Praat)
Analyzes audio files for fluency and confidence metrics
"""

import parselmouth
from parselmouth.praat import call
import numpy as np
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import tempfile
import os
from typing import Dict, Any
import uvicorn

app = FastAPI(title="Speech Analysis Service")

# Enable CORS for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def analyze_audio_file(file_path: str) -> Dict[str, Any]:
    """
    Analyze audio file using Parselmouth to extract acoustic features

    Returns:
        Dictionary containing fluency and confidence metrics
    """
    try:
        # Load audio file
        sound = parselmouth.Sound(file_path)

        # Get basic audio properties
        duration = sound.duration  # in seconds
        sampling_rate = sound.sampling_frequency

        # Extract pitch (F0) - fundamental frequency
        pitch = sound.to_pitch(time_step=0.01)
        pitch_values = pitch.selected_array['frequency']
        pitch_values = pitch_values[pitch_values > 0]  # Remove unvoiced frames

        if len(pitch_values) == 0:
            raise ValueError("No voiced segments detected in audio")

        mean_pitch = float(np.mean(pitch_values))
        std_pitch = float(np.std(pitch_values))
        min_pitch = float(np.min(pitch_values))
        max_pitch = float(np.max(pitch_values))

        # Calculate pitch stability (confidence indicator)
        # Lower coefficient of variation = more stable = more confident
        pitch_cv = (std_pitch / mean_pitch) * 100 if mean_pitch > 0 else 0

        # Extract intensity (loudness)
        intensity = sound.to_intensity(time_step=0.01)
        intensity_values = intensity.values[0]
        intensity_values = intensity_values[intensity_values > 0]

        if len(intensity_values) > 0:
            mean_intensity = float(np.mean(intensity_values))
            std_intensity = float(np.std(intensity_values))
            max_intensity = float(np.max(intensity_values))
        else:
            mean_intensity = std_intensity = max_intensity = 0.0

        # Extract voice quality metrics
        # Harmonicity (HNR - Harmonics-to-Noise Ratio)
        harmonicity = sound.to_harmonicity()
        hnr_values = harmonicity.values[0]
        hnr_values = hnr_values[~np.isnan(hnr_values)]
        mean_hnr = float(np.mean(hnr_values)) if len(hnr_values) > 0 else 0.0

        # Extract jitter and shimmer (voice quality indicators)
        point_process = call(sound, "To PointProcess (periodic, cc)", 75, 500)

        jitter = 0.0
        shimmer = 0.0
        try:
            jitter = call(point_process, "Get jitter (local)", 0, 0, 0.0001, 0.02, 1.3)
            shimmer = call([sound, point_process], "Get shimmer (local)", 0, 0, 0.0001, 0.02, 1.3, 1.6)
        except:
            pass  # If jitter/shimmer calculation fails, keep as 0

        # Calculate speech rate estimation
        # Use intensity to detect voiced segments
        silence_threshold = mean_intensity * 0.3 if mean_intensity > 0 else 40

        # Create TextGrid for syllable detection (simplified)
        intensity_tier = intensity.values[0]
        speech_frames = np.sum(intensity_tier > silence_threshold)
        total_frames = len(intensity_tier)

        # Estimate speaking time (frames above threshold)
        speaking_time = (speech_frames / total_frames) * duration if total_frames > 0 else 0
        silence_time = duration - speaking_time

        # Pause ratio (higher = more hesitation)
        pause_ratio = (silence_time / duration * 100) if duration > 0 else 0

        # Estimate articulation rate (rough approximation)
        # Assumes average syllable duration of 0.2 seconds
        estimated_syllables = speaking_time / 0.2 if speaking_time > 0 else 0
        speech_rate = (estimated_syllables * 60) / duration if duration > 0 else 0  # syllables per minute
        articulation_rate = (estimated_syllables * 60) / speaking_time if speaking_time > 0 else 0

        # Calculate confidence score (0-100)
        # Factors: high intensity, stable pitch, good HNR, low jitter/shimmer
        confidence_score = calculate_confidence_score(
            mean_intensity=mean_intensity,
            pitch_cv=pitch_cv,
            mean_hnr=mean_hnr,
            jitter=jitter,
            shimmer=shimmer
        )

        # Calculate fluency score (0-100)
        # Factors: good speech rate, low pause ratio, stable articulation
        fluency_score = calculate_fluency_score(
            speech_rate=speech_rate,
            pause_ratio=pause_ratio,
            articulation_rate=articulation_rate
        )

        return {
            "duration": round(duration, 2),
            "pitch": {
                "mean": round(mean_pitch, 2),
                "std": round(std_pitch, 2),
                "min": round(min_pitch, 2),
                "max": round(max_pitch, 2),
                "coefficient_of_variation": round(pitch_cv, 2)
            },
            "intensity": {
                "mean": round(mean_intensity, 2),
                "std": round(std_intensity, 2),
                "max": round(max_intensity, 2)
            },
            "voice_quality": {
                "harmonics_to_noise_ratio": round(mean_hnr, 2),
                "jitter": round(jitter, 4),
                "shimmer": round(shimmer, 4)
            },
            "timing": {
                "speaking_time": round(speaking_time, 2),
                "silence_time": round(silence_time, 2),
                "pause_ratio": round(pause_ratio, 2),
                "speech_rate": round(speech_rate, 2),
                "articulation_rate": round(articulation_rate, 2)
            },
            "scores": {
                "confidence": round(confidence_score, 2),
                "fluency": round(fluency_score, 2),
                "overall": round((confidence_score + fluency_score) / 2, 2)
            }
        }

    except Exception as e:
        raise ValueError(f"Error analyzing audio: {str(e)}")


def calculate_confidence_score(
    mean_intensity: float,
    pitch_cv: float,
    mean_hnr: float,
    jitter: float,
    shimmer: float
) -> float:
    """
    Calculate confidence score based on acoustic features

    Confident speech characteristics:
    - Higher intensity (louder voice)
    - Lower pitch variation (stable pitch)
    - Higher HNR (clear voice)
    - Lower jitter and shimmer (steady voice)
    """
    score = 50  # Start at middle

    # Intensity score (0-25 points)
    # Typical speaking intensity: 50-70 dB
    if mean_intensity >= 65:
        score += 25
    elif mean_intensity >= 55:
        score += 15
    elif mean_intensity >= 45:
        score += 5

    # Pitch stability score (0-25 points)
    # Lower CV = more stable = more confident
    if pitch_cv < 10:
        score += 25
    elif pitch_cv < 20:
        score += 15
    elif pitch_cv < 30:
        score += 5

    # Voice quality score (0-25 points)
    if mean_hnr > 15:  # Good voice quality
        score += 15
    elif mean_hnr > 10:
        score += 8

    if jitter < 0.01 and shimmer < 0.05:  # Low jitter/shimmer
        score += 10
    elif jitter < 0.02 and shimmer < 0.1:
        score += 5

    return min(100, max(0, score))


def calculate_fluency_score(
    speech_rate: float,
    pause_ratio: float,
    articulation_rate: float
) -> float:
    """
    Calculate fluency score based on timing features

    Fluent speech characteristics:
    - Good speech rate (150-200 syllables/min)
    - Low pause ratio (< 30%)
    - Consistent articulation rate
    """
    score = 50  # Start at middle

    # Speech rate score (0-35 points)
    # Optimal: 150-200 syllables per minute
    if 150 <= speech_rate <= 200:
        score += 35
    elif 120 <= speech_rate <= 220:
        score += 25
    elif 100 <= speech_rate <= 250:
        score += 15
    elif speech_rate > 0:
        score += 5

    # Pause ratio score (0-35 points)
    # Lower pause ratio = more fluent
    if pause_ratio < 20:
        score += 35
    elif pause_ratio < 30:
        score += 25
    elif pause_ratio < 40:
        score += 15
    elif pause_ratio < 50:
        score += 5

    # Articulation rate bonus (0-30 points)
    # Good articulation: 180-250 syllables/min when speaking
    if 180 <= articulation_rate <= 250:
        score += 30
    elif 150 <= articulation_rate <= 280:
        score += 20
    elif articulation_rate > 100:
        score += 10

    return min(100, max(0, score))


@app.post("/analyze")
async def analyze_audio(file: UploadFile = File(...)) -> Dict[str, Any]:
    """
    Endpoint to analyze uploaded audio file

    Accepts: audio/wav, audio/webm, audio/ogg
    Returns: Analysis metrics including fluency and confidence scores
    """
    # Validate file type
    if not file.content_type or not file.content_type.startswith('audio/'):
        raise HTTPException(status_code=400, detail="File must be an audio file")

    # Save uploaded file to temporary location
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix='.wav') as tmp_file:
            content = await file.read()
            tmp_file.write(content)
            tmp_path = tmp_file.name

        # Analyze the file
        results = analyze_audio_file(tmp_path)

        # Clean up
        os.unlink(tmp_path)

        return {
            "success": True,
            "filename": file.filename,
            "results": results
        }

    except Exception as e:
        # Clean up on error
        if 'tmp_path' in locals():
            try:
                os.unlink(tmp_path)
            except:
                pass

        raise HTTPException(status_code=500, detail=str(e))


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "speech-analysis"}


if __name__ == "__main__":
    print("Starting Speech Analysis Service on http://localhost:8000")
    print("API Documentation available at http://localhost:8000/docs")
    uvicorn.run(app, host="0.0.0.0", port=8000)
