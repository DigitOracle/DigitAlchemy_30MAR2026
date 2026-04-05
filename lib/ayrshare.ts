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

export async function fetchPostHistory(platform: string): Promise<AyrsharePost[]> {
  const apiKey = process.env.AYRSHARE_API_KEY
  if (!apiKey) { console.log("[AYRSHARE] No AYRSHARE_API_KEY"); return [] }

  try {
    const res = await fetch(`https://app.ayrshare.com/api/history/${platform}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
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

    return posts.map((p: Record<string, unknown>) => normalizePost(p, platform)).filter((p): p is AyrsharePost => p !== null)
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

  return {
    platform,
    text: (p.post || p.title || "") as string,
    hashtags: [],
    publishedAt: (p.publishedAt || p.created || "") as string,
    postUrl: (p.postUrl || "") as string,
  }
}

export async function fetchAllPostHistory(): Promise<AyrsharePost[]> {
  const platforms = ["tiktok", "linkedin", "youtube"]
  const results = await Promise.allSettled(platforms.map(p => fetchPostHistory(p)))
  const allPosts: AyrsharePost[] = []
  for (const r of results) {
    if (r.status === "fulfilled") allPosts.push(...r.value)
  }
  console.log("[AYRSHARE] Total posts fetched:", allPosts.length)
  return allPosts
}
