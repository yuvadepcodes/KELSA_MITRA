import { createClient, SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import { Job, INITIAL_TUMAKURU_JOBS } from './jobService';

export interface UserAccount {
  id: string;
  name: string;
  phone: string;
  role: 'worker' | 'employer';
  area?: string;
  tradeOrBusiness?: string;
  jobsCompleted?: number;
  experience?: string;
  expectedWage?: number;
  paymentPreference?: string;
  verified?: boolean;
  rating?: number;
  created_at?: string;
}

const rawUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
const supabaseUrl = rawUrl ? rawUrl.replace(/\/rest\/v1\/?$/i, '').replace(/\/$/, '') : undefined;

export const supabase: SupabaseClient | null =
  supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

export const isSupabaseReady = (): boolean => Boolean(supabase);

const STORAGE_USERS_KEY = 'kelsa_mitra_users_v1';
const STORAGE_CURRENT_USER_KEY = 'kelsa_mitra_current_user_v1';
const STORAGE_JOBS_KEY = 'kelsa_mitra_custom_jobs_v1';

const AREA_COORDINATES: Record<string, { latLng: [number, number]; distanceKm: number; commute: string }> = {
  kyathsandra: { latLng: [13.3106, 77.1636], distanceKm: 2.8, commute: '10 min auto/bus' },
  'b.h. road': { latLng: [13.3415, 77.1062], distanceKm: 1.2, commute: '12 min walk' },
  'bh road': { latLng: [13.3415, 77.1062], distanceKm: 1.2, commute: '12 min walk' },
  apmc: { latLng: [13.3568, 77.0842], distanceKm: 3.5, commute: '15 min city bus' },
  vasanthnarasapura: { latLng: [13.4285, 77.0882], distanceKm: 6.4, commute: 'KSRTC Bus #14' },
  chickpet: { latLng: [13.338, 77.1105], distanceKm: 0.9, commute: '8 min walk' },
  siddaganga: { latLng: [13.3292, 77.118], distanceKm: 2.1, commute: '10 min walk' },
};

function resolveAreaMeta(area: string): { latLng: [number, number]; distanceKm: number; commute: string; areaTag: string } {
  const lower = area.toLowerCase();
  for (const [key, meta] of Object.entries(AREA_COORDINATES)) {
    if (lower.includes(key)) {
      const prettyTag =
        key === 'bh road' || key === 'b.h. road'
          ? 'B.H. Road'
          : key === 'apmc'
          ? 'APMC Yard'
          : key.charAt(0).toUpperCase() + key.slice(1);
      return { ...meta, areaTag: prettyTag };
    }
  }
  return { latLng: [13.3392, 77.114], distanceKm: 2.5, commute: '12 min auto', areaTag: area || 'Tumakuru' };
}

function formatRelativeTime(isoDate?: string): string {
  if (!isoDate) return 'Just now';
  const diffMins = Math.max(0, Math.floor((Date.now() - new Date(isoDate).getTime()) / 60000));
  if (diffMins < 2) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.floor(diffHours / 24)}d ago`;
}

export function normalizeJobRow(row: Record<string, unknown>): Job {
  const titleText = String(row.title || row.title_english || row.title_kannada || 'Local Work Opportunity');
  const areaText = String(row.area || row.location || 'Tumakuru');
  const areaMeta = resolveAreaMeta(areaText);
  const workersCount = row.title
    ? Number(row.workers_count ?? row.slots_left ?? 1)
    : Number(row.slots_left ?? row.workers_count ?? 1);

  const rawEmpName = row.employer_name ? String(row.employer_name) : '';
  const legacyEmp = row.employer ? String(row.employer) : '';
  const employerName =
    rawEmpName && rawEmpName !== 'Local Tumakuru Business'
      ? rawEmpName
      : legacyEmp || rawEmpName || 'Local Tumakuru Business';

  const employerPhone = String(row.employer_phone || row.phone || '+91 98450 55443');

  const rawDist = row.distance_km !== undefined && row.distance_km !== null ? Number(row.distance_km) : undefined;
  const distanceKm =
    row.title && rawDist !== undefined
      ? rawDist
      : rawDist !== undefined && rawDist !== 2.5
      ? rawDist
      : areaMeta.distanceKm;

  return {
    id: String(row.id),
    titleKannada: String(row.title_kannada || titleText),
    titleHindi: String(row.title_hindi || titleText),
    titleEnglish: String(row.title_english || titleText),
    category: String(row.category || 'General'),
    wage: Number(row.wage ?? 750),
    wageUnit: String(row.wage_unit || '/day'),
    shiftTime: String(row.shift_time || '9:00 AM – 6:00 PM'),
    slotsLeft: workersCount,
    location: areaText,
    areaTag: String(row.area_tag || areaMeta.areaTag),
    distanceKm,
    commuteNote: String(row.commute_note || areaMeta.commute),
    pincode: String(row.pincode || '572101'),
    employer: employerName,
    ownerName: String(row.owner_name || employerName),
    verifiedEmployer: Boolean(row.verified_employer ?? true),
    phone: employerPhone,
    timeAgo: formatRelativeTime(row.created_at ? String(row.created_at) : undefined),
    urgency: (row.urgency as Job['urgency']) || 'Immediate',
    paymentMode: (row.payment_mode as Job['paymentMode']) || 'Evening UPI',
    description: String(
      row.description || `${workersCount} worker(s) needed in ${areaText}. Direct owner connection.`
    ),
    descriptionKannada: String(
      row.description_kannada || `${areaText} ಬಳಿ ${workersCount} ಕೆಲಸಗಾರರು ಬೇಕಾಗಿದ್ದಾರೆ. ದಿನಕ್ಕೆ ₹${row.wage ?? 750}.`
    ),
    latLng: [
      Number(row.lat ?? areaMeta.latLng[0]),
      Number(row.lng ?? areaMeta.latLng[1]),
    ],
  };
}

// ================= USER ACCOUNTS (Supabase + localStorage fallback) =================

export function getStoredCurrentUser(): UserAccount | null {
  try {
    const raw = localStorage.getItem(STORAGE_CURRENT_USER_KEY);
    return raw ? (JSON.parse(raw) as UserAccount) : null;
  } catch {
    return null;
  }
}

export function setStoredCurrentUser(user: UserAccount | null): void {
  try {
    if (user) {
      localStorage.setItem(STORAGE_CURRENT_USER_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(STORAGE_CURRENT_USER_KEY);
    }
  } catch {
    // Ignore storage errors
  }
}

export async function upsertUserAccount(params: {
  name: string;
  phone: string;
  role: 'worker' | 'employer';
  area?: string;
  tradeOrBusiness?: string;
  jobsCompleted?: number;
  experience?: string;
  expectedWage?: number;
  paymentPreference?: string;
  verified?: boolean;
  rating?: number;
}): Promise<UserAccount> {
  const cleanPhone = params.phone.replace(/\D/g, '').slice(-10) || params.phone.trim();
  const cleanName = params.name.trim() || 'Tumakuru User';

  let existingLocal: UserAccount | undefined;
  try {
    const existingRaw = localStorage.getItem(STORAGE_USERS_KEY);
    const existingList: UserAccount[] = existingRaw ? JSON.parse(existingRaw) : [];
    existingLocal = existingList.find((u) => u.phone === cleanPhone);
  } catch {
    existingLocal = undefined;
  }

  const mergedMeta = {
    area: params.area ?? existingLocal?.area ?? 'B.H. Road, Tumakuru',
    tradeOrBusiness: params.tradeOrBusiness ?? existingLocal?.tradeOrBusiness ?? '',
    jobsCompleted:
      params.jobsCompleted !== undefined
        ? params.jobsCompleted
        : existingLocal?.jobsCompleted ?? 0,
    experience: params.experience ?? existingLocal?.experience ?? '2+ years',
    expectedWage:
      params.expectedWage !== undefined
        ? params.expectedWage
        : existingLocal?.expectedWage ?? 750,
    paymentPreference: params.paymentPreference ?? existingLocal?.paymentPreference ?? 'Evening UPI',
    verified: params.verified ?? existingLocal?.verified ?? true,
    rating: params.rating ?? existingLocal?.rating ?? 4.8,
  };

  let savedUser: UserAccount = {
    id: existingLocal?.id || `local-${cleanPhone}`,
    name: cleanName,
    phone: cleanPhone,
    role: params.role,
    ...mergedMeta,
    created_at: existingLocal?.created_at || new Date().toISOString(),
  };

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('users')
        .upsert(
          {
            name: cleanName,
            phone: cleanPhone,
            role: params.role,
          },
          { onConflict: 'phone' }
        )
        .select()
        .single();

      if (!error && data) {
        savedUser = {
          id: String(data.id),
          name: String(data.name),
          phone: String(data.phone),
          role: data.role as 'worker' | 'employer',
          ...mergedMeta,
          created_at: String(data.created_at),
        };
      }
    } catch {
      // Fallback gracefully to localStorage if users table is not yet created
    }
  }

  try {
    const existingRaw = localStorage.getItem(STORAGE_USERS_KEY);
    const existing: UserAccount[] = existingRaw ? JSON.parse(existingRaw) : [];
    const filtered = existing.filter((u) => u.phone !== cleanPhone);
    localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify([savedUser, ...filtered]));
  } catch {
    // Ignore storage errors
  }

  setStoredCurrentUser(savedUser);
  return savedUser;
}

// ================= JOBS (Supabase + Realtime + localStorage fallback) =================

export async function fetchAllJobs(): Promise<Job[]> {
  let localCustomJobs: Job[] = [];
  try {
    const raw = localStorage.getItem(STORAGE_JOBS_KEY);
    if (raw) localCustomJobs = JSON.parse(raw) as Job[];
  } catch {
    localCustomJobs = [];
  }

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('jobs')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data && data.length > 0) {
        return data.map((row) => normalizeJobRow(row as Record<string, unknown>));
      }
    } catch {
      // Fall back to seed + localStorage
    }
  }

  const seenIds = new Set(localCustomJobs.map((j) => j.id));
  return [...localCustomJobs, ...INITIAL_TUMAKURU_JOBS.filter((j) => !seenIds.has(j.id))];
}

export async function createJobRecord(params: {
  title: string;
  area: string;
  wage: number;
  workersCount: number;
  employerName?: string;
  employerPhone?: string;
  category?: string;
}): Promise<Job> {
  const areaMeta = resolveAreaMeta(params.area);
  const employerName = params.employerName?.trim() || 'Local Tumakuru Business';
  const employerPhone = params.employerPhone?.trim() || '+91 98450 55443';

  let createdJob: Job = {
    id: `job-${Date.now()}`,
    titleKannada: params.title,
    titleHindi: params.title,
    titleEnglish: params.title,
    category: params.category || 'General',
    wage: Number(params.wage),
    wageUnit: '/day',
    shiftTime: 'Today · Immediate Start',
    slotsLeft: Number(params.workersCount || 1),
    location: params.area,
    areaTag: areaMeta.areaTag,
    distanceKm: areaMeta.distanceKm,
    commuteNote: areaMeta.commute,
    pincode: '572101',
    employer: employerName,
    ownerName: employerName,
    verifiedEmployer: true,
    phone: employerPhone,
    timeAgo: 'Just now',
    urgency: 'Immediate',
    paymentMode: 'Evening UPI',
    description: `${params.workersCount} worker(s) needed in ${params.area}. Direct owner connection.`,
    descriptionKannada: `${params.area} ಬಳಿ ${params.workersCount} ಕೆಲಸಗಾರರು ಬೇಕಾಗಿದ್ದಾರೆ. ದಿನಕ್ಕೆ ₹${params.wage}.`,
    latLng: areaMeta.latLng,
  };

  if (supabase) {
    try {
      // Primary insert supporting full schema
      const fullPayload = {
        title: params.title,
        title_kannada: params.title,
        title_hindi: params.title,
        title_english: params.title,
        category: params.category || 'General',
        wage: Number(params.wage),
        wage_unit: '/day',
        shift_time: 'Today · Immediate Start',
        workers_count: Number(params.workersCount || 1),
        slots_left: Number(params.workersCount || 1),
        area: params.area,
        location: params.area,
        area_tag: areaMeta.areaTag,
        distance_km: areaMeta.distanceKm,
        commute_note: areaMeta.commute,
        employer_name: employerName,
        employer: employerName,
        owner_name: employerName,
        employer_phone: employerPhone,
        phone: employerPhone,
        payment_mode: 'Evening UPI',
        status: 'open',
        description: createdJob.description,
        description_kannada: createdJob.descriptionKannada,
        lat: areaMeta.latLng[0],
        lng: areaMeta.latLng[1],
      };

      let result = await supabase.from('jobs').insert(fullPayload).select().single();

      // Fallback insert if live Supabase table still uses earlier columns only
      if (result.error) {
        result = await supabase
          .from('jobs')
          .insert({
            title_kannada: params.title,
            title_hindi: params.title,
            title_english: params.title,
            category: params.category || 'General',
            wage: Number(params.wage),
            wage_unit: '/day',
            shift_time: 'Today · Immediate Start',
            slots_left: Number(params.workersCount || 1),
            location: params.area,
            area_tag: areaMeta.areaTag,
            commute_note: areaMeta.commute,
            employer: employerName,
            owner_name: employerName,
            phone: employerPhone,
            payment_mode: 'Evening UPI',
            description: createdJob.description,
            description_kannada: createdJob.descriptionKannada,
            lat: areaMeta.latLng[0],
            lng: areaMeta.latLng[1],
          })
          .select()
          .single();
      }

      if (!result.error && result.data) {
        createdJob = normalizeJobRow(result.data as Record<string, unknown>);
      }
    } catch {
      // Fallback to localStorage below
    }
  }

  try {
    const raw = localStorage.getItem(STORAGE_JOBS_KEY);
    const existing: Job[] = raw ? JSON.parse(raw) : [];
    const updated = [createdJob, ...existing.filter((j) => j.id !== createdJob.id)];
    localStorage.setItem(STORAGE_JOBS_KEY, JSON.stringify(updated));
  } catch {
    // Ignore storage errors
  }

  return createdJob;
}

export function subscribeToJobsRealtime(onNewJob: (job: Job) => void): () => void {
  if (!supabase) return () => {};

  const channel: RealtimeChannel = supabase
    .channel('kelsa-jobs-realtime')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'jobs' },
      (payload) => {
        if (payload.new) {
          onNewJob(normalizeJobRow(payload.new as Record<string, unknown>));
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
