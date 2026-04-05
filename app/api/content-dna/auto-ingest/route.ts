import { NextResponse } from "next/server"
import { fetchAllPostHistory } from "@/lib/ayrshare"
import { extractContentDNA } from "@/lib/profile/extractContentDNA"
import { saveDNASample, loadContentProfile, saveContentProfile, mergeProfileWithSample } from "@/lib/firestore/contentProfile"

export const runtime = "nodejs"
export const maxDuration = 60

export async function POST(req: Request): Promise<NextResponse> {
  try {
    const { uid } = await req.json()
    if (!uid) return NextResponse.json({ error: "Missing uid" }, { status: 400 })

    console.log("[AUTO-INGEST] Starting for uid:", uid)

    const posts = await fetchAllPostHistory()
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
