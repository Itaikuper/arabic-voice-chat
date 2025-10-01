/**
 * Speech Analysis Types and Utilities
 * Interfaces for communicating with Python speech analysis service
 */

export interface PitchMetrics {
  mean: number;
  std: number;
  min: number;
  max: number;
  coefficient_of_variation: number;
}

export interface IntensityMetrics {
  mean: number;
  std: number;
  max: number;
}

export interface VoiceQualityMetrics {
  harmonics_to_noise_ratio: number;
  jitter: number;
  shimmer: number;
}

export interface TimingMetrics {
  speaking_time: number;
  silence_time: number;
  pause_ratio: number;
  speech_rate: number;
  articulation_rate: number;
}

export interface SpeechScores {
  confidence: number;
  fluency: number;
  overall: number;
}

export interface SpeechAnalysisResult {
  duration: number;
  pitch: PitchMetrics;
  intensity: IntensityMetrics;
  voice_quality: VoiceQualityMetrics;
  timing: TimingMetrics;
  scores: SpeechScores;
}

export interface AnalysisResponse {
  success: boolean;
  filename: string;
  results: SpeechAnalysisResult;
}

export interface FillerWords {
  count: number;
  words: Array<{
    word: string;
    timestamp: number;
  }>;
}

/**
 * Analyze audio blob using the Python service
 */
export async function analyzeSpeech(
  audioBlob: Blob,
  filename: string = 'audio.wav'
): Promise<SpeechAnalysisResult> {
  try {
    const formData = new FormData();
    formData.append('file', audioBlob, filename);

    const response = await fetch('/api/analyze', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Analysis failed');
    }

    const data: AnalysisResponse = await response.json();
    return data.results;
  } catch (error) {
    console.error('Speech analysis error:', error);
    throw error;
  }
}

/**
 * Detect Arabic filler words in transcript
 * Common Arabic fillers: يعني (ya'ni), وﷲ (wallah), اه (eh), يعني كذا (like this)
 */
export function detectArabicFillers(transcript: string): FillerWords {
  const arabicFillers = [
    'يعني',
    'يعني كذا',
    'وﷲ',
    'والله',
    'اه',
    'ااه',
    'اممم',
    'يا',
    'شو',
    'مثلا',
    'بس',
  ];

  const words: Array<{ word: string; timestamp: number }> = [];
  let count = 0;

  // Simple detection - can be enhanced with NLP
  arabicFillers.forEach((filler) => {
    const regex = new RegExp(filler, 'g');
    const matches = transcript.matchAll(regex);

    for (const match of matches) {
      count++;
      words.push({
        word: filler,
        timestamp: 0, // Would need audio alignment for precise timing
      });
    }
  });

  return { count, words };
}

/**
 * Calculate hesitation ratio from transcript
 */
export function calculateHesitationRatio(
  transcript: string,
  duration: number
): number {
  const fillers = detectArabicFillers(transcript);
  const words = transcript.split(/\s+/).length;

  if (words === 0) return 0;

  // Percentage of filler words
  return (fillers.count / words) * 100;
}

/**
 * Get confidence level description
 */
export function getConfidenceLevel(score: number): string {
  if (score >= 80) return 'Very Confident';
  if (score >= 60) return 'Confident';
  if (score >= 40) return 'Moderate';
  if (score >= 20) return 'Low Confidence';
  return 'Very Low Confidence';
}

/**
 * Get fluency level description
 */
export function getFluencyLevel(score: number): string {
  if (score >= 80) return 'Very Fluent';
  if (score >= 60) return 'Fluent';
  if (score >= 40) return 'Moderate Fluency';
  if (score >= 20) return 'Low Fluency';
  return 'Developing Fluency';
}

/**
 * Get overall proficiency level
 */
export function getProficiencyLevel(
  confidenceScore: number,
  fluencyScore: number,
  hesitationRatio: number
): string {
  const overall = (confidenceScore + fluencyScore) / 2;

  // Adjust for hesitation
  const adjustedScore = overall - hesitationRatio;

  if (adjustedScore >= 80) return 'Advanced';
  if (adjustedScore >= 60) return 'Intermediate-High';
  if (adjustedScore >= 40) return 'Intermediate';
  if (adjustedScore >= 20) return 'Novice-High';
  return 'Novice';
}

/**
 * Generate feedback based on analysis results
 */
export function generateFeedback(
  results: SpeechAnalysisResult,
  transcript?: string
): string[] {
  const feedback: string[] = [];

  // Confidence feedback
  if (results.scores.confidence < 50) {
    if (results.intensity.mean < 55) {
      feedback.push('Try speaking with more volume and projection');
    }
    if (results.pitch.coefficient_of_variation > 25) {
      feedback.push('Work on maintaining a steadier pitch');
    }
    if (results.voice_quality.harmonics_to_noise_ratio < 10) {
      feedback.push('Focus on clear vocal production');
    }
  } else if (results.scores.confidence >= 80) {
    feedback.push('Excellent confidence! Your voice is strong and steady');
  }

  // Fluency feedback
  if (results.scores.fluency < 50) {
    if (results.timing.pause_ratio > 40) {
      feedback.push('Try to reduce pauses between words');
    }
    if (results.timing.speech_rate < 120) {
      feedback.push('Try to speak at a slightly faster pace');
    } else if (results.timing.speech_rate > 220) {
      feedback.push('Try to slow down a bit for better clarity');
    }
  } else if (results.scores.fluency >= 80) {
    feedback.push('Great fluency! Your speech flow is natural');
  }

  // Filler words feedback
  if (transcript) {
    const fillers = detectArabicFillers(transcript);
    const hesitationRatio = calculateHesitationRatio(transcript, results.duration);

    if (hesitationRatio > 10) {
      feedback.push(
        `Reduce filler words (found ${fillers.count} fillers: ${fillers.words
          .slice(0, 3)
          .map((w) => w.word)
          .join(', ')}...)`
      );
    }
  }

  // Overall encouragement
  if (results.scores.overall >= 70) {
    feedback.push('Keep up the great work! 🌟');
  } else if (results.scores.overall >= 50) {
    feedback.push('Good progress! Keep practicing! 💪');
  } else {
    feedback.push('Keep practicing - you\'ll improve with time! 📚');
  }

  return feedback;
}
