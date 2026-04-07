import { NextRequest, NextResponse } from "next/server"
import { getAuth } from "firebase-admin/auth"
import { getStorageBucket, getDb } from "@/lib/jobStore"
import { getJobV2, updateJobV2 } from "@/lib/firestore/jobs"

export const runtime = "nodejs"

export async function POST(req: NextRequest) {
  // Require Firebase Auth before updating job records
  getDb()
  const authHeader = req.headers.get("authorization")
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 })
  }
  try {
    await getAuth().verifyIdToken(authHeader.slice(7))
  } catch {
    return NextResponse.json({ error: "Invalid auth token" }, { status: 401 })
  }

  try {
    const { jobId, storagePath, filename } = await req.json()

    if (!jobId || !storagePath) {
      return NextResponse.json({ error: "jobId and storagePath required" }, { status: 400 })
    }

    // Verify file exists in Firebase Storage
    const bucket = getStorageBucket()
    const file = bucket.file(storagePath)
    const [exists] = await file.exists()

    if (!exists) {
      return NextResponse.json({ error: "File not found in storage" }, { status: 404 })
    }

    // Verify job exists
    const job = await getJobV2(jobId)
    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 })
    }

    // Update job with upload info — ingestion will be triggered
    // by the client opening a new SSE stream to /api/analyze
    await updateJobV2(jobId, {
      sourceType: "upload",
      storagePath,
      accessMethod: "api_key",
      status: "ingesting",
      ingestion: {
        title: filename ?? null,
        duration: null,
        thumbnail: null,
        transcriptSummary: null,
        transcriptStatus: "pending",
        provenance: "derived",
      },
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[upload/complete]", err)
    return NextResponse.json({ error: "Failed to complete upload" }, { status: 500 })
  }
}
