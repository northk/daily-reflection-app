# Daily Reflection App — Build Plan

## Step-by-Step Plan

1. **Scaffold** — Angular standalone-component app with Angular Material + routing already wired.
2. **Core layer** — models, Supabase client service, auth service, entries service, ai service, auth guard.
3. **Shared components** — `entry-editor`, `tag-chips`, `loading`.
4. **Feature: Auth** — `/login` page (sign-in + sign-up toggle).
5. **Feature: Today** — `/today` page (upsert entry for today's date).
6. **Feature: Entries** — `/entries` list with search + tag filter; `/entries/:id` detail/edit/delete.
7. **Feature: Stats** — `/stats` streak, counts, tag frequency, word-count chart (last 14 days).
8. **Phase 2: AI** — two Supabase Edge Functions + `ai.ts` service + UI buttons on Today, Entry Detail, Stats.
9. **Wiring** — `app.routes.ts`, `app.ts`, `app.config.ts`, environment files, `main.ts`.
10. **Docs** — `README.md` with full setup guide.

## File Tree

```
daily-reflection-app/
├── README.md
├── angular.json
├── package.json
├── tsconfig.json
├── tsconfig.app.json
├── src/
│   ├── main.ts
│   ├── styles.scss
│   ├── index.html
│   ├── environments/
│   │   ├── environment.ts
│   │   └── environment.prod.ts
│   └── app/
│       ├── app.ts
│       ├── app.html
│       ├── app.scss
│       ├── app.config.ts
│       ├── app.routes.ts
│       ├── core/
│       │   ├── models/
│       │   │   ├── entry.ts
│       │   │   └── ai.ts
│       │   ├── services/
│       │   │   ├── supabase.ts
│       │   │   ├── auth.ts
│       │   │   ├── entries.ts
│       │   │   └── ai.ts
│       │   └── guards/
│       │       └── auth.ts
│       ├── features/
│       │   ├── auth/
│       │   │   ├── login.ts
│       │   │   ├── login.html
│       │   │   └── login.scss
│       │   ├── entries/
│       │   │   ├── today.ts
│       │   │   ├── today.html
│       │   │   ├── today.scss
│       │   │   ├── entry-list.ts
│       │   │   ├── entry-list.html
│       │   │   ├── entry-list.scss
│       │   │   ├── entry-detail.ts
│       │   │   ├── entry-detail.html
│       │   │   └── entry-detail.scss
│       │   └── stats/
│       │       ├── stats.ts
│       │       ├── stats.html
│       │       └── stats.scss
│       └── shared/
│           └── components/
│               ├── entry-editor/
│               │   ├── entry-editor.ts
│               │   ├── entry-editor.html
│               │   └── entry-editor.scss
│               ├── tag-chips/
│               │   ├── tag-chips.ts
│               │   ├── tag-chips.html
│               │   └── tag-chips.scss
│               └── loading/
│                   ├── loading.ts
│                   ├── loading.html
│                   └── loading.scss
└── supabase/
    └── functions/
        ├── reflect-deeper/
        │   └── index.ts
        └── weekly-summary/
            └── index.ts
```

## Supabase SQL

```sql
-- 1. TABLE
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

-- 2. updated_at TRIGGER
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

-- 3. RLS
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

## Edge Functions

| Function | Route | What it does |
|---|---|---|
| `reflect-deeper` | `POST /functions/v1/reflect-deeper` | Accepts a single `Entry`, validates JWT, calls Claude with the Reflect Deeper prompt, returns `ReflectDeeperResponse` JSON |
| `weekly-summary` | `POST /functions/v1/weekly-summary` | Accepts up to 7 `Entry` objects, validates JWT, calls Claude with the Weekly Summary prompt, returns `WeeklySummaryResponse` JSON |

## npm Packages to Install

```bash
# Core
npm install @supabase/supabase-js

# Angular Material + CDK + Animations
ng add @angular/material

# Charting for stats word-count trend
npm install ng2-charts chart.js
```

### Supabase CLI (edge function deployment)

```bash
npm install -g supabase

# Deploy functions
supabase functions deploy reflect-deeper
supabase functions deploy weekly-summary

# Set secrets
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
supabase secrets set CLAUDE_MODEL=claude-3-5-sonnet-latest
```
