import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, Square, X, Send, Volume2, AlertCircle, ExternalLink, Loader2 } from 'lucide-react';
import { SupportedLang } from '../services/voiceService';

export interface TranscriptEntry {
  id: string;
  source: 'user' | 'ai';
  message: string;
}

interface VoiceAssistantSheetProps {
  isOpen: boolean;
  status: 'idle' | 'listening' | 'transcribing' | 'speaking';
  sarvamConfigured: boolean;
  micBlocked: boolean;
  lang: SupportedLang;
  errorMsg: string | null;
  transcripts: TranscriptEntry[];
  onClose: () => void;
  onStartVoice: () => void;
  onStopVoice: () => void;
  onSendText: (text: string) => void;
}

export default function ElevenLabsVoiceSheet({
  isOpen,
  status,
  sarvamConfigured,
  micBlocked,
  lang,
  errorMsg,
  transcripts,
  onClose,
  onStartVoice,
  onStopVoice,
  onSendText,
}: VoiceAssistantSheetProps) {
  const [textInput, setTextInput] = useState('');

  if (!isOpen) return null;

  const isListening = status === 'listening';
  const isTranscribing = status === 'transcribing';
  const isSpeaking = status === 'speaking';

  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!textInput.trim()) return;
    onSendText(textInput.trim());
    setTextInput('');
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/55 backdrop-blur-sm p-0 sm:p-4">
        <motion.div
          initial={{ y: '100%', opacity: 0.6 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '100%', opacity: 0 }}
          transition={{ type: 'spring', damping: 28, stiffness: 320 }}
          className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl border border-stone-200 flex flex-col max-h-[88vh]"
        >
          <div className="w-10 h-1.5 bg-stone-300 rounded-full mx-auto mb-4 sm:hidden shrink-0" />

          {/* Header */}
          <div className="flex items-center justify-between gap-3 pb-4 border-b border-stone-100 shrink-0">
            <div className="flex items-center gap-3">
              <div
                className={`w-11 h-11 rounded-2xl flex items-center justify-center text-white shadow-sm ${
                  isSpeaking
                    ? 'bg-[#059669]'
                    : isListening
                    ? 'bg-[#EA580C]'
                    : sarvamConfigured
                    ? 'bg-[#059669]'
                    : 'bg-stone-600'
                }`}
              >
                {isTranscribing ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : isSpeaking ? (
                  <Volume2 className="w-5 h-5 animate-pulse" />
                ) : (
                  <Mic className="w-5 h-5" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-extrabold text-[#14171A]">
                    {isTranscribing
                      ? 'Transcribing with Sarvam AI...'
                      : isListening
                      ? lang === 'kn'
                        ? 'ಕೇಳಿಸಿಕೊಳ್ಳುತ್ತಿದೆ (ಮಾತನಾಡಿ)...'
                        : 'Listening — speak in Kannada, Hindi, or English'
                      : isSpeaking
                      ? lang === 'kn'
                        ? 'ಸರ್ವಂ ಧ್ವನಿ ಉತ್ತರಿಸುತ್ತಿದೆ...'
                        : 'Speaking reply...'
                      : lang === 'kn'
                      ? 'ಸರ್ವಂ ಧ್ವನಿ ಸಹಾಯಕ ಸಿದ್ಧವಾಗಿದೆ'
                      : 'Sarvam Voice Assistant Ready'}
                  </h3>
                </div>
                <p className="text-xs text-stone-500">
                  {sarvamConfigured
                    ? 'Sarvam AI (saaras:v4 + bulbul:v3) · Search or Post jobs'
                    : 'Built-in fallback active · Add SARVAM_API_KEY in Secrets for Sarvam AI'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 text-stone-400 hover:text-[#14171A] rounded-xl min-h-[40px] min-w-[40px] flex items-center justify-center cursor-pointer"
              aria-label="Close voice sheet"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Live Waveform Visualizer: Green when Sarvam configured, Grey when Built-in */}
          <div
            className={`my-4 rounded-2xl p-4 flex flex-col items-center justify-center shrink-0 transition-colors ${
              sarvamConfigured ? 'bg-[#059669]' : 'bg-stone-600'
            }`}
          >
            <div className="flex items-center justify-center gap-1.5 h-12">
              {[35, 65, 95, 50, 85, 45, 90, 60, 75, 40, 80, 50].map((val, i) => (
                <motion.div
                  key={i}
                  animate={
                    isListening || isSpeaking
                      ? { height: [`${Math.max(20, val - 25)}%`, `${val}%`, `${Math.max(20, val - 30)}%`] }
                      : { height: '24%' }
                  }
                  transition={{ repeat: Infinity, duration: isSpeaking ? 0.55 : 0.9, delay: i * 0.06 }}
                  className={`w-1.5 rounded-full ${
                    isSpeaking ? 'bg-white' : isListening ? 'bg-[#F59E0B]' : 'bg-white/50'
                  }`}
                />
              ))}
            </div>
            <p className="text-[11px] font-semibold text-white/90 mt-2 text-center">
              {isListening
                ? 'Speak naturally: “ಕ್ಯಾತ್ಸಂದ್ರ ಹತ್ತಿರ ಗೌಂಡಿ ಕೆಲಸ” or “Need 2 helpers for ₹700”'
                : sarvamConfigured
                ? 'Sarvam AI Voice Active · Tap below to speak'
                : 'Built-in Fallback Mode · Type or tap below'}
            </p>
          </div>

          {/* Error Banner */}
          {errorMsg && (
            <div className="mb-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl p-3 text-xs font-semibold space-y-2 shrink-0">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
              {micBlocked && typeof window !== 'undefined' && (
                <a
                  href={window.location.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-700 text-white text-[11px] font-extrabold hover:bg-rose-800 transition"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Open in New Tab to Unlock Mic</span>
                </a>
              )}
            </div>
          )}

          {/* Live Transcript Stream */}
          <div className="flex-1 overflow-y-auto space-y-2.5 min-h-[110px] max-h-52 pr-1 mb-4">
            {transcripts.length === 0 ? (
              <div className="text-center py-6 text-xs text-stone-400">
                Speak or type in Kannada, Hindi, or English to search or post Tumakuru shifts.
              </div>
            ) : (
              transcripts.map((entry) => (
                <div
                  key={entry.id}
                  className={`flex ${entry.source === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed ${
                      entry.source === 'user'
                        ? 'bg-[#14171A] text-white'
                        : 'bg-[#FAF8F5] border border-stone-200 text-[#14171A] font-medium'
                    }`}
                  >
                    {entry.message}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Text Command Input (always available alongside Voice) */}
          <form onSubmit={handleTextSubmit} className="flex items-center gap-2 mb-3 shrink-0">
            <input
              type="text"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="Or type command (e.g. Mason near Kyathsandra ₹750)..."
              className="flex-1 min-h-[42px] px-3.5 bg-[#FAF8F5] border border-stone-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
            <button
              type="submit"
              className="min-h-[42px] px-3.5 rounded-xl bg-stone-900 text-white flex items-center justify-center cursor-pointer"
              aria-label="Send message"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>

          {/* Controls Footer */}
          <div className="flex items-center gap-2.5 shrink-0">
            {isListening ? (
              <button
                type="button"
                onClick={onStopVoice}
                className="flex-1 min-h-[48px] bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-sm rounded-2xl flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <Square className="w-4 h-4" />
                <span>Done Speaking (Send)</span>
              </button>
            ) : (
              <button
                type="button"
                disabled={isTranscribing}
                onClick={onStartVoice}
                className="flex-1 min-h-[48px] bg-[#F59E0B] hover:bg-[#EA580C] hover:text-white disabled:opacity-60 text-[#14171A] font-extrabold text-sm rounded-2xl shadow-sm flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <Mic className="w-4 h-4" />
                <span>
                  {isTranscribing
                    ? 'Processing...'
                    : lang === 'kn'
                    ? 'ಮಾತನಾಡಿ (Speak with Sarvam)'
                    : 'Speak with Sarvam AI'}
                </span>
              </button>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
