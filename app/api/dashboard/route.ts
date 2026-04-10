import { NextRequest, NextResponse } from "next/server"
import { fetchPostHistory, fetchAllPostHistory } from "@/lib/ayrshare"
import { getAyrshareConfig } from "@/lib/firestore/integrations"
import { getAuth } from "firebase-admin/auth"
import { getDb } from "@/lib/jobStore"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(req: NextRequest): Promise<NextResponse> {
  const platformFilter = req.nextUrl.searchParams.get("platform") || "all"
  const rangeFilter = parseInt(req.nextUrl.searchParams.get("range") || "30", 10) || 30
  const uid = req.nextUrl.searchParams.get("uid")

  if (!uid) {
    return NextResponse.json({ error: "uid required" }, { status: 400 })
  }

  // Initialize Firebase Admin + require Bearer auth
  getDb()
  const authHeader = req.headers.get("authorization")
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 })
  }
  try {
    const token = await getAuth().verifyIdToken(authHeader.slice(7))
    if (token.uid !== uid) {
      // Allow admin override
      const db = getDb()
      const callerSnap = await db.doc(`users/${token.uid}`).get()
      const callerRole = (callerSnap.data() as { role?: string } | undefined)?.role
      if (callerRole !== "admin") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
    }
  } catch {
    return NextResponse.json({ error: "Invalid auth token" }, { status: 401 })
  }

  // Resolve Ayrshare credentials for this user
  const ayrConfig = await getAyrshareConfig(uid)
  if (!ayrConfig) {
    return NextResponse.json({ posts: 0, stats: null, timeline: [], topPosts: [], status: "not_connected" })
  }
  const opts = { apiKey: ayrConfig.apiKey, profileKey: ayrConfig.profileKey }

  let posts = platformFilter === "all"
    ? await fetchAllPostHistory(opts)
    : await fetchPostHistory(platformFilter, opts)

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
