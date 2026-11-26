-- Run this in your Supabase Project -> SQL Editor -> New Query
-- Supports PostGIS Tumakuru radius matching + ElevenLabs Voice Agent persistence

create extension if not exists postgis;

-- 1. USERS TABLE (Worker & Employer Accounts)
create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text unique not null,
  role text not null check (role in ('worker', 'employer')),
  created_at timestamptz not null default now()
);

-- 2. JOBS TABLE
create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  title text,
  title_kannada text not null default '',
  title_hindi text not null default '',
  title_english text not null default '',
  category text not null default 'General',
  wage integer not null check (wage > 0),
  wage_unit text not null default '/day',
  shift_time text not null default '9:00 AM – 6:00 PM',
  workers_count integer not null default 1,
  slots_left integer not null default 1,
  area text,
  location text not null default '',
  area_tag text not null default '',
  distance_km numeric not null default 2.5,
  commute_note text not null default '10 min walk',
  pincode text not null default '572101',
  employer_name text not null default 'Local Tumakuru Business',
  employer text not null default 'Local Tumakuru Business',
  owner_name text not null default 'Owner',
  verified_employer boolean not null default true,
  employer_phone text,
  phone text not null default '',
  urgency text not null default 'Immediate',
  payment_mode text not null default 'Daily UPI / Cash',
  status text not null default 'open',
  description text not null default '',
  description_kannada text not null default '',
  lat double precision not null default 13.3392,
  lng double precision not null default 77.1140,
  created_at timestamptz not null default now()
);

-- Safely add new columns if upgrading an earlier jobs table
alter table public.jobs add column if not exists title text;
alter table public.jobs add column if not exists area text;
alter table public.jobs add column if not exists distance_km numeric default 2.5;
alter table public.jobs add column if not exists workers_count integer default 1;
alter table public.jobs add column if not exists employer_name text default 'Local Tumakuru Business';
alter table public.jobs add column if not exists employer_phone text;
alter table public.jobs add column if not exists status text default 'open';

-- 3. WORKERS TABLE
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
  lat double precision not null default 13.3392,
  lng double precision not null default 77.1140,
  created_at timestamptz not null default now()
);

-- 4. SHIFT APPLICATIONS TABLE
create table if not exists public.shift_applications (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  worker_phone text not null,
  status text not null default 'Shift Confirmed',
  created_at timestamptz not null default now()
);

-- 5. ROW LEVEL SECURITY (Open MVP policies)
alter table public.users enable row level security;
alter table public.jobs enable row level security;
alter table public.workers enable row level security;
alter table public.shift_applications enable row level security;

drop policy if exists "Public read users" on public.users;
create policy "Public read users" on public.users for select using (true);
drop policy if exists "Public insert users" on public.users;
create policy "Public insert users" on public.users for insert with check (true);
drop policy if exists "Public update users" on public.users;
create policy "Public update users" on public.users for update using (true);

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

-- 6. ENABLE SUPABASE REALTIME FOR JOBS
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'jobs'
  ) then
    alter publication supabase_realtime add table public.jobs;
  end if;
exception when others then
  null;
end $$;
