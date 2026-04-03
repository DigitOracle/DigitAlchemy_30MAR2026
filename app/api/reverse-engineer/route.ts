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
        const ideaPrompt = isLongTerm
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
          label: industryLabel
            ? (isLongTerm ? `What\u2019s Consistently Performing in ${industryLabel}` : `What\u2019s Trending in ${industryLabel}`)
            : (isLongTerm ? "What\u2019s Consistently Performing" : "What\u2019s Hot Right Now"),
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

        // ── CARD 3: Trending Audio Now (live only — no inference) ──
        const trendingSounds = ptSongs.map((s) => `${s.title} \u2014 ${s.author}`)
        emitSSE("card", { platform, cardType: "trendingAudio", data: {
          trendingSounds,
          source: trendingSounds.length > 0 ? ptSource : "inferred_fallback",
          mode: "live_trend",
          provenance: trendingSounds.length > 0 && ptIsLive ? "observed_live" : "inferred",
          fetchedAt,
          label: isLongTerm ? "Audio That\u2019s Held Steady" : "Trending Audio",
        }})

        // ── CARD 4: Video Ideas (synthesis) ──
        emitSSE("card", { platform, cardType: "videoIdeas", data: {
          ideas: videoIdeas,
          source: "claude", mode: "inferred_fallback", provenance: "inferred",
          label: isLongTerm ? "Content Themes Worth Investing In" : "Video Ideas",
        }})

        // ── CARD 5: Hook Concepts (synthesis) ──
        const hooksData = (ideaData.hookConcepts as unknown[]) ?? []
        emitSSE("card", { platform, cardType: "hooks", data: { hooks: hooksData, label: isLongTerm ? "Proven Hook Patterns" : "Hook Ideas" } })

        // ── CARD 6: Caption Starters (synthesis) ──
        const captionsData = (ideaData.captionStarters as unknown[]) ?? []
        emitSSE("card", { platform, cardType: "captions", data: { captions: captionsData, label: isLongTerm ? "Messaging Frameworks" : "Caption Starters" } })

        // ── CARD 7: Commercial Audio (synthesis) ──
        emitStatus(isLongTerm ? "Selecting evergreen audio options\u2026" : "Generating commercial-safe audio suggestions\u2026")
        const audioIndustryCtx = industryLabel ? ` suitable for ${industryLabel} brand content` : ""
        const audioPrompt = isLongTerm
          ? `Return JSON only. Generate 5 evergreen, commercial-safe / royalty-free audio options for ${config.label} content${hasNiche ? ` in the "${niche}" niche` : ""}${audioIndustryCtx} targeting audiences in ${regionLabel}. Focus on durability — tracks that work over ${lagLabel}, not just today. Include TikTok Commercial Music Library, Epidemic Sound, Artlist where relevant. All recommendations must be culturally relevant and specific to ${regionLabel}.\nReturn: { "commercialSafe": ["string"], "source": "claude", "provenance": "inferred" }`
          : `Return JSON only. Generate 5 commercial-safe / royalty-free audio options for ${config.label} content${hasNiche ? ` in the "${niche}" niche` : ""}${audioIndustryCtx} targeting audiences in ${regionLabel}. Include TikTok Commercial Music Library, Epidemic Sound, Artlist where relevant. All recommendations must be culturally relevant and specific to ${regionLabel}. Reference local events, cultural moments, and regional audience behaviour.\nReturn: { "commercialSafe": ["string"], "source": "claude", "provenance": "inferred" }`
        const audioData = await callClaude(audioPrompt, 400)
        emitSSE("card", { platform, cardType: "commercialAudio", data: { ...audioData, label: isLongTerm ? "Evergreen Audio" : "Licensed Audio" } })

        // ── CARD 8: Vibe Suggestions (synthesis) ──
        emitSSE("card", { platform, cardType: "vibeSuggestions", data: {
          suggestions: themes.slice(0, 4).map((t) => isLongTerm ? `Build a content pillar around: ${t}` : `Create content around: ${t}`),
          mood: hasNiche ? niche : "trending",
          source: "claude", provenance: "inferred",
          label: isLongTerm ? "Brand Positioning Direction" : "Vibe Direction",
        }})

        emitSSE("complete", { platform })

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
