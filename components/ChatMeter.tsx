'use client';

import { useEffect, useState } from 'react';

interface ChatMeterProps {
  inputSeconds: number;
  outputSeconds: number;
  className?: string;
}

// Gemini 2.5 Flash Native Audio pricing
const PRICING = {
  INPUT_PER_MILLION_TOKENS: 2.10,
  OUTPUT_PER_MILLION_TOKENS: 8.50,
  TOKENS_PER_SECOND: 25,
};

export default function ChatMeter({ inputSeconds, outputSeconds, className = '' }: ChatMeterProps) {
  const [inputCost, setInputCost] = useState(0);
  const [outputCost, setOutputCost] = useState(0);
  const [totalCost, setTotalCost] = useState(0);

  useEffect(() => {
    // Calculate tokens
    const inputTokens = inputSeconds * PRICING.TOKENS_PER_SECOND;
    const outputTokens = outputSeconds * PRICING.TOKENS_PER_SECOND;

    // Calculate costs
    const inputCostUSD = (inputTokens / 1_000_000) * PRICING.INPUT_PER_MILLION_TOKENS;
    const outputCostUSD = (outputTokens / 1_000_000) * PRICING.OUTPUT_PER_MILLION_TOKENS;

    setInputCost(inputCostUSD);
    setOutputCost(outputCostUSD);
    setTotalCost(inputCostUSD + outputCostUSD);
  }, [inputSeconds, outputSeconds]);

  const formatCost = (cost: number) => {
    if (cost < 0.01) return `$${cost.toFixed(4)}`;
    return `$${cost.toFixed(3)}`;
  };

  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${seconds.toFixed(1)}s`;
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}m ${secs}s`;
  };

  return (
    <div className={`bg-gray-800 rounded-lg p-4 border border-gray-700 ${className}`}>
      <h3 className="text-sm font-semibold text-gray-300 mb-3">Conversation Cost</h3>

      <div className="space-y-2 text-sm">
        <div className="flex justify-between items-center">
          <span className="text-gray-400">Input Audio:</span>
          <div className="text-right">
            <span className="text-gray-300">{formatTime(inputSeconds)}</span>
            <span className="text-green-400 ml-2 font-mono">{formatCost(inputCost)}</span>
          </div>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-gray-400">Output Audio:</span>
          <div className="text-right">
            <span className="text-gray-300">{formatTime(outputSeconds)}</span>
            <span className="text-blue-400 ml-2 font-mono">{formatCost(outputCost)}</span>
          </div>
        </div>

        <div className="border-t border-gray-700 pt-2 mt-2">
          <div className="flex justify-between items-center">
            <span className="text-gray-200 font-semibold">Total Cost:</span>
            <span className="text-yellow-400 font-mono font-bold">{formatCost(totalCost)}</span>
          </div>
        </div>

        <div className="text-xs text-gray-500 mt-3 pt-2 border-t border-gray-700">
          <div>Rate: {PRICING.TOKENS_PER_SECOND} tokens/sec</div>
          <div>Input: ${PRICING.INPUT_PER_MILLION_TOKENS}/M tokens</div>
          <div>Output: ${PRICING.OUTPUT_PER_MILLION_TOKENS}/M tokens</div>
        </div>
      </div>
    </div>
  );
}
