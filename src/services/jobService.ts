// Isolated Hyper-Local Job & Worker Matching Service (PostGIS / Supabase ready)
// Plug in VITE_SUPABASE_URL & VITE_SUPABASE_ANON_KEY in .env for live persistence.
import { supabase, isSupabaseConfigured } from './supabaseClient';

export interface Job {
  id: string;
  titleKannada: string;
  titleHindi: string;
  titleEnglish: string;
  category: string;
  wage: number;
  wageUnit: string;
  shiftTime: string;
  slotsLeft: number;
  location: string;
  areaTag: string;
  distanceKm: number;
  commuteNote: string;
  pincode: string;
  employer: string;
  ownerName: string;
  verifiedEmployer: boolean;
  phone: string;
  timeAgo: string;
  urgency: 'Immediate' | 'Tomorrow' | 'Weekly Contract';
  paymentMode: 'Evening UPI' | 'Evening Cash' | 'Weekly UPI';
  description: string;
  descriptionKannada: string;
  latLng: [number, number];
}

export interface Worker {
  id: string;
  name: string;
  nameKannada: string;
  skillKannada: string;
  skillHindi: string;
  skillEnglish: string;
  experience: string;
  rating: number;
  location: string;
  distanceKm: number;
  wageExpected: number;
  phone: string;
  verified: boolean;
  availableToday: boolean;
  gigsCompleted: number;
  audioNote: string;
  audioNoteKannada: string;
  latLng: [number, number];
}

export interface ShiftApplication {
  id: string;
  job: Job;
  status: 'Call Initiated' | 'Shift Confirmed' | 'Completed';
  appliedAt: string;
}

export interface PayoutRecord {
  id: string;
  employer: string;
  role: string;
  date: string;
  amount: number;
  mode: 'UPI' | 'Cash';
  settled: boolean;
}

export const isLiveDatabaseConfigured = (): boolean => isSupabaseConfigured();

function formatRelativeTime(isoDate?: string): string {
  if (!isoDate) return 'Live';
  const diffMins = Math.max(0, Math.floor((Date.now() - new Date(isoDate).getTime()) / 60000));
  if (diffMins < 2) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.floor(diffHours / 24)}d ago`;
}

export const TUMAKURU_LOCALITIES = [
  { id: 'all', label: 'All Tumakuru', kn: 'ಎಲ್ಲಾ ತುಮಕೂರು' },
  { id: 'B.H. Road', label: 'B.H. Road', kn: 'ಬಿ.ಹೆಚ್. ರಸ್ತೆ' },
  { id: 'Kyathsandra', label: 'Kyathsandra', kn: 'ಕ್ಯಾತ್ಸಂದ್ರ' },
  { id: 'APMC Yard', label: 'APMC Yard', kn: 'ಎಪಿಎಂಸಿ ಯಾರ್ಡ್' },
  { id: 'Vasanthnarasapura', label: 'Vasanthnarasapura', kn: 'ವಸಂತನರಸಾಪುರ' },
  { id: 'Chickpet', label: 'Chickpet', kn: 'ಚಿಕ್‌ಪೇಟೆ' },
];

export const INITIAL_TUMAKURU_JOBS: Job[] = [
  {
    id: 'j1',
    titleKannada: 'ದ್ವಿಚಕ್ರ ವಾಹನ ಮೆಕ್ಯಾನಿಕ್ / ಪಂಕ್ಚರ್ ಟೆಕ್',
    titleHindi: 'टू-व्हीलर मैकेनिक / पंचर टेक्नीशियन',
    titleEnglish: 'Two-Wheeler Mechanic / Puncture Tech',
    category: 'Auto Garage',
    wage: 850,
    wageUnit: '/day',
    shiftTime: '9:00 AM – 6:30 PM',
    slotsLeft: 1,
    location: 'B.H. Road, Tumakuru',
    areaTag: 'B.H. Road',
    distanceKm: 1.2,
    commuteNote: '12 min walk',
    pincode: '572101',
    employer: 'Sri Vinayaka Auto Garage',
    ownerName: 'Prakash Gowda',
    verifiedEmployer: true,
    phone: '+91 98450 12345',
    timeAgo: '10m ago',
    urgency: 'Immediate',
    paymentMode: 'Evening UPI',
    description: 'Immediate opening for bike servicing, puncture repair, and engine oil change. Tools provided at garage.',
    descriptionKannada: 'ಶ್ರೀ ವಿನಾಯಕ ಆಟೋ ಗ್ಯಾರೇಜ್, ಬಿ.ಹೆಚ್. ರಸ್ತೆ. ತಕ್ಷಣ ಕೆಲಸ ಪ್ರಾರಂಭ, ಸಂಜೆ ಯುಪಿಐ ಪಾವತಿ.',
    latLng: [13.3415, 77.1062],
  },
  {
    id: 'j2',
    titleKannada: 'ಕಟ್ಟಡ ಗೌಂಡಿ ಹೆಲ್ಪರ್ (ಮೇಸನ್ ಸಹಾಯಕ)',
    titleHindi: 'निर्माण राजमिस्त्री हेल्पर (गौंडी)',
    titleEnglish: 'Construction Mason Helper (Goundi)',
    category: 'Construction',
    wage: 750,
    wageUnit: '/day',
    shiftTime: '8:00 AM – 5:00 PM',
    slotsLeft: 2,
    location: 'Kyathsandra, Tumakuru',
    areaTag: 'Kyathsandra',
    distanceKm: 2.8,
    commuteNote: '10 min auto/bus',
    pincode: '572104',
    employer: 'Maruthi Residential Site',
    ownerName: 'Nagaraj Contractor',
    verifiedEmployer: true,
    phone: '+91 98210 98765',
    timeAgo: '24m ago',
    urgency: 'Immediate',
    paymentMode: 'Evening Cash',
    description: '3 days work for residential foundation cementing and brick shifting near Kyathsandra railway gate.',
    descriptionKannada: 'ಕ್ಯಾತ್ಸಂದ್ರ ವಸತಿ ಕಟ್ಟಡ ಕೆಲಸ. 3 ದಿನಗಳ ಕೆಲಸ, ಪ್ರತಿದಿನ ಸಂಜೆ ನಗದು ಪಾವತಿ.',
    latLng: [13.3106, 77.1636],
  },
  {
    id: 'j3',
    titleKannada: 'ಎಪಿಎಂಸಿ ಧಾನ್ಯ ಗೋದಾಮು ಲೋಡರ್ (ಹಮಾಲಿ)',
    titleHindi: 'एपीएमसी अनाज गोदाम लोडर (हमाली)',
    titleEnglish: 'APMC Grain Godown Loader (Hamali)',
    category: 'Logistics',
    wage: 900,
    wageUnit: '/shift',
    shiftTime: '6:00 AM – 1:00 PM',
    slotsLeft: 4,
    location: 'Tumakuru APMC Market Yard',
    areaTag: 'APMC Yard',
    distanceKm: 3.5,
    commuteNote: '15 min city bus',
    pincode: '572103',
    employer: 'Basaveshwara Grain Traders',
    ownerName: 'Shivakumar Shetty',
    verifiedEmployer: true,
    phone: '+91 97311 44556',
    timeAgo: '45m ago',
    urgency: 'Immediate',
    paymentMode: 'Evening Cash',
    description: 'Morning shift 6 AM – 1 PM ragi & paddy sack loading. Breakfast and tea provided on site.',
    descriptionKannada: 'ಬೆಳಿಗ್ಗೆ 6 ರಿಂದ ಮಧ್ಯಾಹ್ನ 1 ಗಂಟೆ ಪಾಳಿ. ರಾಗಿ ಮತ್ತು ಭತ್ತದ ಚೀಲ ಲೋಡಿಂಗ್. ತಿಂಡಿ ಸೌಲಭ್ಯವಿದೆ.',
    latLng: [13.3568, 77.0842],
  },
  {
    id: 'j4',
    titleKannada: 'ಆರ್ಕ್ ವೆಲ್ಡರ್ / ಗ್ರಿಲ್ ಫ್ಯಾಬ್ರಿಕೇಟರ್',
    titleHindi: 'आर्क वेल्डर / ग्रिल फैब्रिकेटर',
    titleEnglish: 'Arc Welder / Grill Fabricator',
    category: 'Industrial',
    wage: 1100,
    wageUnit: '/day',
    shiftTime: '8:30 AM – 6:00 PM',
    slotsLeft: 2,
    location: 'Vasanthnarasapura Industrial Shed',
    areaTag: 'Vasanthnarasapura',
    distanceKm: 6.4,
    commuteNote: 'KSRTC Bus #14',
    pincode: '572128',
    employer: 'Siddalingeshwara Fab Works',
    ownerName: 'Mahesh Patil',
    verifiedEmployer: true,
    phone: '+91 99001 88990',
    timeAgo: '1h ago',
    urgency: 'Weekly Contract',
    paymentMode: 'Weekly UPI',
    description: 'Weekly industrial truss and gate welding contract. Direct bus route from Tumakuru KSRTC Bus Stand.',
    descriptionKannada: 'ವಸಂತನರಸಾಪುರ ಕೈಗಾರಿಕಾ ಶೆಡ್‌ನಲ್ಲಿ ವಾರದ ವೆಲ್ಡಿಂಗ್ ಗುತ್ತಿಗೆ. ಬಸ್ ಸೌಲಭ್ಯ ಲಭ್ಯವಿದೆ.',
    latLng: [13.4285, 77.0882],
  },
  {
    id: 'j5',
    titleKannada: 'ಹಾರ್ಡ್‌ವೇರ್ ಮತ್ತು ಎಲೆಕ್ಟ್ರಿಕಲ್ ಅಂಗಡಿ ಹೆಲ್ಪರ್',
    titleHindi: 'हार्डवेयर और इलेक्ट्रिकल शॉप हेल्पर',
    titleEnglish: 'Hardware & Electrical Shop Helper',
    category: 'Retail Shop',
    wage: 650,
    wageUnit: '/day',
    shiftTime: '9:30 AM – 7:30 PM',
    slotsLeft: 1,
    location: 'Chickpet Main Road, Tumakuru',
    areaTag: 'Chickpet',
    distanceKm: 0.9,
    commuteNote: '8 min walk',
    pincode: '572101',
    employer: 'Mahalakshmi Hardwares',
    ownerName: 'Raghavendra Gupta',
    verifiedEmployer: true,
    phone: '+91 94480 22334',
    timeAgo: '2h ago',
    urgency: 'Tomorrow',
    paymentMode: 'Evening UPI',
    description: 'Full-time or monthly ₹18,000 option available. Pipe sorting, local delivery, and counter help.',
    descriptionKannada: 'ಚಿಕ್‌ಪೇಟೆ ಮುಖ್ಯ ರಸ್ತೆ ಹಾರ್ಡ್‌ವೇರ್ ಅಂಗಡಿ. ದಿನಕ್ಕೆ 650 ಅಥವಾ ತಿಂಗಳಿಗೆ 18,000 ರೂಪಾಯಿ.',
    latLng: [13.3380, 77.1105],
  },
  {
    id: 'j6',
    titleKannada: 'ಕ್ಯಾಟರಿಂಗ್ ಮತ್ತು ಟೆಂಟ್ ಸೆಟಪ್ ಸಿಬ್ಬಂದಿ',
    titleHindi: 'कैटरिंग और टेंट सेटअप क्रू',
    titleEnglish: 'Catering & Tent Setup Crew',
    category: 'Events',
    wage: 700,
    wageUnit: '/event',
    shiftTime: '7:00 AM – 4:00 PM',
    slotsLeft: 5,
    location: 'Siddaganga Extn Marriage Hall',
    areaTag: 'B.H. Road',
    distanceKm: 2.1,
    commuteNote: '10 min walk',
    pincode: '572102',
    employer: 'Sri Siddalinga Caterers',
    ownerName: 'Basavaraju K.',
    verifiedEmployer: true,
    phone: '+91 98860 11998',
    timeAgo: '3h ago',
    urgency: 'Tomorrow',
    paymentMode: 'Evening Cash',
    description: 'Tomorrow 7 AM reporting. Buffet counter arrangement and pandal setup. Breakfast & lunch included.',
    descriptionKannada: 'ನಾಳೆ ಬೆಳಿಗ್ಗೆ 7 ಗಂಟೆಗೆ ಸಿದ್ಧಗಂಗಾ ಎಕ್ಸ್‌ಟೆನ್ಶನ್ ಕಲ್ಯಾಣ ಮಂಟಪದಲ್ಲಿ ಕೆಲಸ. ಊಟ ಉಚಿತ.',
    latLng: [13.3292, 77.1180],
  },
];

export const INITIAL_TUMAKURU_WORKERS: Worker[] = [
  {
    id: 'w1',
    name: 'Ramesh Kumar',
    nameKannada: 'ರಮೇಶ್ ಕುಮಾರ್',
    skillKannada: 'ಗೌಂಡಿ ಮತ್ತು ಕಟ್ಟಡ ಕೆಲಸ',
    skillHindi: 'राजमिस्त्री और निर्माण कार्य',
    skillEnglish: 'Mason & Plastering',
    experience: '6 yrs exp',
    rating: 4.9,
    location: 'Kyathsandra',
    distanceKm: 2.4,
    wageExpected: 800,
    phone: '+91 94480 11223',
    verified: true,
    availableToday: true,
    gigsCompleted: 142,
    audioNote: 'Namaskara, I am Ramesh from Kyathsandra. 6 years experience in brickwork, concrete & centering.',
    audioNoteKannada: 'ನಮಸ್ಕಾರ, ನಾನು ಕ್ಯಾತ್ಸಂದ್ರದ ರಮೇಶ್. ಗೌಂಡಿ ಕೆಲಸ, ಪ್ಲಾಸ್ಟರಿಂಗ್ ಮತ್ತು ಸೆಂಟರಿಂಗ್‌ನಲ್ಲಿ 6 ವರ್ಷ ಅನುಭವ ಇದೆ.',
    latLng: [13.3145, 77.1585],
  },
  {
    id: 'w2',
    name: 'Lakshmiamma',
    nameKannada: 'ಲಕ್ಷ್ಮಮ್ಮ',
    skillKannada: 'ಅಡುಗೆ ಮತ್ತು ಕಲ್ಯಾಣ ಮಂಟಪ ಸಹಾಯಕಿ',
    skillHindi: 'रसोई और कैटरिंग सहायक',
    skillEnglish: 'Cook & Catering Helper',
    experience: '8 yrs exp',
    rating: 4.8,
    location: 'B.H. Road',
    distanceKm: 1.1,
    wageExpected: 650,
    phone: '+91 98860 33445',
    verified: true,
    availableToday: true,
    gigsCompleted: 215,
    audioNote: 'I handle home cooking, marriage hall vegetable cutting, and buffet serving across Tumakuru.',
    audioNoteKannada: 'ನಾನು ಮನೆ ಅಡುಗೆ ಮತ್ತು ಕಲ್ಯಾಣ ಮಂಟಪದ ಅಡುಗೆ ಸಹಾಯಕಿಯಾಗಿ ಕೆಲಸ ಮಾಡುತ್ತೇನೆ.',
    latLng: [13.3402, 77.1092],
  },
  {
    id: 'w3',
    name: 'Manjunath Swamy',
    nameKannada: 'ಮಂಜುನಾಥ ಸ್ವಾಮಿ',
    skillKannada: 'ಎಲೆಕ್ಟ್ರಿಷಿಯನ್ ಮತ್ತು ಮೋಟಾರ್ ವೈಂಡಿಂಗ್',
    skillHindi: 'इलेक्ट्रीशियन और वायरिंग',
    skillEnglish: 'Electrician & Motor Tech',
    experience: '5 yrs exp',
    rating: 4.9,
    location: 'Ashok Nagar',
    distanceKm: 1.8,
    wageExpected: 900,
    phone: '+91 97420 55667',
    verified: true,
    availableToday: true,
    gigsCompleted: 98,
    audioNote: 'Certified wireman for shops, borewell starters, and house wiring in Tumakuru town.',
    audioNoteKannada: 'ಅಂಗಡಿ ವೈರಿಂಗ್, ಬೋರ್‌ವೆಲ್ ಸ್ಟಾರ್ಟರ್ ಮತ್ತು ಮನೆ ಎಲೆಕ್ಟ್ರಿಕಲ್ ರಿಪೇರಿ ಕೆಲಸ ಮಾಡುತ್ತೇನೆ.',
    latLng: [13.3324, 77.1028],
  },
  {
    id: 'w4',
    name: 'Rafiq Ahmed',
    nameKannada: 'ರಫೀಕ್ ಅಹ್ಮದ್',
    skillKannada: 'ಆರ್ಕ್ ವೆಲ್ಡರ್ ಮತ್ತು ಲೋಡಿಂಗ್',
    skillHindi: 'आर्क वेल्डर और फैब्रिकेटर',
    skillEnglish: 'Arc Welder & Fabricator',
    experience: '7 yrs exp',
    rating: 4.7,
    location: 'Vasanthnarasapura',
    distanceKm: 4.9,
    wageExpected: 1000,
    phone: '+91 98451 77889',
    verified: true,
    availableToday: true,
    gigsCompleted: 164,
    audioNote: 'Experienced in rolling shutters, grill gates, and industrial shed welding.',
    audioNoteKannada: 'ರೋಲಿಂಗ್ ಶಟರ್, ಗ್ರಿಲ್ ಗೇಟ್ ಮತ್ತು ಶೆಡ್ ವೆಲ್ಡಿಂಗ್ ಕೆಲಸದಲ್ಲಿ 7 ವರ್ಷ ಅನುಭವ ಇದೆ.',
    latLng: [13.4190, 77.0915],
  },
];

export const INITIAL_PAYOUT_HISTORY: PayoutRecord[] = [
  {
    id: 'p1',
    employer: 'Sri Vinayaka Auto Garage',
    role: 'Garage Helper (B.H. Road)',
    date: 'Yesterday, 6:40 PM',
    amount: 850,
    mode: 'UPI',
    settled: true,
  },
  {
    id: 'p2',
    employer: 'Basaveshwara Grain Traders',
    role: 'APMC Morning Shift',
    date: '2 days ago, 1:15 PM',
    amount: 900,
    mode: 'Cash',
    settled: true,
  },
  {
    id: 'p3',
    employer: 'Mahalakshmi Hardwares',
    role: 'Stock Unloading (Chickpet)',
    date: '4 days ago, 7:10 PM',
    amount: 700,
    mode: 'UPI',
    settled: true,
  },
];

// ================= REAL SUPABASE BACKEND ADAPTERS =================

export async function fetchNearbyJobs(radiusKm: number = 10): Promise<Job[]> {
  if (!supabase) return INITIAL_TUMAKURU_JOBS;

  const { data, error } = await supabase.rpc('nearby_jobs', {
    user_lat: 13.3392,
    user_lng: 77.1140,
    radius_km: radiusKm,
  });

  if (error || !data || data.length === 0) {
    return INITIAL_TUMAKURU_JOBS;
  }

  return data.map((row: Record<string, unknown>) => ({
    id: String(row.id),
    titleKannada: String(row.title_kannada ?? row.title_english),
    titleHindi: String(row.title_hindi ?? row.title_english),
    titleEnglish: String(row.title_english),
    category: String(row.category),
    wage: Number(row.wage),
    wageUnit: String(row.wage_unit ?? '/day'),
    shiftTime: String(row.shift_time ?? '9:00 AM – 6:00 PM'),
    slotsLeft: Number(row.slots_left ?? 1),
    location: String(row.location),
    areaTag: String(row.area_tag),
    distanceKm: Number(row.distance_km ?? 1.5),
    commuteNote: String(row.commute_note ?? '10 min walk'),
    pincode: String(row.pincode ?? '572101'),
    employer: String(row.employer),
    ownerName: String(row.owner_name ?? 'Owner'),
    verifiedEmployer: Boolean(row.verified_employer ?? true),
    phone: String(row.phone),
    timeAgo: formatRelativeTime(row.created_at ? String(row.created_at) : undefined),
    urgency: (row.urgency as Job['urgency']) ?? 'Immediate',
    paymentMode: (row.payment_mode as Job['paymentMode']) ?? 'Evening UPI',
    description: String(row.description ?? ''),
    descriptionKannada: String(row.description_kannada ?? ''),
    latLng: [Number(row.lat), Number(row.lng)] as [number, number],
  }));
}

export async function createJobInSupabase(job: Omit<Job, 'id' | 'timeAgo'>): Promise<Job> {
  const localJob: Job = {
    ...job,
    id: `j-${Date.now()}`,
    timeAgo: 'Just now',
  };

  if (!supabase) return localJob;

  const { data, error } = await supabase
    .from('jobs')
    .insert({
      title_kannada: job.titleKannada,
      title_hindi: job.titleHindi,
      title_english: job.titleEnglish,
      category: job.category,
      wage: job.wage,
      wage_unit: job.wageUnit,
      shift_time: job.shiftTime,
      slots_left: job.slotsLeft,
      location: job.location,
      area_tag: job.areaTag,
      commute_note: job.commuteNote,
      pincode: job.pincode,
      employer: job.employer,
      owner_name: job.ownerName,
      verified_employer: job.verifiedEmployer,
      phone: job.phone,
      urgency: job.urgency,
      payment_mode: job.paymentMode,
      description: job.description,
      description_kannada: job.descriptionKannada,
      lat: job.latLng[0],
      lng: job.latLng[1],
    })
    .select()
    .single();

  if (error || !data) return localJob;

  return {
    ...localJob,
    id: String(data.id),
  };
}

export async function submitShiftApplication(jobId: string, workerPhone: string): Promise<void> {
  if (!supabase) return;
  await supabase.from('shift_applications').insert({
    job_id: jobId,
    worker_phone: workerPhone,
    status: 'Shift Confirmed',
  });
}

export async function fetchWorkersFromSupabase(): Promise<Worker[]> {
  if (!supabase) return INITIAL_TUMAKURU_WORKERS;

  const { data, error } = await supabase
    .from('workers')
    .select('*')
    .order('gigs_completed', { ascending: false });

  if (error || !data || data.length === 0) {
    return INITIAL_TUMAKURU_WORKERS;
  }

  return data.map((row: Record<string, unknown>) => ({
    id: String(row.id),
    name: String(row.name),
    nameKannada: String(row.name_kannada ?? row.name),
    skillKannada: String(row.skill_kannada),
    skillHindi: String(row.skill_hindi ?? row.skill_english),
    skillEnglish: String(row.skill_english),
    experience: String(row.experience),
    rating: Number(row.rating ?? 4.8),
    location: String(row.location),
    distanceKm: 2.0,
    wageExpected: Number(row.wage_expected),
    phone: String(row.phone),
    verified: Boolean(row.verified ?? true),
    availableToday: Boolean(row.available_today ?? true),
    gigsCompleted: Number(row.gigs_completed ?? 0),
    audioNote: String(row.audio_note ?? ''),
    audioNoteKannada: String(row.audio_note_kannada ?? ''),
    latLng: [Number(row.lat), Number(row.lng)] as [number, number],
  }));
}

