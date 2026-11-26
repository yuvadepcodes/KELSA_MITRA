import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PhoneCall, Mic, Volume2, VolumeX, Building2, MapPin,
  CheckCircle2, Cpu, Layers, X, Navigation, Briefcase,
  ShieldCheck, Footprints, Bus, Play, Square, ArrowRight,
  Clock, Wallet, SlidersHorizontal, Star, Search, Check
} from 'lucide-react';
import confetti from 'canvas-confetti';
import TumakuruRadar from './components/TumakuruRadar';
import JobConnectModal from './components/JobConnectModal';
import {
  Job,
  Worker,
  ShiftApplication,
  PayoutRecord,
  TUMAKURU_LOCALITIES,
  INITIAL_TUMAKURU_JOBS,
  INITIAL_TUMAKURU_WORKERS,
  INITIAL_PAYOUT_HISTORY,
  isLiveDatabaseConfigured,
  fetchNearbyJobs,
  fetchWorkersFromSupabase,
  createJobInSupabase,
  submitShiftApplication,
} from './services/jobService';
import {
  SupportedLang,
  VoiceExtractionResult,
  isLiveVoiceConfigured,
  transcribeAndExtractWorkerIntent,
  transcribeEmployerJobPost,
  speakTextWithBrowserFallback,
  stopBrowserSpeech,
} from './services/voiceService';

type WorkerSection = 'discover' | 'shifts';

export default function App() {
  const [lang, setLang] = useState<SupportedLang>('kn');
  const [role, setRole] = useState<'worker' | 'employer'>('worker');
  const [workerSection, setWorkerSection] = useState<WorkerSection>('discover');
  const [mobileDisplay, setMobileDisplay] = useState<'list' | 'map'>('list');

  // Worker Daily Duty & Filters
  const [onDutyToday, setOnDutyToday] = useState(true);
  const [selectedLocality, setSelectedLocality] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [sortBy, setSortBy] = useState<'nearest' | 'highest' | 'immediate'>('nearest');
  const [searchQuery, setSearchQuery] = useState('');
  const [radiusKm, setRadiusKm] = useState<5 | 10>(5);

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

  // Voice Assistant Bottom Sheet
  const [isVoiceOpen, setIsVoiceOpen] = useState(false);
  const [voicePhase, setVoicePhase] = useState<'listening' | 'processing' | 'matched'>('listening');
  const [voiceResult, setVoiceResult] = useState<VoiceExtractionResult | null>(null);
  const [isTtsPlaying, setIsTtsPlaying] = useState(false);

  // Employer Form & View
  const [employerView, setEmployerView] = useState<'list' | 'map'>('list');
  const [employerDraft, setEmployerDraft] = useState('');
  const [employerWage, setEmployerWage] = useState(700);
  const [employerHeadcount, setEmployerHeadcount] = useState(2);
  const [employerArea, setEmployerArea] = useState('B.H. Road, Tumakuru');
  const [employerPhone, setEmployerPhone] = useState('+91 98450 55443');
  const [isEmployerListening, setIsEmployerListening] = useState(false);
  const [employerParsedPreview, setEmployerParsedPreview] = useState(false);

  // Toast & Technical Spec Drawer
  const [toast, setToast] = useState<{ title: string; detail: string } | null>(null);
  const [isArchOpen, setIsArchOpen] = useState(false);

  useEffect(() => {
    if (isLiveDatabaseConfigured()) {
      fetchNearbyJobs(radiusKm).then((loaded) => {
        if (loaded.length > 0) {
          setJobs(loaded);
          setSelectedJobId(loaded[0].id);
        }
      });
      fetchWorkersFromSupabase().then((loadedWorkers) => {
        if (loadedWorkers.length > 0) {
          setWorkers(loadedWorkers);
        }
      });
    }
    return () => stopBrowserSpeech();
  }, [radiusKm]);

  const showToast = (title: string, detail: string) => {
    setToast({ title, detail });
    setTimeout(() => setToast(null), 4000);
  };

  const handlePlayAudio = (id: string, text: string) => {
    if (playingId === id) {
      stopBrowserSpeech();
      setPlayingId(null);
      return;
    }
    setPlayingId(id);
    speakTextWithBrowserFallback(text, lang);
    setTimeout(() => {
      setPlayingId((curr) => (curr === id ? null : curr));
    }, 4500);
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

  const handleOpenVoiceAssistant = async () => {
    setIsVoiceOpen(true);
    setVoicePhase('listening');
    setVoiceResult(null);
    setIsTtsPlaying(false);

    setTimeout(async () => {
      setVoicePhase('processing');
      const result = await transcribeAndExtractWorkerIntent(null, lang);
      setTimeout(() => {
        setVoiceResult(result);
        setVoicePhase('matched');
        setIsTtsPlaying(true);
        speakTextWithBrowserFallback(result.ttsReply, lang);
        setTimeout(() => setIsTtsPlaying(false), 4000);
      }, 950);
    }, 1600);
  };

  const handleApplyVoiceFilters = () => {
    stopBrowserSpeech();
    setIsVoiceOpen(false);
    setSelectedLocality('Kyathsandra');
    setSelectedCategory('Construction');
    setRole('worker');
    setWorkerSection('discover');
    showToast(
      lang === 'kn' ? 'ಧ್ವನಿ ಹುಡುಕಾಟ ಅನ್ವಯಿಸಲಾಗಿದೆ' : 'Voice Filter Applied',
      'Showing Mason Helper jobs near Kyathsandra'
    );
  };

  const handleSimulateEmployerVoice = async () => {
    setIsEmployerListening(true);
    setEmployerParsedPreview(false);
    setTimeout(async () => {
      const res = await transcribeEmployerJobPost(lang);
      setEmployerDraft(res.transcript);
      setEmployerWage(res.entities.minWage);
      setEmployerHeadcount(res.entities.headcount ?? 2);
      setEmployerArea(res.entities.area);
      setIsEmployerListening(false);
      setEmployerParsedPreview(true);
    }, 1500);
  };

  const handleBroadcastJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employerDraft.trim()) return;

    const savedJob = await createJobInSupabase({
      titleKannada: employerDraft,
      titleHindi: employerDraft,
      titleEnglish: `${employerDraft} (${employerHeadcount} needed)`,
      category: 'Retail Shop',
      wage: Number(employerWage),
      wageUnit: '/day',
      shiftTime: 'Today · 2:00 PM – 7:00 PM',
      slotsLeft: employerHeadcount,
      location: employerArea,
      areaTag: employerArea.split(',')[0],
      distanceKm: 1.1,
      commuteNote: '10 min walk',
      pincode: '572101',
      employer: 'Tumakuru Local Enterprise',
      ownerName: 'Business Owner',
      verifiedEmployer: true,
      phone: employerPhone,
      urgency: 'Immediate',
      paymentMode: 'Evening UPI',
      description: `Immediate requirement for ${employerHeadcount} workers in ${employerArea}.`,
      descriptionKannada: `${employerArea} ಬಳಿ ${employerHeadcount} ಜನ ಕೆಲಸಗಾರರು ತಕ್ಷಣ ಬೇಕಾಗಿದ್ದಾರೆ. ದಿನಕ್ಕೆ ₹${employerWage}.`,
      latLng: employerArea.includes('Kyathsandra')
        ? [13.3106, 77.1636]
        : employerArea.includes('APMC')
        ? [13.3568, 77.0842]
        : employerArea.includes('Vasanthnarasapura')
        ? [13.4285, 77.0882]
        : employerArea.includes('Chickpet')
        ? [13.338, 77.1105]
        : [13.3415, 77.1062],
    });

    setJobs((prev) => [savedJob, ...prev]);
    setSelectedJobId(savedJob.id);
    setEmployerDraft('');
    setEmployerParsedPreview(false);
    confetti({ particleCount: 65, spread: 80, origin: { y: 0.7 } });
    showToast(
      lang === 'kn' ? 'ಕೆಲಸ ಪ್ರಕಟಿಸಲಾಗಿದೆ' : 'Opening Published Live',
      `Sent IVR & SMS alert to 18 nearby workers in ${employerArea}.`
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
      const withinRadius = job.distanceKm <= radiusKm;
      const matchesCat = selectedCategory === 'All' || job.category === selectedCategory;
      const matchesLoc = selectedLocality === 'all' || job.areaTag === selectedLocality;
      const q = searchQuery.trim().toLowerCase();
      const matchesQuery =
        !q ||
        job.titleEnglish.toLowerCase().includes(q) ||
        job.titleKannada.toLowerCase().includes(q) ||
        job.location.toLowerCase().includes(q) ||
        job.employer.toLowerCase().includes(q);
      return withinRadius && matchesCat && matchesLoc && matchesQuery;
    })
    .sort((a, b) => {
      if (sortBy === 'highest') return b.wage - a.wage;
      if (sortBy === 'immediate') return a.urgency === 'Immediate' ? -1 : 1;
      return a.distanceKm - b.distanceKm;
    });

  const weeklyEarningsTotal = payouts.reduce((acc, p) => acc + p.amount, 0);

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-[#14171A] flex flex-col">
      {/* ================= CLEAN 3-ZONE TOP APP BAR ================= */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-stone-200/90">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          {/* Zone 1: KELSAಮಿತ್ರ Brand Wordmark */}
          <a
            href="#top"
            className="text-xl font-extrabold tracking-tight text-[#14171A] whitespace-nowrap shrink-0 inline-flex items-baseline"
          >
            <span>KELSA</span>
            <span className="text-[#EA580C] font-['Noto_Sans_Kannada',sans-serif] ml-0.5">ಮಿತ್ರ</span>
          </a>

          {/* Zone 2: Primary App Navigation (Desktop) */}
          <nav className="hidden md:flex items-center gap-7 text-sm font-semibold text-stone-600">
            <button
              type="button"
              onClick={() => {
                setRole('worker');
                setWorkerSection('discover');
              }}
              className={`py-1 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                role === 'worker' && workerSection === 'discover'
                  ? 'border-[#EA580C] text-[#14171A] font-bold'
                  : 'border-transparent hover:text-[#14171A]'
              }`}
            >
              {lang === 'kn' ? 'ಕೆಲಸ ಹುಡುಕಿ' : lang === 'hi' ? 'काम खोजें' : 'Find Work'}
            </button>
            <button
              type="button"
              onClick={() => {
                setRole('worker');
                setWorkerSection('shifts');
              }}
              className={`py-1 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                role === 'worker' && workerSection === 'shifts'
                  ? 'border-[#EA580C] text-[#14171A] font-bold'
                  : 'border-transparent hover:text-[#14171A]'
              }`}
            >
              {lang === 'kn'
                ? `ನನ್ನ ಶಿಫ್ಟ್‌ಗಳು (${myShifts.length})`
                : `My Shifts (${myShifts.length})`}
            </button>
            <button
              type="button"
              onClick={() => setRole('employer')}
              className={`py-1 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                role === 'employer'
                  ? 'border-[#2563EB] text-[#14171A] font-bold'
                  : 'border-transparent hover:text-[#14171A]'
              }`}
            >
              {lang === 'kn' ? 'ಕೆಲಸಗಾರರನ್ನು ನೇಮಿಸಿ' : lang === 'hi' ? 'कामगार रखें' : 'Hire Staff'}
            </button>
          </nav>

          {/* Zone 3: Locality Selector + Language Switcher */}
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="hidden sm:flex items-center gap-1.5 text-xs font-semibold text-stone-700 bg-stone-100 px-2.5 py-1.5 rounded-xl border border-stone-200/80">
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
        {/* ================= WORKER MODE ================= */}
        {role === 'worker' && workerSection === 'discover' && (
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
                      {onDutyToday ? 'Receiving Tumakuru owner calls' : 'Tap to receive local shift alerts'}
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
                        ? 'ಕೆಲಸ ಅಥವಾ ಏರಿಯಾ ಹುಡುಕಿ (ಉದಾ: ಗೌಂಡಿ, ಕ್ಯಾತ್ಸಂದ್ರ)...'
                        : 'Search trade or Tumakuru area (e.g., Mason, APMC)...'
                    }
                    className="w-full min-h-[44px] pl-10 pr-4 bg-[#FAF8F5] border border-stone-200 rounded-xl text-sm font-medium placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white transition"
                  />
                </div>
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.95 }}
                  onClick={handleOpenVoiceAssistant}
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
                      Expand your radius to 10 km or clear the trade filter to see all Tumakuru openings.
                    </p>
                    <div className="flex justify-center gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          setRadiusKm(10);
                          setSelectedCategory('All');
                          setSelectedLocality('all');
                          setSearchQuery('');
                        }}
                        className="px-4 py-2.5 rounded-xl bg-[#14171A] text-white text-xs font-bold cursor-pointer"
                      >
                        Show All Tumakuru Jobs (10 km)
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
        {role === 'worker' && workerSection === 'shifts' && (
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
                {payouts.map((p) => (
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
                ))}
              </div>
            </section>
          </div>
        )}

        {/* ================= EMPLOYER MODE ================= */}
        {role === 'employer' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left: 15-Second Voice Job Poster */}
            <section className="lg:col-span-5 bg-white rounded-3xl p-6 border border-stone-200/90 shadow-xs space-y-5">
              <div>
                <h2 className="text-lg font-extrabold text-[#14171A]">
                  {lang === 'kn' ? '15 ಸೆಕೆಂಡಿನಲ್ಲಿ ಕೆಲಸಗಾರರನ್ನು ಕರೆಯಿರಿ' : 'Hire Local Help in 15 Seconds'}
                </h2>
                <p className="text-xs text-stone-500 mt-1">
                  Speak in Kannada or pick a quick template to alert verified Tumakuru workers within 5 km.
                </p>
              </div>

              <motion.button
                type="button"
                whileTap={{ scale: 0.97 }}
                onClick={handleSimulateEmployerVoice}
                className="w-full min-h-[48px] bg-[#F59E0B] hover:bg-[#EA580C] hover:text-white text-[#14171A] font-extrabold text-sm rounded-2xl shadow-xs flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <Mic className={`w-4 h-4 ${isEmployerListening ? 'animate-bounce' : ''}`} />
                <span>
                  {isEmployerListening
                    ? 'Listening to your requirement...'
                    : lang === 'kn'
                    ? 'ಮಾತನಾಡಿ ಕೆಲಸ ಪ್ರಕಟಿಸಿ'
                    : 'Speak Job Requirement'}
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
                              {lang === 'kn' ? w.nameKannada : w.name}
                            </span>
                            <span className="inline-flex items-center gap-0.5 font-bold text-[#14171A]">
                              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                              {w.rating}
                            </span>
                            <span className="text-stone-500">· {w.gigsCompleted} local gigs</span>
                          </div>

                          <p className="text-xs font-bold text-[#EA580C]">
                            {lang === 'kn' ? w.skillKannada : w.skillEnglish} · {w.location} ({w.distanceKm} km)
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
            <strong className="text-[#14171A]">KELSAಮಿತ್ರ</strong> · Tumakuru Town & Industrial Belt (5–10 km) · Zero-commission direct work network
          </p>
          <button
            type="button"
            onClick={() => setIsArchOpen(true)}
            className="text-xs font-semibold text-stone-600 hover:text-[#14171A] inline-flex items-center gap-1.5 underline underline-offset-4 cursor-pointer"
          >
            <Cpu className="w-3.5 h-3.5 text-[#2563EB]" />
            <span>Voice & Geo API Architecture</span>
          </button>
        </div>
      </footer>

      {/* Mobile Bottom Tab Bar (Thumb-zone navigation, compact height) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-md border-t border-stone-200 grid grid-cols-4 h-16">
        <button
          type="button"
          onClick={() => {
            setRole('worker');
            setWorkerSection('discover');
            setMobileDisplay('list');
          }}
          className={`flex flex-col items-center justify-center gap-0.5 text-[10px] font-bold ${
            role === 'worker' && workerSection === 'discover' && mobileDisplay === 'list'
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
            setRole('worker');
            setWorkerSection('discover');
            setMobileDisplay('map');
          }}
          className={`flex flex-col items-center justify-center gap-0.5 text-[10px] font-bold ${
            role === 'worker' && mobileDisplay === 'map' ? 'text-[#EA580C]' : 'text-stone-500'
          }`}
        >
          <Navigation className="w-5 h-5" />
          <span>Map</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setRole('worker');
            setWorkerSection('shifts');
          }}
          className={`flex flex-col items-center justify-center gap-0.5 text-[10px] font-bold ${
            role === 'worker' && workerSection === 'shifts' ? 'text-[#EA580C]' : 'text-stone-500'
          }`}
        >
          <Wallet className="w-5 h-5" />
          <span>Shifts ({myShifts.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setRole('employer')}
          className={`flex flex-col items-center justify-center gap-0.5 text-[10px] font-bold ${
            role === 'employer' ? 'text-[#2563EB]' : 'text-stone-500'
          }`}
        >
          <Building2 className="w-5 h-5" />
          <span>Hire</span>
        </button>
      </nav>

      {/* Desktop Floating Voice Assistant Trigger */}
      <div className="hidden md:block fixed bottom-6 right-6 z-30">
        <motion.button
          type="button"
          whileTap={{ scale: 0.95 }}
          onClick={role === 'worker' ? handleOpenVoiceAssistant : handleSimulateEmployerVoice}
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

      {/* Shift Accept & Direct Owner Connect Sheet */}
      <JobConnectModal
        job={modalJob}
        lang={lang}
        isAlreadyApplied={Boolean(modalJob && myShifts.some((s) => s.job.id === modalJob.id))}
        onClose={() => setModalJob(null)}
        onConfirmShift={handleConfirmShift}
      />

      {/* Voice Assistant Bottom Sheet */}
      <AnimatePresence>
        {isVoiceOpen && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/55 backdrop-blur-sm p-0 sm:p-4">
            <motion.div
              initial={{ y: '100%', opacity: 0.6 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: '100%', opacity: 0 }}
              transition={{ type: 'spring', damping: 28, stiffness: 320 }}
              className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl border border-stone-200"
            >
              <div className="w-10 h-1.5 bg-stone-300 rounded-full mx-auto mb-4 sm:hidden" />

              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-base font-extrabold text-[#14171A]">
                    {voicePhase === 'listening' && (lang === 'kn' ? 'ಕೇಳಿಸಿಕೊಳ್ಳುತ್ತಿದೆ...' : 'Listening...')}
                    {voicePhase === 'processing' && 'Understanding Trade & Location...'}
                    {voicePhase === 'matched' && (lang === 'kn' ? 'ಹೊಂದಾಣಿಕೆ ಸಿಕ್ಕಿದೆ!' : '3 Matching Shifts Found')}
                  </h3>
                  <p className="text-xs text-stone-500">Speak naturally in Kannada, Hindi, or English</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    stopBrowserSpeech();
                    setIsVoiceOpen(false);
                  }}
                  className="p-2 text-stone-400 hover:text-[#14171A]"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {voicePhase === 'listening' && (
                <div className="my-8 flex items-center justify-center gap-1.5 h-14">
                  {[35, 70, 95, 55, 85, 45, 90, 65, 40, 80].map((val, i) => (
                    <motion.div
                      key={i}
                      animate={{ height: [`${val}%`, `${100 - val}%`, `${val}%`] }}
                      transition={{ repeat: Infinity, duration: 0.75, delay: i * 0.08 }}
                      className="w-2 rounded-full bg-[#EA580C]"
                    />
                  ))}
                </div>
              )}

              {voicePhase !== 'listening' && voiceResult && (
                <div className="space-y-3.5 my-4">
                  <div className="bg-[#FAF8F5] border border-stone-200 rounded-2xl p-4">
                    <p className="text-xs font-bold text-[#EA580C] mb-1">Transcript</p>
                    <p className="text-sm font-bold text-[#14171A]">“{voiceResult.transcript}”</p>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5 text-xs">
                    <div className="bg-[#FAF8F5] p-3 rounded-xl border border-stone-200">
                      <span className="text-stone-500 block text-[11px]">Skill</span>
                      <strong className="text-[#14171A]">{voiceResult.entities.skill}</strong>
                    </div>
                    <div className="bg-[#FAF8F5] p-3 rounded-xl border border-stone-200">
                      <span className="text-stone-500 block text-[11px]">Locality</span>
                      <strong className="text-[#14171A]">
                        {voiceResult.entities.area} ({voiceResult.entities.radiusKm} km)
                      </strong>
                    </div>
                    <div className="bg-[#FAF8F5] p-3 rounded-xl border border-stone-200">
                      <span className="text-stone-500 block text-[11px]">Min Pay</span>
                      <strong className="text-[#059669] tabular-nums">₹{voiceResult.entities.minWage}/day</strong>
                    </div>
                    <div className="bg-[#FAF8F5] p-3 rounded-xl border border-stone-200">
                      <span className="text-stone-500 block text-[11px]">Timing</span>
                      <strong className="text-[#14171A]">{voiceResult.entities.timing}</strong>
                    </div>
                  </div>

                  <div className="bg-[#14171A] text-white rounded-2xl p-3.5 flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        if (isTtsPlaying) {
                          stopBrowserSpeech();
                          setIsTtsPlaying(false);
                        } else {
                          setIsTtsPlaying(true);
                          speakTextWithBrowserFallback(voiceResult.ttsReply, lang);
                        }
                      }}
                      className="w-9 h-9 rounded-xl bg-[#F59E0B] text-[#14171A] flex items-center justify-center shrink-0 cursor-pointer"
                    >
                      {isTtsPlaying ? <Square className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    </button>
                    <p className="text-xs text-stone-200 line-clamp-2">{voiceResult.ttsReply}</p>
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={voicePhase === 'matched' ? handleApplyVoiceFilters : () => setIsVoiceOpen(false)}
                className="w-full mt-2 bg-[#14171A] hover:bg-stone-800 text-white font-extrabold text-sm py-3.5 rounded-2xl transition min-h-[48px] cursor-pointer"
              >
                {voicePhase === 'matched'
                  ? lang === 'kn'
                    ? 'ಹೊಂದಾಣಿಕೆಯಾದ ಕೆಲಸಗಳನ್ನು ತೋರಿಸಿ'
                    : 'Filter Matching Shifts'
                  : 'Cancel'}
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Architecture & API Slide-Over Drawer */}
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
                    <h3 className="text-base font-extrabold text-[#14171A]">Voice & Geo API Architecture</h3>
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
                  <p className="font-bold text-[#14171A]">End-to-End Pipeline</p>
                  <div className="bg-[#FAF8F5] p-4 rounded-2xl border border-stone-200 space-y-2 font-mono text-[11px]">
                    <p>1. Browser Mic (WebAudio API)</p>
                    <p>2. Sarvam AI saaras:v4 (Kannada / Hindi STT)</p>
                    <p>3. Intent & Entity Extractor (Skill, Wage, Locality)</p>
                    <p>4. PostGIS + Leaflet / OpenStreetMap Radius Match</p>
                    <p>5. Sarvam AI bulbul:v4-flash (Regional Voice Reply)</p>
                  </div>
                </div>

                <div className="space-y-3 text-xs">
                  <p className="font-bold text-[#14171A] flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-[#EA580C]" />
                    Environment Integration Hooks
                  </p>
                  <div className="bg-[#FAF8F5] p-4 rounded-2xl border border-stone-200 space-y-2">
                    <div className="flex justify-between">
                      <span className="font-mono text-stone-600">VITE_SARVAM_API_KEY</span>
                      <span className="font-bold text-amber-700">
                        {isLiveVoiceConfigured() ? 'Connected' : 'Simulated Fallback'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-mono text-stone-600">VITE_SUPABASE_URL</span>
                      <span className="font-bold text-amber-700">
                        {isLiveDatabaseConfigured() ? 'Connected' : 'Local Seed State'}
                      </span>
                    </div>
                  </div>
                  <p className="text-[11px] text-stone-500 leading-relaxed">
                    Isolated in <code className="bg-stone-100 px-1 rounded">src/services/voiceService.ts</code> and{' '}
                    <code className="bg-stone-100 px-1 rounded">src/services/jobService.ts</code>.
                  </p>
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
