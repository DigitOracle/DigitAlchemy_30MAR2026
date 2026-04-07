import { NextRequest, NextResponse } from "next/server"
import { getAuth } from "firebase-admin/auth"
import { getJobV2, updateJobV2 } from "@/lib/firestore/jobs"
import { getDb } from "@/lib/jobStore"

export const runtime = "nodejs"

export async function POST(req: NextRequest) {
  // Require Firebase Auth before modifying job state
  getDb()
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

  try {
    const { jobId, platforms, confirmedFocus } = await req.json()

    if (!jobId) {
      return NextResponse.json({ error: "jobId required" }, { status: 400 })
    }

    const job = await getJobV2(jobId)
    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 })
    }

    // Ownership check
    if (job.ownerUid && job.ownerUid !== callerUid) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Content focus confirmation (called before platform selection)
    if (confirmedFocus && !platforms) {
      await updateJobV2(jobId, { confirmedFocus })
      return NextResponse.json({ ok: true })
    }

    if (!Array.isArray(platforms) || platforms.length === 0) {
      return NextResponse.json({ error: "platforms[] required" }, { status: 400 })
    }

    const update: Record<string, unknown> = {
      selectedPlatforms: platforms,
      status: "generating",
      phase: 2,
    }
    if (confirmedFocus) update.confirmedFocus = confirmedFocus

    await updateJobV2(jobId, update)

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[platform-selection]", err)
    return NextResponse.json({ error: "Failed to update platforms" }, { status: 500 })
  }
}
