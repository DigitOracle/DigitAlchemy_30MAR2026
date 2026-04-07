# DA-DIAG-2026-001 — TikTok Tab Empty Recommendations

**Date:** 2026-04-07
**Symptom:** TikTok tab shows "No recommendations available right now" while other tabs render cards.

## Files inspected

| File | Lines | Purpose |
|------|-------|---------|
| `components/console/MorningBriefing.tsx` | 214-226, 229-245, 762-767 | Concept card fetch + fallback chain |
| `components/console/ConceptCardGrid.tsx` | Full file | Card rendering + empty state |
| `app/api/concept-cards/route.ts` | 40-91 | Route handler — does NOT pass recPosts |
| `lib/gazette/conceptCardGenerator.ts` | 95-160 | Generator — skips recPosts adapters when undefined |
| `lib/gazette/adapters.ts` | 59-85 | inferPlatformFormat — TikTok path correct |
| `app/api/post-recommendations/route.ts` | 75-89 | Server-to-server calls forward auth header |

## Root cause: TWO bugs, both contributing

### Bug 1 (PRIMARY): /api/concept-cards does not pass recPosts to the generator

**File:** `app/api/concept-cards/route.ts:81-91`

```typescript
const cards = await generateConceptCards({
  uid: callerUid,
  region,
  platform,
  industry: industry || undefined,
  contentDNA,
  performanceDNA,
  recentPosts,
  baselinePosts,
  scoredTrends,
  // ← recPosts is MISSING — the route never fetches Follow the Trend or Stay in Your Lane data
}, deps);
```

The `generateConceptCards` function skips both `adaptFollowTheTrendToConceptCard` and `adaptStayInYourLaneToConceptCard` when `input.recPosts` is undefined (lines 107, 113 in conceptCardGenerator.ts). The only cards produced come from `scoredTrends` via `adaptScoredTrendToConceptCard`.

**Impact:** If `scoredTrends` is empty (no TikTok snapshots in Firestore for the requested region), the generator returns `[]`, the ConceptCardGrid renders the empty state, and the fallback chain triggers TwoRowRecommends.

### Bug 2 (SECONDARY): Legacy fallback fetches post-recommendations without auth, causing 401 cascade

**File:** `components/console/MorningBriefing.tsx:237`

```typescript
const fetches: Promise<unknown>[] = [fetch(genericUrl).then(r => r.json())]
```

The generic (no-uid) fetch to `/api/post-recommendations` sends NO Authorization header. The post-recommendations route then makes server-to-server calls to `/api/trend-ticker` and `/api/trending-audio` (lines 80-81 in post-recommendations/route.ts), forwarding the auth header from the incoming request:

```typescript
const fwdAuth = req.headers.get("authorization")
const fwdHeaders: Record<string, string> = fwdAuth ? { Authorization: fwdAuth } : {}
```

Since `fwdAuth` is null, the internal calls to trend-ticker and trending-audio have no auth header → both return 401 (they were gated by Phase 2.S commit cd62a9b). This means Claude generates recommendations with "Trending hashtags on TikTok: none available" and "Trending sounds: none available" — likely producing generic or empty recs.

**Impact:** Even when the new concept cards are empty and the fallback fires, the fallback itself is partially broken because its grounding data (trends, sounds) is missing.

## Proposed fix (DO NOT IMPLEMENT)

**Fix 1:** In `app/api/concept-cards/route.ts`, add a fetch to `/api/post-recommendations` (with Bearer auth forwarded) and pass the result as `recPosts: { followTrend: genericRecs, stayInLane: personalRecs }` to `generateConceptCards`. This is the main fix — it populates the adapter pipeline with the data that currently gets thrown away.

**Fix 2:** In `components/console/MorningBriefing.tsx:237`, add Bearer auth to the generic post-recommendations fetch (same pattern as the personalised fetch at line 239). This fixes the fallback chain so legacy recs work even when concept cards are empty.

**Fix 3:** Consider whether the post-recommendations route should call trend-ticker and trending-audio via direct function calls instead of HTTP loopback, to avoid the auth-forwarding problem entirely. This is a Phase 4 refactor, not urgent.

## Other suspicious findings

1. **`activeSection` used as platform filter in concept cards fetch** (line 219). When the user clicks the TikTok tab, `activeSection` is `"tiktok"` — this is correct. But the concept cards fetch fires on every tab change (dep array: `[region, user, activeSection]`), including non-platform tabs like "news" and "culture" where `activeSection` values like `"news"` are passed as `platform=news` to the API. The API probably handles this gracefully (no data for platform "news"), but it's wasted API calls.

2. **No `recPosts` source in the concept-cards route** is the fundamental architecture gap. The route was built as a parallel pipeline in Phase 2.3f but was never connected to the existing post-recommendations source. The adapters exist (Phase 2.3e) but have no data flowing through them for RecPost-derived cards.
