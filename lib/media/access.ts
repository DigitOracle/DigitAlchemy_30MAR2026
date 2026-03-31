// lib/media/access.ts — Media access with platform detection + OAuth retry

import { PLATFORMS } from "@/config/platforms"
import { getToken, isTokenValid, refreshAccessToken } from "@/lib/oauth/tokens"
import { appendAccessAttempt } from "@/lib/firestore/jobs"
import type { AccessAttempt } from "@/types/jobs"

export type MediaAccessResult = {
  success: boolean
  accessMethod: "public" | "oauth" | null
  finalUrl: string | null
  detectedPlatform: string | null
  requiresOAuth: boolean
  oauthConfigured: boolean
  error: string | null
  videoMeta?: {
    title?: string
    duration?: number
    thumbnailUrl?: string
    videoUrl?: string
    captionUrl?: string
  }
}

const PLATFORM_PATTERNS: [RegExp, string][] = [
  [/app\.heygen\.com/, "heygen"],
  [/youtube\.com|youtu\.be/, "youtube"],
  [/instagram\.com/, "instagram"],
  [/tiktok\.com/, "tiktok"],
  [/linkedin\.com/, "linkedin"],
  [/twitter\.com|x\.com/, "x"],
  [/facebook\.com|fb\.watch/, "facebook"],
]

function detectPlatform(url: string): string | null {
  for (const [pattern, platform] of PLATFORM_PATTERNS) {
    if (pattern.test(url)) return platform
  }
  return null
}

function extractHeyGenVideoId(url: string): string | null {
  const match = url.match(/app\.heygen\.com\/videos\/([a-f0-9]+)/)
  return match?.[1] ?? null
}

async function fetchHeyGenVideo(
  videoId: string,
  accessToken: string
): Promise<MediaAccessResult> {
  const res = await fetch(
    `https://api.heygen.com/v1/video_status.get?video_id=${videoId}`,
    { headers: { "Authorization": `Bearer ${accessToken}` } }
  )

  if (!res.ok) {
    return {
      success: false, accessMethod: null, finalUrl: null,
      detectedPlatform: "heygen", requiresOAuth: true,
      oauthConfigured: true, error: `HeyGen API returned ${res.status}`,
    }
  }

  const json = await res.json()
  const data = json.data

  if (!data || data.status === "failed") {
    return {
      success: false, accessMethod: null, finalUrl: null,
      detectedPlatform: "heygen", requiresOAuth: false,
      oauthConfigured: true, error: data?.error ?? "Video not found",
    }
  }

  return {
    success: true,
    accessMethod: "oauth",
    finalUrl: data.video_url ?? null,
    detectedPlatform: "heygen",
    requiresOAuth: false,
    oauthConfigured: true,
    error: null,
    videoMeta: {
      title: data.title ?? undefined,
      duration: data.duration ?? undefined,
      thumbnailUrl: data.thumbnail_url ?? undefined,
      videoUrl: data.video_url ?? undefined,
      captionUrl: data.caption_url ?? undefined,
    },
  }
}

export async function attemptMediaAccess(
  url: string,
  jobId: string
): Promise<MediaAccessResult> {
  const platform = detectPlatform(url)
  const platformConfig = platform ? PLATFORMS[platform] : undefined

  const logAttempt = async (result: AccessAttempt["result"], oauthAvailable: boolean) => {
    try {
      await appendAccessAttempt(jobId, {
        url,
        timestamp: new Date().toISOString(),
        result,
        detectedPlatform: platform,
        oauthAvailable,
      })
    } catch { /* non-critical */ }
  }

  // HeyGen-specific: use API instead of fetching page URL
  if (platform === "heygen") {
    const videoId = extractHeyGenVideoId(url)
    if (!videoId) {
      await logAttempt("failed", false)
      return {
        success: false, accessMethod: null, finalUrl: null,
        detectedPlatform: "heygen", requiresOAuth: false,
        oauthConfigured: false, error: "Could not extract HeyGen video ID from URL",
      }
    }

    // Try with OAuth token first
    const tokenValid = await isTokenValid("heygen")
    if (tokenValid) {
      const token = await getToken("heygen")
      if (token) {
        const result = await fetchHeyGenVideo(videoId, token.accessToken)
        await logAttempt(result.success ? "success" : "failed", true)
        return result
      }
    }

    // Try refreshing token
    const refreshed = await refreshAccessToken("heygen")
    if (refreshed) {
      const result = await fetchHeyGenVideo(videoId, refreshed)
      await logAttempt(result.success ? "success" : "auth_required", true)
      return result
    }

    // No valid token — check if API key works (for public videos)
    const apiKey = process.env.HEYGEN_API_KEY
    if (apiKey) {
      const res = await fetch(
        `https://api.heygen.com/v1/video_status.get?video_id=${videoId}`,
        { headers: { "x-api-key": apiKey } }
      )
      if (res.ok) {
        const json = await res.json()
        if (json.data?.video_url) {
          await logAttempt("success", false)
          return {
            success: true, accessMethod: "public", finalUrl: json.data.video_url,
            detectedPlatform: "heygen", requiresOAuth: false,
            oauthConfigured: false, error: null,
            videoMeta: {
              title: json.data.title ?? undefined,
              duration: json.data.duration ?? undefined,
              thumbnailUrl: json.data.thumbnail_url ?? undefined,
              videoUrl: json.data.video_url ?? undefined,
              captionUrl: json.data.caption_url ?? undefined,
            },
          }
        }
      }
    }

    // OAuth required
    await logAttempt("auth_required", false)
    return {
      success: false, accessMethod: null, finalUrl: null,
      detectedPlatform: "heygen", requiresOAuth: true,
      oauthConfigured: false, error: "HeyGen video requires OAuth authentication",
    }
  }

  // Generic URL: try HEAD request
  try {
    const res = await fetch(url, { method: "HEAD", redirect: "follow" })

    if (res.ok) {
      await logAttempt("success", false)
      return {
        success: true, accessMethod: "public", finalUrl: url,
        detectedPlatform: platform, requiresOAuth: false,
        oauthConfigured: false, error: null,
      }
    }

    if (res.status === 401 || res.status === 403) {
      const oauthAvailable = !!platformConfig?.oauthEnabled
      await logAttempt("auth_required", oauthAvailable)
      return {
        success: false, accessMethod: null, finalUrl: null,
        detectedPlatform: platform, requiresOAuth: true,
        oauthConfigured: false, error: `Access denied (${res.status})`,
      }
    }

    if (res.status === 404) {
      await logAttempt("not_found", false)
      return {
        success: false, accessMethod: null, finalUrl: null,
        detectedPlatform: platform, requiresOAuth: false,
        oauthConfigured: false, error: "URL not found (404)",
      }
    }

    await logAttempt("failed", false)
    return {
      success: false, accessMethod: null, finalUrl: null,
      detectedPlatform: platform, requiresOAuth: false,
      oauthConfigured: false, error: `HTTP ${res.status}`,
    }
  } catch (err) {
    await logAttempt("failed", false)
    return {
      success: false, accessMethod: null, finalUrl: null,
      detectedPlatform: platform, requiresOAuth: false,
      oauthConfigured: false, error: err instanceof Error ? err.message : "Fetch failed",
    }
  }
}
