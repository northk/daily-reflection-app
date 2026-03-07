# AI Rules for “Daily Reflection” (Claude Contract)

This document defines non-negotiable architecture and coding rules.
When generating or modifying code, follow these rules exactly.

---

## Project Goal

Build an Angular + Supabase daily reflection app with:

* Private journal entries per user (RLS)
* CRUD entries, timeline, search, tags, stats
* AI features via Supabase Edge Functions:

  * Reflect Deeper (single entry → structured JSON)
  * Weekly Summary (last 7 days → structured JSON)

---

## Non-Negotiable Architecture Rules

1. **Angular frontend never calls Claude directly**

   * No AI API keys in Angular.
   * All AI calls go through Supabase Edge Functions.

2. **Components never call Supabase directly**

   * All Supabase interaction must live in `core/services/*`.
   * Components call services only.

3. **Do not change folder structure**

```
src/app/
  core/
    models/
    services/      ← supabase, auth, entries, ai, speech-recognition
    guards/
  features/
    auth/
    entries/
    stats/
    settings/
    about/
  shared/
    components/
      entry-editor/
      tag-chips/
      loading/
      hero-banner/
  app.routes.ts
```

Use path aliases from tsconfig, never relative imports.

4. **One responsibility per service**

   * `supabase.ts` → client init + low-level helpers
   * `auth.ts` → auth/session/token
   * `entries.ts` → CRUD + queries
   * `ai.ts` → calls Edge Functions only
   * `speech-recognition.ts` → wraps the browser Web Speech API; exposes `supported`, `listening` signal, `start()`, `stop()`

5. **Auth required on all routes except `/login`**

   * Use `auth.ts` (guard)

---

## Coding Conventions

* Use strict TypeScript typing.
* Keep functions small and readable.
* Avoid new libraries unless requested.
* Services throw meaningful errors.
* Components show user-friendly errors.
* Prefer Angular Material UI components.
* Do not introduce global state libraries (NgRx etc.) unless asked.
* **Use Angular Signals for all mutable component state** — `signal()` for writable state,
  `computed()` for derived state. Do not use plain class properties for values that change
  after construction. Pure presentational components with no state are exempt.
* **No RxJS in the component layer** — the one exception is reactive form control streams
  (e.g. `valueChanges` with `debounceTime`), which are the correct tool for that use case.
  Use `takeUntilDestroyed(this.destroyRef)` to clean up any subscriptions.
* **Load data from the constructor** — call async data-loading methods directly from the
  constructor instead of implementing `OnInit`.

---

## Data Model (Source of Truth)

### Entry model

```ts
export interface Entry {
  id?: string;
  user_id?: string;
  entry_date: string; // YYYY-MM-DD
  title?: string | null;
  body: string;
  tags: string[];
  mood?: number | null; // 1–10
  created_at?: string;
  updated_at?: string;
}
```

### AI response models

```ts
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
  tone: {
    overall: string;
    trend: string;
  };
}
```

---

## Service Method Contracts (Do Not Change Signatures)

### auth.ts

```
signUp(email: string, password: string): Promise<void>
signIn(email: string, password: string): Promise<void>
signOut(): Promise<void>
session: Signal<Session | null>   // readonly signal
user: Signal<User | null>         // computed signal
getAccessToken(): Promise<string | null>
deleteAccount(): Promise<void>
```

### entries.ts

```
getEntryByDate(date: string): Promise<Entry | null>
upsertEntry(entry: Entry): Promise<Entry>
getEntries(params: { q?: string; tag?: string; limit?: number; offset?: number }): Promise<Entry[]>
getEntryById(id: string): Promise<Entry | null>
deleteEntry(id: string): Promise<void>
getEntriesInRange(startDate: string, endDate: string): Promise<Entry[]>
```

### ai.ts

```
reflectDeeper(entry: Entry): Promise<ReflectDeeperResponse>
weeklySummary(entries: Entry[]): Promise<WeeklySummaryResponse>
```

### speech-recognition.ts

```
supported: boolean                          // true if browser supports Web Speech API
listening: Signal<boolean>                  // readonly; true while recording
start(onSegment: (text: string) => void): void  // continuous mode; calls onSegment per final result
stop(): void
```

---

## Supabase Rules

* Use Supabase Auth (email/password).
* Enforce privacy using RLS policies.
* Do NOT weaken or bypass RLS.
* `entries` table has UNIQUE `(user_id, entry_date)`.
* Today page uses upsert behavior.

---

## Edge Function Rules (AI Endpoints)

Functions:

* `reflect-deeper`
* `weekly-summary`

Requirements:

* Require `Authorization: Bearer <JWT>`
* Verify user via Supabase auth (`getUser`)
* Validate request body
* Return JSON ONLY matching the models
* Include CORS headers
* Never log API secrets

---

## AI Prompt Rules

* Output MUST be JSON only.
* Responses must be concise and actionable.
* No diagnosis or medical claims.
* If input is too short, return gentle guidance instead of failing.

---

## Claude Workflow Rules

1. Never generate the entire project at once.
2. Before coding, state:

   * files being changed
   * reason for change
   * new dependencies (if any)
3. When asked for a file:

   * output ONLY that file’s contents.
4. When modifying an existing file:

   * use the pasted current file as source of truth.
   * do not hallucinate content.
5. Keep changes minimal; avoid unrelated refactors.

---

## Definition of Done

A change is complete when:

* Code compiles
* Types align with models
* Feature works end-to-end
* Errors are handled reasonably
* Architecture rules remain intact

## Claude Session Reminder

If unsure:
- DO NOT introduce new architectural patterns.
- DO NOT move logic between layers.
- Ask for clarification instead of assuming.
