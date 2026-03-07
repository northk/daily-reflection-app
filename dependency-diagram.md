# Dependency Diagram

## 1. Full System Overview

Shows how every component, service, and external system relates to each other.

```mermaid
graph TD
  subgraph Angular ["Angular App (Browser)"]
    subgraph Shell ["App Shell"]
      AC[App]
      AG[AuthGuard]
    end

    subgraph Features ["Feature Components"]
      LC[LoginComponent]
      TC[TodayComponent]
      ELC[EntryListComponent]
      EDC[EntryDetailComponent]
      SC[StatsComponent]
      SET[SettingsComponent]
    end

    subgraph Shared ["Shared Components"]
      EE[EntryEditorComponent]
      TCC[TagChipsComponent]
      LoadC[LoadingComponent]
      HB[HeroBannerComponent]
    end

    subgraph Services ["Core Services"]
      SS[SupabaseService]
      AS[AuthService]
      ES[EntriesService]
      AIS[AIService]
      SRS[SpeechRecognitionService]
    end
  end

  subgraph Supabase ["Supabase (Backend)"]
    SA[Auth]
    SD[(Postgres + RLS\nentries · ai_usage)]

    subgraph EdgeFns ["Edge Functions - Deno"]
      RD[reflect-deeper]
      WS[weekly-summary]
      DA[delete-account]
    end
  end

  CLAUDE[Claude API\nAnthropic]

  %% App Shell
  AG -->|session signal check| AS
  AC -->|user signal / logout| AS

  %% Feature → Services
  LC -->|signIn / signUp| AS
  TC -->|getEntryByDate · upsertEntry| ES
  TC -->|reflectDeeper| AIS
  ELC -->|getEntries| ES
  EDC -->|getEntryById · upsertEntry · deleteEntry| ES
  EDC -->|reflectDeeper| AIS
  SC -->|getEntriesInRange| ES
  SC -->|weeklySummary| AIS
  SET -->|downloadEntriesAsCsv · deleteAllEntries| ES
  SET -->|deleteAccount| AS

  %% EntryEditor → SpeechRecognitionService
  EE -->|start · stop · listening| SRS
  SRS -->|Web Speech API| Browser[(Browser\nSpeechRecognition)]

  %% Feature → Shared
  TC -->|renders| EE
  TC -->|renders| HB
  EDC -->|renders| EE
  EDC -->|renders| HB
  ELC -->|renders| HB
  SC -->|renders| HB
  SET -->|renders| HB
  EE -->|renders| TCC
  EE -->|renders| LoadC

  %% Services internal
  AS -->|supabase.auth.*| SS
  ES -->|supabase.from.*| SS
  AIS -->|getAccessToken| AS

  %% SupabaseService → Supabase
  SS -->|Auth API| SA
  SS -->|Queries + RLS| SD

  %% AIService → Edge Functions
  AIS -->|POST + Bearer JWT| RD
  AIS -->|POST + Bearer JWT| WS
  AS -->|POST + Bearer JWT| DA

  %% Edge Functions → Supabase + Claude
  RD -->|verify JWT| SA
  RD -->|track usage| SD
  RD -->|prompt| CLAUDE
  WS -->|verify JWT| SA
  WS -->|track usage| SD
  WS -->|prompt| CLAUDE
  DA -->|verify JWT| SA
  DA -->|admin.deleteUser| SA
```

---

## 2. Auth Flow (Sequence)

What happens when a user signs in and navigates to a protected route.

```mermaid
sequenceDiagram
  participant User
  participant LC as LoginComponent
  participant AS as AuthService
  participant SS as SupabaseService
  participant SA as Supabase Auth
  participant AG as AuthGuard
  participant Router

  User->>LC: submit email + password
  LC->>AS: signIn(email, password)
  AS->>SS: supabase.auth.signInWithPassword()
  SS->>SA: POST /auth/v1/token
  SA-->>SS: session + JWT
  SS-->>AS: session
  AS->>AS: _session.set(session)
  AS-->>LC: success
  LC->>Router: navigate('/today')
  Router->>AG: canActivate()
  AG->>AS: session signal (read)
  AS-->>AG: session exists → true
  AG-->>Router: allow
  Router-->>User: render TodayComponent
```

---

## 3. AI Feature Flow (Sequence)

What happens when a user clicks "Reflect Deeper" (same pattern for "Weekly Summary").

```mermaid
sequenceDiagram
  participant User
  participant Comp as TodayComponent\nor EntryDetailComponent
  participant AIS as AIService
  participant AS as AuthService
  participant EF as reflect-deeper\n(Edge Function)
  participant SA as Supabase Auth
  participant CL as Claude API

  User->>Comp: click "Reflect Deeper"
  Comp->>AIS: reflectDeeper(entry)
  AIS->>AS: getAccessToken()
  AS-->>AIS: JWT string
  AIS->>EF: POST /functions/v1/reflect-deeper\nBody: {entry}\nHeader: Authorization: Bearer JWT
  EF->>SA: auth.getUser(JWT)
  SA-->>EF: user record or 401
  EF->>SA: check ai_usage (rate limit)
  SA-->>EF: call_count < limit → proceed
  EF->>CL: messages: [systemPrompt, userPrompt + entry JSON]
  CL-->>EF: raw JSON text
  EF-->>AIS: 200 { follow_up_questions, reframes, micro_actions }
  AIS-->>Comp: ReflectDeeperResponse
  Comp-->>User: display results panel
```

---

## 4. Service Responsibility Summary

| Service | Owns | Talks to |
|---|---|---|
| `SupabaseService` | Supabase JS client singleton | Supabase Auth + Postgres |
| `AuthService` | Session signal, computed user signal | `SupabaseService` |
| `EntriesService` | All CRUD + query methods for entries | `SupabaseService` |
| `AIService` | Edge function HTTP calls | `AuthService` (JWT), Edge Functions |
| `AuthGuard` | Route protection | `AuthService` |
| `SpeechRecognitionService` | Voice-to-text via Web Speech API | Browser `SpeechRecognition` |

## 5. Data Ownership Rules

- **Components** never call Supabase directly — always go through a service.
- **AIService** never calls Claude directly — always goes through an Edge Function.
- **Edge Functions** are the only layer that holds `ANTHROPIC_API_KEY`.
- **RLS policies** enforce that every Postgres query is scoped to `auth.uid() = user_id`.
- **AuthService** state is held in an Angular signal — no RxJS Observables in the component layer.
