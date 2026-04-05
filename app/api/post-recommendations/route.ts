import { NextRequest, NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import { loadContentProfile } from "@/lib/firestore/contentProfile"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const REGION_LABELS: Record<string, string> = {
  AE: "UAE", SA: "Saudi Arabia", KW: "Kuwait", QA: "Qatar", US: "United States", SG: "Singapore",
}

interface PostRec {
  topic: string
  caption: string
  hashtags: string
  audio: string
  best_time: string
  format: string
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const region = req.nextUrl.searchParams.get("region") || "AE"
  const platform = req.nextUrl.searchParams.get("platform") || "tiktok"
  const uid = req.nextUrl.searchParams.get("uid") || null
  const regionLabel = REGION_LABELS[region] || "UAE"

  // Load Content DNA profile for personalisation
  let profileContext = ""
  if (uid) {
    try {
      const profile = await loadContentProfile(uid)
      if (profile && profile.confidence !== "low") {
        profileContext = `\nCREATOR CONTENT PROFILE (personalise recommendations to match this style):
- Topics they usually cover: ${profile.topics.join(", ")}
- Their tone: ${profile.tone}
- Their visual style: ${profile.visualStyle}
- Their audio preference: ${profile.audioPreference}
- Their caption style: ${profile.captionStyle}
- Their usual hashtags: ${profile.hashtagPatterns.join(", ")}
- Profile confidence: ${profile.confidence} (based on ${profile.sampleCount} videos analyzed)

IMPORTANT: Recommendations should feel like natural extensions of this creator's existing content, not generic advice.\n`
      }
    } catch { /* profile not available — use generic recs */ }
  }

  // Fetch trending data to ground recommendations
  const base = `${req.nextUrl.protocol}//${req.nextUrl.host}`
  const [tickerRes, audioRes] = await Promise.allSettled([
    fetch(`${base}/api/trend-ticker?region=${region}`, { signal: AbortSignal.timeout(10000) }).then(r => r.json()),
    fetch(`${base}/api/trending-audio?region=${region}`, { signal: AbortSignal.timeout(10000) }).then(r => r.json()),
  ])

  const ticker = tickerRes.status === "fulfilled" ? tickerRes.value : {}
  const audio = audioRes.status === "fulfilled" ? audioRes.value : {}

  const tiktokTags = ((ticker.tiktok || []) as string[]).join(", ")
  const instagramTags = ((ticker.instagram || []) as string[]).join(", ")
  const trendingSounds = ((audio.sounds || []) as { title: string; author: string }[]).map(s => `${s.title} by ${s.author}`).join(", ")

  const today = new Date()
  const dayName = today.toLocaleDateString("en-US", { weekday: "long" })
  const dateFmt = today.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
  const timeNow = today.getHours()

  const postingTimes: Record<string, string> = {
    tiktok: timeNow < 12 ? "7-9 PM tonight" : "9-11 PM tonight",
    instagram: timeNow < 12 ? "12-2 PM today" : "7-9 PM tonight",
    youtube: "2-4 PM today or 6-8 PM tonight",
  }

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      messages: [{
        role: "user",
        content: `You are a social media content strategist. Today is ${dayName}, ${dateFmt}. Region: ${regionLabel}. Platform: ${platform}.

Trending hashtags on TikTok: ${tiktokTags || "none available"}
Trending hashtags on Instagram: ${instagramTags || "none available"}
Trending sounds: ${trendingSounds || "none available"}
${profileContext}
Suggested posting time: ${postingTimes[platform] || "today"}

Generate exactly 3 quick post recommendations for ${platform} in ${regionLabel}. Each must be immediately actionable — a social media manager should be able to copy and post within 5 minutes.

Return ONLY this exact format for each, no other text:

---POST---
TOPIC: [one line — what to post about, grounded in the trending data]
CAPTION: [ready-to-copy caption, appropriate length for ${platform}, include emojis where natural, max 150 chars for TikTok, max 200 for Instagram, max 100 for YouTube]
HASHTAGS: [exactly 5 hashtags from the trending data, space separated, each starting with #]
AUDIO: [specific trending sound name if TikTok/Instagram, or "Original audio" if YouTube/none fits]
BEST_TIME: [when to post today]
FORMAT: [one word: Reel / Carousel / Story / Short / Video / Post]
---END---

RULES:
- Use REAL hashtags from the trending data, not generic ones
- Captions must feel human, not corporate
- Each recommendation should be a DIFFERENT topic/angle
- Audio must be from the trending sounds list if available
- Keep it simple — this is a quick brief, not a strategy document`,
      }],
    })

    const text = response.content[0].type === "text" ? response.content[0].text : ""

    const posts: PostRec[] = text.split("---POST---").filter(Boolean).map(block => {
      const clean = block.replace("---END---", "").trim()
      const fields: Record<string, string> = {}
      for (const line of clean.split("\n")) {
        const match = line.match(/^(TOPIC|CAPTION|HASHTAGS|AUDIO|BEST_TIME|FORMAT):\s*(.+)/)
        if (match) fields[match[1].toLowerCase()] = match[2].trim()
      }
      return fields as unknown as PostRec
    }).filter(p => p.topic && p.caption)

    return NextResponse.json({ posts: posts.slice(0, 3), platform, region, regionLabel })
  } catch (err) {
    console.log("[POST-RECS] Error:", err)
    return NextResponse.json({ posts: [], platform, region, regionLabel })
  }
}
