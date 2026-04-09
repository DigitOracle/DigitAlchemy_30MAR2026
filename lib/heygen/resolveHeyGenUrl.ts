/**
 * Resolve a HeyGen dashboard URL to a CDN video URL via the HeyGen API.
 *
 * Dashboard URL pattern: https://app.heygen.com/videos/{video_id}
 * API endpoint: GET https://api.heygen.com/v1/video_status.get?video_id={video_id}
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

export async function resolveHeyGenUrl(dashboardUrl: string): Promise<string> {
  const apiKey = process.env.HEYGEN_API_KEY;
  if (!apiKey) {
    throw new HeyGenResolveError(
      "HeyGen API key not configured. Set HEYGEN_API_KEY in environment variables.",
      "missing_api_key",
    );
  }

  const videoId = extractVideoId(dashboardUrl);

  const res = await fetch(
    `https://api.heygen.com/v1/video_status.get?video_id=${encodeURIComponent(videoId)}`,
    {
      headers: { "X-Api-Key": apiKey },
      signal: AbortSignal.timeout(15000),
    },
  );

  if (!res.ok) {
    throw new HeyGenResolveError(
      `HeyGen API returned ${res.status}. The video may not exist or the API key may be invalid.`,
      "api_error",
    );
  }

  const json = await res.json();
  const data = json?.data as Record<string, unknown> | undefined;

  if (!data) {
    throw new HeyGenResolveError(
      "HeyGen API returned an unexpected response shape.",
      "bad_response",
    );
  }

  const status = data.status as string | undefined;
  if (status !== "completed") {
    throw new HeyGenResolveError(
      `Video is still processing in HeyGen (status: ${status ?? "unknown"}). Try again once it's ready.`,
      "not_completed",
    );
  }

  const videoUrl = data.video_url as string | undefined;
  if (!videoUrl) {
    throw new HeyGenResolveError(
      "HeyGen API returned completed status but no video URL.",
      "missing_video_url",
    );
  }

  return videoUrl;
}
