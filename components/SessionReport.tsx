'use client';

import { SpeechAnalysisResult } from '@/lib/audio/speechAnalysis';

interface SessionReportProps {
  sessionData: {
    duration: number; // Total session duration in seconds
    analysisResults: SpeechAnalysisResult[];
    transcript: string;
    characterName: string;
    startTime: Date;
    endTime: Date;
  };
  onClose: () => void;
}

export default function SessionReport({ sessionData, onClose }: SessionReportProps) {
  // Calculate average scores across all analysis results
  const calculateAverages = () => {
    if (sessionData.analysisResults.length === 0) {
      return {
        avgConfidence: 0,
        avgFluency: 0,
        avgOverall: 0,
        avgSpeechRate: 0,
        avgPauseRatio: 0,
        avgPitch: 0,
        avgIntensity: 0,
      };
    }

    const sum = sessionData.analysisResults.reduce(
      (acc, result) => ({
        confidence: acc.confidence + result.scores.confidence,
        fluency: acc.fluency + result.scores.fluency,
        overall: acc.overall + result.scores.overall,
        speechRate: acc.speechRate + result.timing.speech_rate,
        pauseRatio: acc.pauseRatio + result.timing.pause_ratio,
        pitch: acc.pitch + result.pitch.mean,
        intensity: acc.intensity + result.intensity.mean,
      }),
      {
        confidence: 0,
        fluency: 0,
        overall: 0,
        speechRate: 0,
        pauseRatio: 0,
        pitch: 0,
        intensity: 0,
      }
    );

    const count = sessionData.analysisResults.length;

    return {
      avgConfidence: Math.round(sum.confidence / count),
      avgFluency: Math.round(sum.fluency / count),
      avgOverall: Math.round(sum.overall / count),
      avgSpeechRate: Math.round(sum.speechRate / count),
      avgPauseRatio: Math.round(sum.pauseRatio / count),
      avgPitch: Math.round(sum.pitch / count),
      avgIntensity: Math.round(sum.intensity / count),
    };
  };

  const averages = calculateAverages();
  const durationMinutes = Math.floor(sessionData.duration / 60);
  const durationSeconds = Math.floor(sessionData.duration % 60);

  // Generate teacher-style feedback
  const generateTeacherFeedback = () => {
    const feedback: string[] = [];

    // Overall performance
    if (averages.avgOverall >= 80) {
      feedback.push('Excellent performance! You demonstrated strong Arabic speaking skills.');
    } else if (averages.avgOverall >= 60) {
      feedback.push('Good progress! You are developing solid Arabic conversation abilities.');
    } else if (averages.avgOverall >= 40) {
      feedback.push('Keep practicing! You are making steady improvement in your Arabic skills.');
    } else {
      feedback.push('Continue your efforts! Regular practice will help you improve significantly.');
    }

    // Confidence feedback
    if (averages.avgConfidence >= 75) {
      feedback.push('Your confidence shines through with clear, steady voice projection.');
    } else if (averages.avgConfidence >= 50) {
      feedback.push('Work on projecting your voice more confidently when speaking.');
    } else {
      feedback.push('Focus on speaking louder and with more conviction to build confidence.');
    }

    // Fluency feedback
    if (averages.avgFluency >= 75) {
      feedback.push('Your speech flows naturally with good rhythm and minimal hesitation.');
    } else if (averages.avgFluency >= 50) {
      feedback.push('Try to reduce pauses and maintain a more consistent speaking pace.');
    } else {
      feedback.push('Practice speaking in longer phrases without frequent stops.');
    }

    // Speech rate feedback
    if (averages.avgSpeechRate >= 150 && averages.avgSpeechRate <= 200) {
      feedback.push('Your speaking pace is excellent - neither too fast nor too slow.');
    } else if (averages.avgSpeechRate < 150) {
      feedback.push('Try to speak a bit faster to sound more natural and conversational.');
    } else {
      feedback.push('Slow down slightly to improve clarity and comprehension.');
    }

    // Pause ratio feedback
    if (averages.avgPauseRatio < 20) {
      feedback.push('Great job maintaining continuous speech with minimal pauses!');
    } else if (averages.avgPauseRatio < 30) {
      feedback.push('Good speech continuity. Try to reduce thinking pauses further.');
    } else {
      feedback.push('Focus on planning ahead to reduce long pauses between words.');
    }

    return feedback;
  };

  const feedback = generateTeacherFeedback();

  // Grade calculation
  const getGrade = (score: number): string => {
    if (score >= 90) return 'A+';
    if (score >= 85) return 'A';
    if (score >= 80) return 'A-';
    if (score >= 75) return 'B+';
    if (score >= 70) return 'B';
    if (score >= 65) return 'B-';
    if (score >= 60) return 'C+';
    if (score >= 55) return 'C';
    if (score >= 50) return 'C-';
    if (score >= 45) return 'D+';
    if (score >= 40) return 'D';
    return 'F';
  };

  const overallGrade = getGrade(averages.avgOverall);

  // Performance level
  const getPerformanceLevel = (score: number): string => {
    if (score >= 80) return 'Advanced';
    if (score >= 60) return 'Intermediate-High';
    if (score >= 40) return 'Intermediate';
    if (score >= 20) return 'Novice-High';
    return 'Novice';
  };

  const performanceLevel = getPerformanceLevel(averages.avgOverall);

  // Format date
  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-8 rounded-t-2xl">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold mb-2">Arabic Conversation Report</h1>
              <p className="text-blue-100">Session with {sessionData.characterName}</p>
              <p className="text-sm text-blue-200 mt-1">{formatDate(sessionData.startTime)}</p>
            </div>
            <div className="text-center">
              <div className="text-6xl font-bold">{overallGrade}</div>
              <div className="text-sm text-blue-200 mt-1">Overall Grade</div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="p-8">
          {/* Session Summary */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Session Summary</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-blue-50 p-4 rounded-lg">
                <div className="text-sm text-gray-600">Duration</div>
                <div className="text-2xl font-bold text-blue-600">
                  {durationMinutes}:{durationSeconds.toString().padStart(2, '0')}
                </div>
              </div>
              <div className="bg-purple-50 p-4 rounded-lg">
                <div className="text-sm text-gray-600">Performance Level</div>
                <div className="text-lg font-bold text-purple-600">{performanceLevel}</div>
              </div>
              <div className="bg-green-50 p-4 rounded-lg">
                <div className="text-sm text-gray-600">Analyses</div>
                <div className="text-2xl font-bold text-green-600">
                  {sessionData.analysisResults.length}
                </div>
              </div>
              <div className="bg-orange-50 p-4 rounded-lg">
                <div className="text-sm text-gray-600">Overall Score</div>
                <div className="text-2xl font-bold text-orange-600">{averages.avgOverall}/100</div>
              </div>
            </div>
          </div>

          {/* Performance Scores */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Performance Evaluation</h2>
            <div className="space-y-4">
              {/* Confidence */}
              <div>
                <div className="flex justify-between mb-2">
                  <span className="font-semibold text-gray-700">Self-Confidence & Voice Quality</span>
                  <span className="font-bold text-blue-600">
                    {averages.avgConfidence}/100 ({getGrade(averages.avgConfidence)})
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-4">
                  <div
                    className="bg-gradient-to-r from-blue-500 to-blue-600 h-4 rounded-full transition-all duration-500"
                    style={{ width: `${averages.avgConfidence}%` }}
                  />
                </div>
                <p className="text-sm text-gray-600 mt-1">
                  Voice projection, pitch stability, and clarity
                </p>
              </div>

              {/* Fluency */}
              <div>
                <div className="flex justify-between mb-2">
                  <span className="font-semibold text-gray-700">Fluency & Speech Flow</span>
                  <span className="font-bold text-purple-600">
                    {averages.avgFluency}/100 ({getGrade(averages.avgFluency)})
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-4">
                  <div
                    className="bg-gradient-to-r from-purple-500 to-purple-600 h-4 rounded-full transition-all duration-500"
                    style={{ width: `${averages.avgFluency}%` }}
                  />
                </div>
                <p className="text-sm text-gray-600 mt-1">
                  Speaking pace, pauses, and natural rhythm
                </p>
              </div>
            </div>
          </div>

          {/* Detailed Metrics */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Technical Analysis</h2>
            <div className="bg-gray-50 rounded-lg p-6">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <h3 className="font-semibold text-gray-700 mb-3">Speech Characteristics</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Average Speech Rate:</span>
                      <span className="font-medium">{averages.avgSpeechRate} syl/min</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Pause Ratio:</span>
                      <span className="font-medium">{averages.avgPauseRatio}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Average Pitch:</span>
                      <span className="font-medium">{averages.avgPitch} Hz</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Voice Intensity:</span>
                      <span className="font-medium">{averages.avgIntensity} dB</span>
                    </div>
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-700 mb-3">Progress Indicators</h3>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="text-gray-600">Optimal Speech Rate:</span>
                      <span
                        className={`ml-2 font-medium ${
                          averages.avgSpeechRate >= 150 && averages.avgSpeechRate <= 200
                            ? 'text-green-600'
                            : 'text-orange-600'
                        }`}
                      >
                        {averages.avgSpeechRate >= 150 && averages.avgSpeechRate <= 200
                          ? '✓ Excellent'
                          : '○ Needs Work'}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600">Pause Management:</span>
                      <span
                        className={`ml-2 font-medium ${
                          averages.avgPauseRatio < 30 ? 'text-green-600' : 'text-orange-600'
                        }`}
                      >
                        {averages.avgPauseRatio < 30 ? '✓ Good' : '○ Needs Work'}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600">Voice Confidence:</span>
                      <span
                        className={`ml-2 font-medium ${
                          averages.avgConfidence >= 70 ? 'text-green-600' : 'text-orange-600'
                        }`}
                      >
                        {averages.avgConfidence >= 70 ? '✓ Strong' : '○ Developing'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Teacher Feedback */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Instructor Feedback</h2>
            <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-lg p-6 border-l-4 border-blue-600">
              <div className="space-y-3">
                {feedback.map((item, index) => (
                  <div key={index} className="flex items-start">
                    <span className="text-blue-600 mr-3 mt-1">•</span>
                    <p className="text-gray-700">{item}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Recommendations */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Next Steps for Improvement</h2>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h3 className="font-semibold text-green-800 mb-2">✓ Strengths to Maintain</h3>
                <ul className="space-y-1 text-sm text-green-700">
                  {averages.avgConfidence >= 70 && <li>• Strong, confident voice projection</li>}
                  {averages.avgFluency >= 70 && <li>• Natural, flowing speech patterns</li>}
                  {averages.avgSpeechRate >= 150 && averages.avgSpeechRate <= 200 && (
                    <li>• Optimal speaking pace</li>
                  )}
                  {averages.avgPauseRatio < 25 && <li>• Excellent pause management</li>}
                  {averages.avgConfidence < 70 &&
                    averages.avgFluency < 70 &&
                    (averages.avgSpeechRate < 150 || averages.avgSpeechRate > 200) && (
                      <li>• Consistent practice and dedication</li>
                    )}
                </ul>
              </div>
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                <h3 className="font-semibold text-orange-800 mb-2">⚠ Areas for Development</h3>
                <ul className="space-y-1 text-sm text-orange-700">
                  {averages.avgConfidence < 70 && <li>• Build vocal confidence and projection</li>}
                  {averages.avgFluency < 70 && <li>• Improve speech flow and continuity</li>}
                  {averages.avgSpeechRate < 150 && <li>• Increase speaking pace</li>}
                  {averages.avgSpeechRate > 200 && <li>• Slow down for better clarity</li>}
                  {averages.avgPauseRatio >= 30 && <li>• Reduce hesitation and pauses</li>}
                  {averages.avgConfidence >= 70 &&
                    averages.avgFluency >= 70 &&
                    averages.avgSpeechRate >= 150 &&
                    averages.avgSpeechRate <= 200 && (
                      <li>• Continue challenging yourself with complex topics</li>
                    )}
                </ul>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4 justify-end">
            <button
              onClick={() => window.print()}
              className="px-6 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium rounded-lg transition-colors"
            >
              Print Report
            </button>
            <button
              onClick={onClose}
              className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-medium rounded-lg transition-colors"
            >
              Close Report
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
