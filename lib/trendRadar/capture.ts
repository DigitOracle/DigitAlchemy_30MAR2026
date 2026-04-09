// lib/trendRadar/capture.ts — Calls existing providers, writes to Firestore + optional InfluxDB

import { getDb } from "@/lib/jobStore"
import { buildEntity, dedupeEntities } from "./normalize"
import { writeSnapshotToInflux } from "./influx"
import { saveRegionalEngagementSamples, deleteOldRegionalEngagementSamples } from "@/lib/firestore/regionalEngagement"
import type { RegionalEngagementSample, Platform, Region } from "@/types/gazette"
import type { TrendSnapshot, TrendEntity, TrendPlatform, TrendScope, SourceConfidence } from "./types"

const SNAPSHOTS_COLLECTION = "trend_snapshots"

function snapId(platform: string, scope: string): string {
  return `snap-${Date.now()}-${platform}-${scope}`
}

// ── Provider adapters (call existing APIs, extract entities) ──

async function captureScrapeCreatorsTikTok(region: string): Promise<{ entities: TrendEntity[]; source: string; confidence: SourceConfidence; rawVideos: Record<string, unknown>[] } | null> {
  const apiKey = process.env.SCRAPECREATORS_API_KEY
  if (!apiKey) return null
  const BASE = "https://api.scrapecreators.com"
  const headers = { "x-api-key": apiKey }

  try {
    const [songsRes, hashtagsRes, videosRes] = await Promise.all([
      fetch(`${BASE}/v1/tiktok/songs/popular?region=${region}`, { headers, signal: AbortSignal.timeout(12000) }),
      fetch(`${BASE}/v1/tiktok/hashtags/popular?region=${region}`, { headers, signal: AbortSignal.timeout(12000) }),
      fetch(`${BASE}/v1/tiktok/videos/popular?region=${region}`, { headers, signal: AbortSignal.timeout(12000) }),
    ])

    const entities: TrendEntity[] = []

    if (songsRes.ok) {
      const data = await songsRes.json()
      const items = Array.isArray(data) ? data : (data?.sound_list ?? data?.data ?? data?.songs ?? data?.items ?? [])
      for (const [i, s] of (items as Record<string, unknown>[]).slice(0, 15).entries()) {
        const title = (s.title ?? s.songName ?? s.name ?? "") as string
        const author = (s.author ?? s.authorName ?? s.artist ?? "") as string
        const usage = (s.usageCount ?? s.videoCount ?? (s.stats as Record<string, unknown>)?.videoCount) as number | undefined
        if (title) {
          entities.push(buildEntity(`${title} \u2014 ${author}`, "song", i + 1, i + 1, usage ?? null, { title, author, playUrl: s.playUrl ?? s.play_url ?? null }))
        }
      }
    }

    if (hashtagsRes.ok) {
      const data = await hashtagsRes.json()
      const items = Array.isArray(data) ? data : (data?.list ?? data?.data ?? data?.hashtags ?? data?.items ?? [])
      for (const [i, h] of (items as Record<string, unknown>[]).slice(0, 20).entries()) {
        const tag = (h.hashtag_name ?? h.name ?? h.hashtag ?? h.title ?? "") as string
        const views = (h.video_views ?? h.viewCount ?? h.views ?? h.videoCount) as number | undefined
        if (tag) {
          entities.push(buildEntity(tag, "hashtag", i + 1, i + 1, views ?? null, { viewCount: views ?? null }))
        }
      }
    }

    const rawVideos: Record<string, unknown>[] = []
    if (videosRes.ok) {
      const data = await videosRes.json()
      const items = Array.isArray(data) ? data : (data?.data ?? data?.items ?? data?.videos ?? [])
      // Extract hashtags from popular video descriptions + keep raw items for engagement
      for (const v of (items as Record<string, unknown>[]).slice(0, 20)) {
        rawVideos.push(v)
        const desc = (v.desc ?? v.description ?? v.text ?? "") as string
        const tags = desc.match(/#[\w\u00C0-\u024F]+/g) ?? []
        for (const t of tags) {
          entities.push(buildEntity(t, "hashtag", null, null, null))
        }
      }
    }

    if (entities.length === 0) return null
    return { entities: dedupeEntities(entities), source: "scrape_creators_tiktok", confidence: "high", rawVideos }
  } catch (err) {
    console.log("[trend-capture] scrape_creators tiktok failed:", (err as Error).message)
    return null
  }
}

async function captureScrapeCreatorsTikTokByTopic(topic: string, region: string): Promise<{ entities: TrendEntity[]; source: string; confidence: SourceConfidence } | null> {
  const apiKey = process.env.SCRAPECREATORS_API_KEY
  if (!apiKey || !topic) return null
  const BASE = "https://api.scrapecreators.com"
  const headers = { "x-api-key": apiKey }
  try {
    const [keywordRes, hashtagRes] = await Promise.all([
      fetch(`${BASE}/v1/tiktok/search/keyword?keyword=${encodeURIComponent(topic)}&count=15&region=${region}`, { headers, signal: AbortSignal.timeout(12000) }),
      fetch(`${BASE}/v1/tiktok/search/hashtag?keyword=${encodeURIComponent(topic.replace(/\s+/g, ""))}&count=15&region=${region}`, { headers, signal: AbortSignal.timeout(12000) }),
    ])
    const entities: TrendEntity[] = []
    if (keywordRes.ok) {
      const data = await keywordRes.json()
      const items = Array.isArray(data) ? data : (data?.data ?? data?.items ?? data?.videos ?? [])
      for (const v of (items as Record<string, unknown>[]).slice(0, 15)) {
        const desc = (v.desc ?? v.description ?? v.text ?? v.caption ?? "") as string
        for (const t of (desc.match(/#[\w\u00C0-\u024F]+/g) ?? [])) {
          entities.push(buildEntity(t, "hashtag", null, null, null))
        }
      }
    }
    if (hashtagRes.ok) {
      const data = await hashtagRes.json()
      const items = Array.isArray(data) ? data : (data?.data ?? data?.items ?? data?.challengeList ?? [])
      for (const [i, h] of (items as Record<string, unknown>[]).slice(0, 15).entries()) {
        const tag = (h.hashtag_name ?? h.name ?? h.hashtag ?? h.title ?? h.challengeName ?? "") as string
        const views = (h.video_views ?? h.viewCount ?? h.views) as number | undefined
        if (tag) entities.push(buildEntity(tag, "hashtag", i + 1, i + 1, views ?? null, { viewCount: views ?? null }))
      }
    }
    if (entities.length === 0) return null
    return { entities: dedupeEntities(entities), source: "scrape_creators_tiktok", confidence: "high" }
  } catch { return null }
}

async function captureApify(topic: string, platform: TrendPlatform, region: string): Promise<{ entities: TrendEntity[]; source: string; confidence: SourceConfidence } | null> {
  const apiKey = process.env.APIFY_API_KEY
  if (!apiKey) return null
  const actorMap: Record<string, string> = { instagram: "apify~instagram-hashtag-scraper", tiktok: "clockworks~tiktok-scraper", youtube: "bernardo~youtube-scraper" }
  const actorId = actorMap[platform]
  if (!actorId) return null
  try {
    const res = await fetch(`https://api.apify.com/v2/acts/${actorId}/runs?token=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hashtags: [topic.replace(/\s+/g, "")], resultsLimit: 15, country: region }),
      signal: AbortSignal.timeout(30000),
    })
    if (!res.ok) return null
    const run = await res.json()
    const runId = run?.data?.id
    const datasetId = run?.data?.defaultDatasetId
    if (!runId || !datasetId) return null

    // Poll for run completion (Apify runs are async)
    const pollDeadline = Date.now() + 30000
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

    const itemsRes = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?token=${apiKey}&limit=25`, { signal: AbortSignal.timeout(10000) })
    if (!itemsRes.ok) return null
    const items = await itemsRes.json()
    const entities: TrendEntity[] = []
    for (const item of (items as Record<string, unknown>[]).slice(0, 25)) {
      const text = (item.caption ?? item.text ?? item.description ?? "") as string
      for (const t of (text.match(/#[\w\u00C0-\u024F]+/g) ?? [])) {
        entities.push(buildEntity(t, "hashtag", null, null, null))
      }
    }
    if (entities.length === 0) return null
    return { entities: dedupeEntities(entities), source: "apify_live_scrape", confidence: "medium" }
  } catch { return null }
}

async function captureXpoz(topic: string, platform: TrendPlatform, regionLabel: string): Promise<{ entities: TrendEntity[]; source: string; confidence: SourceConfidence } | null> {
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
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: toolName, arguments: { query: `${topic} ${regionLabel}`, count: 15 } } }),
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
    const entities: TrendEntity[] = []
    for (const p of (items as Record<string, unknown>[]).slice(0, 15)) {
      const text = (p.text ?? p.caption ?? p.description ?? "") as string
      for (const t of (text.match(/#[\w\u00C0-\u024F]+/g) ?? [])) {
        entities.push(buildEntity(t, "hashtag", null, null, null))
      }
    }
    if (entities.length === 0) return null
    return { entities: dedupeEntities(entities), source: "xpoz_social_signal", confidence: "medium" }
  } catch { return null }
}

async function captureScrapeCreatorsInstagram(topic: string, region: string): Promise<{ entities: TrendEntity[]; source: string; confidence: SourceConfidence } | null> {
  const apiKey = process.env.SCRAPECREATORS_API_KEY
  if (!apiKey || !topic) return null
  try {
    const res = await fetch(`https://api.scrapecreators.com/v2/instagram/reels/search?keyword=${encodeURIComponent(topic)}&region=${region}`, {
      headers: { "x-api-key": apiKey },
      signal: AbortSignal.timeout(12000),
    })
    if (!res.ok) return null
    const data = await res.json()
    const items = Array.isArray(data) ? data : (data?.data ?? data?.reels ?? data?.items ?? [])
    const entities: TrendEntity[] = []
    for (const r of (items as Record<string, unknown>[]).slice(0, 15)) {
      const caption = (r.caption ?? r.text ?? "") as string
      for (const t of (caption.match(/#[\w\u00C0-\u024F]+/g) ?? [])) {
        entities.push(buildEntity(t, "hashtag", null, null, null))
      }
    }
    if (entities.length === 0) return null
    return { entities: dedupeEntities(entities), source: "scrape_creators_instagram_support", confidence: "medium" }
  } catch { return null }
}

async function capturePerplexityFallback(topic: string, platform: TrendPlatform, regionLabel: string): Promise<{ entities: TrendEntity[]; source: string; confidence: SourceConfidence } | null> {
  const apiKey = process.env.PERPLEXITY_API_KEY
  if (!apiKey) return null
  try {
    const res = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "sonar",
        messages: [{ role: "user", content: `What are the current trending hashtags and content themes on ${platform} related to "${topic}" in ${regionLabel}? List specific hashtags. Be concise.` }],
        search_recency_filter: "week",
        max_tokens: 400,
      }),
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) return null
    const data = await res.json()
    const text = (data?.choices?.[0]?.message?.content ?? "") as string
    if (!text) return null
    const tagMatches = text.match(/#[\w\u00C0-\u024F]+/g) ?? []
    if (tagMatches.length === 0) return null
    const entities: TrendEntity[] = []
    for (const [i, t] of [...new Set(tagMatches)].slice(0, 15).entries()) {
      entities.push(buildEntity(t, "hashtag", i + 1, null, null))
    }
    return { entities: dedupeEntities(entities), source: "context_guided", confidence: "low" }
  } catch { return null }
}

const REGION_LABELS: Record<string, string> = {
  AE: "the UAE",
  SA: "Saudi Arabia",
  KW: "Kuwait",
  QA: "Qatar",
  US: "the United States",
}

// ── Main capture orchestrator (inference-last, Perplexity fallback) ──

export async function captureTrends(
  platform: TrendPlatform,
  scope: TrendScope,
  niche: string | null,
  region: string = "AE"
): Promise<TrendSnapshot> {
  const topic = scope === "platform_wide" ? "trending" : (niche ?? "trending")
  const regionLabel = REGION_LABELS[region] || region
  let entities: TrendEntity[] = []
  let source = "none"
  let confidence: SourceConfidence = "low"

  let rawVideosForEngagement: Record<string, unknown>[] = []

  // ── Platform-wide: ScrapeCreators → Apify → xpoz → Perplexity ──
  if (scope === "platform_wide") {
    if (platform === "tiktok") {
      const sc = await captureScrapeCreatorsTikTok(region)
      if (sc) { entities = sc.entities; source = sc.source; confidence = sc.confidence; rawVideosForEngagement = sc.rawVideos }
    }
    if (entities.length === 0) {
      const apify = await captureApify("trending", platform, region)
      if (apify) { entities = apify.entities; source = apify.source; confidence = apify.confidence }
    }
    if (entities.length === 0) {
      const xpoz = await captureXpoz("trending", platform, regionLabel)
      if (xpoz) { entities = xpoz.entities; source = xpoz.source; confidence = xpoz.confidence }
    }
    if (entities.length === 0) {
      const pplx = await capturePerplexityFallback("trending", platform, regionLabel)
      if (pplx) { entities = pplx.entities; source = pplx.source; confidence = pplx.confidence }
    }
  }

  // ── Topic-aligned: ScrapeCreators(topic) → Apify → xpoz → Perplexity ──
  if (scope === "topic_aligned" && niche) {
    if (platform === "tiktok") {
      const sc = await captureScrapeCreatorsTikTokByTopic(niche, region)
      if (sc) { entities = sc.entities; source = sc.source; confidence = sc.confidence }
    }
    if (platform === "instagram" && entities.length === 0) {
      const sc = await captureScrapeCreatorsInstagram(niche, region)
      if (sc) { entities = sc.entities; source = sc.source; confidence = sc.confidence }
    }
    if (entities.length === 0) {
      const apify = await captureApify(topic, platform, region)
      if (apify) { entities = apify.entities; source = apify.source; confidence = apify.confidence }
    }
    if (entities.length === 0) {
      const xpoz = await captureXpoz(topic, platform, regionLabel)
      if (xpoz) { entities = xpoz.entities; source = xpoz.source; confidence = xpoz.confidence }
    }
    if (entities.length === 0) {
      const pplx = await capturePerplexityFallback(topic, platform, regionLabel)
      if (pplx) { entities = pplx.entities; source = pplx.source; confidence = pplx.confidence }
    }
  }

  // Assign final ranks by deduped order
  const deduped = dedupeEntities(entities)
  for (const [i, e] of deduped.entries()) {
    if (e.rank === null) e.rank = i + 1
  }

  const snapshot: TrendSnapshot = {
    id: snapId(platform, scope),
    platform,
    scope,
    region,
    capturedAt: new Date().toISOString(),
    source,
    sourceConfidence: confidence,
    niche,
    entityCount: deduped.length,
    entities: deduped,
  }

  // Write to Firestore (primary)
  const db = getDb()
  await db.collection(SNAPSHOTS_COLLECTION).doc(snapshot.id).set(snapshot)
  console.log(`[trend-capture] stored ${deduped.length} entities for ${platform}/${scope}${niche ? `/${niche}` : ""}`)

  // Write-through to InfluxDB Cloud (optional, non-blocking)
  writeSnapshotToInflux(snapshot).catch(() => { /* never fail the main flow */ })

  // ── Persist engagement data for prediction baselines (additive, non-blocking) ──
  if (rawVideosForEngagement.length > 0) {
    try {
      const now = new Date().toISOString()
      const validRegions = ["AE", "SA", "KW", "QA", "US", "SG", "IN"]
      const regionForSample = (validRegions.includes(region) ? region : "AE") as Region
      const platformForSample = platform as Platform

      const samples: RegionalEngagementSample[] = []
      for (const v of rawVideosForEngagement) {
        const postId = (v.id ?? v.video_id ?? v.aweme_id ?? "") as string
        if (!postId) continue
        const stats = (v.stats ?? {}) as Record<string, unknown>
        const views = (v.play_count ?? v.videoViews ?? v.playCount ?? stats.playCount ?? 0) as number
        if (views <= 0) continue
        const likes = (v.digg_count ?? v.likeCount ?? v.likes ?? stats.diggCount ?? 0) as number
        const comments = (v.comment_count ?? v.commentCount ?? v.comments ?? stats.commentCount ?? 0) as number
        const shares = (v.share_count ?? v.shareCount ?? v.shares ?? stats.shareCount ?? 0) as number
        const desc = (v.desc ?? v.description ?? v.text ?? "") as string
        const hashtags: string[] = desc.match(/#[\w\u00C0-\u024F]+/g) ?? []
        const musicObj = (v.music_info ?? v.music ?? {}) as Record<string, unknown>
        const musicTitle = (musicObj.title ?? "") as string

        samples.push({
          sampleId: `sc_${platformForSample}_${postId}_${Date.now()}`,
          postId,
          platform: platformForSample,
          region: regionForSample,
          caption: desc.slice(0, 500),
          hashtags,
          audioType: musicTitle ? "trending" : "original",
          format: "video",
          views,
          likes,
          comments,
          shares,
          engagementRate: (likes + comments + shares) / views,
          capturedAt: now,
          publishedAt: v.create_time ? new Date((v.create_time as number) * 1000).toISOString() : now,
          source: "scrape_creators",
        })
      }

      if (samples.length > 0) {
        await saveRegionalEngagementSamples(samples)
        console.log(`[trend-capture] persisted ${samples.length} engagement samples for ${platform}/${region}`)
      }

      // Cleanup old samples (non-blocking)
      deleteOldRegionalEngagementSamples(90).catch(() => {})
    } catch (engErr) {
      console.log("[trend-capture] engagement sample persistence failed (non-blocking):", (engErr as Error).message)
    }
  }

  return snapshot
}

/** Get recent snapshots for a platform, ordered by capturedAt desc */
export async function getRecentSnapshots(
  platform: TrendPlatform,
  scope: TrendScope,
  niche: string | null,
  limit = 30
): Promise<TrendSnapshot[]> {
  const db = getDb()
  try {
    let query = db.collection(SNAPSHOTS_COLLECTION)
      .where("platform", "==", platform)
      .where("scope", "==", scope)
      .orderBy("capturedAt", "desc")
      .limit(limit)

    if (niche) {
      query = db.collection(SNAPSHOTS_COLLECTION)
        .where("platform", "==", platform)
        .where("scope", "==", scope)
        .where("niche", "==", niche)
        .orderBy("capturedAt", "desc")
        .limit(limit)
    }

    const snap = await query.get()
    console.log(`[trend-radar] fetched ${snap.docs.length} snapshots for ${platform}/${scope}${niche ? `/${niche}` : ""}`)
    return snap.docs.map((d) => d.data() as TrendSnapshot)
  } catch (err) {
    const msg = (err as Error).message ?? ""
    if (msg.includes("requires an index")) {
      console.error(`[trend-radar] Firestore index missing for ${platform}/${scope}. Create it: ${msg.match(/https:\/\/[^\s"]+/)?.[0] ?? "see Firestore console"}`)
      // Fall back to unordered query without orderBy (works without composite index)
      try {
        const fallback = await db.collection(SNAPSHOTS_COLLECTION)
          .where("platform", "==", platform)
          .where("scope", "==", scope)
          .limit(limit)
          .get()
        const docs = fallback.docs.map((d) => d.data() as TrendSnapshot)
        docs.sort((a, b) => b.capturedAt.localeCompare(a.capturedAt))
        console.log(`[trend-radar] fallback query returned ${docs.length} snapshots (unordered)`)
        return docs
      } catch {
        console.error("[trend-radar] fallback query also failed")
        return []
      }
    }
    console.error("[trend-radar] getRecentSnapshots failed:", msg)
    return []
  }
}
