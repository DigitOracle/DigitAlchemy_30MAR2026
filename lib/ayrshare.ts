export interface AyrsharePost {
  platform: string
  text: string
  hashtags: string[]
  musicTitle?: string
  views?: number
  likes?: number
  comments?: number
  shares?: number
  watchTime?: number
  completionRate?: number
  duration?: number
  publishedAt: string
  postUrl?: string
  thumbnailUrl?: string
}

export interface AyrshareOpts {
  apiKey?: string
  profileKey?: string
}

export async function fetchPostHistory(platform: string, opts?: AyrshareOpts): Promise<AyrsharePost[]> {
  const apiKey = opts?.apiKey
  if (!apiKey) { console.log("[AYRSHARE] No API key — caller must provide via getAyrshareConfig"); return [] }

  const headers: Record<string, string> = { Authorization: `Bearer ${apiKey}` }
  if (opts?.profileKey) headers["Profile-Key"] = opts.profileKey

  try {
    const res = await fetch(`https://app.ayrshare.com/api/history/${platform}?limit=500&lastDays=365`, {
      headers,
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) { console.log("[AYRSHARE]", platform, "status:", res.status); return [] }
    const data = await res.json()

    if (data?.code || data?.status === "error") {
      console.log("[AYRSHARE]", platform, "error:", data.message?.slice(0, 100))
      return []
    }

    const posts = Array.isArray(data) ? data : (data?.history || data?.posts || data?.data || [])
    if (!Array.isArray(posts)) return []

    const normalized = posts.map((p: Record<string, unknown>) => normalizePost(p, platform)).filter((p): p is AyrsharePost => p !== null)
    // Enrich YouTube with real engagement data from Data API
    if (platform === "youtube") return enrichYouTubeWithDataAPI(normalized)
    return normalized
  } catch (e) {
    console.log("[AYRSHARE]", platform, "fetch error:", e)
    return []
  }
}

function normalizePost(p: Record<string, unknown>, platform: string): AyrsharePost | null {
  if (!p) return null

  if (platform === "tiktok") {
    const text = (p.post || p.name || "") as string
    return {
      platform: "tiktok",
      text,
      hashtags: (p.tags as string[]) || text.match(/#[\w\u00C0-\u024F]+/g) || [],
      musicTitle: (p.musicTitle as string) || undefined,
      views: (p.videoViews as number) || 0,
      likes: (p.likeCount as number) || 0,
      comments: (p.commentsCount as number) || 0,
      shares: (p.shareCount as number) || 0,
      watchTime: (p.averageTimeWatched as number) || 0,
      completionRate: (p.fullVideoWatchedRate as number) || 0,
      duration: (p.videoDuration as number) || 0,
      publishedAt: (p.publishedAt || p.created || "") as string,
      postUrl: (p.shareUrl || p.postUrl || "") as string,
      thumbnailUrl: (p.thumbnailUrl || "") as string,
    }
  }

  if (platform === "linkedin") {
    const text = (p.post || "") as string
    return {
      platform: "linkedin",
      text,
      hashtags: text.match(/#\w+/g) || [],
      likes: (p.likeCount as number) || 0,
      comments: (p.commentCount as number) || 0,
      publishedAt: (p.publishedAt || p.created || "") as string,
      postUrl: (p.postUrl || "") as string,
    }
  }

  if (platform === "youtube") {
    const title = (p.title || p.post || "") as string
    return {
      platform: "youtube",
      text: title,
      hashtags: title.match(/#\w+/g) || [],
      publishedAt: (p.published || p.created || "") as string,
      postUrl: (p.postUrl || "") as string,
      thumbnailUrl: (p.thumbnailUrl || "") as string,
    }
  }

  if (platform === "instagram") {
    const text = (p.caption || p.post || "") as string
    return {
      platform: "instagram",
      text,
      hashtags: text.match(/#[\w\u00C0-\u024F]+/g) || [],
      likes: (p.likeCount as number) || (p.likes as number) || 0,
      comments: (p.commentCount as number) || (p.comments as number) || 0,
      publishedAt: (p.publishedAt || p.created || "") as string,
      postUrl: (p.postUrl || p.permalink || "") as string,
      thumbnailUrl: (p.thumbnailUrl || p.mediaUrl || "") as string,
    }
  }

  return {
    platform,
    text: (p.post || p.title || "") as string,
    hashtags: [],
    publishedAt: (p.publishedAt || p.created || "") as string,
    postUrl: (p.postUrl || "") as string,
  }
}

// Enrich YouTube posts with real metrics from YouTube Data API v3
async function enrichYouTubeWithDataAPI(posts: AyrsharePost[]): Promise<AyrsharePost[]> {
  const apiKey = process.env.YOUTUBE_API_KEY
  if (!apiKey || posts.length === 0) return posts

  const idMap = new Map<string, number>()
  for (let i = 0; i < posts.length; i++) {
    const match = posts[i].postUrl?.match(/[?&]v=([^&]+)/) || posts[i].postUrl?.match(/youtu\.be\/([^?]+)/)
    if (match) idMap.set(match[1], i)
  }
  if (idMap.size === 0) return posts

  try {
    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${[...idMap.keys()].join(",")}&key=${apiKey}`,
      { signal: AbortSignal.timeout(10000) },
    )
    if (!res.ok) return posts
    const data = await res.json()
    const enriched = [...posts]
    for (const item of (data.items || []) as { id: string; statistics: Record<string, string> }[]) {
      const idx = idMap.get(item.id)
      if (idx !== undefined) {
        enriched[idx] = {
          ...enriched[idx],
          views: parseInt(item.statistics.viewCount || "0", 10),
          likes: parseInt(item.statistics.likeCount || "0", 10),
          comments: parseInt(item.statistics.commentCount || "0", 10),
        }
      }
    }
    console.log("[AYRSHARE] YouTube enriched", idMap.size, "videos with Data API stats")
    return enriched
  } catch (e) {
    console.log("[AYRSHARE] YouTube Data API enrichment error:", e)
    return posts
  }
}

export async function fetchAllPostHistory(opts?: AyrshareOpts): Promise<AyrsharePost[]> {
  const platforms = ["tiktok", "instagram", "linkedin", "youtube"]
  const results = await Promise.allSettled(platforms.map(p => fetchPostHistory(p, opts)))
  const allPosts: AyrsharePost[] = []
  for (const r of results) {
    if (r.status === "fulfilled") allPosts.push(...r.value)
  }
  console.log("[AYRSHARE] Total posts fetched:", allPosts.length)
  return allPosts
}
