import { NextRequest } from "next/server"
import { PLATFORMS } from "@/config/platforms"
import Anthropic from "@anthropic-ai/sdk"

export const runtime = "nodejs"
export const maxDuration = 120

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

function encodeEvent(event: string, data: unknown): Uint8Array {
  return new TextEncoder().encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
}
function ping(): Uint8Array {
  return new TextEncoder().encode(": ping\n\n")
}

async function callClaude(prompt: string, maxTokens = 1200): Promise<Record<string, unknown>> {
  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: maxTokens,
    messages: [{ role: "user", content: prompt }],
  })
  const text = response.content[0].type === "text" ? response.content[0].text : ""
  const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim()
  try { return JSON.parse(cleaned) } catch {
    const match = cleaned.match(/\{[\s\S]*\}/)
    if (match) { try { return JSON.parse(match[0]) } catch { /* fall through */ } }
    return {}
  }
}

// ── Provider functions (same logic as stream route — inference-last chains) ──

type TrendResult = { hashtags: string[]; context: string; source: string; sourceElapsedMs?: number; trendingSongs?: { title: string; author: string; usageCount?: number }[] }

async function fetchScrapeCreatorsTikTokPlatform(region: string): Promise<{ songs: { title: string; author: string; usageCount?: number }[]; hashtags: string[] } | null> {
  const apiKey = process.env.SCRAPECREATORS_API_KEY
  if (!apiKey) return null
  const BASE = "https://api.scrapecreators.com"
  const headers = { "x-api-key": apiKey }
  try {
    const [songsRes, hashtagsRes] = await Promise.all([
      fetch(`${BASE}/v1/tiktok/songs/popular?region=${region}`, { headers, signal: AbortSignal.timeout(12000) }),
      fetch(`${BASE}/v1/tiktok/hashtags/popular?region=${region}`, { headers, signal: AbortSignal.timeout(12000) }),
    ])
    const songs: { title: string; author: string; usageCount?: number }[] = []
    if (songsRes.ok) {
      const data = await songsRes.json()
      const items = Array.isArray(data) ? data : (data?.sound_list ?? data?.data ?? data?.songs ?? data?.items ?? [])
      for (const s of (items as Record<string, unknown>[]).slice(0, 10)) {
        songs.push({
          title: (s.title ?? s.songName ?? s.name ?? "") as string,
          author: (s.author ?? s.authorName ?? s.artist ?? "") as string,
          usageCount: (s.usageCount ?? s.videoCount ?? (s.stats as Record<string, unknown>)?.videoCount) as number | undefined,
        })
      }
    }
    const hashtags: string[] = []
    if (hashtagsRes.ok) {
      const data = await hashtagsRes.json()
      const items = Array.isArray(data) ? data : (data?.list ?? data?.data ?? data?.hashtags ?? data?.items ?? [])
      for (const h of (items as Record<string, unknown>[]).slice(0, 15)) {
        const tag = (h.hashtag_name ?? h.name ?? h.hashtag ?? h.title ?? "") as string
        if (tag) hashtags.push(tag.replace(/^#/, ""))
      }
    }
    if (songs.length === 0 && hashtags.length === 0) return null
    return { songs, hashtags }
  } catch { return null }
}

async function fetchScrapeCreatorsTikTokByTopic(topic: string, region: string, industryLabel: string | null = null): Promise<{ hashtags: string[]; context: string } | null> {
  const apiKey = process.env.SCRAPECREATORS_API_KEY
  if (!apiKey || !topic) return null
  const BASE = "https://api.scrapecreators.com"
  const headers = { "x-api-key": apiKey }
  const searchTerm = industryLabel ? `${topic} ${industryLabel}` : topic
  try {
    const [keywordRes, hashtagRes] = await Promise.all([
      fetch(`${BASE}/v1/tiktok/search/keyword?keyword=${encodeURIComponent(searchTerm)}&count=10&region=${region}`, { headers, signal: AbortSignal.timeout(12000) }),
      fetch(`${BASE}/v1/tiktok/search/hashtag?keyword=${encodeURIComponent(searchTerm.replace(/\s+/g, ""))}&count=10&region=${region}`, { headers, signal: AbortSignal.timeout(12000) }),
    ])
    const hashtags: string[] = []
    const snippets: string[] = []
    if (keywordRes.ok) {
      const data = await keywordRes.json()
      const items = Array.isArray(data) ? data : (data?.data ?? data?.items ?? data?.videos ?? [])
      for (const v of (items as Record<string, unknown>[]).slice(0, 10)) {
        const desc = (v.desc ?? v.description ?? v.text ?? v.caption ?? "") as string
        if (desc) snippets.push(desc.slice(0, 120))
        for (const t of (desc.match(/#[\w\u00C0-\u024F]+/g) ?? [])) hashtags.push(t.replace(/^#/, ""))
      }
    }
    if (hashtagRes.ok) {
      const data = await hashtagRes.json()
      const items = Array.isArray(data) ? data : (data?.data ?? data?.items ?? data?.challengeList ?? [])
      for (const h of (items as Record<string, unknown>[]).slice(0, 10)) {
        const tag = (h.hashtag_name ?? h.name ?? h.hashtag ?? h.title ?? h.challengeName ?? "") as string
        if (tag) hashtags.push(tag.replace(/^#/, ""))
      }
    }
    const unique = [...new Set(hashtags)].slice(0, 15)
    if (unique.length === 0 && snippets.length === 0) return null
    return { hashtags: unique, context: snippets.join("\n") }
  } catch { return null }
}

async function fetchScrapeCreatorsInstagram(topic: string, region: string, industryLabel: string | null = null): Promise<{ hashtags: string[]; context: string } | null> {
  const apiKey = process.env.SCRAPECREATORS_API_KEY
  const searchTerm = industryLabel ? `${topic} ${industryLabel}` : topic
  if (!apiKey || !searchTerm) return null
  const BASE = "https://api.scrapecreators.com"
  try {
    const res = await fetch(`${BASE}/v2/instagram/reels/search?keyword=${encodeURIComponent(searchTerm)}&region=${region}`, {
      headers: { "x-api-key": apiKey },
      signal: AbortSignal.timeout(12000),
    })
    if (!res.ok) return null
    const data = await res.json()
    const items = Array.isArray(data) ? data : (data?.data ?? data?.reels ?? data?.items ?? [])
    const hashtags: string[] = []
    const snippets: string[] = []
    for (const r of (items as Record<string, unknown>[]).slice(0, 10)) {
      const caption = (r.caption ?? r.text ?? "") as string
      if (caption) snippets.push(caption.slice(0, 120))
      for (const t of (caption.match(/#[\w\u00C0-\u024F]+/g) ?? [])) hashtags.push(t.replace(/^#/, ""))
    }
    if (hashtags.length === 0 && snippets.length === 0) return null
    return { hashtags: [...new Set(hashtags)].slice(0, 15), context: snippets.join("\n") }
  } catch { return null }
}

async function fetchApifyTrends(topic: string, platform: string, region: string, industryLabel: string | null = null): Promise<{ hashtags: string[] } | null> {
  const apiKey = process.env.APIFY_API_KEY
  if (!apiKey) return null
  const actorMap: Record<string, string> = { instagram: "apify~instagram-hashtag-scraper", tiktok: "clockworks~tiktok-scraper", youtube: "bernardo~youtube-scraper" }
  const actorId = actorMap[platform]
  if (!actorId) return null
  try {
    const res = await fetch(`https://api.apify.com/v2/acts/${actorId}/runs?token=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hashtags: [industryLabel ? `${topic} ${industryLabel}`.replace(/\s+/g, "") : topic.replace(/\s+/g, "")], resultsLimit: 10, country: region }),
      signal: AbortSignal.timeout(25000),
    })
    if (!res.ok) return null
    const run = await res.json()
    const runId = run?.data?.id
    const datasetId = run?.data?.defaultDatasetId
    if (!runId || !datasetId) return null

    // Poll for run completion (Apify runs are async)
    const pollDeadline = Date.now() + 25000
    while (Date.now() < pollDeadline) {
      const statusRes = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${apiKey}`, { signal: AbortSignal.timeout(5000) })
      if (statusRes.ok) {
        const statusData = await statusRes.json()
        const status = statusData?.data?.status
        if (status === "SUCCEEDED") break
        if (status === "FAILED" || status === "ABORTED" || status === "TIMED-OUT") return null
      }
      await new Promise((r) => setTimeout(r, 2000))
    }

    const itemsRes = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?token=${apiKey}&limit=20`, { signal: AbortSignal.timeout(10000) })
    if (!itemsRes.ok) return null
    const items = await itemsRes.json()
    const allText = (items as Record<string, unknown>[]).map((i) => ((i.caption ?? i.text ?? i.description ?? "") as string)).join(" ")
    const tagMatches = allText.match(/#[\w\u00C0-\u024F]+/g) ?? []
    return { hashtags: [...new Set(tagMatches.map((t: string) => t.replace(/^#/, "")))].slice(0, 15) }
  } catch { return null }
}

async function fetchXpozTrends(topic: string, platform: string, regionLabel: string, industryLabel: string | null = null): Promise<{ hashtags: string[]; posts: string[] } | null> {
  const MCP_URL = process.env.XPOZ_MCP_URL
  const accessKey = process.env.XPOZ_ACCESS_KEY
  if (!MCP_URL || !topic) return null
  const xpozMap: Record<string, string> = { instagram: "getInstagramPostsByKeywords", tiktok: "getTiktokPostsByKeywords", x: "getTwitterPostsByKeywords" }
  const toolName = xpozMap[platform]
  if (!toolName) return null
  try {
    const headers: Record<string, string> = { "Content-Type": "application/json", Accept: "application/json, text/event-stream" }
    if (accessKey) headers["Authorization"] = `Bearer ${accessKey}`
    const res = await fetch(MCP_URL, {
      method: "POST",
      headers,
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: toolName, arguments: { query: `${topic}${industryLabel ? ` ${industryLabel}` : ""} ${regionLabel}`, count: 10 } } }),
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) return null
    const contentType = res.headers.get("content-type") ?? ""
    let resultText: string | null = null
    if (contentType.includes("text/event-stream")) {
      const body = await res.text()
      for (const line of body.split("\n")) {
        if (line.startsWith("data: ")) {
          try { const msg = JSON.parse(line.slice(6)); if (msg.result?.content?.[0]?.text) { resultText = msg.result.content[0].text; break } } catch { /* skip */ }
        }
      }
    } else {
      const data = await res.json()
      resultText = data?.result?.content?.[0]?.text ?? null
    }
    if (!resultText) return null
    const parsed = JSON.parse(resultText)
    const items = Array.isArray(parsed) ? parsed : [parsed]
    const allText = items.map((p: Record<string, unknown>) => ((p.text ?? p.caption ?? p.description ?? "") as string)).join(" ")
    const tagMatches = allText.match(/#[\w\u00C0-\u024F]+/g) ?? []
    const uniqueTags = [...new Set(tagMatches.map((t: string) => t.replace(/^#/, "")))].slice(0, 15)
    const postSnippets = items.slice(0, 5).map((p: Record<string, unknown>) => ((p.text ?? p.caption ?? "") as string).slice(0, 120))
    return { hashtags: uniqueTags, posts: postSnippets }
  } catch { return null }
}

async function fetchPerplexityTrends(topic: string, platform: string, regionLabel: string, industryLabel: string | null = null): Promise<{ hashtags: string[]; context: string; elapsedMs: number } | null> {
  const apiKey = process.env.PERPLEXITY_API_KEY
  if (!apiKey) return null
  const start = Date.now()
  try {
    const res = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "sonar",
        messages: [{ role: "user", content: industryLabel
          ? `What are the current trending hashtags and content themes on ${platform} for the ${industryLabel} industry in ${regionLabel}? Related to "${topic}". List specific hashtags. Be concise.`
          : `What are the current trending hashtags and content themes on ${platform} related to "${topic}" in ${regionLabel}? List specific hashtags. Be concise.` }],
        search_recency_filter: "week",
        max_tokens: 400,
      }),
      signal: AbortSignal.timeout(15000),
    })
    const elapsedMs = Date.now() - start
    if (!res.ok) return null
    const data = await res.json()
    const text = data?.choices?.[0]?.message?.content ?? ""
    if (!text) return null
    const tagMatches = text.match(/#[\w\u00C0-\u024F]+/g) ?? []
    return { context: text.slice(0, 500), hashtags: [...new Set(tagMatches.map((t: string) => t.replace(/^#/, "")))].slice(0, 10) as string[], elapsedMs }
  } catch { return null }
}

// ── Inference-last chains ──

/** Platform-wide: ScrapeCreators → Apify → xpoz → Perplexity */
async function fetchPlatformWideTrends(platform: string, region: string, regionLabel: string, emit: (l: string) => void, industryLabel: string | null = null): Promise<TrendResult> {
  const trendKeyword = industryLabel ? `trending ${industryLabel}` : "trending"

  if (platform === "tiktok") {
    emit("Fetching TikTok platform trends via ScrapeCreators\u2026")
    const sc = await fetchScrapeCreatorsTikTokPlatform(region)
    if (sc && (sc.songs.length > 0 || sc.hashtags.length > 0)) {
      return { hashtags: sc.hashtags, context: sc.songs.map((s) => `${s.title} \u2014 ${s.author}`).join("\n"), source: "scrape_creators_tiktok", trendingSongs: sc.songs }
    }
  }

  emit(`Trying Apify for ${platform} trends\u2026`)
  const apify = await fetchApifyTrends(trendKeyword, platform, region, industryLabel)
  if (apify && apify.hashtags.length > 0) {
    return { hashtags: apify.hashtags, context: "", source: "apify_live_scrape" }
  }

  emit(`Trying xpoz for ${platform} trends\u2026`)
  const xpoz = await fetchXpozTrends(trendKeyword, platform, regionLabel, industryLabel)
  if (xpoz && xpoz.hashtags.length > 0) {
    return { hashtags: xpoz.hashtags, context: xpoz.posts.join("\n"), source: "xpoz_social_signal" }
  }

  emit(`Searching ${platform} trends via Perplexity\u2026`)
  const pplx = await fetchPerplexityTrends(trendKeyword, platform, regionLabel, industryLabel)
  if (pplx && (pplx.hashtags.length > 0 || pplx.context)) {
    return { hashtags: pplx.hashtags, context: pplx.context, source: "context_guided", sourceElapsedMs: pplx.elapsedMs }
  }

  return { hashtags: [], context: "", source: "inferred_fallback" }
}

/** Topic/niche: ScrapeCreators → Apify → xpoz → Perplexity → Claude */
async function fetchNicheTrends(topic: string, platform: string, region: string, regionLabel: string, emit: (l: string) => void, industryLabel: string | null = null): Promise<TrendResult> {
  if (!topic) return { hashtags: [], context: "", source: "inferred_fallback" }

  // TikTok: SC topic search first
  if (platform === "tiktok") {
    emit(`Searching TikTok for "${topic}" via ScrapeCreators\u2026`)
    const sc = await fetchScrapeCreatorsTikTokByTopic(topic, region, industryLabel)
    if (sc && sc.hashtags.length > 0) {
      return { hashtags: sc.hashtags, context: sc.context, source: "scrape_creators_tiktok" }
    }
  }

  // Instagram: SC reels search
  if (platform === "instagram") {
    emit(`Searching Instagram reels for "${topic}" via ScrapeCreators\u2026`)
    const sc = await fetchScrapeCreatorsInstagram(topic, region, industryLabel)
    if (sc && sc.hashtags.length > 0) {
      return { hashtags: sc.hashtags, context: sc.context, source: "scrape_creators_instagram_support" }
    }
  }

  emit(`Trying Apify for "${topic}" on ${platform}\u2026`)
  const apify = await fetchApifyTrends(topic, platform, region, industryLabel)
  if (apify && apify.hashtags.length > 0) {
    return { hashtags: apify.hashtags, context: "", source: "apify_live_scrape" }
  }

  emit(`Trying xpoz for "${topic}" on ${platform}\u2026`)
  const xpoz = await fetchXpozTrends(topic, platform, regionLabel, industryLabel)
  if (xpoz && xpoz.hashtags.length > 0) {
    return { hashtags: xpoz.hashtags, context: xpoz.posts.join("\n"), source: "xpoz_social_signal" }
  }

  emit(`Searching web trends for "${topic}" via Perplexity\u2026`)
  const pplx = await fetchPerplexityTrends(topic, platform, regionLabel, industryLabel)
  if (pplx && (pplx.hashtags.length > 0 || pplx.context)) {
    return { hashtags: pplx.hashtags, context: pplx.context, source: "context_guided", sourceElapsedMs: pplx.elapsedMs }
  }

  return { hashtags: [], context: "", source: "inferred_fallback" }
}

const LIVE_SOURCES = new Set(["scrape_creators_tiktok", "scrape_creators_instagram_support", "apify_live_scrape", "xpoz_social_signal", "official_platform"])

// ── Google Trends data via Apify (12-month keyword analysis) ──

async function fetchGoogleTrends(industry: string, region: string, regionLabel: string, emitStatus: (msg: string) => void): Promise<string | null> {
  const apiKey = process.env.APIFY_API_KEY
  if (!apiKey) return null

  const baseWord = industry.split(" and ")[0].split(",")[0].trim()
  const keywords = [baseWord, `${baseWord} ${regionLabel}`, `${baseWord} TikTok`]

  emitStatus(`Analysing 12 months of search data for ${industry}\u2026`)

  try {
    const res = await fetch(`https://api.apify.com/v2/acts/automation-lab~google-trends-scraper/runs?token=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "keyword", keywords, geo: region, timeRange: "today 12-m", outputType: "flat" }),
      signal: AbortSignal.timeout(100000),
    })
    if (!res.ok) return null
    const run = await res.json()
    const runId = run?.data?.id
    const datasetId = run?.data?.defaultDatasetId
    if (!runId || !datasetId) return null

    // Poll for completion (~75s typical)
    const pollDeadline = Date.now() + 100000
    while (Date.now() < pollDeadline) {
      const statusRes = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${apiKey}`, { signal: AbortSignal.timeout(5000) })
      if (statusRes.ok) {
        const statusData = await statusRes.json()
        const status = statusData?.data?.status
        if (status === "SUCCEEDED") break
        if (status === "FAILED" || status === "ABORTED" || status === "TIMED-OUT") return null
      }
      await new Promise((r) => setTimeout(r, 3000))
    }

    const itemsRes = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?token=${apiKey}&limit=250`, { signal: AbortSignal.timeout(10000) })
    if (!itemsRes.ok) return null
    const items = (await itemsRes.json()) as Record<string, unknown>[]

    const interestOverTime = items.filter((i) => i.type === "interestOverTime")
    const relatedQueries = items.filter((i) => i.type === "relatedQuery")
    const regional = items.filter((i) => i.type === "regionalInterest")

    let summary = `GOOGLE TRENDS DATA (12 months, ${regionLabel}):\n`

    if (interestOverTime.length > 0) {
      summary += "\nMonthly search interest (0-100 scale):\n"
      const byKeyword: Record<string, { date: string; value: number }[]> = {}
      for (const i of interestOverTime) {
        const kw = i.keyword as string
        if (!byKeyword[kw]) byKeyword[kw] = []
        byKeyword[kw].push({ date: (i.formattedDate ?? i.date ?? "") as string, value: (i.value ?? 0) as number })
      }
      for (const [kw, data] of Object.entries(byKeyword)) {
        summary += `\n"${kw}":\n`
        for (const d of data) summary += `  ${d.date}: ${d.value}\n`
      }
    }

    if (relatedQueries.length > 0) {
      summary += "\nRelated searches people also look for:\n"
      for (const i of relatedQueries.slice(0, 15)) {
        summary += `  "${i.query}" \u2014 interest: ${i.value} (${i.relatedType ?? ""})\n`
      }
    }

    if (regional.length > 0) {
      summary += "\nSearch interest by sub-region:\n"
      for (const i of regional.slice(0, 10)) {
        summary += `  ${i.region}: ${i.value}\n`
      }
    }

    return summary
  } catch { return null }
}

// ── Historical analysis pipeline (Analyse History branch) ──

async function fetchHistoricalAnalysis(
  industry: string,
  platform: string,
  region: string,
  regionLabel: string,
  lagLabel: string,
  emitStatus: (msg: string) => void
): Promise<{ trends: string; liveHashtags: string[]; liveContext: string; sources: string[] }> {
  const sources: string[] = []
  const parts: string[] = []

  // SOURCE 0: Google Trends (12-month keyword analysis via Apify)
  const googleTrendsData = await fetchGoogleTrends(industry, region, regionLabel, emitStatus)
  if (googleTrendsData) { sources.push("google_trends") }

  // SOURCE 1: Perplexity deep search (no recency filter — we want historical data)
  emitStatus(`Researching ${industry} history on ${platform} via Perplexity\u2026`)
  const pplxApiKey = process.env.PERPLEXITY_API_KEY
  let pplxText = ""
  if (pplxApiKey) {
    try {
      const res = await fetch("https://api.perplexity.ai/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${pplxApiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "sonar-pro",
          messages: [{ role: "user", content: `Analyse the social media content landscape for the ${industry} industry on ${platform} in ${regionLabel} over the last ${lagLabel}. Provide:\n1. The top 10 most successful accounts in this vertical with their approximate follower counts and content styles\n2. The content formats that consistently drive the highest engagement (video, carousel, photo, short-form, long-form)\n3. Posting frequency patterns of top performers (posts per week, best days, best times)\n4. Seasonal engagement patterns (which months peak, which dip, tied to local events like Ramadan, Eid, National Day, DSF)\n5. The most consistently used hashtags in this vertical\n6. Content topics that drive the most engagement\n7. Average engagement rates for this vertical (likes, comments, shares per post)\n8. Content gaps - what works in other markets but nobody in ${regionLabel} is doing\nBe specific with numbers, account names, and data points. Reference real accounts and real trends.${googleTrendsData ? `\n\nHere is real Google Trends search data for this industry:\n${googleTrendsData}\n\nUse this data to ground your analysis in real search patterns.` : ""}` }],
          max_tokens: 2000,
        }),
        signal: AbortSignal.timeout(30000),
      })
      if (res.ok) {
        const data = await res.json()
        pplxText = data?.choices?.[0]?.message?.content ?? ""
        if (pplxText) { parts.push(pplxText); sources.push("perplexity_deep") }
      }
    } catch { /* non-critical */ }
  }

  // SOURCE 2: ScrapeCreators keyword search for current industry data
  let liveHashtags: string[] = []
  let liveContext = ""
  emitStatus(`Cross-referencing live ${platform} data for ${industry}\u2026`)
  if (platform === "tiktok") {
    const sc = await fetchScrapeCreatorsTikTokByTopic(industry, region, industry)
    if (sc) { liveHashtags = sc.hashtags; liveContext = sc.context; sources.push("scrape_creators_tiktok") }
  } else if (platform === "instagram") {
    const sc = await fetchScrapeCreatorsInstagram(industry, region, industry)
    if (sc) { liveHashtags = sc.hashtags; liveContext = sc.context; sources.push("scrape_creators_instagram") }
  }

  // SOURCE 3: Apify search for industry content
  emitStatus(`Fetching ${industry} content samples via Apify\u2026`)
  const apify = await fetchApifyTrends(industry, platform, region, industry)
  if (apify && apify.hashtags.length > 0) {
    liveHashtags = [...new Set([...liveHashtags, ...apify.hashtags])].slice(0, 20)
    sources.push("apify_live_scrape")
  }

  const allParts = [...parts]
  if (googleTrendsData) allParts.push(googleTrendsData)
  const trends = allParts.join("\n\n") || `No deep research data available for ${industry} on ${platform} in ${regionLabel}. Use general knowledge about this vertical.`
  return { trends, liveHashtags, liveContext, sources }
}

const REGION_LABELS: Record<string, string> = {
  AE: "the UAE",
  SA: "Saudi Arabia",
  KW: "Kuwait",
  QA: "Qatar",
  US: "the United States",
}

export async function POST(req: NextRequest): Promise<Response> {
  const body = await req.json()
  const { platform, niche, region = "AE", lag = "same_day", industry = null } = body as { platform: string; niche: string; region: string; lag: string; industry: string | null }
  const regionLabel = REGION_LABELS[region] || region
  const INDUSTRY_LABELS: Record<string, string> = {
    real_estate: "real estate and property development",
    automotive: "automotive and car dealerships",
    hospitality: "hotels, resorts, and hospitality",
    food_beverage: "food, beverage, and restaurants",
    fashion_beauty: "fashion, beauty, and lifestyle",
    fitness_wellness: "fitness, wellness, and health",
    ecommerce: "e-commerce and online retail",
    education: "education and training",
    healthcare: "healthcare, clinics, and aesthetics",
    financial_services: "financial services and fintech",
  }
  const industryLabel = industry ? INDUSTRY_LABELS[industry] ?? industry : null
  const isLongTerm = ["1w", "2w", "4w", "6m", "12m"].includes(lag)
  const timeHorizon = ["same_day", "24h", "48h", "72h"].includes(lag) ? "react_now"
    : ["1w", "2w", "4w"].includes(lag) ? "plan_ahead"
    : "analyse_history"
  const lagDisplayLabels: Record<string, string> = { same_day: "today", "24h": "24 hours", "48h": "48 hours", "72h": "72 hours", "1w": "1 week", "2w": "2 weeks", "4w": "4 weeks", "6m": "6 months", "12m": "12 months" }
  const lagLabel = lagDisplayLabels[lag] ?? lag

  if (!platform || !PLATFORMS[platform]) {
    return new Response(JSON.stringify({ error: "Valid platform required" }), { status: 400, headers: { "Content-Type": "application/json" } })
  }

  const config = PLATFORMS[platform]
  const hasNiche = !!niche
  const fetchedAt = new Date().toISOString()

  const stream = new ReadableStream({
    async start(controller) {
      const keepAlive = setInterval(() => { try { controller.enqueue(ping()) } catch { /* closed */ } }, 8000)
      const emitSSE = (event: string, data: unknown) => { try { controller.enqueue(encodeEvent(event, data)) } catch { /* closed */ } }
      const emitStatus = (label: string) => emitSSE("processor.started", { label })

      try {
        // ══════════════════════════════════════════════════════
        // ANALYSE HISTORY — dedicated pipeline with deep research
        // ══════════════════════════════════════════════════════
        if (timeHorizon === "analyse_history" && industryLabel) {
          const ha = await fetchHistoricalAnalysis(industryLabel, platform, region, regionLabel, lagLabel, emitStatus)
          const haSourceLabel = ha.sources.includes("perplexity_deep") ? "perplexity" : "claude"
          const haProvenance = ha.sources.includes("perplexity_deep") ? "observed_live" : "inferred"
          const truncatedTrends = ha.trends.slice(0, 3000)

          const fallbackRule = "\nIMPORTANT: If specific verified data points are not available from the research, provide industry-standard estimates and general best practices for this vertical. Frame estimates clearly as 'Industry benchmarks suggest...' or 'Based on general social media research...'. NEVER output 'DATA_UNAVAILABLE' \u2014 always provide actionable guidance even when exact data is limited."

          // CARD 1: Top Performing Content Formats
          emitStatus("Analysing content formats\u2026")
          const formatsData = await callClaude(`Return JSON only. Based on this data about ${industryLabel} on ${config.label} in ${regionLabel} over ${lagLabel}:\n${truncatedTrends}\n\nLIVE HASHTAGS: ${ha.liveHashtags.join(", ") || "none"}\n\nAnalyse the content formats. Create a breakdown showing: which formats (video, carousel, photo, Reels, Stories) get the highest engagement and why. Include estimated percentage split and engagement rate per format. Be specific with numbers.${fallbackRule}\nReturn: { "formats": [{ "name": "string", "percentageOfContent": "string", "engagementRate": "string", "why": "string" }], "summary": "string", "source": "${haSourceLabel}", "provenance": "${haProvenance}" }`, 700)
          emitSSE("card", { platform, cardType: "platformTrends", data: {
            ...formatsData,
            hashtags: ha.liveHashtags,
            source: haSourceLabel,
            provenance: haProvenance,
            fetchedAt,
            label: `Top Performing Content in ${industryLabel}`,
          }})

          // CARD 2: Content Themes That Have Worked
          emitStatus("Identifying proven content themes\u2026")
          const themesData = await callClaude(`Return JSON only. Based on this data:\n${truncatedTrends}\n\nIdentify the top 5-7 content themes that have consistently driven engagement for ${industryLabel} in ${regionLabel}. For each theme: name it, explain why it works, give an example post concept, and estimate its engagement level relative to other themes.${fallbackRule}\nReturn: { "themes": [{ "name": "string", "why": "string", "examplePost": "string", "relativeEngagement": "string" }], "source": "${haSourceLabel}", "provenance": "${haProvenance}" }`, 800)
          emitSSE("card", { platform, cardType: "videoIdeas", data: {
            ...themesData,
            ideas: (themesData.themes as unknown[]) ?? [],
            source: haSourceLabel,
            provenance: haProvenance,
            label: "Content Themes That Have Worked",
          }})

          // CARD 3: Posting Pattern Analysis
          emitStatus("Analysing posting patterns\u2026")
          const patternsData = await callClaude(`Return JSON only. Based on this data:\n${truncatedTrends}\n\nAnalyse posting patterns for top ${industryLabel} accounts on ${config.label} in ${regionLabel}. Cover: optimal posts per week, best days of week, best times of day, content mix ratio (educational vs entertaining vs promotional), and whether consistency or burst posting works better.${fallbackRule}\nReturn: { "optimalFrequency": "string", "bestDays": ["string"], "bestTimes": ["string"], "contentMix": [{ "type": "string", "percentage": "string" }], "consistencyVsBurst": "string", "source": "${haSourceLabel}", "provenance": "${haProvenance}" }`, 600)
          emitSSE("card", { platform, cardType: "postingPatterns", data: { ...patternsData, label: "Posting Pattern Analysis" } })

          // CARD 4: Seasonal Patterns
          emitStatus("Mapping seasonal calendar\u2026")
          const seasonalData = await callClaude(`Return JSON only. Based on this data:\n${truncatedTrends}\n\nMap out a 12-month seasonal calendar for ${industryLabel} on ${config.label} in ${regionLabel}. For each month: note the key events (Ramadan, Eid Al Fitr, Eid Al Adha, UAE National Day, DSF, summer, back-to-school), expected engagement level (high/medium/low), and recommended content themes for that period. Format as a month-by-month guide. Use the Google Trends search interest data provided to identify real seasonal peaks and valleys. Map the search interest numbers to specific months and correlate with local events.${fallbackRule}\nReturn: { "calendar": [{ "month": "string", "events": ["string"], "engagementLevel": "string", "recommendedThemes": ["string"] }], "source": "${haSourceLabel}", "provenance": "${haProvenance}" }`, 900)
          emitSSE("card", { platform, cardType: "seasonalPatterns", data: { ...seasonalData, label: "Seasonal Patterns" } })

          // CARD 5: Vertical Leaders
          emitStatus("Profiling vertical leaders\u2026")
          const leadersData = await callClaude(`Return JSON only. Based on this data:\n${truncatedTrends}\n\nProfile the top 5 ${industryLabel} accounts on ${config.label} in ${regionLabel}. For each: account name, estimated followers, content style (professional/casual/educational/entertaining), posting frequency, signature content format, engagement rate, and one key lesson a new entrant can learn from them.${fallbackRule}\nReturn: { "leaders": [{ "account": "string", "followers": "string", "style": "string", "frequency": "string", "signatureFormat": "string", "engagementRate": "string", "keyLesson": "string" }], "source": "${haSourceLabel}", "provenance": "${haProvenance}" }`, 800)
          emitSSE("card", { platform, cardType: "verticalLeaders", data: { ...leadersData, label: "Vertical Leaders" } })

          // CARD 6: Engagement Benchmarks
          emitStatus("Calculating engagement benchmarks\u2026")
          const benchData = await callClaude(`Return JSON only. Based on this data:\n${truncatedTrends}\n\nProvide engagement benchmarks for ${industryLabel} on ${config.label} in ${regionLabel}. Include: average engagement rate (top 25%, median, bottom 25%), average views per post, average comments per post, average shares per post, follower growth rate benchmarks, and what a new entrant should target in months 1-3, 3-6, and 6-12.${fallbackRule}\nReturn: { "engagementRate": { "top25": "string", "median": "string", "bottom25": "string" }, "avgViews": "string", "avgComments": "string", "avgShares": "string", "growthRate": "string", "targets": { "months1to3": "string", "months3to6": "string", "months6to12": "string" }, "source": "${haSourceLabel}", "provenance": "${haProvenance}" }`, 600)
          emitSSE("card", { platform, cardType: "engagementBenchmarks", data: { ...benchData, label: "Engagement Benchmarks" } })

          // CARD 7: Content Gaps
          emitStatus("Identifying content gaps\u2026")
          const gapsData = await callClaude(`Return JSON only. Based on this data:\n${truncatedTrends}\n\nIdentify content gaps for ${industryLabel} on ${config.label} in ${regionLabel}. Compare what top performers do in other markets (Saudi Arabia, USA, UK) that nobody in ${regionLabel} is doing yet. Identify underserved audience needs, missing content formats, and untapped topics. Be specific about the opportunity size.${fallbackRule}\nReturn: { "gaps": [{ "opportunity": "string", "workingIn": "string", "why": "string", "opportunitySize": "string" }], "underservedNeeds": ["string"], "source": "${haSourceLabel}", "provenance": "${haProvenance}" }`, 700)
          emitSSE("card", { platform, cardType: "contentGaps", data: { ...gapsData, label: "Content Gaps" } })

          emitSSE("complete", { platform })

        } else {
        // ══════════════════════════════════════════════════════
        // REACT NOW + PLAN AHEAD — live scraper pipeline
        // ══════════════════════════════════════════════════════

        // ── CARD 1: Platform Trends Now (inference-last) ──
        // When industry is selected, skip the platform-wide popular endpoints (they ignore topic)
        // and instead use the keyword/search chain which actually filters by industry.
        let platformTrends: TrendResult
        if (industryLabel) {
          emitStatus(`Scanning ${config.label} trends for ${industryLabel} in ${regionLabel}\u2026`)
          platformTrends = await fetchNicheTrends(industryLabel, platform, region, regionLabel, emitStatus, industryLabel)
        } else {
          emitStatus(`Scanning ${config.label} platform trends in ${regionLabel}\u2026`)
          platformTrends = await fetchPlatformWideTrends(platform, region, regionLabel, emitStatus)
        }
        const ptSongs = platformTrends.trendingSongs ?? []
        const ptIsLive = LIVE_SOURCES.has(platformTrends.source)
        const ptSource = platformTrends.source === "context_guided" ? "perplexity" : platformTrends.source === "inferred_fallback" ? "claude" : platformTrends.source

        // Claude adds themes + video ideas (synthesis on top of trend data)
        let themes: unknown[] = []
        let videoIdeas: unknown[] = []
        // Note: analyse_history is handled above with dedicated pipeline
        const ideaPrompt = timeHorizon === "plan_ahead"
          ? `You are DigitAlchemy\u00ae content strategist for ${config.label}. Given platform trend data, generate content themes worth investing in for a multi-week content calendar. Return JSON only.

PLATFORM: ${config.label}
REGION: ${regionLabel}
PRODUCTION WINDOW: ${lagLabel}
CONSISTENT HASHTAGS: ${platformTrends.hashtags.join(", ") || "none"}
STEADY AUDIO: ${ptSongs.map((s) => `"${s.title}" by ${s.author}`).join(", ") || "none"}
TREND CONTEXT: ${platformTrends.context.slice(0, 400) || "none"}
${hasNiche ? `NICHE FOCUS: ${niche}` : "SCOPE: Broad platform-wide themes"}
${industryLabel ? `INDUSTRY: ${industryLabel}` : ""}

Return ONLY this JSON:
{
  "themes": ["3-5 content themes that have shown consistent performance over weeks on ${config.label}"],
  "videoIdeas": [{ "title": "content theme title", "hook": "proven hook pattern", "format": "series|educational|documentary|behind-scenes|case-study|etc", "why": "why this has staying power" }],
  "hookConcepts": [{ "text": "proven hook pattern that works consistently targeting ${industryLabel ? `${industryLabel} audiences` : "general audiences"}", "type": "opening|question|statistic|controversial" }],
  "captionStarters": [{ "text": "messaging framework adaptable across multiple posts targeting ${industryLabel ? `${industryLabel} audiences` : "general audiences"}", "variant": "short|long|story" }]
}

Rules:
- videoIdeas: exactly 5, focus on repeatable content themes not one-off viral moments
- hookConcepts: exactly 3, proven patterns that work consistently
- captionStarters: exactly 3 (short, long, story), messaging frameworks not single-use captions
- ${hasNiche ? `Focus all ideas on the "${niche}" niche` : "Cover diverse evergreen themes"}
- Focus on durability, not virality. These must work over ${lagLabel}, not just today.
- All recommendations must be culturally relevant and specific to ${regionLabel}. Reference local events, cultural moments, and regional audience behaviour.${industryLabel ? `\n- All recommendations must be specifically relevant to the ${industryLabel} industry. Reference industry-specific content formats, audience expectations, and competitive landscape.` : ""}
- Do NOT present Claude suggestions as live data`
          : `You are DigitAlchemy\u00ae trend analyst for ${config.label}. Given platform trend data, generate actionable content ideas. Return JSON only.

PLATFORM: ${config.label}
REGION: ${regionLabel}
TRENDING HASHTAGS: ${platformTrends.hashtags.join(", ") || "none"}
TRENDING SONGS: ${ptSongs.map((s) => `"${s.title}" by ${s.author}`).join(", ") || "none"}
TREND CONTEXT: ${platformTrends.context.slice(0, 400) || "none"}
${hasNiche ? `NICHE FOCUS: ${niche}` : "SCOPE: Broad platform-wide trends"}
${industryLabel ? `INDUSTRY: ${industryLabel}` : ""}

Return ONLY this JSON:
{
  "themes": ["3-5 trending themes/formats on ${config.label} right now"],
  "videoIdeas": [{ "title": "short video idea title", "hook": "opening hook line", "format": "duet|stitch|tutorial|storytime|POV|trend-jump|etc", "why": "why this works now" }],
  "hookConcepts": [{ "text": "hook line targeting ${industryLabel ? `${industryLabel} audiences` : "general audiences"}", "type": "opening|question|statistic|controversial" }],
  "captionStarters": [{ "text": "caption starter text targeting ${industryLabel ? `${industryLabel} audiences` : "general audiences"}", "variant": "short|long|story" }]
}

Rules:
- videoIdeas: exactly 5, specific and actionable
- hookConcepts: exactly 3
- captionStarters: exactly 3 (short, long, story)
- ${hasNiche ? `Focus all ideas on the "${niche}" niche` : "Cover diverse trending themes"}
- All recommendations must be culturally relevant and specific to ${regionLabel}. Reference local events, cultural moments, and regional audience behaviour.${industryLabel ? `\n- All recommendations must be specifically relevant to the ${industryLabel} industry. Reference industry-specific content formats, audience expectations, and competitive landscape.` : ""}
- Do NOT present Claude suggestions as live data`

        emitStatus(`Generating ${config.label} content ideas\u2026`)
        const ideaData = await callClaude(ideaPrompt, 1500)
        themes = (ideaData.themes as unknown[]) ?? []
        videoIdeas = (ideaData.videoIdeas as unknown[]) ?? []

        const platformTrendsCard: Record<string, unknown> = {
          hashtags: platformTrends.hashtags,
          trendingSongs: ptSongs,
          themes,
          notes: "",
          source: ptSource,
          sourceElapsedMs: platformTrends.sourceElapsedMs ?? null,
          mode: ptIsLive ? "live_trend" : "context_guided",
          provenance: ptIsLive ? "observed_live" : "inferred",
          fetchedAt,
          opportunities: [],
          label: timeHorizon === "plan_ahead"
            ? (industryLabel ? `What\u2019s Consistently Performing in ${industryLabel}` : "What\u2019s Consistently Performing")
            : (industryLabel ? `What\u2019s Hot in ${industryLabel}` : "What\u2019s Hot Right Now"),
        }
        emitSSE("card", { platform, cardType: "platformTrends", data: platformTrendsCard })

        // ── CARD 2: Niche Trends (if niche or industry+niche — inference-last) ──
        // Combine niche + industry when both are set; use niche alone otherwise.
        // When only industry is set (no niche), card 1 already covers industry trends, so skip card 2.
        const nicheTopic = hasNiche && industryLabel ? `${niche} ${industryLabel}` : hasNiche ? niche : null
        if (nicheTopic) {
          emitStatus(`Searching ${config.label} trends for "${nicheTopic}" in ${regionLabel}\u2026`)
          const nicheTrends = await fetchNicheTrends(nicheTopic, platform, region, regionLabel, emitStatus, industryLabel)
          const ntIsLive = LIVE_SOURCES.has(nicheTrends.source)
          const ntSource = nicheTrends.source === "context_guided" ? "perplexity" : nicheTrends.source === "inferred_fallback" ? "claude" : nicheTrends.source
          const ptSet = new Set(platformTrends.hashtags.map((h) => h.toLowerCase()))
          const overlapping = nicheTrends.hashtags.filter((h) => ptSet.has(h.toLowerCase()))
          const topicSpecific = nicheTrends.hashtags.filter((h) => !ptSet.has(h.toLowerCase()))

          const topicTrendsCard: Record<string, unknown> = {
            hashtags: nicheTrends.hashtags,
            overlapping,
            topicSpecific,
            notes: nicheTrends.context.slice(0, 300),
            source: ntSource,
            sourceElapsedMs: nicheTrends.sourceElapsedMs ?? null,
            mode: "topic_aligned",
            provenance: ntIsLive ? "observed_live" : "inferred",
            fetchedAt,
          }
          emitSSE("card", { platform, cardType: "topicTrends", data: topicTrendsCard })
        }

        // ── Branch-specific cards ──
        const industryCtx = industryLabel ? ` for ${industryLabel}` : ""
        const industryOrVertical = industryLabel || "this vertical"

        if (timeHorizon === "react_now") {
          // ── REACT NOW: trendingAudio, videoIdeas, hooks, hashtagStrategy, postFormat ──

          const trendingSounds = ptSongs.map((s) => `${s.title} \u2014 ${s.author}`)
          let audioLicensing: Record<string, unknown> = {}
          if (trendingSounds.length > 0) {
            emitStatus("Checking audio licensing\u2026")
            audioLicensing = await callClaude(`Return JSON only. For each of these trending tracks on ${config.label}, indicate whether it is commercially licensed and safe for business/brand use. Mark tracks as [COMMERCIAL \u2713] or [PERSONAL USE ONLY]. This is critical for creators who monetize content or represent brands.\n\nTRACKS:\n${trendingSounds.join("\n")}\n\nReturn: { "tracks": [{ "track": "string", "license": "COMMERCIAL" | "PERSONAL_USE_ONLY", "note": "string" }] }`, 500)
          }
          emitSSE("card", { platform, cardType: "trendingAudio", data: {
            trendingSounds,
            licensing: (audioLicensing.tracks as unknown[]) ?? [],
            source: trendingSounds.length > 0 ? ptSource : "inferred_fallback",
            mode: "live_trend",
            provenance: trendingSounds.length > 0 && ptIsLive ? "observed_live" : "inferred",
            fetchedAt,
            label: "Trending Audio",
          }})

          emitSSE("card", { platform, cardType: "videoIdeas", data: {
            ideas: videoIdeas,
            source: "claude", mode: "inferred_fallback", provenance: "inferred",
            label: "Video Ideas",
          }})

          const hooksData = (ideaData.hookConcepts as unknown[]) ?? []
          emitSSE("card", { platform, cardType: "hooks", data: { hooks: hooksData, label: "Hook Ideas" } })

          emitStatus("Generating hashtag strategy\u2026")
          const hashtagData = await callClaude(`Return JSON only. Based on the trend data, recommend a hashtag strategy for ${config.label} in ${regionLabel}${industryCtx}. Include: (1) 3-5 high-volume hashtags to ride, (2) 3-5 mid-tier hashtags with less competition, (3) 2-3 niche hashtags for discoverability. Explain why each group matters.\nTREND CONTEXT: ${platformTrends.hashtags.join(", ") || "none"}\n${hasNiche ? `NICHE: ${niche}` : ""}\nReturn: { "highVolume": [{ "tag": "string", "why": "string" }], "midTier": [{ "tag": "string", "why": "string" }], "niche": [{ "tag": "string", "why": "string" }], "source": "claude", "provenance": "inferred" }`, 600)
          emitSSE("card", { platform, cardType: "hashtagStrategy", data: { ...hashtagData, label: "Hashtag Strategy" } })

          emitStatus("Analysing best post formats\u2026")
          const formatData = await callClaude(`Return JSON only. Based on current trends on ${config.label} in ${regionLabel}${industryCtx}, recommend the best post formats right now. Consider: talking head, B-roll montage, carousel, duet/stitch, photo dump, behind-the-scenes, tutorial, reaction. Rank the top 3 formats and explain why they\u2019re working.\n${hasNiche ? `NICHE: ${niche}` : ""}\nReturn: { "formats": [{ "name": "string", "rank": 1, "why": "string" }], "source": "claude", "provenance": "inferred" }`, 500)
          emitSSE("card", { platform, cardType: "postFormat", data: { ...formatData, label: "Post Format Recommendation" } })

        } else if (timeHorizon === "plan_ahead") {
          // ── PLAN AHEAD: videoIdeas, hooks, cadencePlan, contentPillars, competitivePosition ──

          emitSSE("card", { platform, cardType: "videoIdeas", data: {
            ideas: videoIdeas,
            source: "claude", mode: "inferred_fallback", provenance: "inferred",
            label: "Content Themes Worth Investing In",
          }})

          const hooksData = (ideaData.hookConcepts as unknown[]) ?? []
          emitSSE("card", { platform, cardType: "hooks", data: { hooks: hooksData, label: "Proven Hook Patterns" } })

          emitStatus("Building content cadence plan\u2026")
          const cadenceData = await callClaude(`Return JSON only. For a ${industryOrVertical} on ${config.label} in ${regionLabel}, recommend an optimal posting cadence for the next ${lagLabel}. Include: recommended posts per week, best days to post, content mix ratio (e.g. 40% educational, 30% entertaining, 30% promotional). Base this on what consistently performs in this market.\n${hasNiche ? `NICHE: ${niche}` : ""}\nReturn: { "postsPerWeek": number, "bestDays": ["string"], "contentMix": [{ "type": "string", "percentage": number }], "notes": "string", "source": "claude", "provenance": "inferred" }`, 500)
          emitSSE("card", { platform, cardType: "cadencePlan", data: { ...cadenceData, label: "Content Cadence Plan" } })

          emitStatus("Generating content pillar recommendations\u2026")
          const pillarsData = await callClaude(`Return JSON only. Recommend 3-4 recurring content pillars (show formats) for a ${industryOrVertical} on ${config.label} in ${regionLabel}. Each pillar should be a repeatable series concept with a name, format, frequency, and example topic. These should work consistently over ${lagLabel}.\n${hasNiche ? `NICHE: ${niche}` : ""}\nReturn: { "pillars": [{ "name": "string", "format": "string", "frequency": "string", "exampleTopic": "string", "why": "string" }], "source": "claude", "provenance": "inferred" }`, 600)
          emitSSE("card", { platform, cardType: "contentPillars", data: { ...pillarsData, label: "Content Pillar Recommendations" } })

          emitStatus("Analysing competitive positioning\u2026")
          const compData = await callClaude(`Return JSON only. Analyse the content landscape for ${industryOrVertical} on ${config.label} in ${regionLabel}. Identify: what content is oversaturated, where the whitespace opportunities are, and what would make a brand stand out. Be specific about content gaps.\n${hasNiche ? `NICHE: ${niche}` : ""}\nReturn: { "oversaturated": ["string"], "whitespace": ["string"], "standoutStrategy": "string", "source": "claude", "provenance": "inferred" }`, 600)
          emitSSE("card", { platform, cardType: "competitivePosition", data: { ...compData, label: "Competitive Positioning" } })

        }

        emitSSE("complete", { platform })

        } // end of } else { (react_now / plan_ahead branch)

      } catch (err) {
        const message = err instanceof Error ? err.message : "Trend scan failed"
        console.error("[reverse-engineer]", err)
        emitSSE("error", { error: message })
      } finally {
        clearInterval(keepAlive)
        controller.close()
      }
    }
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  })
}
