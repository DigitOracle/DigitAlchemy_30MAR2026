// GET /api/trend-radar/scores — Return scored + classified trends for a platform
import { NextRequest, NextResponse } from "next/server"
import { getRecentSnapshots } from "@/lib/trendRadar/capture"
import { computeScores } from "@/lib/trendRadar/score"
import { classifyAndSort } from "@/lib/trendRadar/classify"
import type { ScoresResponse, TrendPlatform, ProductionLag } from "@/lib/trendRadar/types"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const VALID_PLATFORMS = new Set(["tiktok", "instagram", "youtube", "linkedin", "x", "facebook"])
const VALID_LAGS = new Set(["same_day", "24h", "48h", "72h", "1w", "2w", "4w"])

export async function GET(req: NextRequest): Promise<NextResponse<ScoresResponse | { error: string }>> {
  try {
    const { searchParams } = new URL(req.url)
    const platform = searchParams.get("platform") as TrendPlatform | null
    const niche = searchParams.get("niche") || null
    const productionLag = (searchParams.get("lag") || "same_day") as ProductionLag
    const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 200)

    console.log(`[trend-radar/scores] platform=${platform} lag=${productionLag} niche=${niche ?? "none"} limit=${limit}`)

    if (!platform || !VALID_PLATFORMS.has(platform)) {
      return NextResponse.json({ error: "Valid platform required" }, { status: 400 })
    }
    if (!VALID_LAGS.has(productionLag)) {
      return NextResponse.json({ error: "lag must be same_day, 24h, 48h, 72h, 1w, 2w, or 4w" }, { status: 400 })
    }

    // Fetch recent snapshots (platform_wide — the main signal)
    const snapshots = await getRecentSnapshots(platform, "platform_wide", null, 30)
    console.log(`[trend-radar/scores] platform_wide snapshots: ${snapshots.length}`)

    // Also fetch topic_aligned if niche is provided
    let allSnapshots = snapshots
    if (niche) {
      const topicSnaps = await getRecentSnapshots(platform, "topic_aligned", niche, 30)
      console.log(`[trend-radar/scores] topic_aligned snapshots: ${topicSnaps.length}`)
      allSnapshots = [...snapshots, ...topicSnaps]
    }

    // Early return if no data at all
    if (allSnapshots.length === 0) {
      console.log("[trend-radar/scores] no snapshots found, returning empty")
      return NextResponse.json({
        ok: true,
        platform,
        productionLag,
        insufficientHistory: true,
        snapshotCount: 0,
        trends: [],
      })
    }

    // Compute scores
    const nicheFitKeywords = niche ? niche.toLowerCase().split(/[\s,]+/).filter(Boolean) : []
    const scores = computeScores(allSnapshots, platform, niche, nicheFitKeywords, productionLag)
    console.log(`[trend-radar/scores] computed ${scores.length} entity scores`)

    // Classify and sort by production lag
    const classified = classifyAndSort(scores, productionLag)
    const limited = classified.slice(0, limit)
    const insufficientHistory = snapshots.length < 5

    if (limited.length > 0) {
      console.log(`[trend-radar/scores] top entity: "${limited[0].entity}" class=${limited[0].classification} persist=${limited[0].persistence}`)
    }

    return NextResponse.json({
      ok: true,
      platform,
      productionLag,
      insufficientHistory,
      snapshotCount: snapshots.length,
      trends: limited,
    })
  } catch (err) {
    console.error("[trend-radar/scores] failed:", err)
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
