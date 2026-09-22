-- InvestCircle database schema for Supabase
-- This file reflects everything already applied to the live project.
-- Run this once (in order) in a fresh project's SQL Editor if setting up from scratch.

-- 1) PROFILES
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

-- 2) POSTS (with optional image)
create table if not exists posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references profiles(id) on delete cascade,
  author_name text not null,
  author_specialization text,
  content text not null,
  image_url text,
  created_at timestamptz not null default now()
);

-- 3) FOLLOWS (retail -> advisor, or advisor -> advisor; never -> retail, enforced in app)
create table if not exists follows (
  follower_id uuid not null references profiles(id) on delete cascade,
  target_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, target_id)
);

-- 4) BOOKINGS (1:1 sessions between a retail user and an advisor)
create table if not exists bookings (
  id uuid primary key default gen_random_uuid(),
  retail_id uuid not null references profiles(id) on delete cascade,
  retail_name text not null,
  ps_id uuid not null references profiles(id) on delete cascade,
  ps_name text not null,
  preferred_time text,
  booking_date date,
  booking_time text,
  note text,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'declined')),
  created_at timestamptz not null default now()
);

-- 5) LIKES and COMMENTS on posts
create table if not exists post_likes (
  post_id uuid not null references posts(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table if not exists post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references posts(id) on delete cascade,
  author_id uuid not null references profiles(id) on delete cascade,
  author_name text not null,
  content text not null,
  created_at timestamptz not null default now()
);

-- 6) GROUP SESSIONS (advisor-hosted, capacity-limited)
create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  ps_id uuid not null references profiles(id) on delete cascade,
  ps_name text not null,
  title text not null,
  description text,
  session_date date not null,
  session_time text not null,
  capacity int not null check (capacity >= 1),
  status text not null default 'scheduled' check (status in ('scheduled', 'cancelled')),
  created_at timestamptz not null default now()
);

create table if not exists session_registrations (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  retail_id uuid not null references profiles(id) on delete cascade,
  retail_name text not null,
  created_at timestamptz not null default now(),
  unique (session_id, retail_id)
);

-- ================== ROW LEVEL SECURITY ==================
alter table profiles enable row level security;
alter table posts enable row level security;
alter table follows enable row level security;
alter table bookings enable row level security;
alter table post_likes enable row level security;
alter table post_comments enable row level security;
alter table sessions enable row level security;
alter table session_registrations enable row level security;

create policy "Profiles are viewable by everyone signed in" on profiles for select using (auth.role() = 'authenticated');
create policy "Users can insert their own profile" on profiles for insert with check (auth.uid() = id);
create policy "Users can update their own profile" on profiles for update using (auth.uid() = id) with check (auth.uid() = id);

create policy "Posts are viewable by everyone signed in" on posts for select using (auth.role() = 'authenticated');
create policy "Users can create their own posts" on posts for insert with check (auth.uid() = author_id);

create policy "Follows are viewable by everyone signed in" on follows for select using (auth.role() = 'authenticated');
create policy "Users can create their own follow" on follows for insert with check (auth.uid() = follower_id);
create policy "Users can delete their own follow" on follows for delete using (auth.uid() = follower_id);

create policy "Bookings are viewable by the two people involved" on bookings for select using (auth.uid() = retail_id or auth.uid() = ps_id);
create policy "Retail users can create a booking as themselves" on bookings for insert with check (auth.uid() = retail_id);
create policy "Advisors can update the status of their own bookings" on bookings for update using (auth.uid() = ps_id);

create policy "Likes are viewable by everyone signed in" on post_likes for select using (auth.role() = 'authenticated');
create policy "Users can like as themselves" on post_likes for insert with check (auth.uid() = user_id);
create policy "Users can unlike their own like" on post_likes for delete using (auth.uid() = user_id);

create policy "Comments are viewable by everyone signed in" on post_comments for select using (auth.role() = 'authenticated');
create policy "Users can comment as themselves" on post_comments for insert with check (auth.uid() = author_id);

create policy "Sessions are viewable by everyone signed in" on sessions for select using (auth.role() = 'authenticated');
create policy "Advisors can create their own sessions" on sessions for insert with check (auth.uid() = ps_id);
create policy "Advisors can update their own sessions" on sessions for update using (auth.uid() = ps_id);

create policy "Registrations are viewable by everyone signed in" on session_registrations for select using (auth.role() = 'authenticated');
create policy "Retail users can register themselves" on session_registrations for insert with check (auth.uid() = retail_id);
create policy "Retail users can cancel their own registration" on session_registrations for delete using (auth.uid() = retail_id);

-- ================== REALTIME ==================
alter publication supabase_realtime add table posts;
alter publication supabase_realtime add table bookings;
alter publication supabase_realtime add table post_likes;
alter publication supabase_realtime add table post_comments;
alter publication supabase_realtime add table sessions;
alter publication supabase_realtime add table session_registrations;

-- ================== STORAGE ==================
insert into storage.buckets (id, name, public) values ('post-images', 'post-images', true) on conflict (id) do nothing;

create policy "Public read for post-images" on storage.objects for select using (bucket_id = 'post-images');
create policy "Authenticated users can upload post images" on storage.objects for insert to authenticated with check (bucket_id = 'post-images');

-- 9) Duration + completion status for both booking types (time-gated call joins)
alter table bookings add column if not exists duration_minutes int not null default 30;
alter table sessions add column if not exists duration_minutes int not null default 30;

alter table bookings drop constraint if exists bookings_status_check;
alter table bookings add constraint bookings_status_check check (status in ('pending','confirmed','declined','completed'));

alter table sessions drop constraint if exists sessions_status_check;
alter table sessions add constraint sessions_status_check check (status in ('scheduled','cancelled','completed'));

create policy "Retail users can update their own bookings (e.g. mark completed)"
  on bookings for update
  using (auth.uid() = retail_id)
  with check (auth.uid() = retail_id);
