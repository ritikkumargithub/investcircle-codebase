# InvestCircle — MVP

React + Supabase app: profiles (Retail / Portfolio Provider), a feed, follow, and
booking requests, with real email/password authentication.

## 1. Create a free Supabase project
1. Go to https://supabase.com, sign up, and create a new project (pick any region close to India).
2. Wait ~2 minutes for it to provision.

## 2. Set up the database
1. In your Supabase project, open **SQL Editor** → **New query**.
2. Paste the entire contents of `supabase-schema.sql` and click **Run**.
   This creates the tables and the security rules that keep each user's data safe.

## 3. Get your API keys
1. In Supabase, go to **Project Settings → API**.
2. Copy the **Project URL** and the **anon public** key.

## 4. Configure the app
1. In this project folder, copy `.env.example` to `.env`.
2. Paste in your Project URL and anon key:
   ```
   VITE_SUPABASE_URL=https://your-project-ref.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-public-key
   ```

## 5. Run it locally (optional, to test first)
```
npm install
npm run dev
```
Open the URL it prints (usually http://localhost:5173).

## 6. Deploy for free on Vercel
1. Push this folder to a new GitHub repository.
2. Go to https://vercel.com, sign in with GitHub, click **Add New → Project**, and import the repo.
3. In the project's **Environment Variables** settings, add `VITE_SUPABASE_URL` and
   `VITE_SUPABASE_ANON_KEY` with the same values as your `.env`.
4. Click **Deploy**. You'll get a live URL like `investcircle.vercel.app`.

## Email confirmation note
By default, Supabase requires users to click a confirmation link in their email before
they can log in. For early testing you can turn this off in
**Supabase → Authentication → Providers → Email → "Confirm email"** (toggle off),
then turn it back on before a real public launch.

## What's real here
- Real signup/login/logout via Supabase Auth (bcrypt-hashed passwords, not visible to you or Claude)
- Real Postgres database with Row Level Security — each user can only write their own data
- Live feed and bookings updates via Supabase Realtime

## What's still missing for a full public launch
- Payments (Razorpay/Stripe integration for paid bookings)
- In-app chat tied to confirmed bookings
- Admin verification workflow for SEBI registration numbers (currently self-reported)
- Rate limiting, content moderation, and legal/compliance review of public posts
