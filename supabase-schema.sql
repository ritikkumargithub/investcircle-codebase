-- InvestCircle database schema for Supabase
-- Run this once in your Supabase project's SQL Editor (Project -> SQL Editor -> New query)

-- 1) PROFILES: one row per user, linked to Supabase's built-in auth.users
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('retail', 'ps')),
  name text not null,
  specialization text,
  reg_type text check (reg_type in ('RIA', 'RA') or reg_type is null),
  sebi_reg_no text,
  bio text,
  created_at timestamptz not null default now()
);

-- 2) POSTS: advisor updates on the feed
create table if not exists posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references profiles(id) on delete cascade,
  author_name text not null,
  author_specialization text,
  content text not null,
  created_at timestamptz not null default now()
);

-- 3) FOLLOWS: retail users following advisors
create table if not exists follows (
  follower_id uuid not null references profiles(id) on delete cascade,
  target_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, target_id)
);

-- 4) BOOKINGS: session requests between retail users and advisors
create table if not exists bookings (
  id uuid primary key default gen_random_uuid(),
  retail_id uuid not null references profiles(id) on delete cascade,
  retail_name text not null,
  ps_id uuid not null references profiles(id) on delete cascade,
  ps_name text not null,
  preferred_time text not null,
  note text,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'declined')),
  created_at timestamptz not null default now()
);

-- ================== ROW LEVEL SECURITY ==================
-- This is what actually keeps one user's data safe from another.
-- Without these policies, RLS blocks ALL access by default once enabled.

alter table profiles enable row level security;
alter table posts enable row level security;
alter table follows enable row level security;
alter table bookings enable row level security;

-- Profiles: anyone signed in can read all profiles (needed to browse advisors),
-- but you can only insert/update your OWN profile row.
create policy "Profiles are viewable by everyone signed in"
  on profiles for select
  using (auth.role() = 'authenticated');

create policy "Users can insert their own profile"
  on profiles for insert
  with check (auth.uid() = id);

create policy "Users can update their own profile"
  on profiles for update
  using (auth.uid() = id);

-- Posts: anyone signed in can read; only the author can insert as themselves.
create policy "Posts are viewable by everyone signed in"
  on posts for select
  using (auth.role() = 'authenticated');

create policy "Users can create their own posts"
  on posts for insert
  with check (auth.uid() = author_id);

-- Follows: a user can see and manage only their own follow relationships,
-- plus advisors can see who follows them (optional: kept simple here — everyone
-- signed in can read follow rows, but only write their own).
create policy "Follows are viewable by everyone signed in"
  on follows for select
  using (auth.role() = 'authenticated');

create policy "Users can create their own follow"
  on follows for insert
  with check (auth.uid() = follower_id);

create policy "Users can delete their own follow"
  on follows for delete
  using (auth.uid() = follower_id);

-- Bookings: only the two people involved (the retail user and the advisor) can
-- see or touch a given booking row.
create policy "Bookings are viewable by the two people involved"
  on bookings for select
  using (auth.uid() = retail_id or auth.uid() = ps_id);

create policy "Retail users can create a booking as themselves"
  on bookings for insert
  with check (auth.uid() = retail_id);

create policy "Advisors can update the status of their own bookings"
  on bookings for update
  using (auth.uid() = ps_id);

-- Realtime: enable so the app's live feed/bookings subscriptions work
alter publication supabase_realtime add table posts;
alter publication supabase_realtime add table bookings;
