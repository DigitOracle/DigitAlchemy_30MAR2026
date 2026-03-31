// lib/media/access.ts — Media access with platform detection + API key access

import { PLATFORMS } from "@/config/platforms"
import { appendAccessAttempt } from "@/lib/firestore/jobs"
import type { AccessAttempt } from "@/types/jobs"

export type MediaAccessResult = {
  success: boolean
  accessMethod: "public" | "api_key" | null
  finalUrl: string | null
  detectedPlatform: string | null
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

export async function attemptMediaAccess(
  url: string,
  jobId: string
): Promise<MediaAccessResult> {
  const platform = detectPlatform(url)

  const logAttempt = async (result: AccessAttempt["result"]) => {
    try {
      await appendAccessAttempt(jobId, {
        url,
        timestamp: new Date().toISOString(),
        result,
        detectedPlatform: platform,
        oauthAvailable: false,
      })
    } catch { /* non-critical */ }
  }

  // HeyGen: use API key to fetch video directly
  if (platform === "heygen") {
    const videoId = extractHeyGenVideoId(url)
    if (!videoId) {
      await logAttempt("failed")
      return {
        success: false, accessMethod: null, finalUrl: null,
        detectedPlatform: "heygen", error: "Could not extract HeyGen video ID from URL",
      }
    }

    const apiKey = process.env.HEYGEN_API_KEY
    if (!apiKey) {
      await logAttempt("failed")
      return {
        success: false, accessMethod: null, finalUrl: null,
        detectedPlatform: "heygen", error: "HEYGEN_API_KEY not configured",
      }
    }

    try {
      const config = PLATFORMS.heygen
      const endpoint = `${config.apiBase}/v2/video/${videoId}`
      const res = await fetch(endpoint, {
        headers: { "X-Api-Key": apiKey },
      })

      if (!res.ok) {
        await logAttempt(res.status === 404 ? "not_found" : "failed")
        return {
          success: false, accessMethod: null, finalUrl: null,
          detectedPlatform: "heygen",
          error: `HeyGen API returned ${res.status}`,
        }
      }

      const json = await res.json()
      const data = json.data

      if (!data) {
        await logAttempt("failed")
        return {
          success: false, accessMethod: null, finalUrl: null,
          detectedPlatform: "heygen", error: "No video data in API response",
        }
      }

      await logAttempt("success")
      return {
        success: true,
        accessMethod: "api_key",
        finalUrl: data.video_url ?? null,
        detectedPlatform: "heygen",
        error: null,
        videoMeta: {
          title: data.title ?? undefined,
          duration: data.duration ?? undefined,
          thumbnailUrl: data.thumbnail_url ?? undefined,
          videoUrl: data.video_url ?? undefined,
          captionUrl: data.caption_url ?? undefined,
        },
      }
    } catch (err) {
      await logAttempt("failed")
      return {
        success: false, accessMethod: null, finalUrl: null,
        detectedPlatform: "heygen",
        error: err instanceof Error ? err.message : "HeyGen API call failed",
      }
    }
  }

  // Generic URL: try HEAD request
  try {
    const res = await fetch(url, { method: "HEAD", redirect: "follow" })

    if (res.ok) {
      await logAttempt("success")
      return {
        success: true, accessMethod: "public", finalUrl: url,
        detectedPlatform: platform, error: null,
      }
    }

    await logAttempt(res.status === 404 ? "not_found" : "failed")
    return {
      success: false, accessMethod: null, finalUrl: null,
      detectedPlatform: platform, error: `HTTP ${res.status}`,
    }
  } catch (err) {
    await logAttempt("failed")
    return {
      success: false, accessMethod: null, finalUrl: null,
      detectedPlatform: platform,
      error: err instanceof Error ? err.message : "Fetch failed",
    }
  }
}
