import { NextResponse } from "next/server"
import { saveDNASample, loadContentProfile, saveContentProfile, mergeProfileWithSample } from "@/lib/firestore/contentProfile"
import type { ContentDNASample } from "@/lib/firestore/contentProfile"

export const runtime = "nodejs"

export async function POST(req: Request): Promise<NextResponse> {
  try {
    const { uid, dna, platform } = await req.json()
    if (!uid || !dna) return NextResponse.json({ error: "Missing uid or dna" }, { status: 400 })

    const sample: ContentDNASample = {
      sourceType: "upload",
      platform: platform || "tiktok",
      transcript: "",
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
    await saveContentProfile(uid, updated)

    console.log("[CONTENT-DNA] Saved for", uid, "samples:", updated.sampleCount, "confidence:", updated.confidence)

    return NextResponse.json({ success: true, profile: updated })
  } catch (err) {
    console.error("[CONTENT-DNA] Save error:", err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
