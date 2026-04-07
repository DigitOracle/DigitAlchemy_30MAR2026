// POST /api/trend-radar/capture — Trigger a trend snapshot capture
import { NextRequest, NextResponse } from "next/server"
import { getAuth } from "firebase-admin/auth"
import { captureTrends } from "@/lib/trendRadar/capture"
import { getDb } from "@/lib/jobStore"
import type { CaptureRequest, CaptureResponse } from "@/lib/trendRadar/types"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"
export const maxDuration = 60

const VALID_PLATFORMS = new Set(["tiktok", "instagram", "youtube", "linkedin", "x", "facebook"])
const VALID_SCOPES = new Set(["platform_wide", "topic_aligned"])

export async function POST(req: NextRequest): Promise<NextResponse<CaptureResponse | { error: string }>> {
  // Require admin auth — capture triggers paid provider calls and writes platform-wide data
  const db = getDb()
  const authHeader = req.headers.get("authorization")
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 })
  }
  let callerUid: string
  try {
    const token = await getAuth().verifyIdToken(authHeader.slice(7))
    callerUid = token.uid
  } catch {
    return NextResponse.json({ error: "Invalid auth token" }, { status: 401 })
  }
  const callerSnap = await db.doc(`users/${callerUid}`).get()
  const callerRole = (callerSnap.data() as { role?: string } | undefined)?.role
  if (callerRole !== "admin") {
    return NextResponse.json({ error: "Forbidden — admin only" }, { status: 403 })
  }

  try {
    const body = await req.json() as CaptureRequest & { region?: string }

    if (!body.platform || !VALID_PLATFORMS.has(body.platform)) {
      return NextResponse.json({ error: "Valid platform required" }, { status: 400 })
    }
    if (!body.scope || !VALID_SCOPES.has(body.scope)) {
      return NextResponse.json({ error: "scope must be platform_wide or topic_aligned" }, { status: 400 })
    }
    if (body.scope === "topic_aligned" && !body.niche) {
      return NextResponse.json({ error: "niche required for topic_aligned scope" }, { status: 400 })
    }

    const region = body.region || "AE"
    console.log(`[trend-radar] capture starting: ${body.platform}/${body.scope}${body.niche ? `/${body.niche}` : ""} region=${region}`)

    const snapshot = await captureTrends(body.platform, body.scope, body.niche ?? null, region)

    return NextResponse.json({
      ok: true,
      snapshotId: snapshot.id,
      entityCount: snapshot.entityCount,
      source: snapshot.source,
    })
  } catch (err) {
    console.error("[trend-radar] capture failed:", err)
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
