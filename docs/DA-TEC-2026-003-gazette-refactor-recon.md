# DA-TEC-2026-003 — Gazette Refactor Reconnaissance Report

**Date:** 2026-04-07
**Authors:** Kendall Wilson (Doli) + Claude Code
**Status:** Reconnaissance complete — awaiting human review before any code changes
**Scope:** Read-only investigation of existing Console code to plan a unified context-aware pipeline

---

## 1. The Gazette Code

### Files Found

| File | Role |
|------|------|
| `components/console/MorningBriefing.tsx` | The Gazette UI — a full newspaper-styled React component (~450 lines) |
| `app/api/morning-briefing/route.ts` | Backend: fetches Wikipedia, GDELT, YouTube data per region |
| `app/api/trend-ticker/route.ts` | Backend: fetches TikTok + Instagram hashtags via ScrapeCreators |
| `app/api/trending-audio/route.ts` | Backend: fetches TikTok trending sounds, enriches with Spotify |

### Current Implementation

The Gazette (`MorningBriefing.tsx`) is a self-contained newspaper-layout component with:

- **Inputs:** Region (user-selectable from 6 options: AE, SA, KW, QA, US, SG)
- **Data fetching:** Three parallel `fetch()` calls on mount/region change:
  - `/api/morning-briefing?region=X` → Wikipedia trending pages + GDELT news + YouTube trending
  - `/api/trend-ticker?region=X` → TikTok hashtags + Instagram hashtags
  - `/api/trending-audio?region=X` → TikTok trending sounds + Spotify album art
- **Output format:** Rendered as a visual newspaper with sections: masthead, editorial quote, Global Curiosity Index (Wikipedia), Regional News (GDELT narrative), Trend Ticker (hashtags), Sounds of the Moment (audio), platform-specific tabs (TikTok/Instagram/YouTube), post recommendations (generic + personalised via Content DNA)
- **State management:** Local `useState` hooks — no shared state store

### Key Observation

The Gazette currently has **zero concept-card awareness**. It displays raw trend data (hashtag lists, song lists, news articles) without any classification, scoring, or concept-card structure. The "concept cards" pattern only exists in the reverse-engineer route's "React Now" mode.

---

## 2. The Console Landing Page

### File: `app/page.tsx`

The landing page is a multi-stage wizard with these stages:

```
mode_select → source_input → ingesting → ingestion_confirmed →
content_focus_confirm → platform_select → re_setup → generating → complete
```

### Filter UI Location

The filter UI lives in `components/stages/ReverseEngineerSetupStage.tsx`. It presents:

| Filter | Options | Type |
|--------|---------|------|
| Platform | TikTok, Instagram, YouTube, LinkedIn, X, Facebook | Single select (card grid) |
| Region | AE, SA, KW, QA, US, SG | Single select (flag cards) |
| Time Horizon | React Now (same_day, 24h, 48h, 72h), Plan Ahead (1w, 2w, 4w), Analyse History (6m, 12m) | Grouped radio |
| Industry | 10 industries (Real Estate, Automotive, Hospitality, etc.) | Optional single select (icon grid) |
| Audience | Gen Z, Millennials, Gen X, Boomers, All Ages | Optional single select |
| Quick Pulse | TikTok Trending, Instagram Trending, YouTube Trending, News Headlines, Cultural Pulse | Quick-start shortcuts |
| Niche | Free-text input | Text field |

### What Happens on Selection

`onConfirm(platform, niche, lag, region, industry, audience, quickPulse)` → triggers a POST to `/api/reverse-engineer` with all context as JSON body → response is an SSE stream of "card" events rendered by `PlatformWorkspace.tsx`.

### State Management

**No shared state store.** All state is local `useState` in `app/page.tsx`:
- `reNiche`, `reRegion`, `reLag`, `reIndustry`, `reAudience` — filter values
- `selectedPlatforms` — chosen platforms
- `platformCards` — SSE card data received from reverse-engineer

---

## 3. The Existing Context Flow

### How context flows today:

```
ReverseEngineerSetupStage (UI)
  → onConfirm(platform, niche, lag, region, industry, audience)
    → app/page.tsx stores in local state
      → POST /api/reverse-engineer { platform, niche, region, lag, industry, audience }
        → SSE stream of cards back to PlatformWorkspace
```

### Is there a unified "user context" object?

**No.** Each filter is a separate state variable in `app/page.tsx`. They're bundled into a JSON body only at the POST call. The three Gazette routes (`morning-briefing`, `trend-ticker`, `trending-audio`) each take only `?region=X` as a query param — they don't receive platform, industry, audience, or niche.

### The gap:

The Gazette and the reverse-engineer route are **two separate worlds**:
- **Gazette:** Region-only context → raw trend lists → newspaper layout
- **Reverse-engineer:** Full context (platform + region + niche + lag + industry + audience) → Claude-generated concept cards → workspace cards

There is no shared pipeline connecting them.

---

## 4. Existing API Routes

### All routes under `app/api/`:

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/morning-briefing` | GET | Wikipedia + GDELT + YouTube for Gazette |
| `/api/trend-ticker` | GET | TikTok + Instagram hashtags |
| `/api/trending-audio` | GET | TikTok sounds + Spotify enrichment |
| `/api/reverse-engineer` | POST | Full SSE pipeline: scrape → Claude → concept cards |
| `/api/trend-radar/capture` | POST | Capture trend snapshot to Firestore |
| `/api/trend-radar/scores` | GET | Scored + classified trends from snapshots |
| `/api/post-recommendations` | GET | Claude-generated post ideas (generic + personalised) |
| `/api/content-dna/*` | Various | Content DNA profile management |
| `/api/dashboard` | GET | Analytics dashboard stats |
| `/api/accounts/*` | Various | User account management |
| `/api/jobs/*` | Various | Job CRUD and SSE streaming |
| `/api/upload/*` | Various | File upload handling |
| `/api/health/*` | GET | Health checks |
| `/api/platform-selection` | POST | Platform selection step |
| `/api/analyze` | POST | Content analysis |

### Trend-related route summaries:

**`/api/trend-ticker` (GET)** — Takes `?region=X`. Calls ScrapeCreators for TikTok hashtags (`/v1/tiktok/hashtags/popular`) and Instagram reels (`/v2/instagram/reels/search`), also YouTube Data API for trending video tags. Returns `{ tiktok: string[], instagram: string[], youtube: string[], region }`. No Firestore reads, no Claude calls. Pure data fetch.

**`/api/trending-audio` (GET)** — Takes `?region=X`. Calls ScrapeCreators for TikTok trending songs (`/v1/tiktok/songs/popular`), enriches top 5 with Spotify album art via `searchSpotifyTrack()`. Returns `{ sounds: TrendingSound[], source, region }`. No Firestore, no Claude.

**`/api/morning-briefing` (GET)** — Takes `?region=X`. Fetches Wikipedia trending pages (yesterday's most-viewed), GDELT news articles (`trending {regionLabel}`), YouTube trending videos. Returns `{ wikipedia, gdelt, youtube, region, regionLabel, generatedAt }`. No Firestore, no Claude.

**`/api/reverse-engineer` (POST)** — The big one. Takes full context body: `{ platform, niche, region, lag, industry, audience, quickPulse }`. Runs the inference-last provider chain: ScrapeCreators → Apify → xpoz → Perplexity → Claude. Produces SSE events with concept cards (trendSummary, concept1-4, executionGuide for React Now; videoIdeas, hooks, cadencePlan, contentPillars, competitivePosition for Plan Ahead). Heavy Claude usage. Writes to Firestore via job store.

**`/api/trend-radar/capture` (POST)** — Takes `{ platform, scope, niche?, region? }`. Calls `captureTrends()` from `lib/trendRadar/capture.ts` which hits ScrapeCreators, writes a `TrendSnapshot` to Firestore `trend_snapshots` collection. Returns `{ snapshotId, entityCount, source }`.

**`/api/trend-radar/scores` (GET)** — Takes `?platform=X&lag=X&niche=X&limit=X`. Reads recent snapshots from Firestore, computes velocity/persistence/novelty scores via `lib/trendRadar/score.ts`, classifies via `lib/trendRadar/classify.ts`. Returns scored and classified trends. Most sophisticated pipeline — already has the scoring/classification infrastructure.

**`/api/post-recommendations` (GET)** — Takes `?region=X&platform=X&uid=X`. Fetches trend-ticker + trending-audio data, loads Content DNA profile if uid provided, calls Claude to generate personalised post recommendations. Returns `{ posts: PostRec[] }`.

---

## 5. Type Definitions

### What exists:

| Type | Location | Purpose |
|------|----------|---------|
| `TrendSnapshot` | `lib/trendRadar/types.ts` | Raw capture: platform, region, entities[], capturedAt, source |
| `TrendEntity` | `lib/trendRadar/types.ts` | Individual trend item: entity, entityType (hashtag/song), rank, metadata |
| `TrendScore` | `lib/trendRadar/types.ts` | Derived metrics: velocity, persistence, novelty, classification, trendOutlook |
| `TrendClassification` | `lib/trendRadar/types.ts` | `breakout_candidate | stable_opportunity | fading_fast | recurring_pattern | niche_advantage` |
| `TrendOutlook` | `lib/trendRadar/types.ts` | Forecast: direction, stillWorthMaking, forecastConfidence, recommendedNextStep |
| `JobV2` | `types/jobs.ts` | Console job schema with platform cards |
| `PlatformCards` | `types/jobs.ts` | Card types: platformTrends, topicTrends, trendingAudio, etc. |

### What's missing:

| Missing Type | Needed For |
|--------------|-----------|
| `ConceptCard` | Unified output format — combining trend data, classification, and actionable content recommendation into one card |
| `UserContext` | Shared context object bundling region, platform, niche, industry, audience, horizon |
| `GazetteSection` | Typed output for Gazette sections (currently untyped JSON) |
| `ClassificationCategory` | The 7 concept-card categories from DA-UC-001 (TREND_ALERT, BRAND_SIGNAL, etc.) — exists only in Python benchmark, not in TypeScript |

### Key insight:

The `TrendScore` type in `lib/trendRadar/types.ts` is **the closest thing to a concept card that already exists**. It has classification, velocity, persistence, confidence tiers, trend outlook, and production-lag fitness. The refactor could build concept cards on top of `TrendScore` rather than inventing a parallel system.

---

## 6. Refactor Impact Assessment

### New files to create:

| File | Purpose | Risk |
|------|---------|------|
| `types/conceptCard.ts` | `ConceptCard` and `UserContext` type definitions | LOW — new file |
| `lib/pipeline/context.ts` | Unified context builder: UI selections → `UserContext` object | LOW — new file |
| `lib/pipeline/conceptCards.ts` | Pipeline: `UserContext` + `TrendScore[]` → `ConceptCard[]` | LOW — new file |
| `app/api/concept-cards/route.ts` | New API route: single entry point for the unified pipeline | LOW — new route |
| `components/console/ConceptCardGrid.tsx` | UI component for rendering concept cards | LOW — new component |

### Files to modify:

| File | Change | Risk |
|------|--------|------|
| `components/console/MorningBriefing.tsx` | Add concept-card section; fetch from new `/api/concept-cards` instead of (or in addition to) the three separate routes | MEDIUM — large component, visual regression possible |
| `components/stages/ReverseEngineerSetupStage.tsx` | Export `UserContext` type from filter selections | LOW — type export only |
| `app/page.tsx` | Pass `UserContext` to Gazette and new concept-card components | LOW — prop threading |
| `lib/trendRadar/types.ts` | Add `ConceptCard` extension of `TrendScore` | LOW — additive |

### Files that stay untouched:

| File | Why |
|------|-----|
| `app/api/trend-ticker/route.ts` | Still serves raw hashtag data for Gazette ticker display |
| `app/api/trending-audio/route.ts` | Still serves raw audio data for Gazette sounds section |
| `app/api/morning-briefing/route.ts` | Still serves Wikipedia/GDELT/YouTube for Gazette sections |
| `app/api/reverse-engineer/route.ts` | The existing React Now / Plan Ahead SSE pipeline stays as-is — concept cards are a parallel offering, not a replacement |
| `app/api/trend-radar/*` | Capture and scoring infrastructure is reused, not modified |
| `lib/trendRadar/capture.ts` | Snapshot capture stays unchanged |
| `lib/trendRadar/score.ts` | Scoring logic is consumed by the new pipeline |
| `lib/trendRadar/classify.ts` | Classification logic is consumed by the new pipeline |

### Proposed pipeline (pseudo-code):

```
// New unified pipeline: context → trends → concept cards

function buildConceptCards(ctx: UserContext): ConceptCard[] {

  // 1. Gather trend data (reuse existing infrastructure)
  const snapshots = await getRecentSnapshots(ctx.platform, "platform_wide", null, 30)
  const scores: TrendScore[] = computeScores(snapshots)
  const classified = classifyAndSort(scores, ctx.productionLag)

  // 2. Fetch supplementary context (reuse existing routes internally)
  const ticker = await fetchTrendTicker(ctx.region)      // hashtags
  const audio = await fetchTrendingAudio(ctx.region)      // sounds
  const briefing = await fetchMorningBriefing(ctx.region)  // news/wiki/youtube

  // 3. Build concept cards from scored trends + context
  const cards: ConceptCard[] = classified.map(trend => ({
    // From TrendScore (already computed)
    entity: trend.entity,
    entityType: trend.entityType,
    classification: trend.classification,
    velocity: trend.velocity_24h,
    persistence: trend.persistence,
    confidenceTier: trend.confidenceTier,
    trendOutlook: trend.trendOutlook,

    // New: concept-card category (from DA-UC-001 taxonomy)
    conceptCategory: classifyIntoConceptCard(trend, ticker, audio, briefing),

    // New: context-aware fields
    region: ctx.region,
    platform: ctx.platform,
    industry: ctx.industry,
    audience: ctx.audience,
    relevanceScore: computeRelevance(trend, ctx),

    // New: actionability
    suggestedAction: trend.trendOutlook.recommendedNextStep,
    contentIdea: null,  // Populated by Claude in inference-last step
  }))

  // 4. Inference-last: Claude enriches top cards with content ideas
  const enriched = await enrichWithClaude(cards.slice(0, 10), ctx)

  return enriched
}
```

### Estimated scope:

- **New files:** 5
- **Modified files:** 3-4
- **Lines of new code:** ~400-600 (types + pipeline + route + component)
- **Lines of modified code:** ~50-100 (prop threading, optional new section in Gazette)
- **Production risk:** LOW — the refactor is additive. Existing routes and Gazette continue to work. The new `/api/concept-cards` route and concept-card UI are opt-in additions.

---

## Open Questions Requiring Human Judgment

1. **Should concept cards replace or supplement the Gazette?** The current Gazette is a polished newspaper layout that users (Doli's family) already see. Options: (a) add concept cards as a new tab/section within the Gazette, (b) replace the raw trend sections with concept cards, (c) build concept cards as a separate page/view entirely.

2. **Should the unified pipeline reuse `/api/reverse-engineer` or be a new route?** The reverse-engineer route already generates concept cards for React Now mode. We could extend it to serve the Gazette too, or keep them separate to avoid bloating a 1000+ line route.

3. **How should we handle the YouTube exclusion rule?** Trend Ticker excludes YouTube (DA-UC-001 constraint), but the Gazette and concept cards may want YouTube data for the "Video Trending" section. Clarify: is YouTube excluded only from hashtag detection, or from the entire concept-card pipeline?

4. **Should Content DNA integration happen now or later?** The post-recommendations route already personalises based on Content DNA. Concept cards could also be personalised, but this adds complexity. Recommend: ship generic concept cards first, add personalisation in a follow-up.

5. **What's the priority: Gazette refactor or overnight optimization cycle?** The hybrid architecture (DA-TEC-2026-002) and the Gazette refactor are parallel workstreams. Which one should get focus first?

---

**End of reconnaissance report. No code was modified. Awaiting human review before proceeding.**
