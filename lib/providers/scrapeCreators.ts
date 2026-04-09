/**
 * Canonical ScrapeCreators provider module.
 *
 * Single source of truth for all HTTP calls to api.scrapecreators.com.
 * Created in Phase 2.0 of DA-GAZETTE-UNIFICATION.
 * Callers migrate to this module in Phase 4.
 *
 * See docs/DA-TEC-2026-004-scrapecreators-diff.md for the diff analysis
 * that informed this design.
 */

// ============================================================================
// Response envelope — every function returns this shape
// ============================================================================

export interface SCResponse<T> {
  ok: boolean;
  data: T | null;
  error: string | null;
  source: "scrapeCreators";
  fetched_at: string;
}

// ============================================================================
// Raw item types — superset of fields extracted by all four existing callers
// ============================================================================

export interface SCHashtagItem {
  hashtag_name?: string;
  name?: string;
  hashtag?: string;
  title?: string;
  video_views?: number;
  viewCount?: number;
  views?: number;
  videoCount?: number;
  [key: string]: unknown;
}

export interface SCSongItem {
  title?: string;
  songName?: string;
  name?: string;
  author?: string;
  authorName?: string;
  artist?: string;
  usageCount?: number;
  videoCount?: number;
  stats?: { videoCount?: number; [key: string]: unknown };
  cover?: string;
  link?: string;
  rank?: number;
  rank_diff?: number;
  rank_diff_type?: number;
  duration?: number;
  playUrl?: string;
  play_url?: string;
  related_items?: unknown[];
  [key: string]: unknown;
}

export interface SCVideoItem {
  desc?: string;
  description?: string;
  text?: string;
  caption?: string;
  [key: string]: unknown;
}

export interface SCInstagramReelItem {
  caption?: string;
  text?: string;
  [key: string]: unknown;
}

// ============================================================================
// Internal fetch helper
// ============================================================================

const DEFAULT_BASE_URL = "https://api.scrapecreators.com";
const DEFAULT_TIMEOUT_MS = 12_000;

function getConfig(): { apiKey: string; baseUrl: string } | null {
  const apiKey = process.env.SCRAPECREATORS_API_KEY;
  if (!apiKey) return null;
  const baseUrl = process.env.SCRAPECREATORS_BASE_URL || DEFAULT_BASE_URL;
  return { apiKey, baseUrl };
}

async function scFetch<T>(
  path: string,
  opts?: { timeoutMs?: number },
): Promise<SCResponse<T>> {
  const config = getConfig();
  if (!config) {
    return {
      ok: false,
      data: null,
      error: "SCRAPECREATORS_API_KEY not configured",
      source: "scrapeCreators",
      fetched_at: new Date().toISOString(),
    };
  }

  const url = `${config.baseUrl}${path}`;
  const timeoutMs = opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  try {
    const res = await fetch(url, {
      headers: { "x-api-key": config.apiKey },
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!res.ok) {
      return {
        ok: false,
        data: null,
        error: `HTTP ${res.status} ${res.statusText}`,
        source: "scrapeCreators",
        fetched_at: new Date().toISOString(),
      };
    }

    const json = (await res.json()) as unknown;
    return {
      ok: true,
      data: json as T,
      error: null,
      source: "scrapeCreators",
      fetched_at: new Date().toISOString(),
    };
  } catch (err) {
    const message =
      err instanceof DOMException && err.name === "TimeoutError"
        ? "timeout"
        : err instanceof Error
          ? err.message
          : "unknown error";
    return {
      ok: false,
      data: null,
      error: message,
      source: "scrapeCreators",
      fetched_at: new Date().toISOString(),
    };
  }
}

// ============================================================================
// Flexible array extraction — handles the various response shapes
// ============================================================================

function extractArray<T>(
  data: unknown,
  candidates: string[],
): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === "object") {
    for (const key of candidates) {
      const val = (data as Record<string, unknown>)[key];
      if (Array.isArray(val)) return val as T[];
    }
  }
  return [];
}

// ============================================================================
// Public API — one function per unique endpoint
// ============================================================================

/**
 * GET /v1/tiktok/hashtags/popular
 * Used by: trend-ticker, reverse-engineer, trendRadar/capture
 */
export async function fetchTikTokPopularHashtags(params: {
  region: string;
  timeoutMs?: number;
}): Promise<SCResponse<SCHashtagItem[]>> {
  const raw = await scFetch<unknown>(
    `/v1/tiktok/hashtags/popular?region=${encodeURIComponent(params.region)}`,
    { timeoutMs: params.timeoutMs },
  );
  if (!raw.ok || raw.data === null) {
    return { ...raw, data: null } as SCResponse<SCHashtagItem[]>;
  }
  const items = extractArray<SCHashtagItem>(raw.data, [
    "list",
    "data",
    "hashtags",
    "hashtag_list",
    "items",
  ]);
  return { ...raw, data: items };
}

/**
 * GET /v1/tiktok/songs/popular
 * Used by: reverse-engineer, trendRadar/capture, trending-audio
 */
export async function fetchTikTokPopularSongs(params: {
  region: string;
  timeoutMs?: number;
}): Promise<SCResponse<SCSongItem[]>> {
  const raw = await scFetch<unknown>(
    `/v1/tiktok/songs/popular?region=${encodeURIComponent(params.region)}`,
    { timeoutMs: params.timeoutMs },
  );
  if (!raw.ok || raw.data === null) {
    return { ...raw, data: null } as SCResponse<SCSongItem[]>;
  }
  const items = extractArray<SCSongItem>(raw.data, [
    "sound_list",
    "data",
    "songs",
    "items",
  ]);
  return { ...raw, data: items };
}

/**
 * GET /v1/tiktok/videos/popular
 * Used by: trendRadar/capture only
 */
export async function fetchTikTokPopularVideos(params: {
  region: string;
  timeoutMs?: number;
}): Promise<SCResponse<SCVideoItem[]>> {
  const raw = await scFetch<unknown>(
    `/v1/tiktok/videos/popular?region=${encodeURIComponent(params.region)}`,
    { timeoutMs: params.timeoutMs },
  );
  if (!raw.ok || raw.data === null) {
    return { ...raw, data: null } as SCResponse<SCVideoItem[]>;
  }
  const items = extractArray<SCVideoItem>(raw.data, [
    "data",
    "items",
    "videos",
  ]);
  return { ...raw, data: items };
}

/**
 * GET /v1/tiktok/search/keyword
 * Used by: reverse-engineer, trendRadar/capture
 */
export async function fetchTikTokSearchKeyword(params: {
  query: string;
  region: string;
  count?: number;
  timeoutMs?: number;
}): Promise<SCResponse<SCVideoItem[]>> {
  const count = params.count ?? 15;
  const raw = await scFetch<unknown>(
    `/v1/tiktok/search/keyword?query=${encodeURIComponent(params.query)}&count=${count}&region=${encodeURIComponent(params.region)}`,
    { timeoutMs: params.timeoutMs },
  );
  if (!raw.ok || raw.data === null) {
    return { ...raw, data: null } as SCResponse<SCVideoItem[]>;
  }
  const items = extractArray<SCVideoItem>(raw.data, [
    "data",
    "items",
    "videos",
  ]);
  return { ...raw, data: items };
}

/**
 * GET /v1/tiktok/search/hashtag
 * Used by: reverse-engineer, trendRadar/capture
 */
export async function fetchTikTokSearchHashtag(params: {
  keyword: string;
  region: string;
  count?: number;
  timeoutMs?: number;
}): Promise<SCResponse<SCHashtagItem[]>> {
  const count = params.count ?? 15;
  const raw = await scFetch<unknown>(
    `/v1/tiktok/search/hashtag?keyword=${encodeURIComponent(params.keyword)}&count=${count}&region=${encodeURIComponent(params.region)}`,
    { timeoutMs: params.timeoutMs },
  );
  if (!raw.ok || raw.data === null) {
    return { ...raw, data: null } as SCResponse<SCHashtagItem[]>;
  }
  const items = extractArray<SCHashtagItem>(raw.data, [
    "data",
    "items",
    "challengeList",
  ]);
  return { ...raw, data: items };
}

/**
 * GET /v2/instagram/reels/search
 * Used by: trend-ticker, reverse-engineer, trendRadar/capture
 */
export async function fetchInstagramReelsSearch(params: {
  keyword: string;
  region: string;
  timeoutMs?: number;
}): Promise<SCResponse<SCInstagramReelItem[]>> {
  const raw = await scFetch<unknown>(
    `/v2/instagram/reels/search?keyword=${encodeURIComponent(params.keyword)}&region=${encodeURIComponent(params.region)}`,
    { timeoutMs: params.timeoutMs },
  );
  if (!raw.ok || raw.data === null) {
    return { ...raw, data: null } as SCResponse<SCInstagramReelItem[]>;
  }
  const items = extractArray<SCInstagramReelItem>(raw.data, [
    "data",
    "reels",
    "items",
  ]);
  return { ...raw, data: items };
}
