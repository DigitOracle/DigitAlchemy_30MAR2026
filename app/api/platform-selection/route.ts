import { NextRequest, NextResponse } from "next/server"
import { getJobV2, updateJobV2 } from "@/lib/firestore/jobs"

export const runtime = "nodejs"

export async function POST(req: NextRequest) {
  try {
    const { jobId, platforms } = await req.json()

    if (!jobId || !Array.isArray(platforms) || platforms.length === 0) {
      return NextResponse.json({ error: "jobId and platforms[] required" }, { status: 400 })
    }

    const job = await getJobV2(jobId)
    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 })
    }

    await updateJobV2(jobId, {
      selectedPlatforms: platforms,
      status: "generating",
      phase: 2,
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[platform-selection]", err)
    return NextResponse.json({ error: "Failed to update platforms" }, { status: 500 })
  }
}
