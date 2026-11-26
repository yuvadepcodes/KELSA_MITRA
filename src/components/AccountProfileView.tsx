import React, { useState, useEffect } from 'react';
import {
  User,
  ShieldCheck,
  Briefcase,
  Building2,
  Phone,
  MapPin,
  Star,
  Mic,
  CheckCircle2,
  ArrowRight,
  Wallet,
  Clock,
  Save,
  LogOut,
} from 'lucide-react';
import { SupportedLang } from '../services/voiceService';
import { UserAccount } from '../services/supabaseService';
import { Job, ShiftApplication } from '../services/jobService';
import { getBrandParts, localizeDisplayName } from '../utils/transliterate';

interface AccountProfileViewProps {
  lang: SupportedLang;
  currentUser: UserAccount | null;
  activeRole: 'worker' | 'employer';
  myShifts: ShiftApplication[];
  postedJobsCount: number;
  invitedWorkersCount: number;
  weeklyEarningsTotal: number;
  onSaveAccount: (params: {
    name: string;
    phone: string;
    role: 'worker' | 'employer';
    area: string;
    tradeOrBusiness: string;
    jobsCompleted: number;
    experience: string;
    expectedWage: number;
    paymentPreference: string;
  }) => Promise<void>;
  onVoiceUpdate: () => void;
  onNavigateWorkspace: (targetRole: 'worker' | 'employer') => void;
  onSwitchAccount: () => void;
  recentJobs: Job[];
}

export default function AccountProfileView({
  lang,
  currentUser,
  activeRole,
  myShifts,
  postedJobsCount,
  invitedWorkersCount,
  weeklyEarningsTotal,
  onSaveAccount,
  onVoiceUpdate,
  onNavigateWorkspace,
  onSwitchAccount,
  recentJobs,
}: AccountProfileViewProps) {
  const [role, setRole] = useState<'worker' | 'employer'>(currentUser?.role || activeRole);
  const [name, setName] = useState(currentUser?.name || '');
  const [phone, setPhone] = useState(currentUser?.phone || '');
  const [area, setArea] = useState(currentUser?.area || 'B.H. Road');
  const [tradeOrBusiness, setTradeOrBusiness] = useState(
    currentUser?.tradeOrBusiness || ''
  );
  const [jobsCompleted, setJobsCompleted] = useState<number>(
    currentUser?.jobsCompleted ?? (activeRole === 'employer' ? postedJobsCount : 0)
  );
  const [experience, setExperience] = useState(currentUser?.experience || 'New');
  const [expectedWage, setExpectedWage] = useState<number>(currentUser?.expectedWage ?? 700);
  const [paymentPreference, setPaymentPreference] = useState(
    currentUser?.paymentPreference || 'Evening UPI'
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [savedNotice, setSavedNotice] = useState(false);
  const [nameEdited, setNameEdited] = useState(false);
  const [tradeEdited, setTradeEdited] = useState(false);

  const brand = getBrandParts(lang);

  useEffect(() => {
    setNameEdited(false);
    setTradeEdited(false);
    if (currentUser) {
      setRole(currentUser.role);
      setName(localizeDisplayName(currentUser.name, lang));
      setPhone(currentUser.phone);
      setArea((currentUser.area || 'B.H. Road').replace(/,\s*Tumakuru/gi, '').trim());
      setTradeOrBusiness(
        currentUser.tradeOrBusiness ? localizeDisplayName(currentUser.tradeOrBusiness, lang) : ''
      );
      setJobsCompleted(
        currentUser.jobsCompleted !== undefined
          ? currentUser.jobsCompleted
          : currentUser.role === 'employer'
          ? postedJobsCount
          : 0
      );
      setExperience(currentUser.experience || (currentUser.jobsCompleted ? '2+ years' : 'New'));
      setExpectedWage(currentUser.expectedWage ?? 700);
      setPaymentPreference(currentUser.paymentPreference || 'Evening UPI');
    } else {
      setRole(activeRole);
      setName('');
      setPhone('');
      setArea('B.H. Road');
      setTradeOrBusiness('');
      setJobsCompleted(0);
      setExperience('New');
      setExpectedWage(700);
      setPaymentPreference('Evening UPI');
    }
  }, [currentUser, activeRole, postedJobsCount]);

  useEffect(() => {
    if (currentUser) {
      if (!nameEdited) {
        setName(localizeDisplayName(currentUser.name, lang));
      }
      if (!tradeEdited && currentUser.tradeOrBusiness) {
        setTradeOrBusiness(localizeDisplayName(currentUser.tradeOrBusiness, lang));
      }
    }
  }, [lang, currentUser, nameEdited, tradeEdited]);

  const totalJobsCount =
    role === 'worker'
      ? Math.max(0, Number(jobsCompleted || 0)) + myShifts.length
      : Math.max(Number(jobsCompleted || 0), postedJobsCount);

  const displayRating =
    currentUser?.rating !== null && currentUser?.rating !== undefined
      ? currentUser.rating
      : totalJobsCount > 0
      ? 4.8
      : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const digits = phone.replace(/\D/g, '');
    if (!name.trim()) {
      setError(lang === 'kn' ? 'ದಯವಿಟ್ಟು ಹೆಸರು ನಮೂದಿಸಿ' : 'Please enter your name or business name.');
      return;
    }
    if (digits.length !== 10) {
      setError(lang === 'kn' ? '10 ಅಂಕಿಯ ಮೊಬೈಲ್ ಸಂಖ್ಯೆ ನಮೂದಿಸಿ' : 'Please enter a valid 10-digit phone number.');
      return;
    }
    setError('');
    setSaving(true);
    setSavedNotice(false);
    try {
      await onSaveAccount({
        name: !nameEdited && currentUser?.name ? currentUser.name : name.trim(),
        phone: digits,
        role,
        area,
        tradeOrBusiness:
          !tradeEdited && currentUser?.tradeOrBusiness
            ? currentUser.tradeOrBusiness
            : tradeOrBusiness.trim(),
        jobsCompleted: Number(jobsCompleted) || 0,
        experience: experience.trim(),
        expectedWage: Number(expectedWage) || 700,
        paymentPreference,
      });
      setSavedNotice(true);
      setTimeout(() => setSavedNotice(false), 3000);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Top Account Summary Banner */}
      <section className="bg-white rounded-3xl border border-stone-200/90 p-5 sm:p-6 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div
              className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white shrink-0 ${
                role === 'employer' ? 'bg-[#2563EB]' : 'bg-[#EA580C]'
              }`}
            >
              {role === 'employer' ? <Building2 className="w-6 h-6" /> : <User className="w-6 h-6" />}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg sm:text-xl font-extrabold text-[#14171A]">
                  {currentUser?.name
                    ? localizeDisplayName(currentUser.name, lang)
                    : lang === 'kn'
                    ? 'ಹೊಸ ಖಾತೆ'
                    : lang === 'hi'
                    ? `आपका ${brand.full} प्रोफ़ाइल`
                    : `Your ${brand.full} Profile`}
                </h2>
                <span
                  className={`text-[11px] font-extrabold px-2.5 py-0.5 rounded-lg ${
                    role === 'employer'
                      ? 'bg-blue-50 text-[#2563EB] border border-blue-200'
                      : 'bg-amber-50 text-[#EA580C] border border-amber-200'
                  }`}
                >
                  {role === 'employer'
                    ? lang === 'kn'
                      ? 'ಉದ್ಯೋಗದಾತರು (Employer)'
                      : lang === 'hi'
                      ? 'नियोक्ता (Employer)'
                      : 'Employer'
                    : lang === 'kn'
                    ? 'ಕೆಲಸಗಾರರು (Worker)'
                    : lang === 'hi'
                    ? 'कामगार (Worker)'
                    : 'Worker'}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-stone-500 mt-1">
                <span className="inline-flex items-center gap-1 font-semibold text-[#059669]">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Verified Account
                </span>
                {currentUser?.phone && (
                  <span className="inline-flex items-center gap-1 tabular-nums">
                    <Phone className="w-3 h-3" />
                    +91 {currentUser.phone}
                  </span>
                )}
                <span className="inline-flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-[#EA580C]" />
                  {localizeDisplayName(area, lang)}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onVoiceUpdate}
              className="min-h-[44px] px-4 bg-[#F59E0B] hover:bg-[#EA580C] hover:text-white text-[#14171A] font-extrabold text-xs rounded-2xl inline-flex items-center justify-center gap-2 transition cursor-pointer"
            >
              <Mic className="w-4 h-4" />
              <span>{lang === 'kn' ? 'ಧ್ವನಿಯಿಂದ ನವೀಕರಿಸಿ' : 'Update by Voice'}</span>
            </button>

            <button
              type="button"
              onClick={onSwitchAccount}
              className="min-h-[44px] px-3.5 rounded-2xl border border-stone-200 bg-[#FAF8F5] hover:bg-stone-100 text-xs font-bold text-stone-700 inline-flex items-center gap-1.5 transition cursor-pointer"
              title="Sign in or switch account"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>{currentUser ? 'Switch' : 'Sign In'}</span>
            </button>
          </div>
        </div>

        {/* Work & Activity Metrics Strip */}
        <div className="grid grid-cols-3 gap-2.5 sm:gap-4">
          <div className="bg-[#FAF8F5] border border-stone-200/80 rounded-2xl p-3.5">
            <span className="text-[11px] font-semibold text-stone-500 block">
              {role === 'employer'
                ? lang === 'kn'
                  ? 'ಪೋಸ್ಟ್ ಮಾಡಿದ ಕೆಲಸ'
                  : 'Jobs Posted'
                : lang === 'kn'
                ? 'ಮುಗಿಸಿದ ಕೆಲಸಗಳು'
                : 'Jobs Done'}
            </span>
            <span className="text-xl sm:text-2xl font-extrabold text-[#14171A] tabular-nums mt-0.5 block">
              {totalJobsCount}
            </span>
          </div>

          <div className="bg-[#FAF8F5] border border-stone-200/80 rounded-2xl p-3.5">
            <span className="text-[11px] font-semibold text-stone-500 block">
              {role === 'employer' ? 'Workers Invited' : 'Weekly Earned'}
            </span>
            <span className="text-xl sm:text-2xl font-extrabold text-[#059669] tabular-nums mt-0.5 block">
              {role === 'employer'
                ? invitedWorkersCount
                : `₹${weeklyEarningsTotal.toLocaleString('en-IN')}`}
            </span>
          </div>

          <div className="bg-[#FAF8F5] border border-stone-200/80 rounded-2xl p-3.5">
            <span className="text-[11px] font-semibold text-stone-500 block">Trust Rating</span>
            {displayRating !== null ? (
              <span className="text-xl sm:text-2xl font-extrabold text-[#14171A] tabular-nums mt-0.5 inline-flex items-center gap-1">
                {displayRating}
                <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
              </span>
            ) : (
              <span className="text-base sm:text-lg font-extrabold text-stone-600 mt-1 block">
                New <span className="text-[11px] font-medium text-stone-400">(No ratings yet)</span>
              </span>
            )}
          </div>
        </div>
      </section>

      {/* Main Grid: Editable Account & Requirements Form + Workspace Switch */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        <section className="lg:col-span-7 bg-white rounded-3xl border border-stone-200/90 p-5 sm:p-6 shadow-xs">
          <div className="mb-4">
            <h3 className="text-base font-extrabold text-[#14171A]">
              {lang === 'kn'
                ? 'ಖಾತೆ ವಿವರಗಳು ಮತ್ತು ಅವಶ್ಯಕತೆಗಳು'
                : 'Account Details & Work Requirements'}
            </h3>
            <p className="text-xs text-stone-500 mt-0.5">
              Update whether you are a Worker or Employer, jobs completed, trade/business, and daily pay terms.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Role Selector */}
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setRole('worker')}
                className={`p-3 rounded-2xl border-2 text-left transition cursor-pointer ${
                  role === 'worker'
                    ? 'border-[#EA580C] bg-amber-50/70'
                    : 'border-stone-200 bg-[#FAF8F5] hover:border-stone-300'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <Briefcase className={`w-4 h-4 ${role === 'worker' ? 'text-[#EA580C]' : 'text-stone-500'}`} />
                  {role === 'worker' && <CheckCircle2 className="w-4 h-4 text-[#EA580C]" />}
                </div>
                <span className="text-xs font-extrabold text-[#14171A] block">Worker</span>
                <span className="text-[11px] text-stone-500 block">Looking for daily shifts</span>
              </button>

              <button
                type="button"
                onClick={() => setRole('employer')}
                className={`p-3 rounded-2xl border-2 text-left transition cursor-pointer ${
                  role === 'employer'
                    ? 'border-[#2563EB] bg-blue-50/70'
                    : 'border-stone-200 bg-[#FAF8F5] hover:border-stone-300'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <Building2 className={`w-4 h-4 ${role === 'employer' ? 'text-[#2563EB]' : 'text-stone-500'}`} />
                  {role === 'employer' && <CheckCircle2 className="w-4 h-4 text-[#2563EB]" />}
                </div>
                <span className="text-xs font-extrabold text-[#14171A] block">Employer</span>
                <span className="text-[11px] text-stone-500 block">Hiring staff / helpers</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  {role === 'employer' ? 'Owner / Shop Name' : 'Full Name'}
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => {
                    setNameEdited(true);
                    setName(e.target.value);
                  }}
                  placeholder="e.g. Ramesh Kumar / Sri Vinayaka Works"
                  className="w-full min-h-[44px] px-3.5 bg-[#FAF8F5] border border-stone-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  10-Digit Mobile Number
                </label>
                <input
                  type="tel"
                  inputMode="numeric"
                  maxLength={10}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  placeholder="9845012345"
                  className="w-full min-h-[44px] px-3.5 bg-[#FAF8F5] border border-stone-200 rounded-xl text-sm font-bold tabular-nums focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  {role === 'employer' ? 'Business Category / Requirement' : 'Primary Skill / Trade'}
                </label>
                <input
                  type="text"
                  value={tradeOrBusiness}
                  onChange={(e) => {
                    setTradeEdited(true);
                    setTradeOrBusiness(e.target.value);
                  }}
                  placeholder={
                    role === 'employer'
                      ? 'e.g. Hardware Shop, Construction Contractor'
                      : 'e.g. Mason Helper, Welder, Loader'
                  }
                  className="w-full min-h-[44px] px-3.5 bg-[#FAF8F5] border border-stone-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Work Area / Locality
                </label>
                <input
                  type="text"
                  list="kelsa-area-options"
                  value={area}
                  onChange={(e) => setArea(e.target.value)}
                  placeholder="e.g. Chickpet, MG Road, Industrial Area"
                  className="w-full min-h-[44px] px-3.5 bg-[#FAF8F5] border border-stone-200 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white"
                />
                <datalist id="kelsa-area-options">
                  <option value="B.H. Road" />
                  <option value="Chickpet" />
                  <option value="APMC Yard" />
                  <option value="Kyathsandra" />
                  <option value="Industrial Area" />
                  <option value="Main Market" />
                </datalist>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  {role === 'employer' ? 'Past Hires / Jobs' : 'Jobs Done'}
                </label>
                <input
                  type="number"
                  min={0}
                  max={9999}
                  value={jobsCompleted}
                  onChange={(e) => setJobsCompleted(Number(e.target.value))}
                  className="w-full min-h-[44px] px-3.5 bg-[#FAF8F5] border border-stone-200 rounded-xl text-sm font-bold tabular-nums focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  {role === 'employer' ? 'Typical Wage (₹)' : 'Expected Pay (₹)'}
                </label>
                <input
                  type="number"
                  min={300}
                  max={5000}
                  value={expectedWage}
                  onChange={(e) => setExpectedWage(Number(e.target.value))}
                  className="w-full min-h-[44px] px-3.5 bg-[#FAF8F5] border border-stone-200 rounded-xl text-sm font-bold tabular-nums focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white"
                />
              </div>

              <div className="col-span-2 sm:col-span-1">
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Experience
                </label>
                <input
                  type="text"
                  value={experience}
                  onChange={(e) => setExperience(e.target.value)}
                  placeholder="e.g. 3+ years"
                  className="w-full min-h-[44px] px-3.5 bg-[#FAF8F5] border border-stone-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1.5">
                Preferred Payment Mode
              </label>
              <div className="grid grid-cols-3 gap-2">
                {['Evening UPI', 'Daily Cash', 'Weekly Bank'].map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setPaymentPreference(mode)}
                    className={`min-h-[40px] px-2.5 rounded-xl text-xs font-bold border transition cursor-pointer ${
                      paymentPreference === mode
                        ? 'bg-[#14171A] text-white border-[#14171A]'
                        : 'bg-[#FAF8F5] text-stone-700 border-stone-200 hover:bg-stone-100'
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <p className="text-xs font-bold text-rose-600 bg-rose-50 px-3 py-2 rounded-xl border border-rose-200">
                {error}
              </p>
            )}

            {savedNotice && (
              <p className="text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-2 rounded-xl border border-emerald-200 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                <span>Account details saved & synced.</span>
              </p>
            )}

            <button
              type="submit"
              disabled={saving}
              className="w-full min-h-[48px] bg-[#14171A] hover:bg-stone-800 disabled:opacity-60 text-white font-extrabold text-sm rounded-2xl transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <Save className="w-4 h-4 text-amber-400" />
              <span>{saving ? 'Saving Account...' : 'Save Account & Requirements'}</span>
            </button>
          </form>
        </section>

        {/* Right Column: Quick Workspace Switch + Activity Log */}
        <section className="lg:col-span-5 space-y-4">
          <div className="bg-white rounded-3xl border border-stone-200/90 p-5 shadow-xs space-y-3">
            <h3 className="text-sm font-extrabold text-[#14171A]">Quick Workspace Switch</h3>
            <p className="text-xs text-stone-500">
              Jump directly to browse nearby shifts or post a job opening for workers.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2.5">
              <button
                type="button"
                onClick={() => onNavigateWorkspace('worker')}
                className="min-h-[46px] px-4 rounded-2xl bg-[#FAF8F5] hover:bg-amber-50 border border-stone-200 text-xs font-extrabold text-[#14171A] flex items-center justify-between transition cursor-pointer"
              >
                <span className="inline-flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-[#EA580C]" />
                  Find Nearby Work
                </span>
                <ArrowRight className="w-4 h-4 text-stone-400" />
              </button>

              <button
                type="button"
                onClick={() => onNavigateWorkspace('employer')}
                className="min-h-[46px] px-4 rounded-2xl bg-[#14171A] hover:bg-stone-800 text-xs font-extrabold text-white flex items-center justify-between transition cursor-pointer"
              >
                <span className="inline-flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-amber-400" />
                  Hire Staff / Post Job
                </span>
                <ArrowRight className="w-4 h-4 text-amber-400" />
              </button>
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-stone-200/90 p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-extrabold text-[#14171A]">
                {role === 'employer' ? 'Recent Local Openings' : 'Recent Confirmed Shifts'}
              </h3>
              <Wallet className="w-4 h-4 text-[#059669]" />
            </div>

            {role === 'worker' ? (
              myShifts.length === 0 ? (
                <p className="text-xs text-stone-500 bg-[#FAF8F5] p-3.5 rounded-2xl border border-stone-200/70">
                  No new shifts accepted in this session yet. Your past {jobsCompleted} completed jobs are saved to your profile.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {myShifts.slice(0, 4).map((s) => (
                    <div
                      key={s.id}
                      className="p-3 rounded-2xl bg-[#FAF8F5] border border-stone-200/80 flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-extrabold text-[#14171A] truncate">{s.job.titleEnglish}</p>
                        <p className="text-[11px] text-stone-500 inline-flex items-center gap-1 mt-0.5">
                          <Clock className="w-3 h-3" />
                          {s.job.employer} · {s.appliedAt}
                        </p>
                      </div>
                      <span className="text-xs font-extrabold text-[#059669] tabular-nums shrink-0">
                        ₹{s.job.wage}
                      </span>
                    </div>
                  ))}
                </div>
              )
            ) : (
              <div className="space-y-2.5">
                {recentJobs.slice(0, 3).map((j) => (
                  <div
                    key={j.id}
                    className="p-3 rounded-2xl bg-[#FAF8F5] border border-stone-200/80 flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-extrabold text-[#14171A] truncate">{j.titleEnglish}</p>
                      <p className="text-[11px] text-stone-500 mt-0.5">
                        {j.areaTag} · {j.slotsLeft} needed
                      </p>
                    </div>
                    <span className="text-xs font-extrabold text-[#059669] tabular-nums shrink-0">
                      ₹{j.wage}/day
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
