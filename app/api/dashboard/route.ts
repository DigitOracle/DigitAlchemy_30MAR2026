import { NextRequest, NextResponse } from "next/server"
import { fetchPostHistory, fetchAllPostHistory } from "@/lib/ayrshare"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(req: NextRequest): Promise<NextResponse> {
  const platformFilter = req.nextUrl.searchParams.get("platform") || "all"
  const rangeFilter = parseInt(req.nextUrl.searchParams.get("range") || "30", 10) || 30

  let posts = platformFilter === "all"
    ? await fetchAllPostHistory()
    : await fetchPostHistory(platformFilter)

  // Date range filter
  const cutoff = new Date(Date.now() - rangeFilter * 24 * 60 * 60 * 1000)
  posts = posts.filter(p => {
    if (!p.publishedAt) return true
    return new Date(p.publishedAt) >= cutoff
  })

  if (posts.length === 0) {
    return NextResponse.json({ posts: 0, stats: null, timeline: [], topPosts: [] })
  }

  const totalPosts = posts.length
  const totalViews = posts.reduce((sum, p) => sum + (p.views || 0), 0)
  const totalLikes = posts.reduce((sum, p) => sum + (p.likes || 0), 0)
  const totalComments = posts.reduce((sum, p) => sum + (p.comments || 0), 0)
  const totalShares = posts.reduce((sum, p) => sum + (p.shares || 0), 0)
  const totalEngagement = totalLikes + totalComments + totalShares

  const tiktokPosts = posts.filter(p => p.platform === "tiktok")
  const avgCompletion = tiktokPosts.length > 0
    ? tiktokPosts.reduce((sum, p) => sum + (p.completionRate || 0), 0) / tiktokPosts.length
    : 0

  const timeline = posts
    .filter(p => p.publishedAt)
    .sort((a, b) => new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime())
    .map(p => ({
      date: p.publishedAt.split("T")[0],
      platform: p.platform,
      engagement: (p.likes || 0) + (p.comments || 0) + (p.shares || 0),
      views: p.views || 0,
      text: (p.text || "").slice(0, 80),
    }))

  const topPosts = [...posts]
    .map(p => ({
      platform: p.platform,
      text: (p.text || "").slice(0, 100),
      views: p.views || 0,
      likes: p.likes || 0,
      comments: p.comments || 0,
      shares: p.shares || 0,
      engagement: (p.likes || 0) + (p.comments || 0) + (p.shares || 0),
      date: p.publishedAt?.split("T")[0] || "",
      postUrl: p.postUrl || "",
      thumbnailUrl: p.thumbnailUrl || "",
    }))
    .sort((a, b) => b.engagement - a.engagement)
    .slice(0, 8)

  return NextResponse.json({
    posts: totalPosts,
    stats: { totalPosts, totalViews, totalLikes, totalComments, totalShares, totalEngagement, avgCompletion },
    timeline,
    topPosts,
    filters: { platform: platformFilter, range: rangeFilter },
  })
}
