import { NextRequest, NextResponse } from "next/server"
import { getAuth } from "firebase-admin/auth"
import { searchSpotifyTrack } from "@/lib/spotify"
import { getDb } from "@/lib/jobStore"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

interface TrendingSound {
  title: string
  author: string
  rank: number
  rankDiff: number
  rankDiffType: number
  cover: string | null
  link: string | null
  duration: number
  albumArt: string | null
  spotifyUrl: string | null
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  // Require Bearer auth — triggers paid ScrapeCreators + Spotify calls
  getDb()
  const authHeader = req.headers.get("authorization")
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 })
  }
  try {
    await getAuth().verifyIdToken(authHeader.slice(7))
  } catch {
    return NextResponse.json({ error: "Invalid auth token" }, { status: 401 })
  }

  const region = req.nextUrl.searchParams.get("region") || "AE"

  const sounds = await fetchTrendingSounds(region)
  console.log("[TRENDING-AUDIO] ScrapeCreators returned", sounds.length, "sounds for", region)

  const enriched = await enrichWithSpotify(sounds.slice(0, 5))
  const enrichedCount = enriched.filter((s) => s.albumArt !== null).length
  console.log("[TRENDING-AUDIO] Spotify enriched", enrichedCount, "of", enriched.length, "with album art")

  return NextResponse.json({ sounds: enriched, source: "scrapecreators_live", region })
}

async function fetchTrendingSounds(region: string): Promise<TrendingSound[]> {
  const apiKey = process.env.SCRAPECREATORS_API_KEY
  if (!apiKey) { console.log("[TRENDING-AUDIO] No SCRAPECREATORS_API_KEY"); return [] }
  try {
    const res = await fetch(
      `https://api.scrapecreators.com/v1/tiktok/songs/popular?region=${region}`,
      { headers: { "x-api-key": apiKey }, signal: AbortSignal.timeout(10000) },
    )
    if (!res.ok) { console.log("[TRENDING-AUDIO] ScrapeCreators status:", res.status); return [] }
    const data = await res.json()
    const items = Array.isArray(data) ? data : (data?.sound_list ?? data?.data ?? data?.songs ?? data?.items ?? [])
    return (items as Record<string, unknown>[]).slice(0, 50).map((s) => ({
      title: (s.title ?? s.songName ?? s.name ?? "Unknown") as string,
      author: (s.author ?? s.authorName ?? s.artist ?? "Unknown") as string,
      rank: (s.rank ?? 0) as number,
      rankDiff: (s.rank_diff ?? 0) as number,
      rankDiffType: (s.rank_diff_type ?? 0) as number,
      cover: (s.cover ?? null) as string | null,
      link: (s.link ?? null) as string | null,
      duration: (s.duration ?? 0) as number,
      albumArt: null,
      spotifyUrl: null,
    }))
  } catch (e) { console.log("[TRENDING-AUDIO] ScrapeCreators error:", e); return [] }
}

async function enrichWithSpotify(sounds: TrendingSound[]): Promise<TrendingSound[]> {
  if (sounds.length === 0) return sounds

  const results = await Promise.allSettled(
    sounds.map(async (sound) => {
      const cleanTitle = sound.title.replace(/\([^)]*\)/g, "").trim()
      const cleanAuthor = sound.author.replace(/\([^)]*\)/g, "").trim()
      const query = `${cleanTitle} ${cleanAuthor}`.trim()
      if (query.length < 3) return sound
      const meta = await searchSpotifyTrack(query)
      if (meta) return { ...sound, albumArt: meta.albumArt, spotifyUrl: meta.spotifyUrl }
      return sound
    }),
  )

  return results.map((r, i) => (r.status === "fulfilled" ? r.value : sounds[i]))
}
