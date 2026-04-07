import { NextResponse } from "next/server"
import { fetchAllPostHistory } from "@/lib/ayrshare"
import { getAyrshareConfig } from "@/lib/firestore/integrations"
import { extractContentDNA } from "@/lib/profile/extractContentDNA"
import { saveDNASample, loadContentProfile, saveContentProfile, mergeProfileWithSample } from "@/lib/firestore/contentProfile"
import { getAuth } from "firebase-admin/auth"
import { getDb } from "@/lib/jobStore"

export const runtime = "nodejs"
export const maxDuration = 60

export async function POST(req: Request): Promise<NextResponse> {
  try {
    // Ensure Firebase Admin is initialized before verifyIdToken
    getDb()

    const body = await req.json()
    const { uid } = body
    if (!uid) return NextResponse.json({ error: "Missing uid" }, { status: 400 })

    // Require Firebase Auth — mandatory, not optional
    const authHeader = req.headers.get("authorization")
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 })
    }
    try {
      const token = await getAuth().verifyIdToken(authHeader.slice(7))
      if (token.uid !== uid) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
    } catch {
      return NextResponse.json({ error: "Invalid auth token" }, { status: 401 })
    }

    console.log("[AUTO-INGEST] Starting for uid:", uid)

    // Resolve Ayrshare credentials for this user
    const ayrConfig = await getAyrshareConfig(uid)
    if (!ayrConfig) {
      return NextResponse.json({ error: "No social accounts connected. Link your accounts first.", status: "not_connected" })
    }

    const posts = await fetchAllPostHistory({ apiKey: ayrConfig.apiKey, profileKey: ayrConfig.profileKey })
    console.log("[AUTO-INGEST] Fetched", posts.length, "posts across all platforms")

    if (posts.length === 0) {
      return NextResponse.json({ error: "No posts found on linked accounts", posts: 0 })
    }

    // Build combined text for Claude analysis
    const combinedText = posts.map((p, i) => {
      const parts = [`[${p.platform.toUpperCase()} Post ${i + 1}]`]
      if (p.text) parts.push(`Text: ${p.text}`)
      if (p.hashtags.length) parts.push(`Hashtags: ${p.hashtags.join(", ")}`)
      if (p.musicTitle) parts.push(`Music: ${p.musicTitle}`)
      if (p.views) parts.push(`Views: ${p.views}`)
      if (p.likes) parts.push(`Likes: ${p.likes}`)
      if (p.watchTime) parts.push(`Avg watch time: ${p.watchTime}s`)
      if (p.completionRate) parts.push(`Completion rate: ${(p.completionRate * 100).toFixed(0)}%`)
      return parts.join("\n")
    }).join("\n\n")

    const dna = await extractContentDNA(
      combinedText,
      "multi-platform",
      { title: `${posts.length} posts from TikTok, LinkedIn, YouTube` },
    )

    if (!dna) {
      return NextResponse.json({ error: "DNA extraction failed" }, { status: 500 })
    }

    const sample = {
      sourceType: "ayrshare" as const,
      platform: "multi-platform",
      transcript: combinedText.slice(0, 500),
      topics: dna.topics || [],
      tone: dna.tone || "",
      visualStyle: dna.visualStyle || "",
      audioPreference: dna.audioPreference || "",
      captionStyle: dna.captionStyle || "",
      hashtags: dna.hashtags || [],
      duration: 0,
      analyzedAt: new Date().toISOString(),
    }

    await saveDNASample(uid, sample)

    const existing = await loadContentProfile(uid)
    const updated = mergeProfileWithSample(existing, sample)
    // Reflect actual posts analyzed in confidence
    updated.sampleCount = Math.max(updated.sampleCount, posts.length)
    updated.confidence = posts.length >= 6 ? "high" : posts.length >= 3 ? "medium" : "low"
    await saveContentProfile(uid, updated)

    console.log("[AUTO-INGEST] Profile updated. Posts:", posts.length, "Confidence:", updated.confidence)

    return NextResponse.json({
      success: true,
      postsAnalyzed: posts.length,
      platforms: [...new Set(posts.map(p => p.platform))],
      dna,
      confidence: updated.confidence,
    })
  } catch (err) {
    console.error("[AUTO-INGEST] Error:", err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
