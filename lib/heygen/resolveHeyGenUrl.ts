/**
 * Resolve a HeyGen dashboard URL to a CDN video URL via the HeyGen API.
 *
 * Supports two URL patterns:
 * 1. Standard: https://app.heygen.com/videos/{video_id}
 *    → resolved via GET /v1/video_status.get?video_id={video_id}
 * 2. Bio/profile: https://app.heygen.com/videos/bio-{hash}
 *    → resolved via GET /v1/video.list (search by partial ID match)
 */

export class HeyGenResolveError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = "HeyGenResolveError";
  }
}

const HEYGEN_DASHBOARD_PATTERN = /^https:\/\/app\.heygen\.com\/videos\/([a-zA-Z0-9_-]+)/;

export function isHeyGenDashboardUrl(url: string): boolean {
  return HEYGEN_DASHBOARD_PATTERN.test(url.split("?")[0]);
}

export function extractVideoId(url: string): string {
  const match = url.split("?")[0].match(HEYGEN_DASHBOARD_PATTERN);
  if (!match || !match[1]) {
    throw new HeyGenResolveError(
      "Not a valid HeyGen dashboard URL. Expected: https://app.heygen.com/videos/{video_id}",
      "invalid_url",
    );
  }
  return match[1];
}

function getApiKey(): string {
  const apiKey = process.env.HEYGEN_API_KEY;
  if (!apiKey) {
    throw new HeyGenResolveError(
      "HeyGen API key not configured. Set HEYGEN_API_KEY in environment variables.",
      "missing_api_key",
    );
  }
  return apiKey;
}

/** Try the standard video_status.get endpoint. Returns CDN URL or null. */
async function tryStatusEndpoint(videoId: string, apiKey: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://api.heygen.com/v1/video_status.get?video_id=${encodeURIComponent(videoId)}`,
      { headers: { "X-Api-Key": apiKey }, signal: AbortSignal.timeout(15000) },
    );
    if (!res.ok) return null;

    const json = await res.json();
    const data = json?.data as Record<string, unknown> | undefined;
    if (!data) return null;

    const status = data.status as string | undefined;
    if (status !== "completed") {
      throw new HeyGenResolveError(
        `Video is still processing in HeyGen (status: ${status ?? "unknown"}). Try again once it's ready.`,
        "not_completed",
      );
    }

    return (data.video_url as string) || null;
  } catch (e) {
    if (e instanceof HeyGenResolveError) throw e;
    return null;
  }
}

/** Search the video list for a matching video. Returns CDN URL or null. */
async function tryVideoListLookup(idFragment: string, apiKey: string): Promise<string | null> {
  try {
    const res = await fetch(
      "https://api.heygen.com/v1/video.list?limit=100",
      { headers: { "X-Api-Key": apiKey }, signal: AbortSignal.timeout(15000) },
    );
    if (!res.ok) return null;

    const json = await res.json();
    const videos = (json?.data?.videos ?? []) as {
      video_id?: string;
      title?: string;
      status?: string;
      video_url?: string;
    }[];

    // Search by partial ID match (strip bio- prefix)
    const searchTerm = idFragment.toLowerCase();
    const match = videos.find((v) => {
      const vid = (v.video_id ?? "").toLowerCase();
      return vid.includes(searchTerm) || searchTerm.includes(vid);
    });

    if (!match) return null;

    if (match.status !== "completed") {
      throw new HeyGenResolveError(
        `Video found but still processing (status: ${match.status ?? "unknown"}). Try again once it's ready.`,
        "not_completed",
      );
    }

    return match.video_url || null;
  } catch (e) {
    if (e instanceof HeyGenResolveError) throw e;
    return null;
  }
}

export async function resolveHeyGenUrl(dashboardUrl: string): Promise<string> {
  const apiKey = getApiKey();
  const videoId = extractVideoId(dashboardUrl);

  // For bio- prefixed URLs, strip the prefix and use the raw ID directly.
  // Confirmed: video_status.get works with the raw ID (e.g., cb2d34d5c79846d491e72b88dbd51e48).
  const resolveId = videoId.startsWith("bio-") ? videoId.replace(/^bio-/, "") : videoId;

  const cdnUrl = await tryStatusEndpoint(resolveId, apiKey);
  if (cdnUrl) return cdnUrl;

  throw new HeyGenResolveError(
    "Could not resolve this HeyGen video. The video may not exist, may still be processing, or the API key may be invalid.",
    "not_found",
  );
}
