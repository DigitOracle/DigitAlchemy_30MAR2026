# DA-TEC-2026-003 — Phase 0 Gazette Refactor Reconnaissance Report

**Date:** 2026-04-07
**Authors:** Kendall Wilson (Doli) + Claude Code
**Status:** Phase 0.1 complete — awaiting Doli's review before any code changes
**Method:** Read-only pass over actual repo files. Every claim cites file path and line numbers.
**Note:** DA-HANDOVER-001 was referenced in the task but does not exist in the repo. This report proceeds based on DA-UC-001-social-media.md and direct code reading.

---

## 1. Executive Summary

The Gazette is a single 800+ line React component (`components/console/MorningBriefing.tsx`) that renders a newspaper-styled UI with 7 client-side tabs. It fetches data from 3 lightweight GET routes (`morning-briefing`, `trend-ticker`, `trending-audio`) that return raw provider data with zero classification. The "concept card" pattern exists only inside `app/api/reverse-engineer/route.ts` — a separate 1,100-line SSE route that takes full user context and calls Claude. These two systems share no types, no state, and no pipeline logic. The 7-category taxonomy from DA-UC-001 (`AUDIO_VIRAL`, `TREND_ALERT`, etc.) does not exist anywhere in the TypeScript codebase. There is no `UserContext` type. Tab switching is local `useState`, not routing. Post recommendations ("Follow the Trend" / "Stay in Your Lane") are rendered by an inline `RecommendsSection` function using a `RecPost` type defined inside the component — not exported, not shared. Personalisation comes from a Firestore `ContentProfile` document at `users/{uid}/content_profile/main`, loaded by the `/api/post-recommendations` route.

---

## 2. Tab Architecture

### 2a. What renders on initial load

`app/page.tsx:608`:
```tsx
{stage === "mode_select" && <MorningBriefing />}
```

The default `stage` is `"mode_select"` (`app/page.tsx:76`). So the **first thing a user sees** is the `MorningBriefing` component. It is a `"use client"` component that triggers 3 parallel fetches on mount (`MorningBriefing.tsx:220-232`):

```tsx
useEffect(() => {
  setLoading(true)
  Promise.allSettled([
    fetch(`/api/morning-briefing?region=${region}`).then(r => r.json()),
    fetch(`/api/trend-ticker?region=${region}`).then(r => r.json()),
    fetch(`/api/trending-audio?region=${region}`).then(r => r.json()),
  ]).then(([briefing, ticker, audio]) => {
    if (briefing.status === "fulfilled") setData(briefing.value)
    if (ticker.status === "fulfilled") setTickerData(ticker.value)
    if (audio.status === "fulfilled") setAudioData(audio.value)
    setLoading(false)
  })
}, [region])
```

Additionally, if the user is authenticated: `/api/content-dna/profile?uid=X` (line 184) and `/api/dashboard?platform=all&uid=X` (line 195). When a platform tab is active, `/api/post-recommendations?region=X&platform=Y` is also fetched (line 207).

### 2b. The seven tabs

Defined inline at `MorningBriefing.tsx:347-354`:

```tsx
{([
  { id: "briefing", label: "Front Page" },
  { id: "tiktok", label: "TikTok", icon: "tiktok" as const },
  { id: "instagram", label: "Instagram", icon: "instagram" as const },
  { id: "youtube", label: "YouTube", icon: "youtube" as const },
  { id: "news", label: "News Wire" },
  { id: "culture", label: "Culture" },
  { id: "deepdive", label: "Deep Dive \u2192" },
] as const).map(sec => (
```

| Tab | ID | Component | API routes called | Data shape | Client/Server |
|-----|----|-----------|-------------------|-----------|---------------|
| Front Page | `briefing` | Inline JSX in `MorningBriefing.tsx:472-671` | Pre-fetched: `morning-briefing`, `trend-ticker`, `trending-audio` | `BriefingData`, `TickerData`, `AudioData` (local types, lines 6-11) | Client-side fetch |
| TikTok | `tiktok` | Inline JSX `MorningBriefing.tsx:674-715` + `TwoRowRecommends` (line 713) | Pre-fetched ticker/audio + lazy `/api/post-recommendations?platform=tiktok` | `TickerData.tiktok: string[]`, `AudioData.sounds: TrendingSound[]`, `RecPost[]` | Client-side fetch |
| Instagram | `instagram` | Inline JSX `MorningBriefing.tsx:718-739` + `TwoRowRecommends` (line 737) | Pre-fetched ticker + lazy `/api/post-recommendations?platform=instagram` | `TickerData.instagram: string[]`, `RecPost[]` | Client-side fetch |
| YouTube | `youtube` | Inline JSX `MorningBriefing.tsx:742-761` + `TwoRowRecommends` (line 759) | Pre-fetched briefing + lazy `/api/post-recommendations?platform=youtube` | `BriefingData.youtube: YoutubeItem[]`, `RecPost[]` | Client-side fetch |
| News Wire | `news` | Inline JSX `MorningBriefing.tsx:764-781` | Pre-fetched briefing | `BriefingData.gdelt: GdeltItem[]` | Client-side (no additional fetch) |
| Culture | `culture` | Inline JSX `MorningBriefing.tsx:784-801` | Pre-fetched briefing | `BriefingData.wikipedia: WikiItem[]` | Client-side (no additional fetch) |
| Deep Dive | `deepdive` | No content — scrolls to `#scan-setup` (line 358) | N/A — jumps to ReverseEngineerSetupStage | N/A | Client-side scroll |

### 2c. Tab switching mechanism

Tab switching is **client-side state**, not URL routing. At `MorningBriefing.tsx:165`:

```tsx
const [activeSection, setActiveSection] = useState<string>("briefing")
```

Each tab button calls `setActiveSection(sec.id)` (line 359), except "Deep Dive" which scrolls to the scan setup form. Conditional rendering via `{activeSection === "tiktok" && (...)}` pattern at lines 472, 674, 718, 742, 764, 784.

---

## 3. Concept Card Infrastructure

### 3a. "Follow the Trend" / "Stay in Your Lane" card component

The cards are rendered by `RecommendsSection`, an inline function at `MorningBriefing.tsx:88-153`. It is **not exported** and **not in its own file**. Each card receives a `RecPost` type defined locally at line 167:

```tsx
type RecPost = {
  topic: string
  caption: string
  hashtags: string
  audio: string
  best_time: string
  format: string
}
```

Card layout (lines 106-149): Each card shows a numbered index, topic headline, copyable caption in a shaded box, clickable hashtag chips with "Copy all" button, audio name with music note icon, and a footer with posting time + format tag (e.g., "VIDEO").

`TwoRowRecommends` (line 261) renders two rows of `RecommendsSection`: "Follow the Trend" (generic `genericRecs`) and "Stay in Your Lane" (personalised `personalRecs`). Used identically on TikTok (line 713), Instagram (line 737), and YouTube (line 759) tabs.

### 3b. DA-UC-001 taxonomy in TypeScript

**Does not exist.** Grep results:

```
AUDIO_VIRAL       — 0 matches in *.ts/*.tsx
TREND_ALERT       — 0 matches
BRAND_SIGNAL      — 0 matches
CULTURAL_MOMENT   — 0 matches
CREATOR_SPOTLIGHT — 0 matches
REGIONAL_PULSE    — 0 matches
TECH_INNOVATION   — 0 matches
```

The taxonomy exists only in the Python benchmark files under `autoagent/`. The closest TypeScript equivalent is `TrendClassification` in `lib/trendRadar/types.ts:47-52`:

```typescript
export type TrendClassification =
  | "breakout_candidate"
  | "stable_opportunity"
  | "fading_fast"
  | "recurring_pattern"
  | "niche_advantage"
```

This is a velocity/lifecycle taxonomy, not a content-type taxonomy. The two serve different purposes.

### 3c. "Stay in Your Lane" personalisation source

The personalisation flows through Content DNA stored in Firestore:

1. User uploads videos → `/api/content-dna/analyze` processes them → `lib/firestore/contentProfile.ts:31-35` writes to `users/{uid}/content_samples/{docId}`
2. Profile is merged via `mergeProfileWithSample()` (line 53) and saved to `users/{uid}/content_profile/main` (line 47)
3. On tab switch, `MorningBriefing.tsx:207` fetches `/api/post-recommendations?region=X&platform=Y&uid=Z`
4. The route at `app/api/post-recommendations/route.ts:28-48` calls `loadContentProfile(uid)` which reads `users/{uid}/content_profile/main` from Firestore
5. The profile is injected into the Claude prompt as `profileContext` (line 37): topics, tone, visual style, audio preference, caption style, hashtag patterns
6. Claude generates 3 personalised posts grounded in both trending data AND the user's content DNA

The `ContentProfile` interface (`lib/firestore/contentProfile.ts:18-29`):
```typescript
export interface ContentProfile {
  topics: string[]         // e.g. ["construction", "BIM", "digital twins"]
  tone: string
  visualStyle: string
  audioPreference: string
  captionStyle: string
  hashtagPatterns: string[]
  sampleCount: number
  confidence: "low" | "medium" | "high"
}
```

There is **no hardcoded profile**. Doli's construction/BIM/ISO content DNA exists because Doli uploaded those videos. Any user gets personalisation matching their uploads.

### 3d. Instagram vs TikTok card components

**Same component.** All three platform tabs (TikTok, Instagram, YouTube) call `<TwoRowRecommends platform="X" />` which renders the same `RecommendsSection` with the same `RecPost` type and same card layout. The YouTube tab additionally shows raw video thumbnails/titles/views in a grid above the recommendations (lines 750-758) — those are from `BriefingData.youtube: YoutubeItem[]`, not cards.

---

## 4. Existing Types and Shared Code

### 4a. Files under `types/`

| File | Exports |
|------|---------|
| `types/index.ts` | Orchestration primitives: `WorkflowCategory`, `MCPServer`, `StandardsEntry`, `ConditionOperator`, `IntakeStep` — used by the original intake wizard, not Gazette |
| `types/jobs.ts` | Console job schema: `JobV2`, `JobStatusV2`, `PlatformCards`, `IngestionData`, `ConfirmedFocus`, `AccessAttempt` — used by reverse-engineer SSE flow |

### 4b. UserContext type

**Does not exist.** No type named `UserContext` or `userContext` exists anywhere in the codebase. The closest is the `onConfirm` callback signature in `ReverseEngineerSetupStage.tsx:46`:

```typescript
type Props = {
  onConfirm: (platform: string, niche: string, lag: ProductionLag,
              region: string, industry: string | null,
              audience: string | null, quickPulse?: string) => void
}
```

These 7 values are destructured from the POST body at `reverse-engineer/route.ts:634`:

```typescript
const { platform, niche, region = "AE", lag = "same_day",
        industry = null, audience = null, quickPulse = null } = body
```

But they're never bundled into a reusable type — just positional args and inline destructuring.

### 4c. Files under `lib/`

| File | Role |
|------|------|
| `lib/firebase.ts` | Client-side Firebase SDK init (auth + Firestore) |
| `lib/jobStore.ts` | Firebase Admin init + Firestore `getDb()` helper for server routes |
| `lib/spotify.ts` | `searchSpotifyTrack()` — Spotify enrichment for trending audio |
| `lib/useStream.ts` | React hook for consuming SSE streams from reverse-engineer route |
| `lib/AuthContext.tsx` | React context for Firebase Auth state |
| `lib/ayrshare.ts` | Ayrshare social media API integration |
| `lib/analyzeTask.ts` | Task analysis for orchestration wizard |
| `lib/registry.ts` | MCP server registry |
| `lib/scoring.ts` | Intake wizard step scoring |
| `lib/standards.ts` | Standards lookup |
| `lib/formatter.ts` | Output formatting |
| `lib/conditionEvaluator.ts` | Condition evaluation for intake steps |
| `lib/workflowDetector.ts` | Workflow detection |
| `lib/orchestrationPlanner.ts` | Orchestration planning |
| `lib/fileHandler.ts` | File processing |
| `lib/media/access.ts` | Media access/download |
| `lib/transcription/whisper.ts` | Whisper transcription |
| `lib/transcription/supadata.ts` | Supadata transcription fallback |
| `lib/profile/extractContentDNA.ts` | Content DNA extraction from transcripts |
| `lib/firestore/contentProfile.ts` | Content DNA Firestore CRUD |
| `lib/firestore/jobs.ts` | Job v2 Firestore CRUD |
| `lib/firestore/integrations.ts` | Ayrshare integration Firestore CRUD |
| `lib/providers/*.ts` | Registry/standards provider adapters |

**Shared pipeline code:** `lib/jobStore.ts` (Firestore admin), `lib/spotify.ts` (enrichment), `lib/firestore/contentProfile.ts` (Content DNA). No shared trend classification or concept-card pipeline exists.

### 4d. `lib/trendRadar/` files

| File | Purpose |
|------|---------|
| `lib/trendRadar/types.ts` | Type definitions: `TrendSnapshot`, `TrendEntity`, `TrendScore`, `TrendClassification`, `TrendOutlook`, `TrendPlatform`, `ProductionLag`, and 15+ related types |
| `lib/trendRadar/capture.ts` | Calls ScrapeCreators/Apify/Perplexity, builds `TrendSnapshot`, writes to Firestore `trend_snapshots` collection |
| `lib/trendRadar/score.ts` | Rule-based scoring engine: computes velocity (6h/24h/72h), acceleration, persistence, novelty, decay_risk, half-life, cross-platform echo, niche fit from snapshot history |
| `lib/trendRadar/classify.ts` | Maps `TrendScore` → `TrendClassification` (`breakout_candidate`, `stable_opportunity`, `fading_fast`, `recurring_pattern`, `niche_advantage`) |
| `lib/trendRadar/normalize.ts` | Entity normalization: lowercase, strip `#`, collapse whitespace, deduplicate |
| `lib/trendRadar/influx.ts` | Optional InfluxDB write-through for time-series storage; silently skips if env vars missing |

`TrendScore` (defined at `lib/trendRadar/types.ts:84-133`) is the most sophisticated type in the codebase — it includes velocity, persistence, novelty, confidence tiers, trend cause analysis, production-lag fitness, classification, and a forecast outlook. This is the natural foundation for concept cards.

---

## 5. Region Picker

The region picker is **inline in MorningBriefing.tsx**, not a separate component.

At line 382-395, the masthead shows `{editionTag} EDITION` with a "Change" dropdown:

```tsx
<button onClick={() => setSelectorOpen(!selectorOpen)}
  style={{ /* underlined link style */ }}>
  Change &#9662;
</button>
{selectorOpen && (
  <div style={{ position: "absolute", /* dropdown styles */ }}>
    {REGIONS.map(r => (
      <div key={r.id}
        onClick={() => { setRegion(r.id); setSelectorOpen(false) }}
        /* ... */
      >{r.label}</div>
    ))}
  </div>
)}
```

It is a **lightweight dropdown** — not a router link, not a form. It sets `region` state, which triggers re-fetches of all 3 API routes. The 6 regions are defined at line 19-22:

```tsx
const REGIONS = [
  { id: "AE", label: "the UAE" }, { id: "SA", label: "Saudi Arabia" },
  { id: "KW", label: "Kuwait" }, { id: "QA", label: "Qatar" },
  { id: "US", label: "the United States" }, { id: "SG", label: "Singapore" },
]
```

This is separate from the `ReverseEngineerSetupStage` region picker (which has flags and 6 matching codes). They are not connected — changing the Gazette region does not affect the Deep Dive setup, and vice versa.

---

## 6. API Routes Inventory

| Route | Methods | Request | Response | SSE? |
|-------|---------|---------|----------|------|
| `app/api/morning-briefing/route.ts` | GET | `?region=X` | `{ wikipedia: WikiItem[], gdelt: GdeltItem[], youtube: YoutubeItem[], region, regionLabel, generatedAt }` | No |
| `app/api/trend-ticker/route.ts` | GET | `?region=X` | `{ tiktok: string[], instagram: string[], youtube: string[], region }` | No |
| `app/api/trending-audio/route.ts` | GET | `?region=X` | `{ sounds: TrendingSound[], source, region }` | No |
| `app/api/reverse-engineer/route.ts` | POST | `{ platform, niche, region, lag, industry, audience, quickPulse }` | SSE stream of `card`, `processor.started`, `complete`, `error` events | **Yes** |
| `app/api/post-recommendations/route.ts` | GET | `?region=X&platform=Y&uid=Z` | `{ posts: PostRec[], platform, region, regionLabel }` | No |
| `app/api/trend-radar/capture/route.ts` | POST | `{ platform, scope, niche?, region? }` | `{ ok, snapshotId, entityCount, source }` | No |
| `app/api/trend-radar/scores/route.ts` | GET | `?platform=X&lag=X&niche=X&limit=X` | `{ ok, platform, productionLag, insufficientHistory, snapshotCount, trends: TrendScore[] }` | No |
| `app/api/dashboard/route.ts` | GET | `?platform=X&uid=X` | `{ stats: { totalPosts, totalViews, totalEngagement, avgCompletion } }` | No |
| `app/api/content-dna/profile/route.ts` | GET | `?uid=X` | `{ profile: ContentProfile }` | No |
| `app/api/content-dna/save/route.ts` | POST | Content DNA save payload | `{ ok }` | No |
| `app/api/content-dna/analyze/route.ts` | POST | Video analysis payload | `{ ok, sample: ContentDNASample }` | No |
| `app/api/content-dna/auto-ingest/route.ts` | POST | Auto-ingest payload | `{ ok }` | No |
| `app/api/analyze/route.ts` | POST | Content analysis payload | Analysis results | No |
| `app/api/accounts/connect/route.ts` | POST | Account connection payload | `{ ok }` | No |
| `app/api/accounts/status/route.ts` | GET | `?uid=X` | Account status data | No |
| `app/api/platform-selection/route.ts` | POST | Platform selection payload | Job update result | No |
| `app/api/jobs/[jobId]/route.ts` | GET | Path param `jobId` | `{ ok, job: JobV2 }` | No |
| `app/api/jobs/[jobId]/stream/route.ts` | GET | Path param `jobId` | SSE stream | **Yes** |
| `app/api/upload/presign/route.ts` | POST | Upload metadata | Presigned URL | No |
| `app/api/upload/complete/route.ts` | POST | Upload completion | `{ ok }` | No |
| `app/api/health/providers/route.ts` | GET | None | Provider health status | No |

### Shared logic and duplication

The three Gazette routes (`morning-briefing`, `trend-ticker`, `trending-audio`) each call ScrapeCreators independently. The `reverse-engineer` route also calls ScrapeCreators with nearly identical code. ScrapeCreators fetch logic is duplicated at least 3 times:

- `app/api/trend-ticker/route.ts:33-53` (`fetchTikTokHashtags`)
- `app/api/reverse-engineer/route.ts:38+` (`fetchScrapeCreatorsTikTokPlatform`)
- `lib/trendRadar/capture.ts:16-51` (`captureScrapeCreatorsTikTok`)

Each has slightly different parsing and field mapping. This is the primary candidate for extraction to shared code.

---

## 7. Provider Chain and Fixed Boundaries

### 7a. Inference-last provider chain

The chain `ScrapeCreators → Apify → xpoz → Perplexity → Claude` is implemented primarily in `app/api/reverse-engineer/route.ts`. The provider functions are defined inline in that file starting at line 38:

- `fetchScrapeCreatorsTikTokPlatform()` — line 38
- `fetchScrapeCreatorsInstagramSupport()` — later in file
- `fetchApifyTrends()` — later in file  
- `fetchPerplexityContext()` — later in file
- `callClaude()` — line 18

The chain fallback logic is at approximately lines 730-900 (the SSE `start()` handler). If ScrapeCreators fails, it falls back to Apify, then context-guided Perplexity, then Claude inference. This logic is **not shared** — `lib/trendRadar/capture.ts` has its own separate provider chain with different code paths.

### 7b. SSE streaming adapter

Single location: `app/api/reverse-engineer/route.ts:677-1092`. The `safeClose` and `safeEnqueue` guards are at lines 680-681:

```typescript
let streamClosed = false
const safeEnqueue = (chunk: Uint8Array) => {
  if (!streamClosed) { try { controller.enqueue(chunk) } catch { /* closed */ } }
}
const safeClose = () => {
  if (!streamClosed) { streamClosed = true; try { controller.close() } catch { /* already closed */ } }
}
```

This is the **only SSE streaming implementation** for concept-card generation. The job stream at `app/api/jobs/[jobId]/stream/route.ts` has its own SSE adapter for the optimize flow.

### 7c. Firestore logging to `da-experiments/`

**Does not exist in the TypeScript codebase.** Grep for `da-experiments` returned zero matches across all `.ts`/`.tsx` files. This collection path is referenced only in `autoagent/DA-UC-001-social-media.md:38` as a constraint for the Python experiment harness. The production TypeScript routes do not write experiment logs to this collection.

---

## 8. Two-Worlds Verification

The split is **confirmed and unchanged**. The two worlds are:

**World 1: The Gazette** (`components/console/MorningBriefing.tsx`)

```typescript
// Line 1
"use client"
import { useState, useEffect } from "react"
import { useAuth } from "@/lib/AuthContext"

// Line 156
export function MorningBriefing() {
```

Context: region only (line 159: `useState(profile?.defaultRegion || "AE")`). Fetches 3 lightweight GET routes. No Claude calls. No concept-card types. No SSE.

**World 2: The Reverse-Engineer Route** (`app/api/reverse-engineer/route.ts`)

```typescript
// Line 1
import { NextRequest } from "next/server"
import { PLATFORMS } from "@/config/platforms"
import Anthropic from "@anthropic-ai/sdk"

// Line 632
export async function POST(req: NextRequest): Promise<Response> {
  const { platform, niche, region = "AE", lag = "same_day",
          industry = null, audience = null, quickPulse = null } = body
```

Context: full 7-parameter context object. Calls Claude for concept cards. SSE streaming. Writes to Firestore via job store.

**The bridge between them:** The "Deep Dive" tab (7th tab) calls `document.getElementById("scan-setup")?.scrollIntoView()` (line 358), which scrolls to the `ReverseEngineerSetupStage` rendered below the Gazette in `app/page.tsx:612`. This is a UI scroll — not a data connection. The Gazette region selection does not propagate to the Deep Dive setup form.

---

## 9. Open Questions Surfaced During Recon

1. **DA-HANDOVER-001 does not exist.** The task referenced it but it's not in the repo. Should it be created, or was this referring to a different document?

2. **`da-experiments/` Firestore collection is unused.** DA-UC-001 mandates experiment logs go there, but the TypeScript code never writes to it. Is this intentional (Python-only logging), or should the production routes also log there?

3. **ScrapeCreators is called 3 different ways.** The trend-ticker route, reverse-engineer route, and trendRadar capture each have their own fetch + parse logic for the same ScrapeCreators API. Unification should extract this to `lib/providers/scrapeCreators.ts`.

4. **The `RecPost` type is trapped inside a component.** It's defined at `MorningBriefing.tsx:167` as a local type, but it's the de facto concept card type for the Gazette. Should it become the shared `ConceptCard` type, or should a new type supersede it?

5. **TrendRadar scores are not used by the Gazette.** The `trend-radar/scores` route produces rich `TrendScore` objects with classification, velocity, persistence, and forecast — but the Gazette never calls this route. Connecting them would give the Gazette structured intelligence instead of raw hashtag lists.

6. **YouTube exclusion scope is ambiguous.** DA-UC-001 says "Trend Ticker is TikTok + Instagram only" but the Gazette's trend-ticker route at `app/api/trend-ticker/route.ts:16-19` still fetches YouTube:

   ```typescript
   const [tiktok, instagram, youtube] = await Promise.allSettled([
     fetchTikTokHashtags(region),
     fetchInstagramHashtags(region, regionLabel),
     fetchYouTubeTags(region),
   ])
   ```

   Is this a violation of the constraint, or does "Trend Ticker" in DA-UC-001 refer only to the Python agent, not the TypeScript route?

7. **Content DNA personalisation is per-user, not per-profile.** The system supports multiple child profiles under a parent account (evidenced by `app/api/accounts/status/route.ts`), but Content DNA is stored per `uid`. If a parent manages a business account, whose DNA drives "Stay in Your Lane"?

---

## 10. Recommended Revisions to Master Plan

Based on what the code actually contains, these adjustments to any Gazette unification plan are recommended:

### Phase 1 should be: Extract shared providers

Before touching the Gazette, extract the duplicated ScrapeCreators/Apify/Perplexity fetch logic from 3 locations into `lib/providers/scrapeCreators.ts`, `lib/providers/apify.ts`, `lib/providers/perplexity.ts`. This is low-risk refactoring that reduces surface area for the bigger changes.

### Phase 2 should be: Create `types/conceptCard.ts`

Define `ConceptCard` and `UserContext` types. `ConceptCard` should extend or compose `TrendScore` (which already has classification, velocity, forecast) rather than reinventing it. Add the 7-category DA-UC-001 taxonomy as a TypeScript union type.

### Phase 3 should be: Wire TrendRadar scores into the Gazette

The Gazette currently calls 3 raw-data routes. A unified approach would call `trend-radar/scores` (which already produces `TrendScore[]`) and map those to concept cards. This replaces raw hashtag lists with classified, scored, forecasted trend intelligence.

### Phase 4 should be: Extract `RecommendsSection` to its own file

Move the card component and `RecPost` type out of `MorningBriefing.tsx` into `components/console/ConceptCard.tsx`. This is prerequisite for reuse across tabs and potential standalone concept-card views.

### Phase 5 should be: Add concept-card classification

The DA-UC-001 7-category taxonomy does not exist in TypeScript. Adding it to `lib/trendRadar/classify.ts` alongside the existing velocity-based classification creates a dual-axis system: *what kind of trend* (content type) + *what stage is it in* (lifecycle).

### Phases that should NOT change

- The "Deep Dive" flow (reverse-engineer SSE pipeline) should remain separate — it's the heavy Claude-intensive path. The Gazette should remain the lightweight daily intelligence view.
- The SSE adapter and fixed boundaries should not be touched.
- The Firestore job store should not be modified.

---

**End of Phase 0 reconnaissance. No code was modified. Awaiting Doli's review.**
