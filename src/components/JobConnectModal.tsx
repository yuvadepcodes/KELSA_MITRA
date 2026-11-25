import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, PhoneCall, MessageSquare, ShieldCheck, MapPin, Clock, CheckCircle2, Banknote } from 'lucide-react';
import { Job } from '../services/jobService';
import { SupportedLang } from '../services/voiceService';

interface JobConnectModalProps {
  job: Job | null;
  lang: SupportedLang;
  isAlreadyApplied: boolean;
  onClose: () => void;
  onConfirmShift: (job: Job) => void;
}

export default function JobConnectModal({
  job,
  lang,
  isAlreadyApplied,
  onClose,
  onConfirmShift,
}: JobConnectModalProps) {
  if (!job) return null;

  const title = lang === 'kn' ? job.titleKannada : lang === 'hi' ? job.titleHindi : job.titleEnglish;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/55 backdrop-blur-sm p-0 sm:p-4">
        <motion.div
          initial={{ y: '100%', opacity: 0.5 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '100%', opacity: 0 }}
          transition={{ type: 'spring', damping: 30, stiffness: 340 }}
          className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl border border-stone-200"
        >
          <div className="w-10 h-1.5 bg-stone-300 rounded-full mx-auto mb-4 sm:hidden" />

          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold text-[#2563EB] flex items-center gap-1">
                <ShieldCheck className="w-4 h-4" />
                <span>{job.employer} · {job.ownerName}</span>
              </p>
              <h3 className="text-lg font-extrabold text-[#14171A] mt-1 leading-snug">{title}</h3>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-stone-400 hover:text-[#14171A] rounded-xl min-h-[40px] min-w-[40px] flex items-center justify-center"
              aria-label="Close shift details"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Key Shift Summary Grid */}
          <div className="mt-5 bg-[#FAF8F5] rounded-2xl p-4 border border-stone-200/80 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-stone-500">Guaranteed Pay</span>
              <span className="text-xl font-extrabold text-[#059669] tabular-nums">
                ₹{job.wage}
                <span className="text-xs font-semibold text-stone-500">{job.wageUnit}</span>
              </span>
            </div>

            <div className="border-t border-stone-200/70 pt-3 grid grid-cols-2 gap-3 text-xs">
              <div className="flex items-start gap-2">
                <Clock className="w-4 h-4 text-[#EA580C] shrink-0 mt-0.5" />
                <div>
                  <span className="text-stone-500 block">Shift Timing</span>
                  <strong className="text-[#14171A]">{job.shiftTime}</strong>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Banknote className="w-4 h-4 text-[#059669] shrink-0 mt-0.5" />
                <div>
                  <span className="text-stone-500 block">Payout Mode</span>
                  <strong className="text-[#14171A]">{job.paymentMode}</strong>
                </div>
              </div>
              <div className="flex items-start gap-2 col-span-2">
                <MapPin className="w-4 h-4 text-[#2563EB] shrink-0 mt-0.5" />
                <div>
                  <span className="text-stone-500 block">Worksite Address</span>
                  <strong className="text-[#14171A]">
                    {job.location} ({job.distanceKm} km · {job.commuteNote})
                  </strong>
                </div>
              </div>
            </div>
          </div>

          {/* Direct Actions */}
          <div className="mt-5 space-y-2.5">
            <a
              href={`tel:${job.phone}`}
              onClick={() => onConfirmShift(job)}
              className="w-full min-h-[48px] bg-[#F59E0B] hover:bg-[#EA580C] hover:text-white text-[#14171A] font-extrabold text-sm rounded-2xl shadow-sm flex items-center justify-center gap-2 transition"
            >
              <PhoneCall className="w-4 h-4" />
              <span>
                {lang === 'kn'
                  ? `ಮಾಲೀಕರಿಗೆ ಕರೆ ಮಾಡಿ (${job.phone})`
                  : `Call ${job.ownerName} (${job.phone})`}
              </span>
            </a>

            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => onConfirmShift(job)}
                disabled={isAlreadyApplied}
                className={`min-h-[46px] px-4 rounded-2xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                  isAlreadyApplied
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-[#14171A] hover:bg-stone-800 text-white'
                }`}
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>
                  {isAlreadyApplied
                    ? lang === 'kn'
                      ? 'ಶಿಫ್ಟ್ ದೃಢೀಕರಿಸಲಾಗಿದೆ'
                      : 'In My Shifts'
                    : lang === 'kn'
                    ? 'ಕೆಲಸ ಒಪ್ಪಿಕೊಳ್ಳಿ'
                    : 'Accept Shift'}
                </span>
              </button>

              <a
                href={`https://wa.me/${job.phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
                  `Namaskara ${job.ownerName}, I saw your ${job.titleEnglish} job on KELSAಮಿತ್ರ and I am available.`
                )}`}
                target="_blank"
                rel="noreferrer"
                className="min-h-[46px] px-4 rounded-2xl border border-stone-200 bg-white hover:bg-stone-50 text-[#14171A] text-xs font-extrabold flex items-center justify-center gap-1.5 transition"
              >
                <MessageSquare className="w-4 h-4 text-[#059669]" />
                <span>WhatsApp Reply</span>
              </a>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
