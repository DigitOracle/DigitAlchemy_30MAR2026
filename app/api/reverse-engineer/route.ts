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

async function fetchScrapeCreatorsTikTokPlatform(): Promise<{ songs: { title: string; author: string; usageCount?: number }[]; hashtags: string[] } | null> {
  const apiKey = process.env.SCRAPECREATORS_API_KEY
  if (!apiKey) return null
  const BASE = "https://api.scrapecreators.com"
  const headers = { "x-api-key": apiKey }
  try {
    const [songsRes, hashtagsRes] = await Promise.all([
      fetch(`${BASE}/v1/tiktok/songs/popular`, { headers, signal: AbortSignal.timeout(12000) }),
      fetch(`${BASE}/v1/tiktok/hashtags/popular`, { headers, signal: AbortSignal.timeout(12000) }),
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

async function fetchScrapeCreatorsTikTokByTopic(topic: string): Promise<{ hashtags: string[]; context: string } | null> {
  const apiKey = process.env.SCRAPECREATORS_API_KEY
  if (!apiKey || !topic) return null
  const BASE = "https://api.scrapecreators.com"
  const headers = { "x-api-key": apiKey }
  try {
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

async function fetchScrapeCreatorsInstagram(topic: string): Promise<{ hashtags: string[]; context: string } | null> {
  const apiKey = process.env.SCRAPECREATORS_API_KEY
  if (!apiKey || !topic) return null
  const BASE = "https://api.scrapecreators.com"
  try {
    const res = await fetch(`${BASE}/v2/instagram/reels/search?keyword=${encodeURIComponent(topic)}`, {
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

async function fetchApifyTrends(topic: string, platform: string): Promise<{ hashtags: string[] } | null> {
  const apiKey = process.env.APIFY_API_KEY
  if (!apiKey) return null
  const actorMap: Record<string, string> = { instagram: "apify~instagram-hashtag-scraper", tiktok: "clockworks~tiktok-scraper", youtube: "bernardo~youtube-scraper" }
  const actorId = actorMap[platform]
  if (!actorId) return null
  try {
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
  } catch { return null }
}

async function fetchXpozTrends(topic: string, platform: string): Promise<{ hashtags: string[]; posts: string[] } | null> {
  const MCP_URL = process.env.XPOZ_MCP_URL
  if (!MCP_URL || !topic) return null
  const xpozMap: Record<string, string> = { instagram: "getInstagramPostsByKeywords", tiktok: "getTiktokPostsByKeywords", x: "getTwitterPostsByKeywords" }
  const toolName = xpozMap[platform]
  if (!toolName) return null
  try {
    const res = await fetch(MCP_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: toolName, arguments: { keywords: topic, count: 10 } } }),
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

async function fetchPerplexityTrends(topic: string, platform: string): Promise<{ hashtags: string[]; context: string; elapsedMs: number } | null> {
  const apiKey = process.env.PERPLEXITY_API_KEY
  if (!apiKey) return null
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
async function fetchPlatformWideTrends(platform: string, emit: (l: string) => void): Promise<TrendResult> {
  if (platform === "tiktok") {
    emit("Fetching TikTok platform trends via ScrapeCreators\u2026")
    const sc = await fetchScrapeCreatorsTikTokPlatform()
    if (sc && (sc.songs.length > 0 || sc.hashtags.length > 0)) {
      return { hashtags: sc.hashtags, context: sc.songs.map((s) => `${s.title} \u2014 ${s.author}`).join("\n"), source: "scrape_creators_tiktok", trendingSongs: sc.songs }
    }
  }

  emit(`Trying Apify for ${platform} trends\u2026`)
  const apify = await fetchApifyTrends("trending", platform)
  if (apify && apify.hashtags.length > 0) {
    return { hashtags: apify.hashtags, context: "", source: "apify_live_scrape" }
  }

  emit(`Trying xpoz for ${platform} trends\u2026`)
  const xpoz = await fetchXpozTrends("trending", platform)
  if (xpoz && xpoz.hashtags.length > 0) {
    return { hashtags: xpoz.hashtags, context: xpoz.posts.join("\n"), source: "xpoz_social_signal" }
  }

  emit(`Searching ${platform} trends via Perplexity\u2026`)
  const pplx = await fetchPerplexityTrends("trending", platform)
  if (pplx && (pplx.hashtags.length > 0 || pplx.context)) {
    return { hashtags: pplx.hashtags, context: pplx.context, source: "context_guided", sourceElapsedMs: pplx.elapsedMs }
  }

  return { hashtags: [], context: "", source: "inferred_fallback" }
}

/** Topic/niche: ScrapeCreators → Apify → xpoz → Perplexity → Claude */
async function fetchNicheTrends(topic: string, platform: string, emit: (l: string) => void): Promise<TrendResult> {
  if (!topic) return { hashtags: [], context: "", source: "inferred_fallback" }

  // TikTok: SC topic search first
  if (platform === "tiktok") {
    emit(`Searching TikTok for "${topic}" via ScrapeCreators\u2026`)
    const sc = await fetchScrapeCreatorsTikTokByTopic(topic)
    if (sc && sc.hashtags.length > 0) {
      return { hashtags: sc.hashtags, context: sc.context, source: "scrape_creators_tiktok" }
    }
  }

  // Instagram: SC reels search
  if (platform === "instagram") {
    emit(`Searching Instagram reels for "${topic}" via ScrapeCreators\u2026`)
    const sc = await fetchScrapeCreatorsInstagram(topic)
    if (sc && sc.hashtags.length > 0) {
      return { hashtags: sc.hashtags, context: sc.context, source: "scrape_creators_instagram_support" }
    }
  }

  emit(`Trying Apify for "${topic}" on ${platform}\u2026`)
  const apify = await fetchApifyTrends(topic, platform)
  if (apify && apify.hashtags.length > 0) {
    return { hashtags: apify.hashtags, context: "", source: "apify_live_scrape" }
  }

  emit(`Trying xpoz for "${topic}" on ${platform}\u2026`)
  const xpoz = await fetchXpozTrends(topic, platform)
  if (xpoz && xpoz.hashtags.length > 0) {
    return { hashtags: xpoz.hashtags, context: xpoz.posts.join("\n"), source: "xpoz_social_signal" }
  }

  emit(`Searching web trends for "${topic}" via Perplexity\u2026`)
  const pplx = await fetchPerplexityTrends(topic, platform)
  if (pplx && (pplx.hashtags.length > 0 || pplx.context)) {
    return { hashtags: pplx.hashtags, context: pplx.context, source: "context_guided", sourceElapsedMs: pplx.elapsedMs }
  }

  return { hashtags: [], context: "", source: "inferred_fallback" }
}

const LIVE_SOURCES = new Set(["scrape_creators_tiktok", "scrape_creators_instagram_support", "apify_live_scrape", "xpoz_social_signal", "official_platform"])

export async function POST(req: NextRequest): Promise<Response> {
  const body = await req.json()
  const { platform, niche } = body as { platform: string; niche: string }

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
        emitStatus(`Scanning ${config.label} platform trends\u2026`)
        const platformTrends = await fetchPlatformWideTrends(platform, emitStatus)
        const ptSongs = platformTrends.trendingSongs ?? []
        const ptIsLive = LIVE_SOURCES.has(platformTrends.source)
        const ptSource = platformTrends.source === "context_guided" ? "perplexity" : platformTrends.source === "inferred_fallback" ? "claude" : platformTrends.source

        // Claude adds themes + video ideas (synthesis on top of trend data)
        let themes: unknown[] = []
        let videoIdeas: unknown[] = []
        const ideaPrompt = `You are DigitAlchemy\u00ae trend analyst for ${config.label}. Given platform trend data, generate actionable content ideas. Return JSON only.

PLATFORM: ${config.label}
TRENDING HASHTAGS: ${platformTrends.hashtags.join(", ") || "none"}
TRENDING SONGS: ${ptSongs.map((s) => `"${s.title}" by ${s.author}`).join(", ") || "none"}
TREND CONTEXT: ${platformTrends.context.slice(0, 400) || "none"}
${hasNiche ? `NICHE FOCUS: ${niche}` : "SCOPE: Broad platform-wide trends"}

Return ONLY this JSON:
{
  "themes": ["3-5 trending themes/formats on ${config.label} right now"],
  "videoIdeas": [{ "title": "short video idea title", "hook": "opening hook line", "format": "duet|stitch|tutorial|storytime|POV|trend-jump|etc", "why": "why this works now" }],
  "hookConcepts": [{ "text": "hook line", "type": "opening|question|statistic|controversial" }],
  "captionStarters": [{ "text": "caption starter text", "variant": "short|long|story" }]
}

Rules:
- videoIdeas: exactly 5, specific and actionable
- hookConcepts: exactly 3
- captionStarters: exactly 3 (short, long, story)
- ${hasNiche ? `Focus all ideas on the "${niche}" niche` : "Cover diverse trending themes"}
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
        }
        emitSSE("card", { platform, cardType: "platformTrends", data: platformTrendsCard })

        // ── CARD 2: Niche Trends (only if niche provided — inference-last) ──
        if (hasNiche) {
          emitStatus(`Searching ${config.label} trends for "${niche}"\u2026`)
          const nicheTrends = await fetchNicheTrends(niche, platform, emitStatus)
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
        }})

        // ── CARD 4: Video Ideas (synthesis) ──
        emitSSE("card", { platform, cardType: "videoIdeas", data: {
          ideas: videoIdeas,
          source: "claude", mode: "inferred_fallback", provenance: "inferred",
        }})

        // ── CARD 5: Hook Concepts (synthesis) ──
        emitSSE("card", { platform, cardType: "hooks", data: (ideaData.hookConcepts as unknown[]) ?? [] })

        // ── CARD 6: Caption Starters (synthesis) ──
        emitSSE("card", { platform, cardType: "captions", data: (ideaData.captionStarters as unknown[]) ?? [] })

        // ── CARD 7: Commercial Audio (synthesis) ──
        emitStatus("Generating commercial-safe audio suggestions\u2026")
        const audioData = await callClaude(`Return JSON only. Generate 5 commercial-safe / royalty-free audio options for ${config.label} content${hasNiche ? ` in the "${niche}" niche` : ""}. Include TikTok Commercial Music Library, Epidemic Sound, Artlist where relevant.\nReturn: { "commercialSafe": ["string"], "source": "claude", "provenance": "inferred" }`, 400)
        emitSSE("card", { platform, cardType: "commercialAudio", data: audioData })

        // ── CARD 8: Vibe Suggestions (synthesis) ──
        emitSSE("card", { platform, cardType: "vibeSuggestions", data: {
          suggestions: themes.slice(0, 4).map((t) => `Create content around: ${t}`),
          mood: hasNiche ? niche : "trending",
          source: "claude", provenance: "inferred",
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
