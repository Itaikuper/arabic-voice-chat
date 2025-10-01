'use client';

import { useEffect, useState } from 'react';
import {
  SpeechAnalysisResult,
  getConfidenceLevel,
  getFluencyLevel,
  generateFeedback,
} from '@/lib/audio/speechAnalysis';

interface FluencyMeterProps {
  result: SpeechAnalysisResult | null;
  transcript?: string;
  className?: string;
}

export default function FluencyMeter({ result, transcript, className = '' }: FluencyMeterProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (result) {
      setIsVisible(true);
    }
  }, [result]);

  if (!result) {
    return null;
  }

  const confidenceLevel = getConfidenceLevel(result.scores.confidence);
  const fluencyLevel = getFluencyLevel(result.scores.fluency);
  const feedback = generateFeedback(result, transcript);

  return (
    <div
      className={`bg-gradient-to-br from-gray-900 to-gray-800 rounded-lg border border-gray-700 p-4 shadow-lg ${className} ${
        isVisible ? 'animate-fade-in' : ''
      }`}
    >
      <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
        <span className="text-2xl">🎯</span>
        Speech Analysis
      </h3>

      {/* Overall Score */}
      <div className="mb-4">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm text-gray-400">Overall Score</span>
          <span className="text-2xl font-bold text-white">{result.scores.overall}</span>
        </div>
        <div className="w-full bg-gray-700 rounded-full h-3 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${getScoreColor(
              result.scores.overall
            )}`}
            style={{ width: `${result.scores.overall}%` }}
          />
        </div>
      </div>

      {/* Confidence & Fluency Scores */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        {/* Confidence */}
        <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg">💪</span>
            <span className="text-xs text-gray-400">Confidence</span>
          </div>
          <div className="text-xl font-bold text-white mb-1">{result.scores.confidence}</div>
          <div className="text-xs text-gray-400">{confidenceLevel}</div>
          <div className="w-full bg-gray-700 rounded-full h-2 mt-2 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${getScoreColor(
                result.scores.confidence
              )}`}
              style={{ width: `${result.scores.confidence}%` }}
            />
          </div>
        </div>

        {/* Fluency */}
        <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg">🗣️</span>
            <span className="text-xs text-gray-400">Fluency</span>
          </div>
          <div className="text-xl font-bold text-white mb-1">{result.scores.fluency}</div>
          <div className="text-xs text-gray-400">{fluencyLevel}</div>
          <div className="w-full bg-gray-700 rounded-full h-2 mt-2 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${getScoreColor(
                result.scores.fluency
              )}`}
              style={{ width: `${result.scores.fluency}%` }}
            />
          </div>
        </div>
      </div>

      {/* Detailed Metrics */}
      <details className="mb-4">
        <summary className="text-sm text-gray-400 cursor-pointer hover:text-gray-300 transition-colors">
          Detailed Metrics
        </summary>
        <div className="mt-3 space-y-2 text-xs">
          <MetricRow label="Speech Rate" value={`${result.timing.speech_rate} syl/min`} />
          <MetricRow
            label="Articulation Rate"
            value={`${result.timing.articulation_rate} syl/min`}
          />
          <MetricRow label="Pause Ratio" value={`${result.timing.pause_ratio}%`} />
          <MetricRow label="Mean Pitch" value={`${result.pitch.mean} Hz`} />
          <MetricRow label="Mean Intensity" value={`${result.intensity.mean} dB`} />
          <MetricRow label="Voice Quality (HNR)" value={`${result.voice_quality.harmonics_to_noise_ratio} dB`} />
        </div>
      </details>

      {/* Feedback */}
      {feedback.length > 0 && (
        <div className="border-t border-gray-700 pt-3">
          <h4 className="text-sm font-semibold text-gray-300 mb-2">Feedback</h4>
          <ul className="space-y-1">
            {feedback.map((item, index) => (
              <li key={index} className="text-xs text-gray-400 flex items-start gap-2">
                <span className="text-blue-400 mt-0.5">•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center text-gray-400">
      <span>{label}:</span>
      <span className="text-gray-300 font-medium">{value}</span>
    </div>
  );
}

function getScoreColor(score: number): string {
  if (score >= 80) return 'bg-gradient-to-r from-green-500 to-emerald-400';
  if (score >= 60) return 'bg-gradient-to-r from-blue-500 to-cyan-400';
  if (score >= 40) return 'bg-gradient-to-r from-yellow-500 to-amber-400';
  if (score >= 20) return 'bg-gradient-to-r from-orange-500 to-orange-400';
  return 'bg-gradient-to-r from-red-500 to-red-400';
}
