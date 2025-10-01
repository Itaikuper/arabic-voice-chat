/**
 * Voice Chat Component
 * Main UI for real-time voice conversation with Gemini
 */

'use client';

import { useState, useCallback, useEffect } from 'react';
import { useGeminiLive, UsageMetrics } from '@/hooks/useGeminiLive';
import { AudioPlayer } from './AudioPlayer';
import ChatMeter from './ChatMeter';
import FluencyMeter from './FluencyMeter';
import SessionReport from './SessionReport';
import { Character } from '@/lib/characters';
import { SpeechAnalysisResult } from '@/lib/audio/speechAnalysis';

interface VoiceChatProps {
  character: Character;
  onBack?: () => void;
  enableAnalysis?: boolean; // Enable speech analysis feature
}

export function VoiceChat({ character, onBack, enableAnalysis = false }: VoiceChatProps) {
  const [transcript, setTranscript] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [audioPlayer, setAudioPlayer] = useState<any>(null);
  const [usageMetrics, setUsageMetrics] = useState<UsageMetrics>({
    inputSeconds: 0,
    outputSeconds: 0,
  });
  const [analysisResult, setAnalysisResult] = useState<SpeechAnalysisResult | null>(null);
  const [fullTranscript, setFullTranscript] = useState<string>('');
  const [analysisHistory, setAnalysisHistory] = useState<SpeechAnalysisResult[]>([]);
  const [sessionStartTime, setSessionStartTime] = useState<Date | null>(null);
  const [showReport, setShowReport] = useState(false);
  const [generatedTranscript, setGeneratedTranscript] = useState<string>('');
  const [isGeneratingTranscript, setIsGeneratingTranscript] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Handle audio data from Gemini
  const handleAudioData = useCallback((audioData: string) => {
    // Queue audio for playback
    if ((window as any).__audioPlayer) {
      (window as any).__audioPlayer.enqueueAudio(audioData);
    }
  }, []);

  // Handle transcript updates
  const handleTranscript = useCallback((text: string) => {
    setTranscript((prev) => [...prev, `AI: ${text}`]);
    setFullTranscript((prev) => prev + ' ' + text);
  }, []);

  // Handle errors
  const handleError = useCallback((err: Error) => {
    setError(err.message);
    console.error('Error:', err);
  }, []);

  // Handle usage updates
  const handleUsageUpdate = useCallback((metrics: UsageMetrics) => {
    setUsageMetrics(metrics);
  }, []);

  // Handle analysis results
  const handleAnalysisResult = useCallback((result: SpeechAnalysisResult) => {
    console.log('📊 Speech analysis result:', result);
    setAnalysisResult(result);
    setAnalysisHistory((prev) => [...prev, result]);
  }, []);

  // Initialize Gemini Live
  const {
    status,
    isRecording,
    connect,
    disconnect,
    startRecording,
    stopRecording,
    conversationHistory,
    clearConversationHistory,
    generateTranscript,
    generateTranscriptAuto,
  } = useGeminiLive({
    character,
    onAudioData: handleAudioData,
    onTranscript: handleTranscript,
    onError: handleError,
    onUsageUpdate: handleUsageUpdate,
    onAnalysisResult: handleAnalysisResult,
    enableAnalysis,
    analysisIntervalSeconds: 10,
  });

  // Get audio player instance
  useEffect(() => {
    const checkAudioPlayer = setInterval(() => {
      if ((window as any).__audioPlayer) {
        setAudioPlayer((window as any).__audioPlayer);
        clearInterval(checkAudioPlayer);
      }
    }, 100);

    return () => clearInterval(checkAudioPlayer);
  }, []);

  // Handle start button click
  const handleStart = async () => {
    setError(null);
    if (!sessionStartTime) {
      setSessionStartTime(new Date());
    }
    if (status === 'disconnected') {
      await connect();
    }
    await startRecording();
  };

  // Handle stop button click
  const handleStop = () => {
    stopRecording();
  };

  // Handle end session - show report
  const handleEndSession = () => {
    stopRecording();
    disconnect();
    if (enableAnalysis && analysisHistory.length > 0) {
      setShowReport(true);
    }
  };

  // Close report and reset session
  const handleCloseReport = () => {
    setShowReport(false);
    setAnalysisHistory([]);
    setSessionStartTime(null);
    setFullTranscript('');
    setTranscript([]);
    clearConversationHistory();
    setGeneratedTranscript('');
  };

  // Generate transcript from conversation history
  const handleGenerateTranscript = async () => {
    setIsGeneratingTranscript(true);
    try {
      // Auto mode: prefer quick live history; fallback to high-fidelity re-transcription
      const transcript = await generateTranscriptAuto();
      if (transcript) {
        setGeneratedTranscript(transcript);
      } else {
        setError('Failed to generate transcript');
      }
    } catch (err) {
      setError('Error generating transcript: ' + String(err));
    } finally {
      setIsGeneratingTranscript(false);
    }
  };

  // Download transcript as text file
  const handleDownloadTranscript = () => {
    const blob = new Blob([generatedTranscript], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `conversation-transcript-${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Get status color
  const getStatusColor = () => {
    switch (status) {
      case 'connected':
        return 'bg-green-500';
      case 'connecting':
        return 'bg-yellow-500';
      case 'error':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  // Get status text
  const getStatusText = () => {
    switch (status) {
      case 'connected':
        return 'Connected';
      case 'connecting':
        return 'Connecting...';
      case 'error':
        return 'Error';
      default:
        return 'Disconnected';
    }
  };

  return (
    <div
      className="flex min-h-screen relative overflow-hidden"
      style={{
        backgroundImage: 'url(/background.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      {/* Dark overlay for better contrast */}
      <div className="absolute inset-0 bg-black/50" />

      {/* Large character image - full screen centered */}
      {character.image && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-full h-full max-w-6xl relative flex items-center justify-center">
            <img
              src={character.image}
              alt={character.name}
              className="max-w-full max-h-[90vh] object-contain drop-shadow-2xl"
              style={{
                filter: 'contrast(1.15) brightness(0.9)',
              }}
            />
          </div>
        </div>
      )}

      {/* Floating Control Button - Top Right */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="fixed top-8 right-8 z-50 w-14 h-14 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 shadow-2xl flex items-center justify-center transition-all duration-300 hover:scale-110"
        aria-label={sidebarOpen ? 'Close controls' : 'Open controls'}
      >
        <svg
          className="w-6 h-6 text-white transition-transform duration-300"
          style={{ transform: sidebarOpen ? 'rotate(45deg)' : 'rotate(0deg)' }}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 4v16m8-8H4"
          />
        </svg>
      </button>

      {/* Character Name Overlay - Top Center */}
      <div className="fixed top-8 left-1/2 transform -translate-x-1/2 z-40 bg-black/80 backdrop-blur-lg rounded-2xl px-8 py-4 border border-white/20 shadow-2xl">
        <h1 className="text-3xl font-bold text-white mb-1 drop-shadow-lg text-center">
          {character.name}
        </h1>
        <p className="text-lg text-gray-200 text-center" dir="rtl">
          {character.nameArabic}
        </p>
      </div>

      {/* Collapsible Sidebar - Right Side */}
      <div
        className={`fixed top-0 right-0 h-full w-full max-w-xl bg-black/90 backdrop-blur-xl border-l border-white/10 shadow-2xl z-40 transform transition-transform duration-500 ease-in-out overflow-y-auto ${
          sidebarOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="p-8">
          {/* Sidebar Header */}
          <div className="mb-8 pb-6 border-b border-white/10">
            <h2 className="text-2xl font-bold text-white mb-2">Interrogation Controls</h2>
            <p className="text-gray-300 text-sm">{character.description}</p>
          </div>
          {/* Status Indicator */}
          <div className="flex items-center justify-center gap-3 mb-6">
            <div className={`w-3 h-3 rounded-full ${getStatusColor()} shadow-lg`} />
            <span className="text-sm font-medium text-gray-200">{getStatusText()}</span>
          </div>

          {/* Audio Player */}
          <div className="flex justify-center mb-6">
            <AudioPlayer />
          </div>

          {/* Chat Meter */}
          <div className="mb-6">
            <ChatMeter
              inputSeconds={usageMetrics.inputSeconds}
              outputSeconds={usageMetrics.outputSeconds}
            />
          </div>

          {/* Fluency Meter - Show when analysis is enabled and we have results */}
          {enableAnalysis && analysisResult && (
            <div className="mb-6">
              <FluencyMeter result={analysisResult} transcript={fullTranscript} />
            </div>
          )}

          {/* Error Display */}
        {error && (
          <div className="mb-6 p-4 bg-red-900/80 border border-red-500/50 rounded-lg backdrop-blur-sm">
            <div className="flex items-start gap-3">
              <svg
                className="w-5 h-5 text-red-300 flex-shrink-0 mt-0.5"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
              <div>
                <h3 className="text-sm font-medium text-red-200">Error</h3>
                <p className="text-sm text-red-100 mt-1">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Conversation Transcript Display */}
        {conversationHistory.length > 0 && (
          <div className="mt-6 p-4 bg-black/50 backdrop-blur-md rounded-lg max-h-96 overflow-y-auto border border-white/10">
            <h3 className="text-sm font-semibold text-gray-200 mb-3">Conversation Transcript</h3>
            <div className="space-y-3">
              {conversationHistory.map((turn, index) => (
                <div
                  key={index}
                  className={`p-3 rounded-lg backdrop-blur-sm ${
                    turn.speaker === 'user'
                      ? 'bg-blue-900/50 border-l-4 border-blue-400'
                      : 'bg-green-900/50 border-l-4 border-green-400'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-semibold text-gray-200">
                      {turn.speaker === 'user' ? 'You (U)' : `${character.name} (${character.name.charAt(0)})`}
                    </span>
                    <span className="text-xs text-gray-400">
                      {turn.timestamp.toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="text-sm text-gray-100" dir="auto">
                    {turn.text}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Instructions */}
        <div className="mt-6 pt-6 border-t border-white/10">
          <h3 className="text-sm font-semibold text-gray-200 mb-3">Instructions:</h3>
          <ul className="text-sm text-gray-300 space-y-2">
            <li className="flex items-start gap-2">
              <span className="text-blue-400 mt-0.5">•</span>
              <span>Click the microphone button to start speaking</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-400 mt-0.5">•</span>
              <span>Speak naturally in Palestinian Arabic dialect</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-400 mt-0.5">•</span>
              <span>The AI will respond in spoken Arabic through your speakers</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-400 mt-0.5">•</span>
              <span>Click the stop button when you're done speaking</span>
            </li>
          </ul>

          {/* Action Buttons */}
          <div className="mt-6 flex flex-col gap-3">
            <div className="flex gap-3 justify-center flex-wrap">
              {/* Generate Transcript Button */}
              {usageMetrics.inputSeconds > 0 && !isRecording && (
                <button
                  onClick={handleGenerateTranscript}
                  disabled={isGeneratingTranscript}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 disabled:from-gray-400 disabled:to-gray-500 text-white font-medium rounded-lg transition-all duration-200 shadow-lg disabled:cursor-not-allowed"
                >
                  <svg
                    className={`w-5 h-5 ${isGeneratingTranscript ? 'animate-spin' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  {isGeneratingTranscript ? 'Generating...' : 'Generate Transcript'}
                </button>
              )}

              {/* Download Transcript Button */}
              {generatedTranscript && (
                <button
                  onClick={handleDownloadTranscript}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white font-medium rounded-lg transition-all duration-200 shadow-lg"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                    />
                  </svg>
                  Download Transcript
                </button>
              )}

              {/* End Session & Show Report Button */}
              {enableAnalysis && analysisHistory.length > 0 && (
                <button
                  onClick={handleEndSession}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-medium rounded-lg transition-all duration-200 shadow-lg"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                    />
                  </svg>
                  View Session Report
                </button>
              )}

              {/* Change Character Button */}
              {onBack && (
                <button
                  onClick={onBack}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 text-sm font-medium rounded-lg transition-all duration-200"
                  aria-label="Change character"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M10 19l-7-7m0 0l7-7m-7 7h18"
                    />
                  </svg>
                  Change Character
                </button>
              )}
            </div>

            {/* Generated Transcript Display */}
            {generatedTranscript && (
              <div className="mt-4 p-6 bg-gradient-to-br from-purple-900/80 to-indigo-900/80 backdrop-blur-md rounded-lg border-2 border-purple-500/30">
                <h3 className="text-lg font-bold text-purple-100 mb-4 flex items-center gap-2">
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  Complete Conversation Transcript
                </h3>
                <div className="p-4 bg-black/40 rounded-lg shadow-inner max-h-96 overflow-y-auto whitespace-pre-wrap font-mono text-sm text-gray-200" dir="auto">
                  {generatedTranscript}
                </div>
              </div>
            )}
          </div>
          </div>
        </div>
      </div>

      {/* Floating microphone button - Bottom Center (always visible) */}
      <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 z-50 flex flex-col items-center gap-3">
        {!isRecording ? (
          <button
            onClick={handleStart}
            disabled={status === 'connecting'}
            className="group relative w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 disabled:from-gray-400 disabled:to-gray-500 transition-all duration-300 shadow-2xl hover:shadow-blue-500/50 hover:scale-110 disabled:cursor-not-allowed"
          >
            <div className="absolute inset-0 rounded-full bg-white opacity-0 group-hover:opacity-20 transition-opacity" />
            <svg
              className="w-10 h-10 mx-auto text-white"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        ) : (
          <button
            onClick={handleStop}
            className="group relative w-20 h-20 rounded-full bg-gradient-to-br from-red-500 to-pink-600 hover:from-red-600 hover:to-pink-700 transition-all duration-300 shadow-2xl hover:shadow-red-500/50 animate-pulse"
          >
            <div className="absolute inset-0 rounded-full bg-white opacity-0 group-hover:opacity-20 transition-opacity" />
            <div className="w-8 h-8 mx-auto bg-white rounded-sm" />
          </button>
        )}

        <p className="text-sm text-white font-medium bg-black/70 backdrop-blur-md px-4 py-2 rounded-full shadow-lg">
          {isRecording ? 'Recording...' : 'Press to speak'}
        </p>
      </div>

      {/* Session Report Modal */}
      {showReport && sessionStartTime && (
        <SessionReport
          sessionData={{
            duration: usageMetrics.inputSeconds,
            analysisResults: analysisHistory,
            transcript: fullTranscript,
            characterName: character.name,
            startTime: sessionStartTime,
            endTime: new Date(),
          }}
          onClose={handleCloseReport}
        />
      )}
    </div>
  );
}
