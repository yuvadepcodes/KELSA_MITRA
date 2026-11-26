import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PhoneCall, Mic, Volume2, VolumeX, Building2, MapPin,
  CheckCircle2, Cpu, Layers, X, Navigation, Briefcase,
  ShieldCheck, Footprints, Bus, Play, Square, ArrowRight,
  Clock, Wallet, SlidersHorizontal, Star, Search, Check, User
} from 'lucide-react';
import confetti from 'canvas-confetti';
import TumakuruRadar from './components/TumakuruRadar';
import JobConnectModal from './components/JobConnectModal';
import OnboardingModal from './components/OnboardingModal';
import ElevenLabsVoiceSheet, { TranscriptEntry } from './components/ElevenLabsVoiceSheet';
import AccountProfileView from './components/AccountProfileView';
import {
  Job,
  Worker,
  ShiftApplication,
  PayoutRecord,
  TUMAKURU_LOCALITIES,
  INITIAL_TUMAKURU_JOBS,
  INITIAL_TUMAKURU_WORKERS,
  INITIAL_PAYOUT_HISTORY,
  fetchWorkersFromSupabase,
  submitShiftApplication,
} from './services/jobService';
import {
  UserAccount,
  isSupabaseReady,
  getStoredCurrentUser,
  setStoredCurrentUser,
  upsertUserAccount,
  fetchAllJobs,
  createJobRecord,
  subscribeToJobsRealtime,
} from './services/supabaseService';
import {
  SupportedLang,
  MicRecordingSession,
  fetchSarvamStatus,
  speakWithSarvamOrFallback,
  startSarvamMicCapture,
  transcribeAudioWithSarvam,
  parseVoiceMarketplaceCommand,
  stopBrowserSpeech,
} from './services/voiceService';
import {
  getBrandParts,
  localizeDisplayName,
  localizeRoleLabel,
} from './utils/transliterate';

type WorkerSection = 'discover' | 'shifts';

interface VoiceFilter {
  skill?: string;
  area?: string;
  minWage?: number;
}

function matchesVoiceFilter(job: Job, filter: VoiceFilter | null): boolean {
  if (!filter) return true;
  if (filter.skill && filter.skill.trim()) {
    const s = filter.skill.trim().toLowerCase();
    const skillHaystack = `${job.titleEnglish} ${job.titleKannada} ${job.titleHindi} ${job.category} ${job.description}`.toLowerCase();
    if (!skillHaystack.includes(s)) return false;
  }
  if (filter.area && filter.area.trim()) {
    const a = filter.area.trim().toLowerCase();
    const areaHaystack = `${job.location} ${job.areaTag}`.toLowerCase();
    if (!areaHaystack.includes(a)) return false;
  }
  if (typeof filter.minWage === 'number' && !Number.isNaN(filter.minWage) && filter.minWage > 0) {
    if (job.wage < filter.minWage) return false;
  }
  return true;
}

export default function App() {
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(() => getStoredCurrentUser());
  const [isOnboardingOpen, setIsOnboardingOpen] = useState<boolean>(() => !getStoredCurrentUser());

  const [lang, setLang] = useState<SupportedLang>('kn');
  const [role, setRole] = useState<'worker' | 'employer'>(() => getStoredCurrentUser()?.role || 'worker');
  const [workerSection, setWorkerSection] = useState<WorkerSection>('discover');
  const [mobileDisplay, setMobileDisplay] = useState<'list' | 'map'>('list');
  const [showAccountPanel, setShowAccountPanel] = useState(false);

  // Worker Daily Duty & Filters
  const [onDutyToday, setOnDutyToday] = useState(true);
  const [selectedLocality, setSelectedLocality] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [sortBy, setSortBy] = useState<'nearest' | 'highest' | 'immediate'>('nearest');
  const [searchQuery, setSearchQuery] = useState('');
  const [radiusKm, setRadiusKm] = useState<5 | 10>(5);
  const [voiceFilter, setVoiceFilter] = useState<VoiceFilter | null>(null);

  // Marketplace Data
  const [jobs, setJobs] = useState<Job[]>(INITIAL_TUMAKURU_JOBS);
  const [workers, setWorkers] = useState<Worker[]>(INITIAL_TUMAKURU_WORKERS);
  const [selectedJobId, setSelectedJobId] = useState<string>(INITIAL_TUMAKURU_JOBS[0].id);
  const [modalJob, setModalJob] = useState<Job | null>(null);
  const [myShifts, setMyShifts] = useState<ShiftApplication[]>([]);
  const [payouts] = useState<PayoutRecord[]>(INITIAL_PAYOUT_HISTORY);
  const [invitedWorkerIds, setInvitedWorkerIds] = useState<string[]>([]);

  // Audio playback
  const [playingId, setPlayingId] = useState<string | null>(null);

  // Sarvam Voice Sheet & Status State
  const [isVoiceSheetOpen, setIsVoiceSheetOpen] = useState(false);
  const [sarvamConfigured, setSarvamConfigured] = useState(false);
  const [voiceSheetStatus, setVoiceSheetStatus] = useState<'idle' | 'listening' | 'transcribing' | 'speaking'>('idle');
  const [voiceMicBlocked, setVoiceMicBlocked] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [transcripts, setTranscripts] = useState<TranscriptEntry[]>([]);
  const voiceMicSessionRef = useRef<MicRecordingSession | null>(null);

  // Employer Form & View
  const [employerView, setEmployerView] = useState<'list' | 'map'>('list');
  const [employerDraft, setEmployerDraft] = useState('');
  const [employerWage, setEmployerWage] = useState(700);
  const [employerHeadcount, setEmployerHeadcount] = useState(2);
  const [employerArea, setEmployerArea] = useState('B.H. Road, Tumakuru');
  const [employerPhone, setEmployerPhone] = useState(() => getStoredCurrentUser()?.phone || '+91 98450 55443');
  const [employerParsedPreview, setEmployerParsedPreview] = useState(false);

  // Toast & Technical Spec Drawer
  const [toast, setToast] = useState<{ title: string; detail: string } | null>(null);
  const [isArchOpen, setIsArchOpen] = useState(false);

  // Refs for fresh state inside ElevenLabs client tool callbacks
  const jobsRef = useRef<Job[]>(jobs);
  const currentUserRef = useRef<UserAccount | null>(currentUser);

  useEffect(() => {
    jobsRef.current = jobs;
  }, [jobs]);

  useEffect(() => {
    currentUserRef.current = currentUser;
    if (currentUser?.phone) {
      setEmployerPhone(currentUser.phone);
    }
  }, [currentUser]);

  // Initial Supabase Load + Realtime Subscription
  useEffect(() => {
    let active = true;

    fetchAllJobs().then((loaded) => {
      if (active && loaded.length > 0) {
        setJobs(loaded);
        setSelectedJobId((curr) => (loaded.some((j) => j.id === curr) ? curr : loaded[0].id));
      }
    });

    fetchWorkersFromSupabase().then((loadedWorkers) => {
      if (active && loadedWorkers.length > 0) {
        setWorkers(loadedWorkers);
      }
    });

    const unsubscribe = subscribeToJobsRealtime((newJob) => {
      setJobs((prev) => (prev.some((j) => j.id === newJob.id) ? prev : [newJob, ...prev]));
    });

    fetchSarvamStatus().then((status) => {
      if (active) setSarvamConfigured(status.configured);
    });

    return () => {
      active = false;
      unsubscribe();
      stopBrowserSpeech();
    };
  }, []);

  const brand = getBrandParts(lang);

  useEffect(() => {
    document.title = `${brand.full} — ${
      lang === 'kn'
        ? 'ಧ್ವನಿ ಆಧಾರಿತ ಸ್ಥಳೀಯ ಕೆಲಸ'
        : lang === 'hi'
        ? 'वॉयस-फर्स्ट स्थानीय काम'
        : 'Voice-First Local Job Matching'
    }`;
  }, [brand.full, lang]);

  const showToast = (title: string, detail: string) => {
    setToast({ title, detail });
    setTimeout(() => setToast(null), 4000);
  };

  const handlePlayAudio = async (id: string, text: string) => {
    if (playingId === id) {
      stopBrowserSpeech();
      setPlayingId(null);
      return;
    }
    setPlayingId(id);
    await speakWithSarvamOrFallback(text, lang);
    setPlayingId((curr) => (curr === id ? null : curr));
  };

  const handleConfirmShift = (job: Job) => {
    const exists = myShifts.some((s) => s.job.id === job.id);
    if (!exists) {
      submitShiftApplication(job.id, '+91 94480 00000').catch(() => {});
      setMyShifts((prev) => [
        {
          id: `app-${Date.now()}`,
          job,
          status: 'Shift Confirmed',
          appliedAt: 'Just now',
        },
        ...prev,
      ]);
      confetti({ particleCount: 55, spread: 70, origin: { y: 0.75 } });
    }
    setModalJob(null);
    showToast(
      lang === 'kn' ? 'ಶಿಫ್ಟ್ ದೃಢೀಕರಿಸಲಾಗಿದೆ' : 'Shift Confirmed',
      `${job.employer} · ${job.shiftTime} (${job.location})`
    );
  };

  const handleVoiceCommandText = async (spokenText: string) => {
    const clean = spokenText.trim();
    if (!clean) return;

    setTranscripts((prev) => [
      ...prev,
      { id: `u-${Date.now()}`, source: 'user', message: clean },
    ]);

    const parsed = parseVoiceMarketplaceCommand(clean, role, lang);

    if (parsed.intent === 'createJob') {
      const created = await createJobRecord({
        title: parsed.skill || clean.slice(0, 48),
        area: parsed.area || 'B.H. Road, Tumakuru',
        wage: parsed.minWage || 700,
        workersCount: parsed.headcount || 1,
        employerName: currentUserRef.current?.name,
        employerPhone: currentUserRef.current?.phone,
      });
      setJobs((prev) => (prev.some((j) => j.id === created.id) ? prev : [created, ...prev]));
      setSelectedJobId(created.id);
      confetti({ particleCount: 65, spread: 80, origin: { y: 0.7 } });
      showToast('Instant Job Live', `${created.titleEnglish} · ₹${created.wage}/day`);
    } else {
      const nextFilter: VoiceFilter | null =
        parsed.skill || parsed.area || parsed.minWage
          ? { skill: parsed.skill, area: parsed.area, minWage: parsed.minWage }
          : null;

      setRole('worker');
      setWorkerSection('discover');
      setMobileDisplay('list');
      setSelectedCategory('All');
      setSelectedLocality('all');
      setSearchQuery(nextFilter ? '' : clean);
      setRadiusKm(10);
      setVoiceFilter(nextFilter);

      const filtered = jobsRef.current.filter((job) => matchesVoiceFilter(job, nextFilter));
      if (filtered.length > 0) {
        setSelectedJobId(filtered[0].id);
      }
      showToast(
        lang === 'kn' ? 'ಧ್ವನಿ ಹುಡುಕಾಟ ಅನ್ವಯಿಸಲಾಗಿದೆ' : 'Voice Filter Applied',
        `Found ${filtered.length} matching jobs nearby`
      );
    }

    setTranscripts((prev) => [
      ...prev,
      { id: `ai-${Date.now()}`, source: 'ai', message: parsed.reply },
    ]);
    setVoiceSheetStatus('speaking');
    await speakWithSarvamOrFallback(parsed.reply, lang);
    setVoiceSheetStatus('idle');
  };

  const startSarvamVoiceCapture = () => {
    stopBrowserSpeech();
    setVoiceError(null);
    setVoiceMicBlocked(false);

    if (!sarvamConfigured) {
      setVoiceError(
        'HD Voice is currently unavailable. Please type your command below.'
      );
      return;
    }

    voiceMicSessionRef.current = startSarvamMicCapture({
      maxDurationMs: 8500,
      silenceDurationMs: 1500,
      onStatusChange: (phase) => setVoiceSheetStatus(phase),
      onAudioCaptured: async (blob) => {
        setVoiceSheetStatus('transcribing');
        const res = await transcribeAudioWithSarvam(blob, lang);
        if (res.transcript) {
          await handleVoiceCommandText(res.transcript);
        } else {
          setVoiceSheetStatus('idle');
          setVoiceError(res.errorMessage || 'Could not understand audio. Please try speaking again.');
        }
      },
      onError: (code, msg) => {
        setVoiceSheetStatus('idle');
        if (code === 'MIC_PERMISSION_DENIED') {
          setVoiceMicBlocked(true);
        }
        setVoiceError(msg);
      },
    });
  };

  const startElevenLabsVoice = () => {
    stopBrowserSpeech();
    setVoiceError(null);
    setVoiceMicBlocked(false);
    setIsVoiceSheetOpen(true);
    if (sarvamConfigured) {
      startSarvamVoiceCapture();
    }
  };

  const stopSarvamVoiceCapture = () => {
    try {
      voiceMicSessionRef.current?.stop();
    } catch {
      // Ignore
    }
  };

  const handleCloseVoiceSheet = () => {
    stopSarvamVoiceCapture();
    stopBrowserSpeech();
    setVoiceSheetStatus('idle');
    setIsVoiceSheetOpen(false);
  };

  const handleSaveManualUser = async (params: {
    name: string;
    phone: string;
    role: 'worker' | 'employer';
    area?: string;
    tradeOrBusiness?: string;
    jobsCompleted?: number;
    experience?: string;
    expectedWage?: number;
    paymentPreference?: string;
  }) => {
    const saved = await upsertUserAccount(params);
    setCurrentUser(saved);
    setRole(saved.role);
    if (saved.role === 'worker') {
      setWorkerSection('discover');
    }
    setIsOnboardingOpen(false);
    showToast('Account Saved', `Signed in as ${saved.name} (${saved.role})`);
  };

  const handleExistingUserLogin = (existingUser: UserAccount) => {
    setCurrentUser(existingUser);
    setRole(existingUser.role);
    if (existingUser.role === 'worker') {
      setWorkerSection('discover');
    }
    setIsOnboardingOpen(false);
    showToast('Welcome Back', `Signed in as ${existingUser.name} (${existingUser.role})`);
  };

  const handleSignOutUser = () => {
    setStoredCurrentUser(null);
    setCurrentUser(null);
    setMyShifts([]);
  };

  const handleBroadcastJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employerDraft.trim()) return;

    const savedJob = await createJobRecord({
      title: employerDraft.trim(),
      area: employerArea,
      wage: Number(employerWage),
      workersCount: employerHeadcount,
      employerName: currentUser?.name || 'Local Business',
      employerPhone: employerPhone || currentUser?.phone || '+91 98450 55443',
      category: 'Retail Shop',
    });

    setJobs((prev) => (prev.some((j) => j.id === savedJob.id) ? prev : [savedJob, ...prev]));
    setSelectedJobId(savedJob.id);
    setEmployerDraft('');
    setEmployerParsedPreview(false);
    confetti({ particleCount: 65, spread: 80, origin: { y: 0.7 } });
    showToast(
      lang === 'kn' ? 'ಕೆಲಸ ಪ್ರಕಟಿಸಲಾಗಿದೆ' : 'Instant Job Live',
      `${savedJob.titleEnglish} · ${employerArea} (₹${employerWage}/day)`
    );
  };

  const handleInviteWorker = (worker: Worker) => {
    if (!invitedWorkerIds.includes(worker.id)) {
      setInvitedWorkerIds((prev) => [...prev, worker.id]);
    }
    showToast(
      lang === 'kn' ? 'ಕರೆ / ಆಮಂತ್ರಣ ಕಳುಹಿಸಲಾಗಿದೆ' : 'IVR Call Invite Sent',
      `${worker.name} (${worker.phone}) will receive your shift details immediately.`
    );
  };

  const categories = ['All', 'Auto Garage', 'Construction', 'Logistics', 'Industrial', 'Retail Shop', 'Events'];

  const filteredJobs = jobs
    .filter((job) => {
      const withinRadius = voiceFilter ? true : job.distanceKm <= radiusKm;
      const matchesCat = selectedCategory === 'All' || job.category === selectedCategory;
      const matchesLoc = selectedLocality === 'all' || job.areaTag === selectedLocality;
      const q = searchQuery.trim().toLowerCase();
      const matchesQuery =
        !q ||
        job.titleEnglish.toLowerCase().includes(q) ||
        job.titleKannada.toLowerCase().includes(q) ||
        job.location.toLowerCase().includes(q) ||
        job.employer.toLowerCase().includes(q);
      const matchesVoice = matchesVoiceFilter(job, voiceFilter);
      return withinRadius && matchesCat && matchesLoc && matchesQuery && matchesVoice;
    })
    .sort((a, b) => {
      if (sortBy === 'highest') return b.wage - a.wage;
      if (sortBy === 'immediate') return a.urgency === 'Immediate' ? -1 : 1;
      return a.distanceKm - b.distanceKm;
    });

  const weeklyEarningsTotal = currentUser?.weeklyEarned ?? 0;

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-[#14171A] flex flex-col">
      {/* ================= CLEAN 3-ZONE TOP APP BAR ================= */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-stone-200/90">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          {/* Zone 1: Localized Brand Wordmark */}
          <a
            href="#top"
            className="text-xl font-extrabold tracking-tight text-[#14171A] whitespace-nowrap shrink-0 inline-flex items-baseline"
          >
            <span>{brand.prefix}</span>
            <span className={`text-[#EA580C] ml-0.5 ${brand.suffixFontClass}`}>{brand.suffix}</span>
          </a>

          {/* Zone 2: Primary App Navigation (Desktop) */}
          <nav className="hidden md:flex items-center gap-7 text-sm font-semibold text-stone-600">
            <button
              type="button"
              onClick={() => {
                setShowAccountPanel(false);
                setRole('worker');
                setWorkerSection('discover');
              }}
              className={`py-1 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                !showAccountPanel && role === 'worker' && workerSection === 'discover'
                  ? 'border-[#EA580C] text-[#14171A] font-bold'
                  : 'border-transparent hover:text-[#14171A]'
              }`}
            >
              {lang === 'kn' ? 'ಕೆಲಸ ಹುಡುಕಿ' : lang === 'hi' ? 'काम खोजें' : 'Find Work'}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowAccountPanel(false);
                setRole('worker');
                setWorkerSection('shifts');
              }}
              className={`py-1 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                !showAccountPanel && role === 'worker' && workerSection === 'shifts'
                  ? 'border-[#EA580C] text-[#14171A] font-bold'
                  : 'border-transparent hover:text-[#14171A]'
              }`}
            >
              {lang === 'kn'
                ? `ನನ್ನ ಶಿಫ್ಟ್‌ಗಳು (${myShifts.length})`
                : lang === 'hi'
                ? `मेरी शिफ्ट (${myShifts.length})`
                : `My Shifts (${myShifts.length})`}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowAccountPanel(false);
                setRole('employer');
              }}
              className={`py-1 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                !showAccountPanel && role === 'employer'
                  ? 'border-[#2563EB] text-[#14171A] font-bold'
                  : 'border-transparent hover:text-[#14171A]'
              }`}
            >
              {lang === 'kn' ? 'ಕೆಲಸಗಾರರನ್ನು ನೇಮಿಸಿ' : lang === 'hi' ? 'कामगार रखें' : 'Hire Staff'}
            </button>
          </nav>

          {/* Zone 3: Profile Pill + Locality Selector + Language Switcher */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                if (currentUser) {
                  setShowAccountPanel(true);
                } else {
                  setIsOnboardingOpen(true);
                }
              }}
              className="inline-flex items-center gap-1.5 min-h-[36px] px-2.5 py-1 rounded-xl border border-stone-200 bg-stone-100 hover:bg-stone-200/70 text-xs font-bold text-[#14171A] transition cursor-pointer max-w-[165px]"
              title="Account & Role"
            >
              <User className={`w-3.5 h-3.5 shrink-0 ${currentUser?.role === 'employer' ? 'text-[#2563EB]' : 'text-[#EA580C]'}`} />
              <span className="truncate">
                {currentUser
                  ? `${localizeDisplayName(currentUser.name, lang)} · ${localizeRoleLabel(currentUser.role, lang)}`
                  : lang === 'kn'
                  ? 'ಸೈನ್ ಇನ್'
                  : lang === 'hi'
                  ? 'साइन इन'
                  : 'Sign In'}
              </span>
            </button>

            <div className="hidden lg:flex items-center gap-1.5 text-xs font-semibold text-stone-700 bg-stone-100 px-2.5 py-1.5 rounded-xl border border-stone-200/80">
              <MapPin className="w-3.5 h-3.5 text-[#EA580C] shrink-0" />
              <select
                value={selectedLocality}
                onChange={(e) => setSelectedLocality(e.target.value)}
                aria-label="Select Tumakuru Locality"
                className="bg-transparent text-xs font-bold text-[#14171A] focus:outline-none cursor-pointer"
              >
                {TUMAKURU_LOCALITIES.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {lang === 'kn' ? loc.kn : loc.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="relative flex items-center bg-stone-100 p-1 rounded-xl text-xs font-bold border border-stone-200/70">
              {(['kn', 'hi', 'en'] as SupportedLang[]).map((code) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => setLang(code)}
                  className={`relative z-10 px-2.5 py-1 rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                    lang === code ? 'text-[#14171A]' : 'text-stone-500 hover:text-[#14171A]'
                  }`}
                >
                  {lang === code && (
                    <motion.span
                      layoutId="langPill"
                      transition={{ type: 'spring', stiffness: 450, damping: 35 }}
                      className="absolute inset-0 bg-white rounded-lg shadow-sm -z-10"
                    />
                  )}
                  {code === 'kn' ? 'ಕನ್ನಡ' : code === 'hi' ? 'हिंदी' : 'ENG'}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      {/* ================= MAIN WORKSPACE ================= */}
      <main id="top" className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-5 sm:py-6 pb-28 space-y-6">
        {/* ================= ACCOUNT PROFILE & REQUIREMENTS VIEW ================= */}
        {showAccountPanel && (
          <AccountProfileView
            lang={lang}
            currentUser={currentUser}
            activeRole={role}
            myShifts={myShifts}
            postedJobsCount={jobs.filter((j) => currentUser?.name && j.employer === currentUser.name).length || 1}
            invitedWorkersCount={invitedWorkerIds.length}
            weeklyEarningsTotal={weeklyEarningsTotal}
            onSaveAccount={handleSaveManualUser}
            onVoiceUpdate={startElevenLabsVoice}
            onNavigateWorkspace={(targetRole) => {
              setShowAccountPanel(false);
              setRole(targetRole);
              if (targetRole === 'worker') {
                setWorkerSection('discover');
              }
            }}
            onSwitchAccount={() => {
              handleSignOutUser();
              setShowAccountPanel(false);
              setIsOnboardingOpen(true);
            }}
            recentJobs={jobs}
          />
        )}

        {/* ================= WORKER MODE ================= */}
        {!showAccountPanel && role === 'worker' && workerSection === 'discover' && (
          <>
            {/* Daily Duty & Quick Earnings Bar (Swiggy/Rapido Partner Pattern) */}
            <section className="bg-white rounded-2xl border border-stone-200/90 p-4 sm:px-6 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="flex items-center justify-between sm:justify-start gap-4">
                <button
                  type="button"
                  onClick={() => setOnDutyToday((v) => !v)}
                  className={`relative inline-flex items-center gap-3 px-3.5 py-2 rounded-xl border transition cursor-pointer min-h-[44px] ${
                    onDutyToday
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                      : 'bg-stone-100 border-stone-200 text-stone-600'
                  }`}
                >
                  <span
                    className={`w-10 h-6 rounded-full p-0.5 transition-colors flex items-center ${
                      onDutyToday ? 'bg-[#10B981] justify-end' : 'bg-stone-300 justify-start'
                    }`}
                  >
                    <motion.span layout className="w-5 h-5 rounded-full bg-white shadow-sm" />
                  </span>
                  <div className="text-left">
                    <span className="text-xs font-extrabold block leading-none">
                      {onDutyToday
                        ? lang === 'kn'
                          ? 'ಇಂದು ಕೆಲಸಕ್ಕೆ ಸಿದ್ಧ (On Duty)'
                          : 'Available for Work Today'
                        : lang === 'kn'
                        ? 'ವಿರಾಮದಲ್ಲಿ (Off Duty)'
                        : 'Paused Today'}
                    </span>
                    <span className="text-[11px] opacity-75 block mt-0.5">
                      {onDutyToday ? 'Receiving local owner calls' : 'Tap to receive local shift alerts'}
                    </span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setWorkerSection('shifts')}
                  className="text-left px-3.5 py-2 rounded-xl hover:bg-stone-50 transition cursor-pointer"
                >
                  <span className="text-[11px] font-semibold text-stone-500 block">This Week</span>
                  <span className="text-base font-extrabold text-[#059669] tabular-nums">
                    ₹{weeklyEarningsTotal.toLocaleString('en-IN')}
                  </span>
                </button>
              </div>

              {/* Zero-Typing Voice Search Input */}
              <div className="flex items-center gap-2 flex-1 lg:max-w-xl">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={
                      lang === 'kn'
                        ? 'ಕೆಲಸ ಅಥವಾ ಏರಿಯಾ ಹುಡುಕಿ (ಉದಾ: ಗೌಂಡಿ, ಚಿಕ್ಕಪೇಟೆ)...'
                        : 'Search trade or nearby area (e.g., Mason, Chickpet)...'
                    }
                    className="w-full min-h-[44px] pl-10 pr-4 bg-[#FAF8F5] border border-stone-200 rounded-xl text-sm font-medium placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white transition"
                  />
                </div>
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.95 }}
                  onClick={startElevenLabsVoice}
                  className="min-h-[44px] px-4 bg-[#F59E0B] hover:bg-[#EA580C] hover:text-white text-[#14171A] font-extrabold text-xs sm:text-sm rounded-xl shadow-xs inline-flex items-center gap-2 whitespace-nowrap transition cursor-pointer"
                >
                  <Mic className="w-4 h-4" />
                  <span>{lang === 'kn' ? 'ಮಾತನಾಡಿ' : 'Voice'}</span>
                </motion.button>
              </div>
            </section>

            {/* Filter Chips & Sort Controls */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition min-h-[38px] cursor-pointer ${
                      selectedCategory === cat
                        ? 'bg-[#14171A] text-white'
                        : 'bg-white border border-stone-200 text-stone-700 hover:bg-stone-100'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0">
                {/* Mobile List/Map Segmented Switch */}
                <div className="flex lg:hidden items-center bg-stone-200/80 p-1 rounded-xl text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => setMobileDisplay('list')}
                    className={`px-3 py-1.5 rounded-lg transition ${
                      mobileDisplay === 'list' ? 'bg-white text-[#14171A] shadow-xs' : 'text-stone-600'
                    }`}
                  >
                    List ({filteredJobs.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setMobileDisplay('map')}
                    className={`px-3 py-1.5 rounded-lg transition ${
                      mobileDisplay === 'map' ? 'bg-white text-[#14171A] shadow-xs' : 'text-stone-600'
                    }`}
                  >
                    Map
                  </button>
                </div>

                <div className="flex items-center gap-1.5 bg-white border border-stone-200 px-3 py-1.5 rounded-xl text-xs font-bold text-stone-700 min-h-[38px]">
                  <SlidersHorizontal className="w-3.5 h-3.5 text-stone-400" />
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as 'nearest' | 'highest' | 'immediate')}
                    aria-label="Sort jobs"
                    className="bg-transparent focus:outline-none cursor-pointer"
                  >
                    <option value="nearest">Nearest first</option>
                    <option value="highest">Highest pay</option>
                    <option value="immediate">Immediate start</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Active Voice Filter Banner */}
            {voiceFilter && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="inline-flex items-center gap-1.5 font-extrabold text-[#EA580C]">
                    <Mic className="w-3.5 h-3.5" />
                    Voice Filter Active:
                  </span>
                  {voiceFilter.skill && (
                    <span className="bg-white border border-amber-200 px-2.5 py-1 rounded-lg font-bold text-[#14171A]">
                      Skill: {voiceFilter.skill}
                    </span>
                  )}
                  {voiceFilter.area && (
                    <span className="bg-white border border-amber-200 px-2.5 py-1 rounded-lg font-bold text-[#14171A]">
                      Area: {voiceFilter.area}
                    </span>
                  )}
                  {voiceFilter.minWage && (
                    <span className="bg-white border border-amber-200 px-2.5 py-1 rounded-lg font-bold text-[#059669]">
                      Min Wage: ₹{voiceFilter.minWage}
                    </span>
                  )}
                  <span className="text-stone-600 font-semibold">
                    ({filteredJobs.length} {filteredJobs.length === 1 ? 'match' : 'matches'})
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setVoiceFilter(null)}
                  className="px-3 py-1.5 rounded-xl bg-[#14171A] text-white text-xs font-bold hover:bg-stone-800 transition cursor-pointer"
                >
                  Reset
                </button>
              </div>
            )}

            {/* Split-Pane Marketplace: Left Job Feed + Right Sticky OpenStreetMap */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Job Feed Column */}
              <div className={`lg:col-span-7 space-y-3.5 ${mobileDisplay === 'map' ? 'hidden lg:block' : 'block'}`}>
                {filteredJobs.length === 0 ? (
                  <div className="bg-white rounded-3xl border border-stone-200 p-8 text-center space-y-3">
                    <p className="text-base font-extrabold text-[#14171A]">
                      No shifts match those filters within {radiusKm} km
                    </p>
                    <p className="text-xs text-stone-500">
                      Expand your radius to 10 km or clear the trade filter to see all nearby openings.
                    </p>
                    <div className="flex justify-center gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          setRadiusKm(10);
                          setSelectedCategory('All');
                          setSelectedLocality('all');
                          setSearchQuery('');
                          setVoiceFilter(null);
                        }}
                        className="px-4 py-2.5 rounded-xl bg-[#14171A] text-white text-xs font-bold cursor-pointer"
                      >
                        Show All Nearby Jobs (10 km)
                      </button>
                    </div>
                  </div>
                ) : (
                  filteredJobs.map((job) => {
                    const isSelected = selectedJobId === job.id;
                    const isPlaying = playingId === job.id;
                    const isApplied = myShifts.some((s) => s.job.id === job.id);
                    const localizedTitle =
                      lang === 'kn' ? job.titleKannada : lang === 'hi' ? job.titleHindi : job.titleEnglish;
                    const localizedDesc = lang === 'kn' ? job.descriptionKannada : job.description;

                    return (
                      <article
                        key={job.id}
                        onClick={() => setSelectedJobId(job.id)}
                        className={`bg-white rounded-2xl p-5 border transition cursor-pointer ${
                          isSelected
                            ? 'border-[#EA580C] shadow-md ring-1 ring-[#EA580C]/20'
                            : 'border-stone-200/90 hover:border-stone-300 shadow-xs'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                          <div className="space-y-1 flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2 text-xs text-stone-500">
                              <span className="font-bold text-[#2563EB] inline-flex items-center gap-1">
                                <ShieldCheck className="w-3.5 h-3.5" />
                                {job.employer}
                              </span>
                              <span aria-hidden="true">·</span>
                              <span>{job.timeAgo}</span>
                              <span aria-hidden="true">·</span>
                              <span className="font-semibold text-[#EA580C]">
                                {job.slotsLeft} {job.slotsLeft === 1 ? 'spot left' : 'spots left'}
                              </span>
                            </div>

                            <h3 className="text-base sm:text-lg font-extrabold text-[#14171A] leading-snug">
                              {localizedTitle}
                            </h3>
                            {lang !== 'en' && (
                              <p className="text-xs font-medium text-stone-500">{job.titleEnglish}</p>
                            )}
                          </div>

                          {/* Big Tabular Emerald Pay */}
                          <div className="sm:text-right shrink-0 flex sm:block items-baseline justify-between border-t sm:border-t-0 pt-2 sm:pt-0 border-stone-100">
                            <div className="text-xl sm:text-2xl font-extrabold text-[#059669] tabular-nums tracking-tight">
                              ₹{job.wage}
                              <span className="text-xs font-bold text-stone-500 ml-0.5">{job.wageUnit}</span>
                            </div>
                            <span className="text-[11px] font-bold text-stone-500 block">
                              {job.paymentMode}
                            </span>
                          </div>
                        </div>

                        <p className="text-xs text-stone-600 mt-2.5 leading-relaxed">{localizedDesc}</p>

                        {/* Shift Metadata & Actions */}
                        <div className="mt-4 pt-3.5 border-t border-stone-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-stone-600">
                            <span className="inline-flex items-center gap-1 font-semibold text-[#14171A]">
                              <MapPin className="w-3.5 h-3.5 text-[#EA580C]" />
                              {job.distanceKm} km · {job.areaTag}
                            </span>
                            <span className="inline-flex items-center gap-1">
                              {job.distanceKm <= 1.5 ? (
                                <Footprints className="w-3.5 h-3.5 text-stone-400" />
                              ) : (
                                <Bus className="w-3.5 h-3.5 text-stone-400" />
                              )}
                              {job.commuteNote}
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5 text-stone-400" />
                              {job.shiftTime}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => handlePlayAudio(job.id, `${localizedTitle}. ${localizedDesc}`)}
                              className={`min-h-[40px] px-3 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition cursor-pointer ${
                                isPlaying
                                  ? 'bg-amber-100 text-[#EA580C]'
                                  : 'bg-stone-100 hover:bg-stone-200 text-stone-800'
                              }`}
                            >
                              {isPlaying ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                              <span>{isPlaying ? 'Stop' : lang === 'kn' ? 'ಕೇಳಿ' : 'Listen'}</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => setModalJob(job)}
                              className={`min-h-[40px] px-4 rounded-xl text-xs font-extrabold inline-flex items-center gap-1.5 transition cursor-pointer ${
                                isApplied
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-[#F59E0B] hover:bg-[#EA580C] hover:text-white text-[#14171A]'
                              }`}
                            >
                              {isApplied ? <Check className="w-3.5 h-3.5" /> : <PhoneCall className="w-3.5 h-3.5" />}
                              <span>
                                {isApplied
                                  ? lang === 'kn'
                                    ? 'ದೃಢೀಕರಿಸಲಾಗಿದೆ'
                                    : 'Accepted'
                                  : lang === 'kn'
                                  ? 'ಕೆಲಸ ಪಡೆಯಿರಿ'
                                  : 'Accept / Call'}
                              </span>
                            </button>
                          </div>
                        </div>
                      </article>
                    );
                  })
                )}
              </div>

              {/* Sticky Interactive OpenStreetMap Column */}
              <div
                className={`lg:col-span-5 lg:sticky lg:top-20 ${
                  mobileDisplay === 'map' ? 'block' : 'hidden lg:block'
                }`}
              >
                <TumakuruRadar
                  mode="jobs"
                  jobs={filteredJobs.length ? filteredJobs : jobs}
                  lang={lang}
                  radiusKm={radiusKm}
                  selectedId={selectedJobId}
                  onSelectId={setSelectedJobId}
                  onRadiusChange={setRadiusKm}
                  onSelectJobAction={(job) => setModalJob(job)}
                  heightClass="h-[360px] lg:h-[400px]"
                />
              </div>
            </div>
          </>
        )}

        {/* ================= WORKER MY SHIFTS & PASSBOOK ================= */}
        {!showAccountPanel && role === 'worker' && workerSection === 'shifts' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Active Shifts */}
            <section className="lg:col-span-7 bg-white rounded-3xl border border-stone-200/90 p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-extrabold text-[#14171A]">
                    {lang === 'kn' ? 'ನನ್ನ ದೃಢೀಕರಿಸಿದ ಶಿಫ್ಟ್‌ಗಳು' : 'My Active Shifts'}
                  </h2>
                  <p className="text-xs text-stone-500">
                    Shifts you accepted or called today in Tumakuru.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setWorkerSection('discover')}
                  className="text-xs font-extrabold text-[#EA580C] hover:underline cursor-pointer"
                >
                  + Find More Work
                </button>
              </div>

              {myShifts.length === 0 ? (
                <div className="bg-[#FAF8F5] rounded-2xl p-8 text-center border border-stone-200/70 space-y-3">
                  <Briefcase className="w-8 h-8 text-stone-400 mx-auto" />
                  <p className="text-sm font-bold text-[#14171A]">No active shifts yet today</p>
                  <p className="text-xs text-stone-500 max-w-sm mx-auto">
                    Tap “Accept / Call” on any nearby Tumakuru job to lock in your shift and owner contact.
                  </p>
                  <button
                    type="button"
                    onClick={() => setWorkerSection('discover')}
                    className="px-4 py-2.5 rounded-xl bg-[#14171A] text-white text-xs font-extrabold cursor-pointer"
                  >
                    Browse Nearby Jobs
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {myShifts.map((item) => (
                    <div
                      key={item.id}
                      className="p-4 rounded-2xl bg-[#FAF8F5] border border-stone-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div>
                        <span className="text-xs font-extrabold text-[#059669]">{item.status}</span>
                        <h3 className="text-sm font-extrabold text-[#14171A] mt-0.5">
                          {lang === 'kn' ? item.job.titleKannada : item.job.titleEnglish}
                        </h3>
                        <p className="text-xs text-stone-500 mt-0.5">
                          {item.job.employer} · {item.job.shiftTime} · {item.job.location}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-base font-extrabold text-[#059669] tabular-nums">
                          ₹{item.job.wage}
                        </span>
                        <a
                          href={`tel:${item.job.phone}`}
                          className="min-h-[40px] px-3.5 rounded-xl bg-[#14171A] text-white text-xs font-bold inline-flex items-center gap-1.5"
                        >
                          <PhoneCall className="w-3.5 h-3.5 text-amber-400" />
                          <span>Call Owner</span>
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* KhataBook-style Earnings Passbook */}
            <section className="lg:col-span-5 bg-white rounded-3xl border border-stone-200/90 p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-extrabold text-[#14171A]">
                    {lang === 'kn' ? 'ವಾರದ ಗಳಿಕೆ ಪಾಸ್‌ಬುಕ್' : 'Weekly Payout Passbook'}
                  </h2>
                  <p className="text-xs text-stone-500">Verified UPI & cash daily settlements</p>
                </div>
                <Wallet className="w-5 h-5 text-[#059669]" />
              </div>

              <div className="bg-[#14171A] text-white rounded-2xl p-5">
                <span className="text-xs text-stone-400">Settled This Week</span>
                <div className="text-3xl font-extrabold text-emerald-400 tabular-nums mt-1">
                  ₹{weeklyEarningsTotal.toLocaleString('en-IN')}
                </div>
                <p className="text-[11px] text-stone-400 mt-1">Zero platform commission · 100% goes to you</p>
              </div>

              <div className="divide-y divide-stone-100">
                {weeklyEarningsTotal === 0 && myShifts.length === 0 ? (
                  <p className="text-xs text-stone-500 py-4 text-center">
                    No settled payouts yet. Accept and complete a shift to track your UPI and cash settlements here.
                  </p>
                ) : (
                  payouts.map((p) => (
                    <div key={p.id} className="py-3 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-extrabold text-[#14171A]">{p.employer}</p>
                        <p className="text-[11px] text-stone-500">
                          {p.role} · {p.date}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-extrabold text-[#059669] tabular-nums">+₹{p.amount}</span>
                        <span className="block text-[10px] font-bold text-stone-500">{p.mode} Settled</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>
        )}

        {/* ================= EMPLOYER MODE ================= */}
        {!showAccountPanel && role === 'employer' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left: 15-Second Voice Job Poster */}
            <section className="lg:col-span-5 bg-white rounded-3xl p-6 border border-stone-200/90 shadow-xs space-y-5">
              <div>
                <h2 className="text-lg font-extrabold text-[#14171A]">
                  {lang === 'kn' ? '15 ಸೆಕೆಂಡಿನಲ್ಲಿ ಕೆಲಸಗಾರರನ್ನು ಕರೆಯಿರಿ' : 'Hire Local Help in 15 Seconds'}
                </h2>
                <p className="text-xs text-stone-500 mt-1">
                  Speak in Kannada or pick a quick template to alert verified workers within 5 km.
                </p>
              </div>

              <motion.button
                type="button"
                whileTap={{ scale: 0.97 }}
                onClick={startElevenLabsVoice}
                className="w-full min-h-[48px] bg-[#F59E0B] hover:bg-[#EA580C] hover:text-white text-[#14171A] font-extrabold text-sm rounded-2xl shadow-xs flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <Mic className={`w-4 h-4 ${voiceSheetStatus === 'listening' ? 'animate-pulse' : ''}`} />
                <span>
                  {voiceSheetStatus === 'listening'
                    ? 'Listening — Speak Job Details'
                    : lang === 'kn'
                    ? 'ಮಾತನಾಡಿ ಕೆಲಸ ಪ್ರಕಟಿಸಿ'
                    : 'Post Job by Voice'}
                </span>
              </motion.button>

              {/* Quick 1-Tap Shopkeeper Presets */}
              <div className="flex flex-wrap gap-1.5">
                {[
                  { label: '2 Loaders · ₹700', text: 'Need 2 helpers to unload stock today afternoon', wage: 700, count: 2 },
                  { label: '1 Mason · ₹850', text: 'Need 1 experienced mason for brickwork tomorrow', wage: 850, count: 1 },
                  { label: 'Shop Helper · ₹650', text: 'Need hardware shop helper for daily packing & delivery', wage: 650, count: 1 },
                ].map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => {
                      setEmployerDraft(preset.text);
                      setEmployerWage(preset.wage);
                      setEmployerHeadcount(preset.count);
                      setEmployerParsedPreview(true);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-xs font-bold text-stone-700 transition cursor-pointer"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              {employerParsedPreview && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3.5 text-xs space-y-1.5">
                  <div className="flex items-center gap-1.5 font-extrabold text-emerald-800">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Parsed Shift Summary</span>
                  </div>
                  <p className="text-stone-700">
                    {employerHeadcount} workers · ₹{employerWage}/day · {employerArea}
                  </p>
                </div>
              )}

              <form onSubmit={handleBroadcastJob} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">Work Details</label>
                  <textarea
                    rows={2}
                    required
                    value={employerDraft}
                    onChange={(e) => setEmployerDraft(e.target.value)}
                    placeholder="e.g. Need 2 helpers this afternoon to unload hardware stock, ₹700/day"
                    className="w-full px-3.5 py-2.5 bg-[#FAF8F5] border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">Daily Wage (₹)</label>
                    <input
                      type="number"
                      min={300}
                      max={5000}
                      value={employerWage}
                      onChange={(e) => setEmployerWage(Number(e.target.value))}
                      className="w-full px-3.5 py-2.5 bg-[#FAF8F5] border border-stone-200 rounded-xl text-sm font-bold tabular-nums focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">Headcount</label>
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={employerHeadcount}
                      onChange={(e) => setEmployerHeadcount(Number(e.target.value))}
                      className="w-full px-3.5 py-2.5 bg-[#FAF8F5] border border-stone-200 rounded-xl text-sm font-bold tabular-nums focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">Area</label>
                    <select
                      value={employerArea}
                      onChange={(e) => setEmployerArea(e.target.value)}
                      className="w-full px-3 py-2.5 bg-[#FAF8F5] border border-stone-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500"
                    >
                      <option value="B.H. Road, Tumakuru">B.H. Road</option>
                      <option value="Kyathsandra, Tumakuru">Kyathsandra</option>
                      <option value="APMC Yard, Tumakuru">APMC Yard</option>
                      <option value="Vasanthnarasapura Sheds">Vasanthnarasapura</option>
                      <option value="Chickpet, Tumakuru">Chickpet</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">Owner Phone</label>
                    <input
                      type="text"
                      value={employerPhone}
                      onChange={(e) => setEmployerPhone(e.target.value)}
                      className="w-full px-3 py-2.5 bg-[#FAF8F5] border border-stone-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full min-h-[48px] bg-[#14171A] hover:bg-stone-800 text-white font-extrabold text-sm rounded-2xl transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>Broadcast to Nearby Workers</span>
                  <ArrowRight className="w-4 h-4 text-amber-400" />
                </button>
              </form>
            </section>

            {/* Right: Verified Workers Nearby + Map Toggle */}
            <section className="lg:col-span-7 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-extrabold text-[#14171A]">
                    {lang === 'kn' ? 'ಹತ್ತಿರದ ಪರಿಶೀಲಿಸಿದ ಕೆಲಸಗಾರರು' : 'Available Workers Within 5 km'}
                  </h2>
                  <p className="text-xs text-stone-500">Tap “5s Intro” to hear the worker’s voice profile.</p>
                </div>

                <div className="flex items-center bg-stone-200/80 p-1 rounded-xl text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => setEmployerView('list')}
                    className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                      employerView === 'list' ? 'bg-white text-[#14171A] shadow-xs' : 'text-stone-600'
                    }`}
                  >
                    Workers ({workers.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setEmployerView('map')}
                    className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                      employerView === 'map' ? 'bg-white text-[#14171A] shadow-xs' : 'text-stone-600'
                    }`}
                  >
                    Map
                  </button>
                </div>
              </div>

              {employerView === 'map' ? (
                <TumakuruRadar
                  mode="workers"
                  workers={workers}
                  lang={lang}
                  radiusKm={radiusKm}
                  onRadiusChange={setRadiusKm}
                  onSelectWorkerCall={handleInviteWorker}
                  heightClass="h-[380px]"
                />
              ) : (
                <div className="space-y-3">
                  {workers.map((w) => {
                    const isPlaying = playingId === w.id;
                    const isInvited = invitedWorkerIds.includes(w.id);
                    const introText = lang === 'kn' ? w.audioNoteKannada : w.audioNote;

                    return (
                      <article
                        key={w.id}
                        className="bg-white rounded-2xl p-5 border border-stone-200/90 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                      >
                        <div className="space-y-1.5">
                          <div className="flex flex-wrap items-center gap-2 text-xs">
                            <span className="text-base font-extrabold text-[#14171A]">
                              {lang === 'kn'
                                ? w.nameKannada
                                : lang === 'hi'
                                ? localizeDisplayName(w.nameKannada || w.name, 'hi')
                                : w.name}
                            </span>
                            <span className="inline-flex items-center gap-0.5 font-bold text-[#14171A]">
                              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                              {w.rating}
                            </span>
                            <span className="text-stone-500">· {w.gigsCompleted} local gigs</span>
                          </div>

                          <p className="text-xs font-bold text-[#EA580C]">
                            {lang === 'kn' ? w.skillKannada : lang === 'hi' ? w.skillHindi : w.skillEnglish} · {w.location} ({w.distanceKm} km)
                          </p>
                          <p className="text-xs text-stone-600 italic">“{introText}”</p>
                        </div>

                        <div className="flex items-center justify-between sm:justify-end gap-2.5 shrink-0">
                          <div className="text-left sm:text-right mr-1">
                            <span className="text-base font-extrabold text-[#059669] tabular-nums">
                              ₹{w.wageExpected}
                            </span>
                            <span className="block text-[10px] text-stone-500">/day</span>
                          </div>

                          <button
                            type="button"
                            onClick={() => handlePlayAudio(w.id, introText)}
                            className={`min-h-[42px] px-3 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition cursor-pointer ${
                              isPlaying
                                ? 'bg-amber-100 text-[#EA580C]'
                                : 'bg-stone-100 hover:bg-stone-200 text-stone-800'
                            }`}
                          >
                            {isPlaying ? <Square className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                            <span>{isPlaying ? 'Playing' : '5s Intro'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleInviteWorker(w)}
                            className={`min-h-[42px] px-4 rounded-xl text-xs font-extrabold inline-flex items-center gap-1.5 transition cursor-pointer ${
                              isInvited
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-[#14171A] hover:bg-stone-800 text-white'
                            }`}
                          >
                            {isInvited ? <Check className="w-3.5 h-3.5" /> : <PhoneCall className="w-3.5 h-3.5 text-amber-400" />}
                            <span>{isInvited ? 'Invited' : 'Call / Hire'}</span>
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        )}
      </main>

      {/* Quiet Production Footer with Architecture Spec Link */}
      <footer className="border-t border-stone-200 bg-white py-5 px-4 sm:px-6 mb-16 md:mb-0">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-stone-500">
          <p>
            <strong className="text-[#14171A]">{brand.full}</strong> · Hyper-Local Direct Work Network (5–10 km) · Zero-commission direct work
          </p>
          <button
            type="button"
            onClick={() => setIsArchOpen(true)}
            className="text-xs font-semibold text-stone-600 hover:text-[#14171A] inline-flex items-center gap-1.5 underline underline-offset-4 cursor-pointer"
          >
            <Cpu className="w-3.5 h-3.5 text-[#2563EB]" />
            <span>Platform Architecture</span>
          </button>
        </div>
      </footer>

      {/* Mobile Bottom Tab Bar (Thumb-zone navigation, compact height) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-md border-t border-stone-200 grid grid-cols-4 h-16">
        <button
          type="button"
          onClick={() => {
            setShowAccountPanel(false);
            setRole('worker');
            setWorkerSection('discover');
            setMobileDisplay('list');
          }}
          className={`flex flex-col items-center justify-center gap-0.5 text-[10px] font-bold ${
            !showAccountPanel && role === 'worker' && workerSection === 'discover' && mobileDisplay === 'list'
              ? 'text-[#EA580C]'
              : 'text-stone-500'
          }`}
        >
          <Briefcase className="w-5 h-5" />
          <span>Jobs</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setShowAccountPanel(false);
            setRole('worker');
            setWorkerSection('discover');
            setMobileDisplay('map');
          }}
          className={`flex flex-col items-center justify-center gap-0.5 text-[10px] font-bold ${
            !showAccountPanel && role === 'worker' && mobileDisplay === 'map' ? 'text-[#EA580C]' : 'text-stone-500'
          }`}
        >
          <Navigation className="w-5 h-5" />
          <span>Map</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setShowAccountPanel(false);
            setRole('worker');
            setWorkerSection('shifts');
          }}
          className={`flex flex-col items-center justify-center gap-0.5 text-[10px] font-bold ${
            !showAccountPanel && role === 'worker' && workerSection === 'shifts' ? 'text-[#EA580C]' : 'text-stone-500'
          }`}
        >
          <Wallet className="w-5 h-5" />
          <span>Shifts ({myShifts.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setShowAccountPanel(true)}
          className={`flex flex-col items-center justify-center gap-0.5 text-[10px] font-bold ${
            showAccountPanel
              ? currentUser?.role === 'employer' || role === 'employer'
                ? 'text-[#2563EB]'
                : 'text-[#EA580C]'
              : 'text-stone-500'
          }`}
        >
          <User className="w-5 h-5" />
          <span>{lang === 'kn' ? 'ಖಾತೆ' : 'Account'}</span>
        </button>
      </nav>

      {/* Desktop Floating Voice Assistant Trigger */}
      <div className="hidden md:block fixed bottom-6 right-6 z-30">
        <motion.button
          type="button"
          whileTap={{ scale: 0.95 }}
          onClick={startElevenLabsVoice}
          className="flex items-center gap-2.5 bg-[#14171A] hover:bg-stone-800 text-white pl-3 pr-5 py-2.5 rounded-full shadow-xl border border-stone-700 cursor-pointer transition"
        >
          <span className="w-9 h-9 rounded-full bg-gradient-to-br from-[#F59E0B] to-[#EA580C] flex items-center justify-center text-white">
            <Mic className="w-4 h-4" />
          </span>
          <span className="text-xs font-extrabold whitespace-nowrap">
            {role === 'worker'
              ? lang === 'kn'
                ? 'ಧ್ವನಿ ಸಹಾಯಕ'
                : 'Voice Search'
              : lang === 'kn'
              ? 'ಧ್ವನಿ ಪೋಸ್ಟ್'
              : 'Voice Post'}
          </span>
        </motion.button>
      </div>

      {/* Confirmation Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 18 }}
            className="fixed bottom-20 right-4 left-4 sm:left-auto sm:w-96 z-50 bg-[#14171A] text-white p-4 rounded-2xl shadow-2xl border border-emerald-500/40 flex items-start gap-3"
          >
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-extrabold text-emerald-400">{toast.title}</p>
              <p className="text-xs text-stone-300 mt-0.5">{toast.detail}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Onboarding & Account Modal */}
      <OnboardingModal
        isOpen={isOnboardingOpen}
        lang={lang}
        currentUser={currentUser}
        sarvamConfigured={sarvamConfigured}
        onClose={() => setIsOnboardingOpen(false)}
        onSaveUser={handleSaveManualUser}
        onExistingUserLogin={handleExistingUserLogin}
        onSignOut={handleSignOutUser}
      />

      {/* Shift Accept & Direct Owner Connect Sheet */}
      <JobConnectModal
        job={modalJob}
        lang={lang}
        isAlreadyApplied={Boolean(modalJob && myShifts.some((s) => s.job.id === modalJob.id))}
        onClose={() => setModalJob(null)}
        onConfirmShift={handleConfirmShift}
      />

      {/* Live Voice Assistant Sheet */}
      <ElevenLabsVoiceSheet
        isOpen={isVoiceSheetOpen}
        status={voiceSheetStatus}
        sarvamConfigured={sarvamConfigured}
        micBlocked={voiceMicBlocked}
        lang={lang}
        errorMsg={voiceError}
        transcripts={transcripts}
        onClose={handleCloseVoiceSheet}
        onStartVoice={startSarvamVoiceCapture}
        onStopVoice={stopSarvamVoiceCapture}
        onSendText={(text) => {
          handleVoiceCommandText(text);
        }}
      />

      {/* Architecture Slide-Over Drawer */}
      <AnimatePresence>
        {isArchOpen && (
          <div className="fixed inset-0 z-50 flex justify-end bg-black/55 backdrop-blur-sm">
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 280 }}
              className="bg-white w-full max-w-md h-full p-6 shadow-2xl flex flex-col justify-between overflow-y-auto"
            >
              <div className="space-y-6">
                <div className="flex items-center justify-between border-b border-stone-200 pb-4">
                  <div className="flex items-center gap-2.5">
                    <Cpu className="w-5 h-5 text-[#2563EB]" />
                    <h3 className="text-base font-extrabold text-[#14171A]">Platform Architecture</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsArchOpen(false)}
                    className="p-2 text-stone-400 hover:text-[#14171A]"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-3 text-xs text-stone-700">
                  <p className="font-bold text-[#14171A]">End-to-End Live Pipeline</p>
                  <div className="bg-[#FAF8F5] p-4 rounded-2xl border border-stone-200 space-y-2 font-mono text-[11px]">
                    <p>1. Multilingual Voice Recognition (Kannada, Hindi, English)</p>
                    <p>2. Natural Neural Voice Response & Confirmation</p>
                    <p>3. Cloud Database + Realtime Sync (users & jobs)</p>
                    <p>4. Interactive Geo-Radius Matching (5 km / 10 km)</p>
                  </div>
                </div>

                <div className="space-y-3 text-xs">
                  <p className="font-bold text-[#14171A] flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-[#EA580C]" />
                    Live Service Status
                  </p>
                  <div className="bg-[#FAF8F5] p-4 rounded-2xl border border-stone-200 space-y-2">
                    <div className="flex justify-between">
                      <span className="font-mono text-stone-600">HD Voice Engine</span>
                      <span className={`font-bold ${sarvamConfigured ? 'text-[#059669]' : 'text-stone-500'}`}>
                        {sarvamConfigured ? 'Connected' : 'Standard Mode'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-mono text-stone-600">Realtime Database</span>
                      <span className="font-bold text-[#059669]">
                        {isSupabaseReady() ? 'Connected' : 'Local Fallback'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsArchOpen(false)}
                className="w-full mt-6 bg-[#14171A] hover:bg-stone-800 text-white font-extrabold text-sm py-3.5 rounded-2xl transition min-h-[48px] cursor-pointer"
              >
                Close
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
