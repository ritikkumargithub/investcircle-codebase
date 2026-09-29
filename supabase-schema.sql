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
alter publication supabase_realtime add table wallet_transactions;
alter publication supabase_realtime add table profiles;

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

-- 10) Payments (dummy) + wallet
alter table profiles add column if not exists wallet_balance int not null default 0;
alter table profiles add column if not exists session_price int not null default 0;

alter table bookings add column if not exists price int not null default 0;
alter table bookings add column if not exists payment_status text not null default 'pending' check (payment_status in ('pending','paid','refunded'));

alter table sessions add column if not exists price int not null default 0;

alter table session_registrations add column if not exists price_paid int not null default 0;
alter table session_registrations add column if not exists payment_status text not null default 'pending' check (payment_status in ('pending','paid','refunded'));

create table if not exists wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  type text not null check (type in ('signup_bonus','topup','booking_payment','booking_earning','booking_refund','session_payment','session_earning','session_refund')),
  amount int not null,
  description text,
  related_booking_id uuid references bookings(id) on delete set null,
  related_session_id uuid references sessions(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table wallet_transactions enable row level security;
create policy "Users can view their own wallet transactions" on wallet_transactions for select using (auth.uid() = user_id);
create policy "Users can insert their own wallet transactions" on wallet_transactions for insert with check (auth.uid() = user_id);
create unique index if not exists uniq_signup_bonus_per_user on wallet_transactions(user_id) where type = 'signup_bonus';
alter publication supabase_realtime add table wallet_transactions;

-- Atomic, server-side payment functions (SECURITY DEFINER; each independently checks
-- auth.uid() before moving any wallet balance, so a client can never move someone else's money).
-- Granted to `authenticated` only; revoked from anon/public.

create or replace function book_one_on_one(
  p_ps_id uuid, p_booking_date date, p_booking_time text, p_duration_minutes int, p_note text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_investor_id uuid := auth.uid();
  v_investor_name text; v_ps_name text; v_price int; v_balance int; v_booking_id uuid;
begin
  if v_investor_id is null then raise exception 'Not authenticated'; end if;
  select name, wallet_balance into v_investor_name, v_balance from profiles where id = v_investor_id and role = 'retail';
  if v_investor_name is null then raise exception 'Only retail investors can book sessions'; end if;
  select name, session_price into v_ps_name, v_price from profiles where id = p_ps_id and role = 'ps';
  if v_ps_name is null then raise exception 'Advisor not found'; end if;
  if v_balance < v_price then raise exception 'Insufficient wallet balance'; end if;

  update profiles set wallet_balance = wallet_balance - v_price where id = v_investor_id;
  update profiles set wallet_balance = wallet_balance + v_price where id = p_ps_id;

  insert into bookings (retail_id, retail_name, ps_id, ps_name, booking_date, booking_time, duration_minutes, note, status, price, payment_status, preferred_time)
  values (v_investor_id, v_investor_name, p_ps_id, v_ps_name, p_booking_date, p_booking_time, p_duration_minutes, p_note, 'pending', v_price, 'paid', p_booking_date || ' · ' || p_booking_time)
  returning id into v_booking_id;

  insert into wallet_transactions (user_id, type, amount, description, related_booking_id) values
    (v_investor_id, 'booking_payment', -v_price, 'Booking with ' || v_ps_name, v_booking_id),
    (p_ps_id, 'booking_earning', v_price, 'Booking from ' || v_investor_name, v_booking_id);
  return v_booking_id;
end; $$;

create or replace function decline_booking(p_booking_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_ps_id uuid; v_retail_id uuid; v_price int; v_status text; v_payment_status text;
begin
  select ps_id, retail_id, price, status, payment_status into v_ps_id, v_retail_id, v_price, v_status, v_payment_status
  from bookings where id = p_booking_id;
  if v_ps_id is null then raise exception 'Booking not found'; end if;
  if auth.uid() <> v_ps_id then raise exception 'Not authorized'; end if;
  if v_status <> 'pending' then raise exception 'Only pending bookings can be declined'; end if;

  update bookings set status = 'declined', payment_status = 'refunded' where id = p_booking_id;

  if v_payment_status = 'paid' then
    update profiles set wallet_balance = wallet_balance + v_price where id = v_retail_id;
    update profiles set wallet_balance = wallet_balance - v_price where id = v_ps_id;
    insert into wallet_transactions (user_id, type, amount, description, related_booking_id) values
      (v_retail_id, 'booking_refund', v_price, 'Refund: advisor declined', p_booking_id),
      (v_ps_id, 'booking_refund', -v_price, 'Refund issued to investor', p_booking_id);
  end if;
end; $$;

create or replace function register_for_session(p_session_id uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_investor_id uuid := auth.uid();
  v_investor_name text; v_balance int; v_ps_id uuid; v_price int; v_capacity int; v_status text; v_count int; v_reg_id uuid;
begin
  if v_investor_id is null then raise exception 'Not authenticated'; end if;
  select name, wallet_balance into v_investor_name, v_balance from profiles where id = v_investor_id and role = 'retail';
  if v_investor_name is null then raise exception 'Only retail investors can register'; end if;
  select ps_id, price, capacity, status into v_ps_id, v_price, v_capacity, v_status from sessions where id = p_session_id for update;
  if v_ps_id is null then raise exception 'Session not found'; end if;
  if v_status <> 'scheduled' then raise exception 'Session is not open for registration'; end if;
  select count(*) into v_count from session_registrations where session_id = p_session_id;
  if v_count >= v_capacity then raise exception 'Session is full'; end if;
  if v_balance < v_price then raise exception 'Insufficient wallet balance'; end if;

  update profiles set wallet_balance = wallet_balance - v_price where id = v_investor_id;
  update profiles set wallet_balance = wallet_balance + v_price where id = v_ps_id;

  insert into session_registrations (session_id, retail_id, retail_name, price_paid, payment_status)
  values (p_session_id, v_investor_id, v_investor_name, v_price, 'paid')
  returning id into v_reg_id;

  insert into wallet_transactions (user_id, type, amount, description, related_session_id) values
    (v_investor_id, 'session_payment', -v_price, 'Session registration', p_session_id),
    (v_ps_id, 'session_earning', v_price, 'Session registration income', p_session_id);
  return v_reg_id;
end; $$;

create or replace function cancel_registration(p_session_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_investor_id uuid := auth.uid();
  v_ps_id uuid; v_reg record;
begin
  select * into v_reg from session_registrations where session_id = p_session_id and retail_id = v_investor_id;
  if v_reg.id is null then raise exception 'Registration not found'; end if;
  select ps_id into v_ps_id from sessions where id = p_session_id;
  delete from session_registrations where id = v_reg.id;

  if v_reg.payment_status = 'paid' then
    update profiles set wallet_balance = wallet_balance + v_reg.price_paid where id = v_investor_id;
    update profiles set wallet_balance = wallet_balance - v_reg.price_paid where id = v_ps_id;
    insert into wallet_transactions (user_id, type, amount, description, related_session_id) values
      (v_investor_id, 'session_refund', v_reg.price_paid, 'Refund: cancelled registration', p_session_id),
      (v_ps_id, 'session_refund', -v_reg.price_paid, 'Refund issued to investor', p_session_id);
  end if;
end; $$;

create or replace function cancel_session(p_session_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_ps_id uuid; r record;
begin
  select ps_id into v_ps_id from sessions where id = p_session_id;
  if v_ps_id is null then raise exception 'Session not found'; end if;
  if auth.uid() <> v_ps_id then raise exception 'Not authorized'; end if;
  update sessions set status = 'cancelled' where id = p_session_id;
  for r in select * from session_registrations where session_id = p_session_id and payment_status = 'paid' loop
    update profiles set wallet_balance = wallet_balance + r.price_paid where id = r.retail_id;
    update profiles set wallet_balance = wallet_balance - r.price_paid where id = v_ps_id;
    insert into wallet_transactions (user_id, type, amount, description, related_session_id) values
      (r.retail_id, 'session_refund', r.price_paid, 'Refund: session cancelled', p_session_id),
      (v_ps_id, 'session_refund', -r.price_paid, 'Refund issued to investor', p_session_id);
    update session_registrations set payment_status = 'refunded' where id = r.id;
  end loop;
end; $$;

revoke all on function book_one_on_one(uuid, date, text, int, text) from public, anon;
revoke all on function decline_booking(uuid) from public, anon;
revoke all on function register_for_session(uuid) from public, anon;
revoke all on function cancel_registration(uuid) from public, anon;
revoke all on function cancel_session(uuid) from public, anon;

grant execute on function book_one_on_one(uuid, date, text, int, text) to authenticated;
grant execute on function decline_booking(uuid) to authenticated;
grant execute on function register_for_session(uuid) to authenticated;
grant execute on function cancel_registration(uuid) to authenticated;
grant execute on function cancel_session(uuid) to authenticated;

-- 11) Realtime fix: profiles must be in the publication for live wallet-balance sync
alter publication supabase_realtime add table profiles;

-- 12) Personal notes/todo list (private per user)
create table if not exists notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  content text not null,
  is_done boolean not null default false,
  created_at timestamptz not null default now()
);

alter table notes enable row level security;
create policy "Users can view their own notes" on notes for select using (auth.uid() = user_id);
create policy "Users can create their own notes" on notes for insert with check (auth.uid() = user_id);
create policy "Users can update their own notes" on notes for update using (auth.uid() = user_id);
create policy "Users can delete their own notes" on notes for delete using (auth.uid() = user_id);
alter publication supabase_realtime add table notes;

-- 13) Advisor categories (for Discover search/filter)
alter table profiles add column if not exists categories text[] not null default '{}'::text[];

-- 14) Notifications, referrals, saved posts, and in-app chat tied to bookings
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  type text not null check (type in (
    'booking_request','booking_confirmed','booking_declined','booking_completed',
    'session_registration','new_follower','new_post','session_reminder','booking_reminder','referral_bonus'
  )),
  message text not null,
  related_booking_id uuid references bookings(id) on delete cascade,
  related_session_id uuid references sessions(id) on delete cascade,
  related_post_id uuid references posts(id) on delete cascade,
  related_user_id uuid references profiles(id) on delete set null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);
alter table notifications enable row level security;
create policy "Users can view their own notifications" on notifications for select using (auth.uid() = user_id);
create policy "Users can mark their own notifications read" on notifications for update using (auth.uid() = user_id);
alter publication supabase_realtime add table notifications;

alter table bookings add column if not exists reminder_sent boolean not null default false;
alter table sessions add column if not exists reminder_sent boolean not null default false;

alter table profiles add column if not exists referral_code text unique;
create table if not exists referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references profiles(id) on delete cascade,
  referred_id uuid not null unique references profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table referrals enable row level security;
create policy "Users can view referrals they're part of" on referrals for select using (auth.uid() = referrer_id or auth.uid() = referred_id);

create table if not exists saved_posts (
  user_id uuid not null references profiles(id) on delete cascade,
  post_id uuid not null references posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);
alter table saved_posts enable row level security;
create policy "Users can view their own saved posts" on saved_posts for select using (auth.uid() = user_id);
create policy "Users can save posts as themselves" on saved_posts for insert with check (auth.uid() = user_id);
create policy "Users can unsave their own saved posts" on saved_posts for delete using (auth.uid() = user_id);
alter publication supabase_realtime add table saved_posts;

create table if not exists chat_messages (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings(id) on delete cascade,
  sender_id uuid not null references profiles(id) on delete cascade,
  sender_name text not null,
  content text not null,
  created_at timestamptz not null default now()
);
alter table chat_messages enable row level security;
create policy "Participants can view their booking's chat" on chat_messages for select
  using (exists (select 1 from bookings b where b.id = chat_messages.booking_id and (b.retail_id = auth.uid() or b.ps_id = auth.uid())));
create policy "Participants can send messages in their booking's chat" on chat_messages for insert
  with check (sender_id = auth.uid() and exists (select 1 from bookings b where b.id = chat_messages.booking_id and (b.retail_id = auth.uid() or b.ps_id = auth.uid())));
alter publication supabase_realtime add table chat_messages;

-- Notification triggers (fire regardless of which client performs the action)
create or replace function notify_new_booking() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into notifications (user_id, type, message, related_booking_id, related_user_id)
  values (NEW.ps_id, 'booking_request', NEW.retail_name || ' requested a session on ' || NEW.booking_date || ' at ' || NEW.booking_time, NEW.id, NEW.retail_id);
  return NEW;
end; $$;
drop trigger if exists trg_notify_new_booking on bookings;
create trigger trg_notify_new_booking after insert on bookings for each row execute function notify_new_booking();

create or replace function notify_booking_status_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if NEW.status is distinct from OLD.status then
    if NEW.status = 'confirmed' then
      insert into notifications (user_id, type, message, related_booking_id, related_user_id)
      values (NEW.retail_id, 'booking_confirmed', NEW.ps_name || ' confirmed your session on ' || NEW.booking_date, NEW.id, NEW.ps_id);
    elsif NEW.status = 'declined' then
      insert into notifications (user_id, type, message, related_booking_id, related_user_id)
      values (NEW.retail_id, 'booking_declined', NEW.ps_name || ' declined your request. Your payment was refunded.', NEW.id, NEW.ps_id);
    elsif NEW.status = 'completed' then
      insert into notifications (user_id, type, message, related_booking_id, related_user_id) values
        (NEW.retail_id, 'booking_completed', 'Your session with ' || NEW.ps_name || ' is complete.', NEW.id, NEW.ps_id),
        (NEW.ps_id, 'booking_completed', 'Your session with ' || NEW.retail_name || ' is complete.', NEW.id, NEW.retail_id);
    end if;
  end if;
  return NEW;
end; $$;
drop trigger if exists trg_notify_booking_status on bookings;
create trigger trg_notify_booking_status after update on bookings for each row execute function notify_booking_status_change();

create or replace function notify_new_follower() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_name text;
begin
  select name into v_name from profiles where id = NEW.follower_id;
  insert into notifications (user_id, type, message, related_user_id)
  values (NEW.target_id, 'new_follower', coalesce(v_name, 'Someone') || ' started following you', NEW.follower_id);
  return NEW;
end; $$;
drop trigger if exists trg_notify_new_follower on follows;
create trigger trg_notify_new_follower after insert on follows for each row execute function notify_new_follower();

create or replace function notify_new_post() returns trigger
language plpgsql security definer set search_path = public as $$
declare r record;
begin
  for r in select follower_id from follows where target_id = NEW.author_id loop
    insert into notifications (user_id, type, message, related_post_id, related_user_id)
    values (r.follower_id, 'new_post', NEW.author_name || ' posted an update', NEW.id, NEW.author_id);
  end loop;
  return NEW;
end; $$;
drop trigger if exists trg_notify_new_post on posts;
create trigger trg_notify_new_post after insert on posts for each row execute function notify_new_post();

create or replace function notify_session_registration() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_ps_id uuid; v_title text;
begin
  select ps_id, title into v_ps_id, v_title from sessions where id = NEW.session_id;
  insert into notifications (user_id, type, message, related_session_id, related_user_id)
  values (v_ps_id, 'session_registration', NEW.retail_name || ' registered for ' || v_title, NEW.session_id, NEW.retail_id);
  return NEW;
end; $$;
drop trigger if exists trg_notify_session_registration on session_registrations;
create trigger trg_notify_session_registration after insert on session_registrations for each row execute function notify_session_registration();

-- Trigger functions must never be directly callable via the API
revoke all on function notify_new_booking() from public, anon, authenticated;
revoke all on function notify_booking_status_change() from public, anon, authenticated;
revoke all on function notify_new_follower() from public, anon, authenticated;
revoke all on function notify_new_post() from public, anon, authenticated;
revoke all on function notify_session_registration() from public, anon, authenticated;

-- Reminder + referral RPCs (SECURITY DEFINER; each checks auth.uid() before writing)
create or replace function send_booking_reminder(p_booking_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare b record;
begin
  select * into b from bookings where id = p_booking_id for update;
  if b.id is null then raise exception 'Booking not found'; end if;
  if auth.uid() <> b.retail_id and auth.uid() <> b.ps_id then raise exception 'Not authorized'; end if;
  if b.reminder_sent or b.status <> 'confirmed' then return; end if;
  update bookings set reminder_sent = true where id = p_booking_id;
  insert into notifications (user_id, type, message, related_booking_id, related_user_id) values
    (b.retail_id, 'booking_reminder', 'Your session with ' || b.ps_name || ' starts soon', p_booking_id, b.ps_id),
    (b.ps_id, 'booking_reminder', 'Your session with ' || b.retail_name || ' starts soon', p_booking_id, b.retail_id);
end; $$;

create or replace function send_session_reminder(p_session_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare s record; r record; v_is_participant boolean;
begin
  select * into s from sessions where id = p_session_id for update;
  if s.id is null then raise exception 'Session not found'; end if;
  select exists(select 1 from session_registrations where session_id = p_session_id and retail_id = auth.uid()) into v_is_participant;
  if auth.uid() <> s.ps_id and not v_is_participant then raise exception 'Not authorized'; end if;
  if s.reminder_sent then return; end if;
  update sessions set reminder_sent = true where id = p_session_id;
  insert into notifications (user_id, type, message, related_session_id) values (s.ps_id, 'session_reminder', 'Your session "' || s.title || '" starts soon', p_session_id);
  for r in select retail_id from session_registrations where session_id = p_session_id loop
    insert into notifications (user_id, type, message, related_session_id) values (r.retail_id, 'session_reminder', s.title || ' starts soon', p_session_id);
  end loop;
end; $$;

create or replace function apply_referral(p_referred_id uuid, p_code text) returns void
language plpgsql security definer set search_path = public as $$
declare v_referrer_id uuid; v_referrer_name text; v_referred_name text;
begin
  if auth.uid() <> p_referred_id then raise exception 'Not authorized'; end if;
  select id, name into v_referrer_id, v_referrer_name from profiles where referral_code = p_code;
  if v_referrer_id is null then raise exception 'Referral code not found'; end if;
  if v_referrer_id = p_referred_id then raise exception 'Cannot refer yourself'; end if;
  select name into v_referred_name from profiles where id = p_referred_id;
  insert into referrals (referrer_id, referred_id) values (v_referrer_id, p_referred_id);
  update profiles set wallet_balance = wallet_balance + 50 where id = v_referrer_id;
  update profiles set wallet_balance = wallet_balance + 50 where id = p_referred_id;
  insert into wallet_transactions (user_id, type, amount, description) values
    (v_referrer_id, 'referral_bonus', 50, 'Referral bonus: ' || coalesce(v_referred_name, 'a new user') || ' joined'),
    (p_referred_id, 'referral_bonus', 50, 'Referral bonus for signing up with a code');
  insert into notifications (user_id, type, message, related_user_id)
  values (v_referrer_id, 'referral_bonus', 'You earned ₹50 for referring ' || coalesce(v_referred_name, 'a new user'), p_referred_id);
end; $$;

revoke all on function send_booking_reminder(uuid) from public, anon;
revoke all on function send_session_reminder(uuid) from public, anon;
revoke all on function apply_referral(uuid, text) from public, anon;
grant execute on function send_booking_reminder(uuid) to authenticated;
grant execute on function send_session_reminder(uuid) to authenticated;
grant execute on function apply_referral(uuid, text) to authenticated;
