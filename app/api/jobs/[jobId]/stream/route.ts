import { NextRequest } from "next/server"
import { getAuth } from "firebase-admin/auth"
import { getJobV2, updateJobV2, updateJobStatusV2, updateCard } from "@/lib/firestore/jobs"
import { getDb } from "@/lib/jobStore"
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
  try {
    return JSON.parse(cleaned)
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/)
    if (match) {
      try { return JSON.parse(match[0]) } catch { /* fall through */ }
    }
    return {}
  }
}

// ── Live trend data fetchers ──

/** xpoz: social trend signal — only for platforms with real xpoz tools */
async function fetchXpozTrends(topic: string, platform: string): Promise<{ hashtags: string[]; posts: string[] } | null> {
  const MCP_URL = process.env.XPOZ_MCP_URL
  if (!MCP_URL) { console.log("[phase2] XPOZ_MCP_URL not configured, skipping xpoz"); return null }
  if (!topic) { console.log("[phase2] xpoz requires a topic, skipping for platform-wide"); return null }
  try {
    // Only map platforms that have REAL xpoz tools — no cross-platform proxying
    const xpozMap: Record<string, string> = {
      instagram: "getInstagramPostsByKeywords",
      tiktok: "getTiktokPostsByKeywords",
      x: "getTwitterPostsByKeywords",
    }
    const toolName = xpozMap[platform]
    if (!toolName) { console.log(`[phase2] xpoz has no tool for ${platform}, skipping`); return null }
    // Streamable HTTP MCP uses JSON-RPC 2.0
    const res = await fetch(MCP_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: { name: toolName, arguments: { keywords: topic, count: 10 } },
      }),
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) { console.log(`[phase2] xpoz HTTP ${res.status}`); return null }
    const contentType = res.headers.get("content-type") ?? ""
    let resultText: string | null = null
    if (contentType.includes("text/event-stream")) {
      // SSE response — parse for the result message
      const body = await res.text()
      for (const line of body.split("\n")) {
        if (line.startsWith("data: ")) {
          try {
            const msg = JSON.parse(line.slice(6))
            if (msg.result?.content?.[0]?.text) { resultText = msg.result.content[0].text; break }
          } catch { /* skip */ }
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
    const uniqueTags = [...new Set(tagMatches.map((t: string) => t.replace(/^#/, "")))]
    const postSnippets = items.slice(0, 5).map((p: Record<string, unknown>) => ((p.text ?? p.caption ?? "") as string).slice(0, 120))
    return { hashtags: uniqueTags.slice(0, 15), posts: postSnippets }
  } catch (err) {
    console.log(`[phase2] xpoz ${platform} failed:`, (err as Error).message)
    return null
  }
}

/** Perplexity: contextual trend enrichment (REST API — stdio MCP not callable from route) */
async function fetchPerplexityTrends(topic: string, platform: string): Promise<{ context: string; hashtags: string[]; elapsedMs: number } | null> {
  const apiKey = process.env.PERPLEXITY_API_KEY
  if (!apiKey) { console.log("[phase2] PERPLEXITY_API_KEY not configured, skipping perplexity"); return null }
  const start = Date.now()
  try {
    const res = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "sonar",
        messages: [{ role: "user", content: `What are the current trending hashtags and content themes on ${platform} related to "${topic}"? List specific hashtags. Be concise.` }],
        search_recency_filter: "week",
        max_tokens: 400,
      }),
      signal: AbortSignal.timeout(15000),
    })
    const elapsedMs = Date.now() - start
    if (!res.ok) { console.log(`[phase2] perplexity HTTP ${res.status} (${elapsedMs}ms)`); return null }
    const data = await res.json()
    const text = data?.choices?.[0]?.message?.content ?? ""
    if (!text) return null
    const tagMatches = text.match(/#[\w\u00C0-\u024F]+/g) ?? []
    return { context: text.slice(0, 500), hashtags: [...new Set(tagMatches.map((t: string) => t.replace(/^#/, "")))] .slice(0, 10) as string[], elapsedMs }
  } catch (err) {
    console.log(`[phase2] perplexity ${platform} failed (${Date.now() - start}ms):`, (err as Error).message)
    return null
  }
}

/** Apify: scraping fallback for trend data */
async function fetchApifyTrends(topic: string, platform: string): Promise<{ hashtags: string[] } | null> {
  const apiKey = process.env.APIFY_API_KEY
  if (!apiKey) { console.log("[phase2] APIFY_API_KEY not configured, skipping apify"); return null }
  try {
    const actorMap: Record<string, string> = { instagram: "apify~instagram-hashtag-scraper", tiktok: "clockworks~tiktok-scraper", youtube: "bernardo~youtube-scraper" }
    const actorId = actorMap[platform]
    if (!actorId) return null
    const res = await fetch(`https://api.apify.com/v2/acts/${actorId}/runs?token=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hashtags: [topic.replace(/\s+/g, "")], resultsLimit: 10 }),
      signal: AbortSignal.timeout(25000),
    })
    if (!res.ok) return null
    const run = await res.json()
    const datasetId = run?.data?.defaultDatasetId
    if (!datasetId) return null
    const itemsRes = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?token=${apiKey}&limit=20`, { signal: AbortSignal.timeout(10000) })
    if (!itemsRes.ok) return null
    const items = await itemsRes.json()
    const allText = (items as Record<string, unknown>[]).map((i) => ((i.caption ?? i.text ?? i.description ?? "") as string)).join(" ")
    const tagMatches = allText.match(/#[\w\u00C0-\u024F]+/g) ?? []
    return { hashtags: [...new Set(tagMatches.map((t: string) => t.replace(/^#/, "")))].slice(0, 15) }
  } catch (err) {
    console.log(`[phase2] apify ${platform} failed:`, (err as Error).message)
    return null
  }
}

// ── Provider role mapping ──
const PROVIDER_ROLES: Record<string, string> = {
  scrape_creators_tiktok: "trend_audio",
  scrape_creators_instagram_support: "metadata_support",
  apify: "trend_audio",
  xpoz: "social_signal",
  supadata: "transcript_metadata",
  perplexity: "contextual_enrichment",
  claude: "synthesis",
}

/** Quality filter: downgrade hashtags that look synthetic / AI-hallucinated */
function filterSuspiciousHashtags(hashtags: string[], source: string): { filtered: string[]; downgraded: boolean } {
  // Live-scraped sources are trusted — no filtering
  const TRUSTED = new Set(["scrape_creators_tiktok", "apify_live_scrape", "xpoz_social_signal", "official_platform"])
  if (TRUSTED.has(source)) return { filtered: hashtags, downgraded: false }

  const suspicious = (tag: string): boolean => {
    const lower = tag.toLowerCase()
    // Future dates (2027+) or months ahead suggest hallucination
    if (/202[7-9]|203\d/.test(lower)) return true
    // Overly generic single-word filler
    if (["trending", "viral", "fyp", "foryou", "foryoupage", "explore"].includes(lower)) return true
    // Absurdly long compound tags (likely AI-generated)
    if (tag.length > 40) return true
    return false
  }

  const filtered = hashtags.filter((h) => !suspicious(h))
  const downgraded = filtered.length < hashtags.length
  if (downgraded) {
    console.log(`[phase2] quality filter removed ${hashtags.length - filtered.length} suspicious hashtags from ${source}`)
  }
  return { filtered, downgraded }
}

/** ScrapeCreators: TikTok platform-wide popular songs + hashtags (topic-independent) */
async function fetchScrapeCreatorsTikTokPlatform(): Promise<{ songs: { title: string; author: string; playUrl?: string; usageCount?: number }[]; hashtags: string[]; source: string } | null> {
  const apiKey = process.env.SCRAPECREATORS_API_KEY
  if (!apiKey) { console.log("[phase2] SCRAPECREATORS_API_KEY not configured, skipping scrape_creators"); return null }
  const BASE = "https://api.scrapecreators.com"
  const headers = { "x-api-key": apiKey }
  try {
    // Fetch popular songs + popular hashtags in parallel — these are platform-wide, no topic needed
    const [songsRes, hashtagsRes] = await Promise.all([
      fetch(`${BASE}/v1/tiktok/songs/popular`, { headers, signal: AbortSignal.timeout(12000) }),
      fetch(`${BASE}/v1/tiktok/hashtags/popular`, { headers, signal: AbortSignal.timeout(12000) }),
    ])

    const songs: { title: string; author: string; playUrl?: string; usageCount?: number }[] = []
    if (songsRes.ok) {
      const data = await songsRes.json()
      const items = Array.isArray(data) ? data : (data?.sound_list ?? data?.data ?? data?.songs ?? data?.items ?? [])
      for (const s of (items as Record<string, unknown>[]).slice(0, 10)) {
        songs.push({
          title: (s.title ?? s.songName ?? s.name ?? "") as string,
          author: (s.author ?? s.authorName ?? s.artist ?? "") as string,
          playUrl: (s.playUrl ?? s.play_url ?? s.musicUrl) as string | undefined,
          usageCount: (s.usageCount ?? s.videoCount ?? (s.stats as Record<string, unknown>)?.videoCount) as number | undefined,
        })
      }
    } else {
      console.log(`[phase2] scrape_creators songs HTTP ${songsRes.status}`)
    }

    const hashtags: string[] = []
    if (hashtagsRes.ok) {
      const data = await hashtagsRes.json()
      const items = Array.isArray(data) ? data : (data?.list ?? data?.data ?? data?.hashtags ?? data?.items ?? [])
      for (const h of (items as Record<string, unknown>[]).slice(0, 15)) {
        const tag = (h.hashtag_name ?? h.name ?? h.hashtag ?? h.title ?? "") as string
        if (tag) hashtags.push(tag.replace(/^#/, ""))
      }
    } else {
      console.log(`[phase2] scrape_creators hashtags HTTP ${hashtagsRes.status}`)
    }

    if (songs.length === 0 && hashtags.length === 0) return null
    console.log(`[phase2] scrape_creators platform returned ${songs.length} songs, ${hashtags.length} hashtags for tiktok`)
    return { songs, hashtags, source: "scrape_creators_tiktok" }
  } catch (err) {
    console.log(`[phase2] scrape_creators tiktok platform failed:`, (err as Error).message)
    return null
  }
}

/** ScrapeCreators: TikTok topic-specific search (uses keyword + hashtag search, NOT global popular) */
async function fetchScrapeCreatorsTikTokByTopic(topic: string): Promise<{ hashtags: string[]; context: string; source: string } | null> {
  const apiKey = process.env.SCRAPECREATORS_API_KEY
  if (!apiKey) return null
  if (!topic) return null
  const BASE = "https://api.scrapecreators.com"
  const headers = { "x-api-key": apiKey }
  try {
    // Search by keyword + search by hashtag in parallel
    const [keywordRes, hashtagRes] = await Promise.all([
      fetch(`${BASE}/v1/tiktok/search/keyword?keyword=${encodeURIComponent(topic)}&count=10`, { headers, signal: AbortSignal.timeout(12000) }),
      fetch(`${BASE}/v1/tiktok/search/hashtag?keyword=${encodeURIComponent(topic.replace(/\s+/g, ""))}&count=10`, { headers, signal: AbortSignal.timeout(12000) }),
    ])

    const hashtags: string[] = []
    const snippets: string[] = []

    if (keywordRes.ok) {
      const data = await keywordRes.json()
      const items = Array.isArray(data) ? data : (data?.data ?? data?.items ?? data?.videos ?? [])
      for (const v of (items as Record<string, unknown>[]).slice(0, 10)) {
        const desc = (v.desc ?? v.description ?? v.text ?? v.caption ?? "") as string
        if (desc) snippets.push(desc.slice(0, 120))
        const tagMatches = desc.match(/#[\w\u00C0-\u024F]+/g) ?? []
        for (const t of tagMatches) hashtags.push(t.replace(/^#/, ""))
      }
    } else {
      console.log(`[phase2] scrape_creators keyword search HTTP ${keywordRes.status}`)
    }

    if (hashtagRes.ok) {
      const data = await hashtagRes.json()
      const items = Array.isArray(data) ? data : (data?.data ?? data?.items ?? data?.challengeList ?? [])
      for (const h of (items as Record<string, unknown>[]).slice(0, 10)) {
        const tag = (h.hashtag_name ?? h.name ?? h.hashtag ?? h.title ?? h.challengeName ?? "") as string
        if (tag) hashtags.push(tag.replace(/^#/, ""))
        const desc = (h.desc ?? h.description ?? "") as string
        if (desc) snippets.push(desc.slice(0, 120))
      }
    } else {
      console.log(`[phase2] scrape_creators hashtag search HTTP ${hashtagRes.status}`)
    }

    const unique = [...new Set(hashtags)].slice(0, 15)
    if (unique.length === 0 && snippets.length === 0) return null
    console.log(`[phase2] scrape_creators topic search returned ${unique.length} hashtags for "${topic}"`)
    return { hashtags: unique, context: snippets.join("\n"), source: "scrape_creators_tiktok" }
  } catch (err) {
    console.log(`[phase2] scrape_creators tiktok topic search failed:`, (err as Error).message)
    return null
  }
}

/** ScrapeCreators: Instagram support (search reels + reel info — metadata only, NOT primary trend source) */
async function fetchScrapeCreatorsInstagram(topic: string): Promise<{ reelSnippets: string[]; hashtags: string[]; source: string } | null> {
  const apiKey = process.env.SCRAPECREATORS_API_KEY
  if (!apiKey) { console.log("[phase2] SCRAPECREATORS_API_KEY not configured, skipping scrape_creators ig"); return null }
  const BASE = "https://api.scrapecreators.com"
  const headers = { "x-api-key": apiKey }
  try {
    const res = await fetch(`${BASE}/v2/instagram/reels/search?keyword=${encodeURIComponent(topic)}`, {
      headers,
      signal: AbortSignal.timeout(12000),
    })
    if (!res.ok) { console.log(`[phase2] scrape_creators ig reels HTTP ${res.status}`); return null }
    const data = await res.json()
    const items = Array.isArray(data) ? data : (data?.data ?? data?.reels ?? data?.items ?? [])
    const reelSnippets: string[] = []
    const hashtags: string[] = []
    for (const r of (items as Record<string, unknown>[]).slice(0, 10)) {
      const caption = (r.caption ?? r.text ?? "") as string
      if (caption) reelSnippets.push(caption.slice(0, 120))
      const tagMatches = caption.match(/#[\w\u00C0-\u024F]+/g) ?? []
      for (const t of tagMatches) hashtags.push(t.replace(/^#/, ""))
    }
    if (reelSnippets.length === 0 && hashtags.length === 0) return null
    console.log(`[phase2] scrape_creators ig returned ${reelSnippets.length} reels, ${hashtags.length} hashtags`)
    return { reelSnippets, hashtags: [...new Set(hashtags)].slice(0, 15), source: "scrape_creators_instagram_support" }
  } catch (err) {
    console.log(`[phase2] scrape_creators ig failed:`, (err as Error).message)
    return null
  }
}

type LiveTrendResult = { hashtags: string[]; context: string; source: string; sourceElapsedMs?: number; trendingSongs?: { title: string; author: string; playUrl?: string; usageCount?: number }[] }

/** Platform-wide trends — inference-last: ScrapeCreators → Apify → xpoz → Perplexity */
async function fetchPlatformWideTrends(
  platform: string, emit: (event: string, data: unknown) => void
): Promise<LiveTrendResult> {

  // ── Step 1: ScrapeCreators (TikTok has real platform-wide endpoints) ──
  if (platform === "tiktok") {
    emit("processor.started", { platform, label: "Fetching TikTok platform trends via ScrapeCreators\u2026" })
    const sc = await fetchScrapeCreatorsTikTokPlatform()
    if (sc && (sc.songs.length > 0 || sc.hashtags.length > 0)) {
      return { hashtags: sc.hashtags, context: sc.songs.map((s) => `${s.title} \u2014 ${s.author}`).join("\n"), source: "scrape_creators_tiktok", trendingSongs: sc.songs }
    }
  }

  // ── Step 2: Apify (use "trending" as a generic discovery keyword) ──
  emit("processor.started", { platform, label: `Trying Apify scraper for ${platform} trends\u2026` })
  const apify = await fetchApifyTrends("trending", platform)
  if (apify && apify.hashtags.length > 0) {
    console.log(`[phase2] apify platform-wide returned ${apify.hashtags.length} hashtags for ${platform}`)
    return { hashtags: apify.hashtags, context: "", source: "apify_live_scrape" }
  }

  // ── Step 3: xpoz (use "trending" keyword — only fires for platforms with real tools) ──
  emit("processor.started", { platform, label: `Trying xpoz for ${platform} trends\u2026` })
  const xpoz = await fetchXpozTrends("trending", platform)
  if (xpoz && xpoz.hashtags.length > 0) {
    console.log(`[phase2] xpoz platform-wide returned ${xpoz.hashtags.length} hashtags for ${platform}`)
    return { hashtags: xpoz.hashtags, context: xpoz.posts.join("\n"), source: "xpoz_social_signal" }
  }

  // ── Step 4 (last resort): Perplexity context-guided ──
  emit("processor.started", { platform, label: `Searching ${platform} platform trends via Perplexity\u2026` })
  const pplx = await fetchPerplexityTrends("trending", platform)
  if (pplx && (pplx.hashtags.length > 0 || pplx.context)) {
    console.log(`[phase2] perplexity platform-wide returned ${pplx.hashtags.length} hashtags for ${platform}`)
    return { hashtags: pplx.hashtags, context: pplx.context, source: "context_guided", sourceElapsedMs: pplx.elapsedMs }
  }

  console.log(`[phase2] no platform-wide trends for ${platform}`)
  return { hashtags: [], context: "", source: "inferred_fallback" }
}

/** Topic-aligned trend data — uses topic to search each provider */
async function fetchTopicTrends(
  topic: string, platform: string, emit: (event: string, data: unknown) => void
): Promise<LiveTrendResult> {
  if (!topic) return { hashtags: [], context: "", source: "inferred_fallback" }

  // ── TikTok: ScrapeCreators keyword search → Apify → xpoz → Perplexity ──
  if (platform === "tiktok") {
    emit("processor.started", { platform, label: `Searching TikTok for "${topic}" via ScrapeCreators\u2026` })
    const sc = await fetchScrapeCreatorsTikTokByTopic(topic)
    if (sc && sc.hashtags.length > 0) {
      return { hashtags: sc.hashtags, context: sc.context, source: "scrape_creators_tiktok" }
    }

    emit("processor.started", { platform, label: "Trying Apify scraper for TikTok\u2026" })
    const apify = await fetchApifyTrends(topic, platform)
    if (apify && apify.hashtags.length > 0) {
      return { hashtags: apify.hashtags, context: "", source: "apify_live_scrape" }
    }

    emit("processor.started", { platform, label: "Fetching TikTok social signal via xpoz\u2026" })
    const xpoz = await fetchXpozTrends(topic, platform)
    if (xpoz && xpoz.hashtags.length > 0) {
      return { hashtags: xpoz.hashtags, context: xpoz.posts.join("\n"), source: "xpoz_social_signal" }
    }

    emit("processor.started", { platform, label: "Searching web trends via Perplexity\u2026" })
    const pplx = await fetchPerplexityTrends(topic, platform)
    if (pplx && (pplx.hashtags.length > 0 || pplx.context)) {
      return { hashtags: pplx.hashtags, context: pplx.context, source: "context_guided", sourceElapsedMs: pplx.elapsedMs }
    }

    return { hashtags: [], context: "", source: "inferred_fallback" }
  }

  // ── Instagram: Apify → ScrapeCreators (support) → xpoz → Perplexity ──
  if (platform === "instagram") {
    emit("processor.started", { platform, label: "Fetching Instagram trends via Apify\u2026" })
    const apify = await fetchApifyTrends(topic, platform)
    if (apify && apify.hashtags.length > 0) {
      // Augment with ScrapeCreators reel metadata (support only, non-blocking)
      let scContext = ""
      try {
        const sc = await fetchScrapeCreatorsInstagram(topic)
        if (sc) scContext = sc.reelSnippets.join("\n")
      } catch { /* non-blocking */ }
      return { hashtags: apify.hashtags, context: scContext, source: "apify_live_scrape" }
    }

    emit("processor.started", { platform, label: "Searching Instagram reels via ScrapeCreators\u2026" })
    const sc = await fetchScrapeCreatorsInstagram(topic)
    if (sc && sc.hashtags.length > 0) {
      return { hashtags: sc.hashtags, context: sc.reelSnippets.join("\n"), source: "scrape_creators_instagram_support" }
    }

    emit("processor.started", { platform, label: "Fetching Instagram social signal via xpoz\u2026" })
    const xpoz = await fetchXpozTrends(topic, platform)
    if (xpoz && xpoz.hashtags.length > 0) {
      return { hashtags: xpoz.hashtags, context: xpoz.posts.join("\n"), source: "xpoz_social_signal" }
    }

    emit("processor.started", { platform, label: "Searching web trends via Perplexity\u2026" })
    const pplx = await fetchPerplexityTrends(topic, platform)
    if (pplx && (pplx.hashtags.length > 0 || pplx.context)) {
      return { hashtags: pplx.hashtags, context: pplx.context, source: "context_guided", sourceElapsedMs: pplx.elapsedMs }
    }

    return { hashtags: [], context: "", source: "inferred_fallback" }
  }

  // ── All other platforms: xpoz (if supported) → Apify → Perplexity ──
  emit("processor.started", { platform, label: `Fetching live ${platform} trends via xpoz\u2026` })
  const xpoz = await fetchXpozTrends(topic, platform)
  if (xpoz && xpoz.hashtags.length > 0) {
    console.log(`[phase2] xpoz returned ${xpoz.hashtags.length} hashtags for ${platform}`)
    return { hashtags: xpoz.hashtags, context: xpoz.posts.join("\n"), source: "xpoz_social_signal" }
  }

  emit("processor.started", { platform, label: `Trying Apify scraper for ${platform}\u2026` })
  const apify = await fetchApifyTrends(topic, platform)
  if (apify && apify.hashtags.length > 0) {
    console.log(`[phase2] apify returned ${apify.hashtags.length} hashtags for ${platform}`)
    return { hashtags: apify.hashtags, context: "", source: "apify_live_scrape" }
  }

  emit("processor.started", { platform, label: `Searching web trends via Perplexity\u2026` })
  const pplx = await fetchPerplexityTrends(topic, platform)
  if (pplx && (pplx.hashtags.length > 0 || pplx.context)) {
    console.log(`[phase2] perplexity returned ${pplx.hashtags.length} hashtags for ${platform}`)
    return { hashtags: pplx.hashtags, context: pplx.context, source: "context_guided", sourceElapsedMs: pplx.elapsedMs }
  }

  console.log(`[phase2] no topic trend data for ${platform}, falling back to inferred`)
  return { hashtags: [], context: "", source: "inferred_fallback" }
}

export async function GET(
  req: NextRequest,
  { params }: { params: { jobId: string } }
) {
  // Require Firebase Auth before any provider calls or job mutations
  getDb()
  const authHeader = req.headers.get("authorization")
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Authentication required" }), { status: 401, headers: { "Content-Type": "application/json" } })
  }
  let callerUid: string
  try {
    const token = await getAuth().verifyIdToken(authHeader.slice(7))
    callerUid = token.uid
  } catch {
    return new Response(JSON.stringify({ error: "Invalid auth token" }), { status: 401, headers: { "Content-Type": "application/json" } })
  }

  const job = await getJobV2(params.jobId)
  if (!job) return new Response("Job not found", { status: 404 })

  // Fail-closed ownership check — no admin override on mutation path
  if (job.ownerUid !== callerUid) {
    return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { "Content-Type": "application/json" } })
  }

  if (job.phase !== 2 || job.status !== "generating") {
    return new Response("Job not in generating state", { status: 400 })
  }

  const stream = new ReadableStream({
    async start(controller) {
      const keepAlive = setInterval(() => {
        try { controller.enqueue(ping()) } catch { /* closed */ }
      }, 8000)

      const emit = (event: string, data: unknown) => {
        try { controller.enqueue(encodeEvent(event, data)) } catch { /* closed */ }
      }

      try {
        const ingestion = job.ingestion
        const focus = job.confirmedFocus
        const topic = focus?.topic ?? ingestion.title ?? "the submitted content"
        const summary = focus?.summary ?? ingestion.transcriptSummary ?? ""
        const provenance = ingestion.provenance

        for (const platformId of job.selectedPlatforms) {
          const config = PLATFORMS[platformId]
          if (!config) continue
          const fetchedAt = new Date().toISOString()

          // ── CARD 1: Platform Trends Now (topic-independent) ──
          emit("processor.started", { platform: platformId, label: `Fetching ${config.label} platform trends\u2026` })
          const platformTrends = await fetchPlatformWideTrends(platformId, emit)
          const ptSongs = platformTrends.trendingSongs ?? []

          // Trust gate: only scrape/platform sources count as live
          const LIVE_SOURCES = new Set(["scrape_creators_tiktok", "apify_live_scrape", "xpoz_social_signal", "official_platform"])
          const ptIsLiveScrape = LIVE_SOURCES.has(platformTrends.source)
          const ptMode = ptIsLiveScrape ? "live_trend" : platformTrends.source === "inferred_fallback" ? "inferred_fallback" : "context_guided"
          const ptProvenance = ptIsLiveScrape ? "observed_live" : "inferred"
          const ptSource = platformTrends.source === "context_guided" ? "perplexity" : platformTrends.source === "inferred_fallback" ? "claude" : platformTrends.source

          // Quality-filter hashtags from non-live sources
          const ptHashFilter = filterSuspiciousHashtags(platformTrends.hashtags, ptSource)
          const ptFinalMode = ptHashFilter.downgraded && ptMode === "context_guided" ? "context_guided" : ptMode

          // Build platform trends card data
          const platformTrendsCard: Record<string, unknown> = {
            hashtags: ptHashFilter.filtered,
            trendingSongs: ptSongs,
            themes: [],
            notes: "",
            source: ptSource,
            sourceElapsedMs: platformTrends.sourceElapsedMs ?? null,
            mode: ptFinalMode,
            provenance: ptProvenance,
            fetchedAt,
            opportunities: [],
          }

          // If we got real live-scraped data, ask Claude to add themes + content opportunities
          if (ptIsLiveScrape) {
            const ptPrompt = `You are DigitAlchemy\u00ae platform analyst. Given LIVE platform trend data, identify trending themes/formats and content opportunities. Return JSON only.

PLATFORM: ${config.label}
LIVE HASHTAGS: ${platformTrends.hashtags.join(", ") || "none"}
LIVE SONGS: ${ptSongs.map((s) => `"${s.title}" by ${s.author}`).join(", ") || "none"}
LIVE CONTEXT: ${platformTrends.context.slice(0, 300) || "none"}

UPLOADED VIDEO TOPIC: ${topic}

Return ONLY this JSON:
{
  "themes": ["string — 3-5 trending themes/formats on the platform right now"],
  "opportunities": [{ "trend": "the platform trend", "fit": "high|medium|low", "action": "Create new content around this trend|Adapt uploaded video to this trend|Low relevance" }]
}

Rules:
- themes should describe PLATFORM-WIDE trends, not topic-specific ones
- opportunities should assess how the uploaded video topic relates to each trend
- Be honest about fit — "low" is valid`

            try {
              const ptExtra = await callClaude(ptPrompt, 600)
              if (ptExtra.themes) platformTrendsCard.themes = ptExtra.themes
              if (ptExtra.opportunities) platformTrendsCard.opportunities = ptExtra.opportunities
            } catch { /* non-critical */ }
          }

          await updateCard(params.jobId, platformId, "platformTrends", platformTrendsCard)
          emit("card", { platform: platformId, cardType: "platformTrends", data: platformTrendsCard })

          // ── CARD 2: Topic-Aligned Trends ──
          emit("processor.started", { platform: platformId, label: `Finding ${config.label} trends for "${topic}"\u2026` })
          const topicTrends = await fetchTopicTrends(topic, platformId, emit)
          const ttIsLiveScrape = LIVE_SOURCES.has(topicTrends.source)
          const ttProvenance = ttIsLiveScrape ? "observed_live" : "inferred"
          const ttSource = topicTrends.source === "context_guided" ? "perplexity" : topicTrends.source === "inferred_fallback" ? "claude" : topicTrends.source

          // Quality-filter topic hashtags
          const ttHashFilter = filterSuspiciousHashtags(topicTrends.hashtags, ttSource)

          // Find overlap between platform trends and topic trends
          const platformHashSet = new Set(ptHashFilter.filtered.map((h) => h.toLowerCase()))
          const overlapping = ttHashFilter.filtered.filter((h) => platformHashSet.has(h.toLowerCase()))
          const topicSpecific = ttHashFilter.filtered.filter((h) => !platformHashSet.has(h.toLowerCase()))

          const topicTrendsCard: Record<string, unknown> = {
            hashtags: ttHashFilter.filtered,
            overlapping,
            topicSpecific,
            notes: "",
            source: ttSource,
            sourceElapsedMs: topicTrends.sourceElapsedMs ?? null,
            mode: "topic_aligned",
            provenance: ttProvenance,
            fetchedAt,
          }

          // If neither live source produced topic hashtags, ask Claude
          if (topicTrends.hashtags.length === 0) {
            const ttPrompt = `You are DigitAlchemy\u00ae hashtag researcher for ${config.label}. Return JSON only.

TOPIC: ${topic}
TRANSCRIPT SUMMARY: ${summary}
PLATFORM: ${config.label}
PLATFORM TRENDING HASHTAGS: ${platformTrends.hashtags.join(", ") || "none"}

Return ONLY this JSON:
{
  "overlapping": ["hashtags that are both relevant to the topic AND currently trending on the platform"],
  "topicSpecific": ["hashtags specific to the video topic but not necessarily trending"],
  "notes": "brief note on hashtag strategy"
}`

            try {
              const ttExtra = await callClaude(ttPrompt, 400)
              if (ttExtra.overlapping) topicTrendsCard.overlapping = ttExtra.overlapping
              if (ttExtra.topicSpecific) topicTrendsCard.topicSpecific = ttExtra.topicSpecific
              if (ttExtra.notes) topicTrendsCard.notes = ttExtra.notes
              topicTrendsCard.source = "claude"
              topicTrendsCard.mode = "inferred_fallback"
              topicTrendsCard.provenance = "inferred"
            } catch { /* non-critical */ }
          }

          await updateCard(params.jobId, platformId, "topicTrends" , topicTrendsCard)
          emit("card", { platform: platformId, cardType: "topicTrends", data: topicTrendsCard })

          // ── CARD 3: Trending Audio Now (live only) ──
          const trendingSoundsFromLive = ptSongs.map((s) => `${s.title} \u2014 ${s.author}`)
          const audioIsLive = trendingSoundsFromLive.length > 0
          const trendingAudioCard: Record<string, unknown> = {
            trendingSounds: trendingSoundsFromLive,
            source: audioIsLive ? platformTrends.source : "inferred_fallback",
            mode: "live_trend",
            provenance: audioIsLive ? "observed_live" : "inferred",
            fetchedAt,
          }
          await updateCard(params.jobId, platformId, "trendingAudio" , trendingAudioCard)
          emit("card", { platform: platformId, cardType: "trendingAudio", data: trendingAudioCard })

          // ── CARDS 4-8: Claude synthesis (commercialAudio, vibeSuggestions, hooks, captions, schedule) ──
          emit("processor.started", { platform: platformId, label: `Generating ${config.label} content pack\u2026` })

          const liveAudioContext = trendingSoundsFromLive.length > 0
            ? `\nLIVE TRENDING AUDIO (source: ${platformTrends.source}):\n${trendingSoundsFromLive.slice(0, 8).map((s, i) => `${i + 1}. ${s}`).join("\n")}`
            : ""
          const liveHashtagContext = platformTrends.hashtags.length > 0
            ? `\nPLATFORM TRENDING HASHTAGS: ${platformTrends.hashtags.join(", ")}`
            : ""

          const packPrompt = `You are DigitAlchemy\u00ae content pack generator for ${config.label}. Return JSON only.

TOPIC: ${topic}
TRANSCRIPT SUMMARY: ${summary}
PLATFORM: ${config.label}
PROVENANCE: ${provenance}${liveHashtagContext}${liveAudioContext}

Return ONLY this JSON:
{
  "commercialAudio": { "commercialSafe": ["5+ royalty-free / commercial-license audio options — include TikTok Commercial Music Library, Epidemic Sound, Artlist where relevant"], "source": "synthesis", "provenance": "inferred" },
  "vibeSuggestions": { "suggestions": ["3-4 creative direction / mood-based audio suggestions"], "mood": "string", "source": "synthesis", "provenance": "inferred" },
  "hooks": [{ "text": "string", "type": "opening|question|statistic" }],
  "captions": [{ "text": "string", "variant": "short|long|story" }],
  "schedule": { "bestTimes": ["string"], "frequency": "string", "notes": "string" }
}

Rules:
- Make every field specific to ${config.label} conventions and norms.
- For hooks, return exactly 3 hooks.
- For captions, return exactly 3 captions (short, long, story variants).
- commercialAudio.commercialSafe MUST be licensed/royalty-free options only. Include specific library names.
- vibeSuggestions are creative direction — NEVER present them as live trend data.
- Do NOT include trending audio in commercialAudio or vibeSuggestions — that is a separate card.`

          const packData = await callClaude(packPrompt, 1500)
          console.log(`[phase2] Claude returned keys for ${platformId}:`, Object.keys(packData))
          console.log(`[phase2] Pack data sample for ${platformId}:`, JSON.stringify(packData).slice(0, 500))

          const emitCards = ["commercialAudio", "vibeSuggestions", "hooks", "captions", "schedule"] as const
          for (const cardType of emitCards) {
            const data = packData[cardType] as Record<string, unknown> | undefined
            if (data) {
              await updateCard(params.jobId, platformId, cardType, data)
              emit("card", { platform: platformId, cardType, data })
            }
          }
        }

        // Persist search index for future retrieval
        try {
          const completedJob = await getJobV2(params.jobId)
          if (completedJob) {
            const allHashtags: string[] = []
            const allHooks: string[] = []
            const allCaptions: string[] = []
            for (const [, cards] of Object.entries(completedJob.cards ?? {})) {
              const c = cards as unknown as Record<string, Record<string, unknown> | null>
              // Collect from both platform trends and topic trends
              const pt = c?.platformTrends
              if (pt?.hashtags && Array.isArray(pt.hashtags)) allHashtags.push(...(pt.hashtags as string[]))
              const tt = c?.topicTrends
              if (tt?.hashtags && Array.isArray(tt.hashtags)) allHashtags.push(...(tt.hashtags as string[]))
              if (tt?.overlapping && Array.isArray(tt.overlapping)) allHashtags.push(...(tt.overlapping as string[]))
              if (tt?.topicSpecific && Array.isArray(tt.topicSpecific)) allHashtags.push(...(tt.topicSpecific as string[]))
              const hooks = c?.hooks
              if (Array.isArray(hooks)) allHooks.push(...(hooks as { text: string }[]).map((h) => h.text).slice(0, 3))
              const captions = c?.captions
              if (Array.isArray(captions)) allCaptions.push(...(captions as { text: string }[]).map((cap) => cap.text.slice(0, 100)).slice(0, 3))
            }
            await updateJobV2(params.jobId, {
              searchIndex: {
                title: completedJob.ingestion.title,
                filename: completedJob.storagePath?.split("/").pop() ?? null,
                sourceMode: completedJob.sourceType,
                platforms: completedJob.selectedPlatforms,
                topic,
                keywords: [...new Set(allHashtags)].slice(0, 30),
                transcriptSummary: summary.slice(0, 300) || null,
                hookSnippets: allHooks.slice(0, 6),
                captionSnippets: allCaptions.slice(0, 6),
                trendHashtags: [...new Set(allHashtags)].slice(0, 20),
                createdAt: completedJob.createdAt,
                status: "complete",
              },
            } as Record<string, unknown>)
            console.log("[phase2] searchIndex persisted for", params.jobId)
          }
        } catch (indexErr) {
          console.error("[phase2] searchIndex write failed:", indexErr)
        }

        await updateJobStatusV2(params.jobId, "complete")
        emit("complete", { jobId: params.jobId })

      } catch (err) {
        const message = err instanceof Error ? err.message : "Generation failed"
        console.error("[jobs stream]", err)
        try { await updateJobStatusV2(params.jobId, "error", message) } catch { /* ignore */ }
        emit("error", { jobId: params.jobId, error: message })
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
