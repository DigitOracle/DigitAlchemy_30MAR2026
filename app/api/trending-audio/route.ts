import { NextRequest, NextResponse } from "next/server"

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
    return (items as Record<string, unknown>[]).slice(0, 8).map((s) => ({
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
  const clientId = process.env.SPOTIFY_CLIENT_ID
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET
  if (!clientId || !clientSecret) return sounds

  let token: string | null = null
  try {
    const tokenRes = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: "Basic " + Buffer.from(clientId + ":" + clientSecret).toString("base64"),
      },
      body: "grant_type=client_credentials",
      cache: "no-store",
    })
    if (!tokenRes.ok) return sounds
    const tokenData = await tokenRes.json()
    token = tokenData.access_token
    console.log("[TRENDING-AUDIO] Spotify token obtained:", token ? token.slice(0, 10) + "..." : "null")
  } catch (e) { console.log("[TRENDING-AUDIO] Spotify token error:", e); return sounds }

  if (!token) return sounds

  const results = await Promise.allSettled(
    sounds.map(async (sound) => {
      // Clean query: strip parenthetical noise like "(1034554)", extra whitespace
      const cleanTitle = sound.title.replace(/\([^)]*\)/g, "").trim()
      const cleanAuthor = sound.author.replace(/\([^)]*\)/g, "").trim()
      const query = `${cleanTitle} ${cleanAuthor}`.trim()
      if (query.length < 3) return sound
      try {
        const res = await fetch(
          `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=1`,
          { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(3000) },
        )
        if (!res.ok) { console.log("[TRENDING-AUDIO] Spotify search failed:", res.status, "for:", query.slice(0, 40)); return sound }
        const data = await res.json()
        const track = data?.tracks?.items?.[0]
        if (track) {
          return {
            ...sound,
            albumArt: track.album?.images?.[1]?.url || track.album?.images?.[0]?.url || null,
            spotifyUrl: track.external_urls?.spotify || null,
          }
        }
        return sound
      } catch { return sound }
    }),
  )

  return results.map((r, i) => (r.status === "fulfilled" ? r.value : sounds[i]))
}
