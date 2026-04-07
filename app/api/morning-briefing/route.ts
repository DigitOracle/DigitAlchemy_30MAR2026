import { NextRequest, NextResponse } from "next/server"
import { getAuth } from "firebase-admin/auth"
import { getDb } from "@/lib/jobStore"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const REGION_LABELS: Record<string, string> = {
  AE: "the UAE", SA: "Saudi Arabia", KW: "Kuwait", QA: "Qatar", US: "the United States", SG: "Singapore",
}

type WikiItem = { name: string; views: number }
type GdeltItem = { title: string; domain: string; url?: string }
type YoutubeItem = { title: string; channel: string; views: number; thumbnail: string }

export async function GET(req: NextRequest): Promise<NextResponse> {
  // Require Bearer auth — triggers paid YouTube Data API calls
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
  const regionLabel = REGION_LABELS[region] || region

  const [wikipedia, gdelt, youtube] = await Promise.all([
    fetchWikipedia(),
    fetchGdelt(regionLabel),
    fetchYoutube(region),
  ])

  return NextResponse.json({ wikipedia, gdelt, youtube, region, regionLabel, generatedAt: new Date().toISOString() })
}

async function fetchWikipedia(): Promise<WikiItem[]> {
  try {
    const d = new Date(Date.now() - 86400000)
    const url = `https://wikimedia.org/api/rest_v1/metrics/pageviews/top/en.wikipedia.org/all-access/${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`
    const res = await fetch(url, { headers: { "User-Agent": "DigitAlchemy/1.0 (contact@digitalabbot.io)" }, signal: AbortSignal.timeout(8000) })
    if (!res.ok) return []
    const data = await res.json()
    const articles = (data?.items?.[0]?.articles ?? []) as Record<string, unknown>[]
    return articles
      .filter((a) => {
        const n = a.article as string
        return !n.startsWith("Main_Page") && !n.startsWith("Special:") && !n.startsWith("Wikipedia:") && !n.startsWith("File:") && !n.includes("Featured_pictures")
      })
      .slice(0, 12)
      .map((a) => ({ name: (a.article as string).replace(/_/g, " "), views: a.views as number }))
  } catch { return [] }
}

async function fetchGdelt(regionLabel: string): Promise<GdeltItem[]> {
  try {
    const q = encodeURIComponent(`trending ${regionLabel}`)
    const res = await fetch(`https://api.gdeltproject.org/api/v2/doc/doc?query=${q}&mode=ArtList&maxrecords=50&format=json&sort=DateDesc`, { signal: AbortSignal.timeout(12000) })
    if (!res.ok) return []
    const data = await res.json()
    return ((data?.articles ?? []) as Record<string, unknown>[]).slice(0, 9).map((a) => ({
      title: (a.title ?? "") as string,
      domain: (a.domain ?? "") as string,
      url: (a.url ?? "") as string,
    }))
  } catch { return [] }
}

async function fetchYoutube(region: string): Promise<YoutubeItem[]> {
  const apiKey = process.env.YOUTUBE_API_KEY
  if (!apiKey) return []
  try {
    const res = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&chart=mostPopular&regionCode=${region}&maxResults=50&key=${apiKey}`, { signal: AbortSignal.timeout(10000) })
    if (!res.ok) return []
    const data = await res.json()
    return ((data?.items ?? []) as Record<string, unknown>[]).map((v) => {
      const s = v.snippet as Record<string, unknown>
      const stats = (v.statistics ?? {}) as Record<string, unknown>
      const thumbs = s.thumbnails as Record<string, Record<string, unknown>> | undefined
      return {
        title: (s.title ?? "") as string,
        channel: (s.channelTitle ?? "") as string,
        views: Number(stats.viewCount ?? 0),
        thumbnail: ((thumbs?.medium?.url ?? thumbs?.default?.url ?? "") as string),
      }
    })
  } catch { return [] }
}
