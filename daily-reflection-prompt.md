# Daily Reflection — Claude Code Build Prompt

> This document preserves the full prompt used to bootstrap the **Daily Reflection** Angular + Supabase journaling app with Claude Code.

---

## Overview

You are my senior full-stack pair programmer. We are building a small but real **Angular + Supabase** app called **"Daily Reflection"**.

---

## Goal

Build an MVP daily reflection journal with:

- Supabase Auth (email/password)
- Private entries per user (Row Level Security)
- CRUD entries (create, edit, delete)
- Timeline list, search, tag filtering
- Stats (streak, tags frequency, word count trend)

Then add AI features via Supabase Edge Functions:

- **Reflect Deeper** — single entry → structured JSON
- **Weekly Summary** — last 7 days → structured JSON

---

## Important Constraints

- Use **Angular (latest stable)** with Router.
- Use **Angular Material** for UI to keep it fast and consistent.
- Use **Supabase JS client** for Angular. Keep all data calls in services.
- **Never** put Claude API key in the Angular frontend.
- AI calls must go through **Supabase Edge Functions (Deno)**.
- Keep the code structured and readable; no giant components.
- Generate code **ONE FILE AT A TIME** when I ask. Before code, give plan + file tree.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Angular + TypeScript |
| UI | Angular Material |
| Backend | Supabase (Postgres, Auth, RLS) |
| AI Endpoints | Supabase Edge Functions (Deno) |

---

## Features

### Phase 1 — No AI

**Routes:**

| Route | Description |
|---|---|
| `/login` | Authentication |
| `/today` | Today's entry editor |
| `/entries` | Timeline list |
| `/entries/:id` | Entry detail |
| `/stats` | Stats dashboard |

**Entry fields:**

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | PK, auto-generated |
| `user_id` | uuid | FK → `auth.users` |
| `entry_date` | date | |
| `title` | text | nullable |
| `body` | text | required |
| `tags` | text[] | default `{}` |
| `mood` | int | nullable, 1–10 |
| `created_at` | timestamptz | auto |
| `updated_at` | timestamptz | auto |

**UI Requirements:**

- **Today page:** Entry editor for today's date (create or update).
- **Entries page:** Timeline list newest first, search by keyword in title/body, filter by tag.
- **Entry detail page:** View + edit + delete.
- **Stats page:**
  - Streak (consecutive days with at least one entry)
  - Counts (this week / month)
  - Tag frequency (top tags)
  - Word count trend (last 14 days) — simple chart is ok

### Phase 2 — AI Features

Add 2 buttons:

**1. "Reflect Deeper"** (on Today + Entry detail)
- Sends single entry to edge function
- Returns structured JSON: `follow_up_questions[]`, `reframes[]`, `micro_actions[]`

**2. "Weekly Summary"** (on Stats)
- Pulls last 7 days of entries for the user
- Sends entries to edge function
- Returns structured JSON: `themes[]`, `wins[]`, `stressors[]`, `suggested_experiments[]`, `tone{ overall, trend }`

> Optionally store AI outputs later; do not block MVP on persistence.

---

## Angular Project Structure

```
src/app/
  core/
    models/
      entry.ts
      ai.ts
    services/
      supabase.ts
      auth.ts
      entries.ts
      ai.ts
    guards/
      auth.ts
  features/
    auth/
      login.ts|html|scss
    entries/
      today.ts|html|scss
      entry-list.ts|html|scss
      entry-detail.ts|html|scss
    stats/
      stats.ts|html|scss
  shared/
    components/
      entry-editor/
        entry-editor.ts|html|scss
      tag-chips/
        tag-chips.ts|html|scss
      loading/
        loading.ts|html|scss
  app.routes.ts
  app.config.ts
  app.ts|html|scss
```

**Services rule:**
- Components should **not** call Supabase directly.
- `entries.service` handles CRUD and queries.
- `ai.service` calls edge functions.
- `auth.service` handles login/session/logout.
- `auth.guard` protects all routes except `/login`.

---

## Supabase Setup

### 1. SQL Schema

```sql
CREATE TABLE public.entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entry_date date NOT NULL,
  title text,
  body text NOT NULL,
  tags text[] NOT NULL DEFAULT '{}'::text[],
  mood int,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, entry_date)
);
```

### 2. `updated_at` Trigger

```sql
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
```

### 3. Row Level Security

```sql
ALTER TABLE public.entries ENABLE ROW LEVEL SECURITY;

-- SELECT own rows
CREATE POLICY "select_own_entries"
ON public.entries FOR SELECT
USING (auth.uid() = user_id);

-- INSERT only with own user_id
CREATE POLICY "insert_own_entries"
ON public.entries FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- UPDATE own rows
CREATE POLICY "update_own_entries"
ON public.entries FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- DELETE own rows
CREATE POLICY "delete_own_entries"
ON public.entries FOR DELETE
USING (auth.uid() = user_id);
```

> Edge Function invocation must pass the user JWT so it can be authorized.

---

## Environment Variables

**Angular:**

```
SUPABASE_URL
SUPABASE_ANON_KEY
```

**Edge Functions (Supabase secrets):**

```
ANTHROPIC_API_KEY
CLAUDE_MODEL     (optional, default: "claude-3-5-sonnet-latest")
```

---

## Edge Functions (Phase 2)

| Function | Path | Description |
|---|---|---|
| Reflect Deeper | `functions/reflect-deeper/index.ts` | Analyzes a single entry and returns follow-up questions, reframes, and micro-actions |
| Weekly Summary | `functions/weekly-summary/index.ts` | Summarizes last 7 days of entries into themes, wins, stressors, experiments, and tone |

**Both functions must:**
- Require `Authorization` header (Bearer user JWT)
- Verify user by calling Supabase Auth / `getUser` using the JWT
- Validate request body shape
- Call Claude with a strict system prompt
- Return JSON **only**, matching our types
- Handle errors cleanly (400 validation, 401 auth, 500 Claude errors)
- Include CORS headers for browser

### Request / Response Contracts

#### Reflect Deeper

**POST body:**
```json
{
  "entry": {
    "entry_date": "YYYY-MM-DD",
    "title": "...",
    "body": "...",
    "tags": ["..."],
    "mood": 7
  }
}
```

**Response:**
```json
{
  "follow_up_questions": ["..."],
  "reframes": ["..."],
  "micro_actions": ["..."]
}
```

#### Weekly Summary

**POST body:**
```json
{
  "entries": [
    { "entry_date": "YYYY-MM-DD", "title": "...", "body": "...", "tags": ["..."], "mood": 7 }
  ]
}
```

**Response:**
```json
{
  "themes": ["..."],
  "wins": ["..."],
  "stressors": ["..."],
  "suggested_experiments": ["..."],
  "tone": { "overall": "...", "trend": "..." }
}
```

---

## AI Prompts

### Reflect Deeper

**System prompt:**
> "You are a supportive, practical reflection coach. Be warm, non-clinical, non-judgmental. Do not give medical or mental health diagnoses. Do not mention policy. Produce JSON only. Keep items short and actionable."

**User prompt:**
> Given the entry, produce:
> - 3 `follow_up_questions` that help the user reflect deeper (gentle, specific).
> - 2 `reframes` that offer alternative interpretations.
> - 3 `micro_actions` that are tiny next steps within 5–10 minutes.
>
> Return JSON exactly with keys `follow_up_questions`, `reframes`, `micro_actions`. No extra keys.

### Weekly Summary

**System prompt:**
> "You are a supportive reflection analyst. Summarize patterns without diagnosis. Focus on themes, wins, stressors, and small experiments. Produce JSON only."

**User prompt:**
> Given up to 7 entries, produce:
> - 3–6 `themes`
> - 2–5 `wins`
> - 2–5 `stressors`
> - 3 `suggested_experiments` phrased as tiny experiments (3 days max)
> - `tone.overall` (one phrase) and `tone.trend` (e.g. `'improving'`, `'flat'`, `'worsening'`, `'mixed'`)
>
> Return JSON exactly with keys `themes`, `wins`, `stressors`, `suggested_experiments`, `tone`. No extra keys.

---

## TypeScript Models

### `entry.ts`

```typescript
export interface Entry {
  id?: string;
  user_id?: string;
  entry_date: string; // YYYY-MM-DD
  title?: string | null;
  body: string;
  tags: string[];
  mood?: number | null;
  created_at?: string;
  updated_at?: string;
}
```

### `ai.ts`

```typescript
export interface ReflectDeeperResponse {
  follow_up_questions: string[];
  reframes: string[];
  micro_actions: string[];
}

export interface WeeklySummaryResponse {
  themes: string[];
  wins: string[];
  stressors: string[];
  suggested_experiments: string[];
  tone: { overall: string; trend: string };
}
```

---

## Service Method Contracts

### `auth.ts`

```typescript
signUp(email: string, password: string): Promise<void>
signIn(email: string, password: string): Promise<void>
signOut(): Promise<void>
session$: Observable<Session | null>
user$: Observable<User | null>
getAccessToken(): Promise<string | null>
```

### `entries.ts`

```typescript
getEntryByDate(date: string): Promise<Entry | null>
upsertEntry(entry: Entry): Promise<Entry>
getEntries(params: { q?: string; tag?: string; limit?: number; offset?: number }): Promise<Entry[]>
getEntryById(id: string): Promise<Entry | null>
deleteEntry(id: string): Promise<void>
getEntriesInRange(startDate: string, endDate: string): Promise<Entry[]>
```

### `ai.ts`

```typescript
reflectDeeper(entry: Entry): Promise<ReflectDeeperResponse>
weeklySummary(entries: Entry[]): Promise<WeeklySummaryResponse>
```

---

## Implementation Notes

- Use Angular **standalone components** (no NgModules).
- Use **Reactive Forms** for entry editor.
- For tags UI: simple chips input (comma-separated → chips).
- For stats chart: use `ng2-charts` + `chart.js` (already installed).
- **Today page logic:** On load, fetch entry by today's date; if none, initialize blank entry with today's date.
- All pages except `/login` require `auth.guard`.
- Provide a **README** with setup steps: Angular env, Supabase SQL, RLS, running app, deploying edge functions, setting secrets.

---

## Deliverables

### Step 1 — Output First

- A brief step-by-step plan
- A complete file tree
- The exact Supabase SQL (schema + trigger + RLS)
- Edge function list and what each does
- Any npm packages to install

### Step 2 — File-by-File Generation

> Then **wait** for me to ask for each file. When I ask for a file, output **only** that file's contents.

---

*Start now with deliverable (1).*
