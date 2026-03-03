# Daily Reflection

A private journaling app with AI-powered reflection. Write daily entries, track your mood and streaks, and get structured insights from Claude.

## Features

- **Daily entries** — write, tag, and rate your mood (1–10) each day
- **Entry history** — search and filter all past entries by keyword or tag
- **Stats** — 14-day streak, avg mood, top tags, word-count chart
- **Reflect Deeper** — AI analysis of a single entry: follow-up questions, reframes, micro-actions
- **Weekly Summary** — AI synthesis of the last 7 days: themes, wins, stressors, suggested experiments

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Angular 21 + Angular Material (M3) |
| Backend | Supabase (Postgres + Auth + Edge Functions) |
| AI | Claude via Anthropic API (called from Edge Functions only) |
| Charts | Chart.js via ng2-charts |

---

## Setup

### 1. Prerequisites

- Node.js 20+
- [Supabase CLI](https://supabase.com/docs/guides/cli)
- A [Supabase](https://supabase.com) project
- An [Anthropic API key](https://console.anthropic.com)

### 2. Clone and install

```bash
git clone <repo-url>
cd daily-reflection-app
npm install
```

### 3. Configure Supabase

In your Supabase project dashboard, open the **SQL Editor** and run the following:

```sql
-- 1. Table
CREATE TABLE public.entries (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entry_date  date        NOT NULL,
  title       text,
  body        text        NOT NULL,
  tags        text[]      NOT NULL DEFAULT '{}'::text[],
  mood        int,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, entry_date)
);

-- 2. Auto-update updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_entries_updated_at
BEFORE UPDATE ON public.entries
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3. Row Level Security
ALTER TABLE public.entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own_entries"
ON public.entries FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "insert_own_entries"
ON public.entries FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "update_own_entries"
ON public.entries FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "delete_own_entries"
ON public.entries FOR DELETE
USING (auth.uid() = user_id);
```

In **Authentication → Providers**, make sure **Email** is enabled.

### 4. Configure environment

Copy the example environment file and fill in your Supabase credentials:

```bash
cp src/environments/environment.example.ts src/environments/environment.ts
```

Edit `src/environments/environment.ts`:

```ts
export const environment = {
  production: false,
  supabaseUrl: 'https://your-project-id.supabase.co',
  supabaseAnonKey: 'your-anon-key-here',
};
```

Your project URL and anon key are in **Supabase → Project Settings → API**.

> `environment.ts` is git-ignored and must never be committed.

### 5. Run locally

```bash
npm start
```

Open [http://localhost:4200](http://localhost:4200). Sign up for an account and start writing.

---

## Deploying Edge Functions

The AI features require two Supabase Edge Functions. Deploy them with the Supabase CLI:

```bash
# Log in and link to your project
supabase login
supabase link --project-ref your-project-id

# Deploy both functions
supabase functions deploy reflect-deeper
supabase functions deploy weekly-summary

# Set secrets
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
```

The `CLAUDE_MODEL` secret is optional — the functions default to `claude-sonnet-4-6`.

### Disable "Verify JWT with legacy secret"

After deploying, go to **Edge Functions** in the Supabase dashboard and open each function. Find the **"Verify JWT with legacy secret"** toggle and turn it **off** for both `reflect-deeper` and `weekly-summary`.

This setting blocks requests that don't use the anon key as their JWT, which conflicts with sending the user's session token. The functions handle their own JWT verification internally via `supabase.auth.getUser()`, so the platform-level toggle is not needed.

---

## Production Build

```bash
npm run build
```

Output is in `dist/daily-reflection-app/browser`. Deploy to any static host (Netlify, Vercel, etc.).

For production, create `src/environments/environment.prod.ts` with `production: true` and your live Supabase credentials.
