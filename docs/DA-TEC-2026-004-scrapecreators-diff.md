# DA-TEC-2026-004 — ScrapeCreators Implementation Diff

**Date:** 2026-04-07
**Purpose:** Document all ScrapeCreators fetch implementations before extraction to canonical module.
**Phase:** 2.0 of DA-GAZETTE-UNIFICATION

---

## Caller 1: `app/api/trend-ticker/route.ts`

**Lines:** 33–83
**Functions:** `fetchTikTokHashtags()` (lines 33–53), `fetchInstagramHashtags()` (lines 58–83)

### Endpoints called

| Function | Endpoint | Method |
|----------|----------|--------|
| `fetchTikTokHashtags` | `/v1/tiktok/hashtags/popular?region={region}` | GET |
| `fetchInstagramHashtags` | `/v2/instagram/reels/search?query={query}&region={region}` | GET |

### Request shape
- Header: `x-api-key` from `SCRAPECREATORS_API_KEY`
- Timeout: 10,000ms via `AbortSignal.timeout(10000)`
- Instagram query: `"trending {regionLabel}"` (human-readable region name)

### Response parsing
- TikTok hashtags: Flexible array detection (`data`, `list`, `hashtags`, `items`). Extracts `hashtag_name ?? name ?? hashtag ?? title`, prefixes with `#`, takes first 50.
- Instagram: Flexible array detection (`data`, `reels`, `items`). Regex-extracts `#hashtags` from `caption ?? text`, dedupes, lowercases, takes first 8.

### Error handling
- Try/catch returns `[]` on any error. No retry. No logging beyond `console.log`.

### Return type
- TikTok: `string[]` (hashtag strings with `#` prefix)
- Instagram: `string[]` (hashtag strings, lowercased, with `#` prefix)

---

## Caller 2: `app/api/reverse-engineer/route.ts`

**Lines:** 38–139
**Functions:** `fetchScrapeCreatorsTikTokPlatform()` (38–78), `fetchScrapeCreatorsTikTokByTopic()` (80–113), `fetchScrapeCreatorsInstagram()` (116–139)

### Endpoints called

| Function | Endpoint(s) | Method |
|----------|-------------|--------|
| `fetchScrapeCreatorsTikTokPlatform` | `/v1/tiktok/songs/popular?region={r}`, `/v1/tiktok/hashtags/popular?region={r}` (parallel) | GET |
| `fetchScrapeCreatorsTikTokByTopic` | `/v1/tiktok/search/keyword?query={q}&count=10&region={r}`, `/v1/tiktok/search/hashtag?keyword={q}&count=10&region={r}` (parallel) | GET |
| `fetchScrapeCreatorsInstagram` | `/v2/instagram/reels/search?keyword={q}&region={r}` | GET |

### Request shape
- Header: `x-api-key` from `SCRAPECREATORS_API_KEY`
- Timeout: 12,000ms via `AbortSignal.timeout(12000)`
- Topic search: combines `topic` + `industryLabel` if present

### Response parsing
- Songs: Flexible array (`sound_list`, `data`, `songs`, `items`). Extracts `title`, `author`, `usageCount`, `relatedCount`, `cover`, `link`, `rank`, `rankDiff`. Takes first 50.
- Hashtags: Same flexible array as Caller 1. Strips `#` prefix. Takes first 50.
- By-topic keyword: Extracts hashtags from video `desc`/`description`/`text`/`caption` via regex. Also parses hashtag search results (`challengeList`).
- Instagram: Same as Caller 1 pattern but uses `keyword` param (not `query`). Extracts hashtags + snippet context.

### Error handling
- Try/catch returns `null` (not `[]`). No retry. No logging.

### Return type
- Platform: `{ songs: SongData[]; hashtags: string[] } | null`
- By-topic: `{ hashtags: string[]; context: string } | null`
- Instagram: `{ hashtags: string[]; context: string } | null`

### Key difference from Caller 1
- Uses `keyword` param for Instagram (not `query`)
- Returns structured objects (not flat arrays)
- Extracts song metadata (title, author, usage, cover, link, rank)
- Returns context snippets from captions
- 12s timeout vs 10s

---

## Caller 3: `lib/trendRadar/capture.ts`

**Lines:** 16–75 (TikTok platform), 77–110 (TikTok by topic), 204–225 (Instagram)
**Functions:** `captureScrapeCreatorsTikTok()`, `captureScrapeCreatorsTikTokByTopic()`, `captureScrapeCreatorsInstagram()`

### Endpoints called

| Function | Endpoint(s) | Method |
|----------|-------------|--------|
| `captureScrapeCreatorsTikTok` | `/v1/tiktok/songs/popular`, `/v1/tiktok/hashtags/popular`, `/v1/tiktok/videos/popular` (all parallel) | GET |
| `captureScrapeCreatorsTikTokByTopic` | `/v1/tiktok/search/keyword?keyword={q}&count=15`, `/v1/tiktok/search/hashtag?keyword={q}&count=15` (parallel) | GET |
| `captureScrapeCreatorsInstagram` | `/v2/instagram/reels/search?keyword={q}&region={r}` | GET |

### Request shape
- Header: `x-api-key` from `SCRAPECREATORS_API_KEY`
- Timeout: 12,000ms
- **Unique:** Also fetches `/v1/tiktok/videos/popular` (not called by other callers)
- By-topic uses `keyword` param (same as Caller 2), but `count=15` vs `count=10`

### Response parsing
- Transforms everything into `TrendEntity[]` via `buildEntity()` helper
- Songs: Extracts `title`, `author`, `usageCount`/`videoCount`, `playUrl`. Takes first 15 (not 50).
- Hashtags: Same flexible array parsing. Takes first 20 (not 50).
- Videos: Regex-extracts hashtags from video descriptions (unique to this caller)
- By-topic: Same hashtag extraction from keyword/hashtag search. Takes first 15.
- Instagram: Regex hashtag extraction from captions. Takes first 15.

### Error handling
- Try/catch returns `null`. Logs error message via `console.log`.

### Return type
- `{ entities: TrendEntity[]; source: string; confidence: SourceConfidence } | null`
- Entities are deduplicated via `dedupeEntities()`.

### Key difference from Callers 1 & 2
- Normalizes everything into `TrendEntity` typed objects (not raw strings or ad-hoc objects)
- Includes `/v1/tiktok/videos/popular` endpoint (no other caller uses this)
- Uses `buildEntity()` and `dedupeEntities()` from `./normalize.ts`
- Returns source confidence labels ("high", "medium")
- Lower item limits (15–20 vs 50)

---

## Caller 4: `app/api/trending-audio/route.ts`

**Lines:** 33–57
**Function:** `fetchTrendingSounds()`

### Endpoint called

| Function | Endpoint | Method |
|----------|----------|--------|
| `fetchTrendingSounds` | `/v1/tiktok/songs/popular?region={region}` | GET |

### Request shape
- Header: `x-api-key` from `SCRAPECREATORS_API_KEY`
- Timeout: 10,000ms

### Response parsing
- Flexible array: `sound_list`, `data`, `songs`, `items`
- Extracts: `title`, `author`, `rank`, `rank_diff`, `rank_diff_type`, `cover`, `link`, `duration`
- Adds `albumArt: null, spotifyUrl: null` (populated later by Spotify enrichment)
- Takes first 50

### Error handling
- Try/catch returns `[]`. Logs error.

### Return type
- `TrendingSound[]` (custom interface with rank, rankDiff, rankDiffType, cover, link, duration, albumArt, spotifyUrl)

### Key difference from other callers
- Only calls the songs endpoint (not hashtags)
- Extracts `rank_diff`, `rank_diff_type`, `duration` — fields no other caller uses
- Returns a flatter structure purpose-built for the audio UI

---

## Canonical Module Design

### Unique endpoints across all four callers (deduped)

| # | Endpoint | Used by |
|---|----------|---------|
| 1 | `/v1/tiktok/hashtags/popular` | Callers 1, 2, 3 |
| 2 | `/v1/tiktok/songs/popular` | Callers 2, 3, 4 |
| 3 | `/v1/tiktok/videos/popular` | Caller 3 only |
| 4 | `/v1/tiktok/search/keyword` | Callers 2, 3 |
| 5 | `/v1/tiktok/search/hashtag` | Callers 2, 3 |
| 6 | `/v2/instagram/reels/search` | Callers 1, 2, 3 |

### Proposed function signatures

```typescript
fetchTikTokPopularHashtags(params: { region: string })
fetchTikTokPopularSongs(params: { region: string })
fetchTikTokPopularVideos(params: { region: string })
fetchTikTokSearchKeyword(params: { query: string; region: string; count?: number })
fetchTikTokSearchHashtag(params: { keyword: string; region: string; count?: number })
fetchInstagramReelsSearch(params: { keyword: string; region: string })
```

### Shared response envelope

```typescript
type SCResponse<T> = {
  ok: boolean;
  data: T | null;
  error: string | null;
  source: "scrapeCreators";
  fetched_at: string;
}
```

### Payload types (superset of all callers)

**Hashtag item** — union of all fields any caller extracts:
`{ hashtag_name, name, hashtag, title, video_views, viewCount, views, videoCount }`

**Song item** — union of all fields:
`{ title, songName, name, author, authorName, artist, usageCount, videoCount, stats, cover, link, rank, rank_diff, rank_diff_type, duration, playUrl, play_url, related_items }`

**Video item** — union:
`{ desc, description, text, caption }`

**Instagram reel item** — union:
`{ caption, text }`

### Parsing inconsistencies and resolution

1. **Instagram search param name:** Caller 1 uses `query`, Callers 2 and 3 use `keyword`. **Resolution:** The canonical module will use `keyword` (matches the majority and aligns with the `/v2` API docs).

2. **Timeout values:** Caller 1 uses 10s, Callers 2/3 use 12s, Caller 4 uses 10s. **Resolution:** Default to 12s in the canonical module (the longest existing value), with per-call override via params.

3. **Item limits:** Caller 1 takes 50, Caller 3 takes 15–20, etc. **Resolution:** The canonical module returns all items from the API. Callers slice to their own limits.

4. **Instagram `query` vs `keyword` param:** **Resolution:** Use `keyword`. Caller 1 at `trend-ticker/route.ts:63` uses `query=` but this appears to be an older API version. The `/v2` endpoint documented in Callers 2 and 3 uses `keyword=`. Migration in Phase 4 will update Caller 1 to match.
