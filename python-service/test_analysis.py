"""
Test script for speech analysis service
Generates a synthetic audio file and tests the analysis
"""

import numpy as np
import wave
import struct
import requests
from pathlib import Path

def generate_test_audio(filename='test_audio.wav', duration=5.0, sample_rate=48000):
    """
    Generate a synthetic audio file for testing
    Creates a simple tone with some variation to simulate speech
    """
    num_samples = int(duration * sample_rate)

    # Generate audio with varying frequency (simulating pitch variation)
    t = np.linspace(0, duration, num_samples)

    # Base frequency around 150 Hz (typical male speech)
    base_freq = 150
    freq_variation = 30 * np.sin(2 * np.pi * 2 * t)  # Slow variation
    frequency = base_freq + freq_variation

    # Generate tone
    audio = np.sin(2 * np.pi * frequency * t)

    # Add some amplitude variation (simulating speech intensity changes)
    amplitude_envelope = 0.5 + 0.3 * np.sin(2 * np.pi * 0.5 * t)
    audio = audio * amplitude_envelope

    # Add some pauses (silence)
    pause_start = int(2.0 * sample_rate)
    pause_end = int(2.5 * sample_rate)
    audio[pause_start:pause_end] = 0

    # Convert to 16-bit PCM
    audio_int16 = (audio * 32767).astype(np.int16)

    # Write WAV file
    with wave.open(filename, 'w') as wav_file:
        wav_file.setnchannels(1)  # Mono
        wav_file.setsampwidth(2)  # 16-bit
        wav_file.setframerate(sample_rate)
        wav_file.writeframes(audio_int16.tobytes())

    print(f"✅ Generated test audio: {filename}")
    print(f"   Duration: {duration}s, Sample rate: {sample_rate}Hz")
    return filename

def test_analysis_service(audio_file='test_audio.wav', service_url='http://localhost:8000'):
    """
    Test the speech analysis service
    """
    print(f"\n🔬 Testing speech analysis service...")
    print(f"   Service URL: {service_url}")
    print(f"   Audio file: {audio_file}")

    # Check if file exists
    if not Path(audio_file).exists():
        print(f"❌ Error: Audio file not found: {audio_file}")
        return False

    # Test health endpoint
    try:
        print("\n1️⃣ Testing health endpoint...")
        response = requests.get(f"{service_url}/health", timeout=5)
        if response.status_code == 200:
            print(f"✅ Health check passed: {response.json()}")
        else:
            print(f"❌ Health check failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Cannot connect to service: {e}")
        print("   Make sure the Python service is running:")
        print("   cd python-service && python analyze.py")
        return False

    # Test analysis endpoint
    try:
        print("\n2️⃣ Testing analysis endpoint...")
        with open(audio_file, 'rb') as f:
            files = {'file': (audio_file, f, 'audio/wav')}
            response = requests.post(f"{service_url}/analyze", files=files, timeout=30)

        if response.status_code == 200:
            data = response.json()
            print("✅ Analysis successful!\n")

            # Print results
            results = data['results']

            print("📊 Analysis Results:")
            print(f"   Duration: {results['duration']}s")
            print(f"\n   🎯 Scores:")
            print(f"      Confidence:  {results['scores']['confidence']}/100")
            print(f"      Fluency:     {results['scores']['fluency']}/100")
            print(f"      Overall:     {results['scores']['overall']}/100")

            print(f"\n   🎵 Pitch:")
            print(f"      Mean:  {results['pitch']['mean']} Hz")
            print(f"      Std:   {results['pitch']['std']} Hz")
            print(f"      CV:    {results['pitch']['coefficient_of_variation']}%")

            print(f"\n   🔊 Intensity:")
            print(f"      Mean:  {results['intensity']['mean']} dB")
            print(f"      Max:   {results['intensity']['max']} dB")

            print(f"\n   ⏱️ Timing:")
            print(f"      Speech Rate:       {results['timing']['speech_rate']} syl/min")
            print(f"      Articulation Rate: {results['timing']['articulation_rate']} syl/min")
            print(f"      Pause Ratio:       {results['timing']['pause_ratio']}%")

            print(f"\n   🎙️ Voice Quality:")
            print(f"      HNR:     {results['voice_quality']['harmonics_to_noise_ratio']} dB")
            print(f"      Jitter:  {results['voice_quality']['jitter']}")
            print(f"      Shimmer: {results['voice_quality']['shimmer']}")

            return True
        else:
            print(f"❌ Analysis failed: {response.status_code}")
            print(f"   Response: {response.text}")
            return False

    except Exception as e:
        print(f"❌ Error during analysis: {e}")
        return False

def main():
    """
    Main test function
    """
    print("=" * 60)
    print("Speech Analysis Service - Test Script")
    print("=" * 60)

    # Generate test audio
    audio_file = generate_test_audio()

    # Test the service
    success = test_analysis_service(audio_file)

    # Cleanup
    print(f"\n🧹 Cleaning up test file...")
    try:
        Path(audio_file).unlink()
        print(f"✅ Deleted {audio_file}")
    except:
        pass

    # Summary
    print("\n" + "=" * 60)
    if success:
        print("✅ All tests passed!")
        print("\nYou can now use the speech analysis feature in your app:")
        print("   <VoiceChat character={char} enableAnalysis={true} />")
    else:
        print("❌ Tests failed. Please check the error messages above.")
    print("=" * 60)

if __name__ == '__main__':
    main()
