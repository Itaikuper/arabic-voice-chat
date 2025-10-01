"""
Simple test script for speech analysis service (no emojis for Windows compatibility)
"""

import numpy as np
import wave
import requests
from pathlib import Path

def generate_test_audio(filename='test_audio.wav', duration=5.0, sample_rate=48000):
    """Generate synthetic audio for testing"""
    num_samples = int(duration * sample_rate)
    t = np.linspace(0, duration, num_samples)

    # Base frequency around 150 Hz (typical male speech)
    base_freq = 150
    freq_variation = 30 * np.sin(2 * np.pi * 2 * t)
    frequency = base_freq + freq_variation

    # Generate tone with amplitude variation
    audio = np.sin(2 * np.pi * frequency * t)
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
        wav_file.setnchannels(1)
        wav_file.setsampwidth(2)
        wav_file.setframerate(sample_rate)
        wav_file.writeframes(audio_int16.tobytes())

    print(f"[OK] Generated test audio: {filename}")
    print(f"     Duration: {duration}s, Sample rate: {sample_rate}Hz")
    return filename

def test_analysis_service(audio_file='test_audio.wav', service_url='http://localhost:8000'):
    """Test the speech analysis service"""
    print(f"\n[TEST] Testing speech analysis service...")
    print(f"       Service URL: {service_url}")
    print(f"       Audio file: {audio_file}")

    if not Path(audio_file).exists():
        print(f"[ERROR] Audio file not found: {audio_file}")
        return False

    # Test health endpoint
    try:
        print("\n[1] Testing health endpoint...")
        response = requests.get(f"{service_url}/health", timeout=5)
        if response.status_code == 200:
            print(f"[OK] Health check passed: {response.json()}")
        else:
            print(f"[ERROR] Health check failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"[ERROR] Cannot connect to service: {e}")
        print("        Make sure the Python service is running:")
        print("        cd python-service && python analyze.py")
        return False

    # Test analysis endpoint
    try:
        print("\n[2] Testing analysis endpoint...")
        with open(audio_file, 'rb') as f:
            files = {'file': (audio_file, f, 'audio/wav')}
            response = requests.post(f"{service_url}/analyze", files=files, timeout=30)

        if response.status_code == 200:
            data = response.json()
            print("[OK] Analysis successful!\n")

            results = data['results']

            print("=" * 60)
            print("ANALYSIS RESULTS:")
            print("=" * 60)
            print(f"Duration: {results['duration']}s")

            print(f"\nSCORES:")
            print(f"  Confidence:  {results['scores']['confidence']}/100")
            print(f"  Fluency:     {results['scores']['fluency']}/100")
            print(f"  Overall:     {results['scores']['overall']}/100")

            print(f"\nPITCH:")
            print(f"  Mean:  {results['pitch']['mean']} Hz")
            print(f"  Std:   {results['pitch']['std']} Hz")
            print(f"  CV:    {results['pitch']['coefficient_of_variation']}%")

            print(f"\nINTENSITY:")
            print(f"  Mean:  {results['intensity']['mean']} dB")
            print(f"  Max:   {results['intensity']['max']} dB")

            print(f"\nTIMING:")
            print(f"  Speech Rate:       {results['timing']['speech_rate']} syl/min")
            print(f"  Articulation Rate: {results['timing']['articulation_rate']} syl/min")
            print(f"  Pause Ratio:       {results['timing']['pause_ratio']}%")

            print(f"\nVOICE QUALITY:")
            print(f"  HNR:     {results['voice_quality']['harmonics_to_noise_ratio']} dB")
            print(f"  Jitter:  {results['voice_quality']['jitter']}")
            print(f"  Shimmer: {results['voice_quality']['shimmer']}")
            print("=" * 60)

            return True
        else:
            print(f"[ERROR] Analysis failed: {response.status_code}")
            print(f"        Response: {response.text}")
            return False

    except Exception as e:
        print(f"[ERROR] Error during analysis: {e}")
        return False

def main():
    print("=" * 60)
    print("Speech Analysis Service - Test Script")
    print("=" * 60)

    # Generate test audio
    audio_file = generate_test_audio()

    # Test the service
    success = test_analysis_service(audio_file)

    # Cleanup
    print(f"\n[CLEANUP] Removing test file...")
    try:
        Path(audio_file).unlink()
        print(f"[OK] Deleted {audio_file}")
    except:
        pass

    # Summary
    print("\n" + "=" * 60)
    if success:
        print("[SUCCESS] All tests passed!")
        print("\nYou can now use the speech analysis feature in your app:")
        print("  <VoiceChat character={char} enableAnalysis={true} />")
    else:
        print("[FAILED] Tests failed. Please check the error messages above.")
    print("=" * 60)

if __name__ == '__main__':
    main()
