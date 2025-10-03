/**
 * PhaseMeter Component
 * Displays current interrogation phase info for debugging in the sidebar
 */

import { PhaseInfo } from '@/hooks/useGeminiLive';

interface PhaseMeterProps {
  phaseInfo: PhaseInfo;
}

const phaseColors = {
  0: 'from-blue-500 to-blue-600',
  1: 'from-red-500 to-red-600',
  2: 'from-yellow-500 to-yellow-600',
  3: 'from-green-500 to-green-600',
};

const phaseNames = {
  0: 'Personal Questions',
  1: 'Denial Phase',
  2: 'Probing Phase',
  3: 'Confession Phase',
};

export function PhaseMeter({ phaseInfo }: PhaseMeterProps) {
  const phaseColor = phaseColors[phaseInfo.currentPhase as keyof typeof phaseColors] || 'from-gray-500 to-gray-600';
  const phaseName = phaseNames[phaseInfo.currentPhase as keyof typeof phaseNames] || 'Unknown';

  return (
    <div className="bg-black/50 backdrop-blur-md rounded-lg p-4 border border-white/10">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-200">
          Interrogation Phase (Debug)
        </h3>
        <div className={`px-3 py-1 rounded-full bg-gradient-to-r ${phaseColor} text-white text-sm font-medium`}>
          Phase {phaseInfo.currentPhase}
        </div>
      </div>

      {/* Phase Name */}
      <div className="mb-4">
        <p className="text-lg font-medium text-white">{phaseName}</p>
      </div>

      {/* Metrics Grid */}
      <div className="space-y-2 text-sm">
        {/* Turn Count */}
        <div className="flex justify-between items-center">
          <span className="text-gray-400">Conversation Turns:</span>
          <span className="text-white font-medium">{phaseInfo.turnCount}</span>
        </div>

        {/* Estimated Time */}
        <div className="flex justify-between items-center">
          <span className="text-gray-400">Estimated Time:</span>
          <span className="text-white font-medium">~{phaseInfo.estimatedMinutes} min</span>
        </div>

        {/* Character Type */}
        <div className="flex justify-between items-center">
          <span className="text-gray-400">Character Type:</span>
          <span className="text-white font-medium capitalize">{phaseInfo.characterType}</span>
        </div>

        {/* Divider */}
        <div className="border-t border-white/10 my-3"></div>

        {/* Phase Eligibility */}
        <div className="space-y-1">
          <div className="flex justify-between items-center">
            <span className="text-gray-400">Phase 2 Eligible:</span>
            <span className={`font-medium ${phaseInfo.phase2Eligible ? 'text-green-400' : 'text-red-400'}`}>
              {phaseInfo.phase2Eligible ? '✓ Yes' : '✗ No'}
              {phaseInfo.phase2Eligible && phaseInfo.phase2Threshold && (
                <span className="text-xs text-gray-400 ml-1">({phaseInfo.phase2Threshold} min)</span>
              )}
            </span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-gray-400">Phase 3 Eligible:</span>
            <span className={`font-medium ${phaseInfo.phase3Eligible ? 'text-green-400' : 'text-red-400'}`}>
              {phaseInfo.phase3Eligible ? '✓ Yes' : '✗ No'}
              {phaseInfo.phase3Eligible && phaseInfo.phase3Threshold && (
                <span className="text-xs text-gray-400 ml-1">({phaseInfo.phase3Threshold} min)</span>
              )}
            </span>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-white/10 my-3"></div>

        {/* Next Phase Info */}
        <div>
          <p className="text-gray-400 text-xs mb-1">Next Phase:</p>
          <p className="text-white text-sm font-medium">{phaseInfo.nextPhaseInfo}</p>
        </div>
      </div>

      {/* Phase Legend (Collapsed) */}
      <details className="mt-4">
        <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-300 transition-colors">
          Phase Legend
        </summary>
        <div className="mt-2 space-y-1 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-gradient-to-r from-blue-500 to-blue-600"></div>
            <span className="text-gray-300">Phase 0: Personal Questions</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-gradient-to-r from-red-500 to-red-600"></div>
            <span className="text-gray-300">Phase 1: Denial (trigger: "أمنيات")</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-gradient-to-r from-yellow-500 to-yellow-600"></div>
            <span className="text-gray-300">Phase 2: Probing (if eligible)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-gradient-to-r from-green-500 to-green-600"></div>
            <span className="text-gray-300">Phase 3: Confession (if eligible)</span>
          </div>
        </div>
      </details>
    </div>
  );
}
