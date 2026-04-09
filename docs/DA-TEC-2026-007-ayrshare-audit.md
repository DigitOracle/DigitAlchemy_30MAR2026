# DA-TEC-2026-007 — Ayrshare Integration Audit (Phase 2.3a)

**Date:** 2026-04-07
**Authors:** Kendall Wilson (Doli) + Claude Code
**Status:** Complete — findings inform Phase 2.3b scope

## Purpose

Phase 2.3 will build a concept-card generator that surfaces predictions based on the user's actual historical post performance (Performance DNA) blended with regional/industry baselines. Before writing code, this audit maps the existing Ayrshare integration to determine: (a) what data is already being pulled, (b) what's being persisted, (c) what's being discarded, and (d) where a Performance DNA layer plugs in.

## Current State

### Files involved

| File | Role |
|------|------|
| `lib/ayrshare.ts` | Core Ayrshare client: `fetchPostHistory()`, `fetchAllPostHistory()`, `normalizePost()`, `enrichYouTubeWithDataAPI()` |
| `lib/firestore/integrations.ts` | `getAyrshareConfig()` — resolves API key + profile key per user. `saveAyrshareProfileKey()` — stores profile key on connect. |
| `lib/firestore/contentProfile.ts` | Content DNA CRUD — saves style analysis from Ayrshare posts. Does NOT persist engagement data. |
| `app/api/accounts/connect/route.ts` | OAuth flow: creates Ayrshare profile, generates JWT link URL for social account linking |
| `app/api/accounts/status/route.ts` | Checks connected platforms via Ayrshare `/profiles` endpoint |
| `app/api/content-dna/auto-ingest/route.ts` | Sync flow: fetches all post history, sends to Claude for DNA extraction, persists DNA profile |
| `app/api/dashboard/route.ts` | Dashboard stats: fetches post history, aggregates engagement metrics, returns stats + timeline |
| `app/accounts/page.tsx` | UI: linked accounts page, "Sync & Build Content DNA" button |

### Endpoints in use

| Ayrshare endpoint | Caller file | Purpose |
|-------------------|-------------|---------|
| `GET /api/history/{platform}` | `lib/ayrshare.ts:31` | Fetch user's post history with engagement data |
| `POST /api/profiles` | `app/api/accounts/connect/route.ts:60` | Create a new Ayrshare child profile for a user |
| `GET /api/profiles` | `app/api/accounts/connect/route.ts:76`, `app/api/accounts/status/route.ts:24` | List profiles to find matching profile key / check connected platforms |
| `POST /api/profiles/generateJWT` | `app/api/accounts/connect/route.ts:131` | Generate JWT URL for social account OAuth linking |
| `GET /api/user` | `app/api/accounts/status/route.ts:36` | Admin-only: check primary profile's connected social accounts |

**NOT in use:**

| Ayrshare endpoint | Status |
|-------------------|--------|
| `GET /analytics/post/{id}` | **Not called anywhere** — per-post analytics (impressions, reach, saves, profile visits) |
| `GET /analytics/social` | **Not called anywhere** — profile-level analytics (follower count, growth rate) |
| `POST /post` | Not called — no publishing from the Console |
| `POST /auto-schedule` | Not called — no scheduling |
| `GET /comments` | Not called |

### Firestore persistence

**`users/{uid}/integrations/ayrshare`** — Written on account connect (`app/api/accounts/connect/route.ts:106`):
```
{
  profileKey: string,     // Ayrshare child profile key
  refId: string,          // Ayrshare reference ID
  connectedAt: string,    // ISO timestamp
  platforms: string[],    // e.g. ["tiktok", "linkedin", "youtube"]
}
```
Updated by `app/api/accounts/status/route.ts:49` with the current `platforms` list.

**`users/{uid}/content_samples/{docId}`** — Written by `saveDNASample()` on each DNA sync. Contains style analysis only (topics, tone, visualStyle, etc.). Does NOT contain engagement metrics.

**`users/{uid}/content_profile/main`** — Merged profile aggregated from samples. Same shape as above — style only, no engagement.

**No Firestore path stores raw Ayrshare post data or engagement metrics.** Posts are fetched, analyzed, and discarded every time.

### Content DNA integration

The auto-ingest flow (`app/api/content-dna/auto-ingest/route.ts:42-67`):

1. Calls `fetchAllPostHistory()` which fetches `/api/history/{platform}` for TikTok, LinkedIn, YouTube
2. `normalizePost()` extracts engagement fields: `views`, `likes`, `comments`, `shares`, `watchTime`, `completionRate`, `duration`
3. YouTube posts enriched with YouTube Data API v3 stats (views, likes, comments)
4. All posts combined into a text block that **includes engagement data** (lines 56-59):
   - `Views: {p.views}`, `Likes: {p.likes}`, `Avg watch time: {p.watchTime}s`, `Completion rate: {p.completionRate}`
5. Claude analyzes the combined text and extracts **style** DNA (topics, tone, visual style, etc.)
6. The `ContentDNASample` saved to Firestore contains only style fields — **engagement data is discarded**

### Gaps

1. **Engagement metrics are fetched but not persisted.** The `AyrsharePost` interface has views, likes, comments, shares, watchTime, completionRate — all populated for TikTok, partially for LinkedIn and YouTube. But `saveDNASample()` only saves style analysis. The raw engagement data is lost after each sync.

2. **No per-post analytics.** The `/analytics/post/{id}` endpoint (impressions, reach, saves, profile visits) is never called. The current engagement data comes from `/history` response fields, which may have less granularity than the dedicated analytics endpoint.

3. **No profile-level analytics.** The `/analytics/social` endpoint (follower count, growth rate, demographics) is never called. The dashboard computes stats from post history only.

4. **No historical engagement persistence.** The dashboard fetches post history live every time. If a post's engagement metrics change over time (which they do — TikTok views can grow for weeks), there's no time-series record. Performance DNA needs at least one snapshot of engagement data per sync.

5. **No prediction infrastructure.** No code computes expected engagement ranges, baselines, or predictions. The reverse-engineer route asks Claude to estimate benchmarks, but those are industry-wide guesses, not user-specific predictions.

## Recommendations for Phase 2.3b

### Approach: Extend existing flow (small scope)

The engagement data is **already being fetched** — it's just being thrown away. Phase 2.3b does NOT need to add new Ayrshare endpoint integration. It needs to:

1. **Persist the engagement data that's already being fetched** alongside the style DNA
2. **Add a prediction layer** that computes baselines from the user's historical engagement
3. **Make the prediction available** to the concept-card generator

### Files to add

| File | Purpose |
|------|---------|
| `lib/firestore/performanceDNA.ts` | CRUD for `users/{uid}/performance_dna/main` — stores engagement baselines and per-post metrics |
| `lib/gazette/predictions.ts` | Computes expected engagement ranges from Performance DNA + regional/industry baselines |

### Files to modify

| File | Change |
|------|--------|
| `app/api/content-dna/auto-ingest/route.ts` | After extracting style DNA, also persist raw engagement data to `performance_dna` |
| `lib/ayrshare.ts` | No changes needed — already fetches engagement data |
| `firestore.rules` | Add `users/{uid}/performance_dna/{doc}` rule (same as other subcollections — owner read/write) |

### Estimated scope

**Half day.** The heavy lifting (Ayrshare integration, post normalization, engagement extraction) is already done. Phase 2.3b is plumbing: add a Firestore write, define a type, compute some averages.

### Risks

1. **Ayrshare plan tier.** The `/history` endpoint is available on all Ayrshare plans, but rate limits may apply. Current sync fetches all posts at once — if a user has 1000+ posts, this could hit rate limits. Mitigation: paginate or limit to most recent 100 posts.

2. **Engagement data freshness.** TikTok engagement data from `/history` reflects the state at the time of the API call, not the state when the post was published. A 2-week-old video might have 10x more views now than when it was first returned. This is fine for baselines but means we should record `fetchedAt` timestamps alongside the metrics.

3. **YouTube engagement gap.** The Ayrshare `/history` response for YouTube does NOT include engagement data natively — the existing code enriches via YouTube Data API v3 (`enrichYouTubeWithDataAPI()` at `lib/ayrshare.ts:114`). This enrichment depends on `YOUTUBE_API_KEY` being set. If it's missing, YouTube posts have zero engagement data.

4. **Instagram gap.** Instagram is listed as a connectable platform on the accounts page, but `fetchAllPostHistory()` at `lib/ayrshare.ts:153` only fetches TikTok, LinkedIn, YouTube — Instagram is NOT included. Instagram Performance DNA will be missing until this is added.

## Open Questions for Doli

1. **Should Performance DNA persist raw per-post engagement data, or only computed baselines?**
   - Per-post: more granular, enables trend analysis, but more Firestore storage
   - Baselines only: simpler, cheaper, sufficient for predictions
   - Recommended: persist per-post for the most recent 50 posts + computed baselines

2. **Should the `/analytics/post` and `/analytics/social` endpoints be added in Phase 2.3b or deferred?**
   - The `/history` endpoint already provides views/likes/comments/shares
   - `/analytics/post` adds impressions, reach, saves, profile visits
   - `/analytics/social` adds follower count, demographics
   - Recommended: defer to Phase 2.3c — the `/history` data is sufficient for v1 Performance DNA

3. **Should Instagram be added to `fetchAllPostHistory()` in Phase 2.3b?**
   - Currently only TikTok, LinkedIn, YouTube are fetched
   - Instagram is connectable but its history is never fetched
   - Recommended: add in Phase 2.3b — it's a one-line change to the platforms array

4. **What's the minimum number of posts needed before Performance DNA is considered reliable?**
   - Content DNA uses `sampleCount >= 6` for "high" confidence
   - Performance DNA likely needs more data points for statistically meaningful baselines
   - Recommended: 10 posts minimum, "high" at 30+, "low" below 10

---

**End of audit. No code was modified.**
