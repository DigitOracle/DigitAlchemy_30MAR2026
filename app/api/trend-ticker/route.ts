import { NextRequest, NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const REGION_LABELS: Record<string, string> = {
  AE: "UAE", SA: "Saudi Arabia", KW: "Kuwait", QA: "Qatar", US: "United States", SG: "Singapore",
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const region = req.nextUrl.searchParams.get("region") || "AE"
  const regionLabel = REGION_LABELS[region] || region

  const [tiktok, instagram, youtube] = await Promise.allSettled([
    fetchTikTokHashtags(region),
    fetchInstagramHashtags(region, regionLabel),
    fetchYouTubeTags(region),
  ])

  const tt = tiktok.status === "fulfilled" ? tiktok.value : []
  const ig = instagram.status === "fulfilled" ? instagram.value : []
  const yt = youtube.status === "fulfilled" ? youtube.value : []

  console.log(`[TICKER] Results — TikTok: ${tt.length}, Instagram: ${ig.length}, YouTube: ${yt.length}`)

  return NextResponse.json({ tiktok: tt, instagram: ig, youtube: yt, region })
}

// ── TikTok: ScrapeCreators /v1/tiktok/hashtags/popular ──
// Mirrors the exact parsing from reverse-engineer/route.ts fetchScrapeCreatorsTikTokPlatform
async function fetchTikTokHashtags(region: string): Promise<string[]> {
  const apiKey = process.env.SCRAPECREATORS_API_KEY
  if (!apiKey) { console.log("[TICKER] TikTok: no SCRAPECREATORS_API_KEY"); return [] }
  try {
    const res = await fetch(
      `https://api.scrapecreators.com/v1/tiktok/hashtags/popular?region=${region}`,
      { headers: { "x-api-key": apiKey }, signal: AbortSignal.timeout(10000) },
    )
    console.log("[TICKER] TikTok response status:", res.status)
    if (!res.ok) return []
    const data = await res.json()
    // Match the exact parsing from the scan route
    const items = Array.isArray(data) ? data : (data?.list ?? data?.data ?? data?.hashtags ?? data?.hashtag_list ?? data?.items ?? [])
    console.log("[TICKER] TikTok items count:", (items as unknown[]).length, "sample:", JSON.stringify(items[0])?.slice(0, 150))
    const hashtags: string[] = []
    for (const h of (items as Record<string, unknown>[]).slice(0, 10)) {
      const tag = (h.hashtag_name ?? h.name ?? h.hashtag ?? h.title ?? "") as string
      if (tag) hashtags.push(`#${tag.replace(/^#/, "")}`)
    }
    return hashtags
  } catch (e) { console.log("[TICKER] TikTok error:", e); return [] }
}

// ── Instagram: ScrapeCreators /v2/instagram/reels/search — extract hashtags from captions ──
// Mirrors the exact approach from reverse-engineer/route.ts fetchScrapeCreatorsInstagram
async function fetchInstagramHashtags(region: string, regionLabel: string): Promise<string[]> {
  const apiKey = process.env.SCRAPECREATORS_API_KEY
  if (!apiKey) { console.log("[TICKER] Instagram: no SCRAPECREATORS_API_KEY"); return [] }
  try {
    const query = `trending ${regionLabel}`
    const res = await fetch(
      `https://api.scrapecreators.com/v2/instagram/reels/search?query=${encodeURIComponent(query)}&region=${region}`,
      { headers: { "x-api-key": apiKey }, signal: AbortSignal.timeout(10000) },
    )
    console.log("[TICKER] Instagram response status:", res.status)
    if (!res.ok) return []
    const data = await res.json()
    const items = Array.isArray(data) ? data : (data?.data ?? data?.reels ?? data?.items ?? [])
    console.log("[TICKER] Instagram items count:", (items as unknown[]).length)
    const hashtags: string[] = []
    for (const r of (items as Record<string, unknown>[]).slice(0, 15)) {
      const caption = (r.caption ?? r.text ?? "") as string
      for (const t of (caption.match(/#[\w\u00C0-\u024F]+/g) ?? [])) {
        hashtags.push(t)
      }
    }
    // Deduplicate and return top 8
    const unique = [...new Set(hashtags.map((h) => h.toLowerCase()))].slice(0, 8)
    return unique.map((h) => h.startsWith("#") ? h : `#${h}`)
  } catch (e) { console.log("[TICKER] Instagram error:", e); return [] }
}

// ── YouTube: extract tags from trending videos ──
async function fetchYouTubeTags(region: string): Promise<string[]> {
  const apiKey = process.env.YOUTUBE_API_KEY
  if (!apiKey) { console.log("[TICKER] YouTube: no YOUTUBE_API_KEY"); return [] }
  try {
    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=snippet&chart=mostPopular&regionCode=${region}&maxResults=10&key=${apiKey}`,
      { signal: AbortSignal.timeout(8000) },
    )
    if (!res.ok) return []
    const data = await res.json()
    const items = (data?.items ?? []) as Record<string, unknown>[]
    const allTags = items.flatMap((v) => {
      const snippet = v.snippet as Record<string, unknown> | undefined
      return (snippet?.tags as string[]) ?? []
    })
    const counts = new Map<string, number>()
    for (const tag of allTags) {
      const n = tag.toLowerCase().trim()
      if (n.length > 2 && n.length < 30) counts.set(n, (counts.get(n) || 0) + 1)
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([t]) => `#${t.replace(/\s+/g, "")}`)
  } catch { return [] }
}
