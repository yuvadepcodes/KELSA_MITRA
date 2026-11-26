-- Run this in your Supabase Project -> SQL Editor -> New Query
-- Enables PostGIS for hyper-local 5km / 10km Tumakuru radius matching

create extension if not exists postgis;

-- 1. JOBS TABLE
create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  title_kannada text not null,
  title_hindi text not null default '',
  title_english text not null,
  category text not null,
  wage integer not null check (wage > 0),
  wage_unit text not null default '/day',
  shift_time text not null default '9:00 AM – 6:00 PM',
  slots_left integer not null default 1,
  location text not null,
  area_tag text not null,
  commute_note text not null default '10 min walk',
  pincode text not null default '572101',
  employer text not null,
  owner_name text not null default 'Owner',
  verified_employer boolean not null default true,
  phone text not null,
  urgency text not null default 'Immediate',
  payment_mode text not null default 'Evening UPI',
  description text not null default '',
  description_kannada text not null default '',
  lat double precision not null,
  lng double precision not null,
  geom geography(Point, 4326) generated always as (st_setsrid(st_makepoint(lng, lat), 4326)::geography) stored,
  created_at timestamptz not null default now()
);

create index if not exists jobs_geom_idx on public.jobs using gist (geom);

-- 2. WORKERS TABLE
create table if not exists public.workers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  name_kannada text not null,
  skill_kannada text not null,
  skill_hindi text not null default '',
  skill_english text not null,
  experience text not null,
  rating numeric(2,1) not null default 4.8,
  location text not null,
  wage_expected integer not null,
  phone text not null,
  verified boolean not null default true,
  available_today boolean not null default true,
  gigs_completed integer not null default 0,
  audio_note text not null default '',
  audio_note_kannada text not null default '',
  lat double precision not null,
  lng double precision not null,
  geom geography(Point, 4326) generated always as (st_setsrid(st_makepoint(lng, lat), 4326)::geography) stored,
  created_at timestamptz not null default now()
);

create index if not exists workers_geom_idx on public.workers using gist (geom);

-- 3. SHIFT APPLICATIONS TABLE
create table if not exists public.shift_applications (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  worker_phone text not null,
  status text not null default 'Shift Confirmed',
  created_at timestamptz not null default now()
);

-- 4. ROW LEVEL SECURITY (Idempotent policies for MVP)
alter table public.jobs enable row level security;
alter table public.workers enable row level security;
alter table public.shift_applications enable row level security;

drop policy if exists "Public read jobs" on public.jobs;
create policy "Public read jobs" on public.jobs for select using (true);

drop policy if exists "Public insert jobs" on public.jobs;
create policy "Public insert jobs" on public.jobs for insert with check (true);

drop policy if exists "Public read workers" on public.workers;
create policy "Public read workers" on public.workers for select using (true);

drop policy if exists "Public read applications" on public.shift_applications;
create policy "Public read applications" on public.shift_applications for select using (true);

drop policy if exists "Public insert applications" on public.shift_applications;
create policy "Public insert applications" on public.shift_applications for insert with check (true);

-- 5. HYPER-LOCAL RADIUS MATCH FUNCTIONS (5km / 10km from Tumakuru)
create or replace function public.nearby_jobs(
  user_lat double precision default 13.3392,
  user_lng double precision default 77.1140,
  radius_km double precision default 10
)
returns table (
  id uuid,
  title_kannada text,
  title_hindi text,
  title_english text,
  category text,
  wage integer,
  wage_unit text,
  shift_time text,
  slots_left integer,
  location text,
  area_tag text,
  distance_km double precision,
  commute_note text,
  pincode text,
  employer text,
  owner_name text,
  verified_employer boolean,
  phone text,
  urgency text,
  payment_mode text,
  description text,
  description_kannada text,
  lat double precision,
  lng double precision,
  created_at timestamptz
)
language sql
stable
as $$
  select
    j.id,
    j.title_kannada,
    j.title_hindi,
    j.title_english,
    j.category,
    j.wage,
    j.wage_unit,
    j.shift_time,
    j.slots_left,
    j.location,
    j.area_tag,
    round((st_distance(j.geom, st_setsrid(st_makepoint(user_lng, user_lat), 4326)::geography) / 1000.0)::numeric, 1)::double precision as distance_km,
    j.commute_note,
    j.pincode,
    j.employer,
    j.owner_name,
    j.verified_employer,
    j.phone,
    j.urgency,
    j.payment_mode,
    j.description,
    j.description_kannada,
    j.lat,
    j.lng,
    j.created_at
  from public.jobs j
  where st_dwithin(j.geom, st_setsrid(st_makepoint(user_lng, user_lat), 4326)::geography, radius_km * 1000)
  order by j.created_at desc;
$$;

-- 6. SEED DATA FOR TUMAKURU (Only inserts if jobs table is empty)
insert into public.jobs (
  title_kannada, title_hindi, title_english, category, wage, wage_unit, shift_time, slots_left,
  location, area_tag, commute_note, pincode, employer, owner_name, phone, urgency, payment_mode,
  description, description_kannada, lat, lng
)
select * from (values
  (
    'ದ್ವಿಚಕ್ರ ವಾಹನ ಮೆಕ್ಯಾನಿಕ್ / ಪಂಕ್ಚರ್ ಟೆಕ್',
    'टू-व्हीलर मैकेनिक / पंचर टेक्नीशियन',
    'Two-Wheeler Mechanic / Puncture Tech',
    'Auto Garage', 850, '/day', '9:00 AM – 6:30 PM', 1,
    'B.H. Road, Tumakuru', 'B.H. Road', '12 min walk', '572101',
    'Sri Vinayaka Auto Garage', 'Prakash Gowda', '+91 98450 12345', 'Immediate', 'Evening UPI',
    'Immediate opening for bike servicing, puncture repair, and engine oil change. Tools provided at garage.',
    'ಶ್ರೀ ವಿನಾಯಕ ಆಟೋ ಗ್ಯಾರೇಜ್, ಬಿ.ಹೆಚ್. ರಸ್ತೆ. ತಕ್ಷಣ ಕೆಲಸ ಪ್ರಾರಂಭ, ಸಂಜೆ ಯುಪಿಐ ಪಾವತಿ.',
    13.3415, 77.1062
  ),
  (
    'ಕಟ್ಟಡ ಗೌಂಡಿ ಹೆಲ್ಪರ್ (ಮೇಸನ್ ಸಹಾಯಕ)',
    'निर्माण राजमिस्त्री हेल्पर (गौंडी)',
    'Construction Mason Helper (Goundi)',
    'Construction', 750, '/day', '8:00 AM – 5:00 PM', 2,
    'Kyathsandra, Tumakuru', 'Kyathsandra', '10 min auto/bus', '572104',
    'Maruthi Residential Site', 'Nagaraj Contractor', '+91 98210 98765', 'Immediate', 'Evening Cash',
    '3 days work for residential foundation cementing and brick shifting near Kyathsandra railway gate.',
    'ಕ್ಯಾತ್ಸಂದ್ರ ವಸತಿ ಕಟ್ಟಡ ಕೆಲಸ. 3 ದಿನಗಳ ಕೆಲಸ, ಪ್ರತಿದಿನ ಸಂಜೆ ನಗದು ಪಾವತಿ.',
    13.3106, 77.1636
  ),
  (
    'ಎಪಿಎಂಸಿ ಧಾನ್ಯ ಗೋದಾಮು ಲೋಡರ್ (ಹಮಾಲಿ)',
    'एपीएमसी अनाज गोदाम लोडर (हमाली)',
    'APMC Grain Godown Loader (Hamali)',
    'Logistics', 900, '/shift', '6:00 AM – 1:00 PM', 4,
    'Tumakuru APMC Market Yard', 'APMC Yard', '15 min city bus', '572103',
    'Basaveshwara Grain Traders', 'Shivakumar Shetty', '+91 97311 44556', 'Immediate', 'Evening Cash',
    'Morning shift 6 AM – 1 PM ragi & paddy sack loading. Breakfast and tea provided on site.',
    'ಬೆಳಿಗ್ಗೆ 6 ರಿಂದ ಮಧ್ಯಾಹ್ನ 1 ಗಂಟೆ ಪಾಳಿ. ರಾಗಿ ಮತ್ತು ಭತ್ತದ ಚೀಲ ಲೋಡಿಂಗ್. ತಿಂಡಿ ಸೌಲಭ್ಯವಿದೆ.',
    13.3568, 77.0842
  ),
  (
    'ಆರ್ಕ್ ವೆಲ್ಡರ್ / ಗ್ರಿಲ್ ಫ್ಯಾಬ್ರಿಕೇಟರ್',
    'आर्क वेल्डर / ग्रिल फैब्रिकेटर',
    'Arc Welder / Grill Fabricator',
    'Industrial', 1100, '/day', '8:30 AM – 6:00 PM', 2,
    'Vasanthnarasapura Industrial Shed', 'Vasanthnarasapura', 'KSRTC Bus #14', '572128',
    'Siddalingeshwara Fab Works', 'Mahesh Patil', '+91 99001 88990', 'Weekly Contract', 'Weekly UPI',
    'Weekly industrial truss and gate welding contract. Direct bus route from Tumakuru KSRTC Bus Stand.',
    'ವಸಂತನರಸಾಪುರ ಕೈಗಾರಿಕಾ ಶೆಡ್‌ನಲ್ಲಿ ವಾರದ ವೆಲ್ಡಿಂಗ್ ಗುತ್ತಿಗೆ. ಬಸ್ ಸೌಲಭ್ಯ ಲಭ್ಯವಿದೆ.',
    13.4285, 77.0882
  ),
  (
    'ಹಾರ್ಡ್‌ವೇರ್ ಮತ್ತು ಎಲೆಕ್ಟ್ರಿಕಲ್ ಅಂಗಡಿ ಹೆಲ್ಪರ್',
    'हार्डवेयर और इलेक्ट्रिकल शॉप हेल्पर',
    'Hardware & Electrical Shop Helper',
    'Retail Shop', 650, '/day', '9:30 AM – 7:30 PM', 1,
    'Chickpet Main Road, Tumakuru', 'Chickpet', '8 min walk', '572101',
    'Mahalakshmi Hardwares', 'Raghavendra Gupta', '+91 94480 22334', 'Tomorrow', 'Evening UPI',
    'Full-time or monthly ₹18,000 option available. Pipe sorting, local delivery, and counter help.',
    'ಚಿಕ್‌ಪೇಟೆ ಮುಖ್ಯ ರಸ್ತೆ ಹಾರ್ಡ್‌ವೇರ್ ಅಂಗಡಿ. ದಿನಕ್ಕೆ 650 ಅಥವಾ ತಿಂಗಳಿಗೆ 18,000 ರೂಪಾಯಿ.',
    13.3380, 77.1105
  ),
  (
    'ಕ್ಯಾಟರಿಂಗ್ ಮತ್ತು ಟೆಂಟ್ ಸೆಟಪ್ ಸಿಬ್ಬಂದಿ',
    'कैटरिंग और टेंट सेटअप क्रू',
    'Catering & Tent Setup Crew',
    'Events', 700, '/event', '7:00 AM – 4:00 PM', 5,
    'Siddaganga Extn Marriage Hall', 'B.H. Road', '10 min walk', '572102',
    'Sri Siddalinga Caterers', 'Basavaraju K.', '+91 98860 11998', 'Tomorrow', 'Evening Cash',
    'Tomorrow 7 AM reporting. Buffet counter arrangement and pandal setup. Breakfast & lunch included.',
    'ನಾಳೆ ಬೆಳಿಗ್ಗೆ 7 ಗಂಟೆಗೆ ಸಿದ್ಧಗಂಗಾ ಎಕ್ಸ್‌ಟೆನ್ಶನ್ ಕಲ್ಯಾಣ ಮಂಟಪದಲ್ಲಿ ಕೆಲಸ. ಊಟ ಉಚಿತ.',
    13.3292, 77.1180
  )
) as seed(
  title_kannada, title_hindi, title_english, category, wage, wage_unit, shift_time, slots_left,
  location, area_tag, commute_note, pincode, employer, owner_name, phone, urgency, payment_mode,
  description, description_kannada, lat, lng
)
where not exists (select 1 from public.jobs limit 1);

insert into public.workers (
  name, name_kannada, skill_kannada, skill_hindi, skill_english, experience, rating,
  location, wage_expected, phone, gigs_completed, audio_note, audio_note_kannada, lat, lng
)
select * from (values
  (
    'Ramesh Kumar', 'ರಮೇಶ್ ಕುಮಾರ್', 'ಗೌಂಡಿ ಮತ್ತು ಕಟ್ಟಡ ಕೆಲಸ', 'राजमिस्त्री और निर्माण कार्य', 'Mason & Plastering',
    '6 yrs exp', 4.9, 'Kyathsandra', 800, '+91 94480 11223', 142,
    'Namaskara, I am Ramesh from Kyathsandra. 6 years experience in brickwork, concrete & centering.',
    'ನಮಸ್ಕಾರ, ನಾನು ಕ್ಯಾತ್ಸಂದ್ರದ ರಮೇಶ್. ಗೌಂಡಿ ಕೆಲಸ, ಪ್ಲಾಸ್ಟರಿಂಗ್ ಮತ್ತು ಸೆಂಟರಿಂಗ್‌ನಲ್ಲಿ 6 ವರ್ಷ ಅನುಭವ ಇದೆ.',
    13.3145, 77.1585
  ),
  (
    'Lakshmiamma', 'ಲಕ್ಷ್ಮಮ್ಮ', 'ಅಡುಗೆ ಮತ್ತು ಕಲ್ಯಾಣ ಮಂಟಪ ಸಹಾಯಕಿ', 'रसोई और कैटरिंग सहायक', 'Cook & Catering Helper',
    '8 yrs exp', 4.8, 'B.H. Road', 650, '+91 98860 33445', 215,
    'I handle home cooking, marriage hall vegetable cutting, and buffet serving across Tumakuru.',
    'ನಾನು ಮನೆ ಅಡುಗೆ ಮತ್ತು ಕಲ್ಯಾಣ ಮಂಟಪದ ಅಡುಗೆ ಸಹಾಯಕಿಯಾಗಿ ಕೆಲಸ ಮಾಡುತ್ತೇನೆ.',
    13.3402, 77.1092
  ),
  (
    'Manjunath Swamy', 'ಮಂಜುನಾಥ ಸ್ವಾಮಿ', 'ಎಲೆಕ್ಟ್ರಿಷಿಯನ್ ಮತ್ತು ಮೋಟಾರ್ ವೈಂಡಿಂಗ್', 'इलेक्ट्रीशियन और वायरिंग', 'Electrician & Motor Tech',
    '5 yrs exp', 4.9, 'Ashok Nagar', 900, '+91 97420 55667', 98,
    'Certified wireman for shops, borewell starters, and house wiring in Tumakuru town.',
    'ಅಂಗಡಿ ವೈರಿಂಗ್, ಬೋರ್‌ವೆಲ್ ಸ್ಟಾರ್ಟರ್ ಮತ್ತು ಮನೆ ಎಲೆಕ್ಟ್ರಿಕಲ್ ರಿಪೇರಿ ಕೆಲಸ ಮಾಡುತ್ತೇನೆ.',
    13.3324, 77.1028
  ),
  (
    'Rafiq Ahmed', 'ರಫೀಕ್ ಅಹ್ಮದ್', 'ಆರ್ಕ್ ವೆಲ್ಡರ್ ಮತ್ತು ಲೋಡಿಂಗ್', 'आर्क वेल्डर और फैब्रिकेटर', 'Arc Welder & Fabricator',
    '7 yrs exp', 4.7, 'Vasanthnarasapura', 1000, '+91 98451 77889', 164,
    'Experienced in rolling shutters, grill gates, and industrial shed welding.',
    'ರೋಲಿಂಗ್ ಶಟರ್, ಗ್ರಿಲ್ ಗೇಟ್ ಮತ್ತು ಶೆಡ್ ವೆಲ್ಡಿಂಗ್ ಕೆಲಸದಲ್ಲಿ 7 ವರ್ಷ ಅನುಭವ ಇದೆ.',
    13.4190, 77.0915
  )
) as seed(
  name, name_kannada, skill_kannada, skill_hindi, skill_english, experience, rating,
  location, wage_expected, phone, gigs_completed, audio_note, audio_note_kannada, lat, lng
)
where not exists (select 1 from public.workers limit 1);
