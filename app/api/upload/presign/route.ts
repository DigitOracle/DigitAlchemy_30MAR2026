import { NextRequest, NextResponse } from "next/server"
import { getAuth } from "firebase-admin/auth"
import { getStorageBucket, getDb } from "@/lib/jobStore"
import { getJobV2 } from "@/lib/firestore/jobs"

export const runtime = "nodejs"

const ALLOWED_TYPES = new Set([
  "video/mp4",
  "video/mov",
  "video/quicktime",
  "video/webm",
])

export async function POST(req: NextRequest) {
  // Require Firebase Auth before issuing signed upload URLs
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
    const { filename, contentType, jobId } = await req.json()

    if (!filename || !contentType || !jobId) {
      return NextResponse.json({ error: "filename, contentType, and jobId required" }, { status: 400 })
    }

    if (!ALLOWED_TYPES.has(contentType)) {
      return NextResponse.json({ error: `Unsupported file type: ${contentType}. Allowed: MP4, MOV, WebM` }, { status: 400 })
    }

    // Require job to exist before issuing signed URL
    const job = await getJobV2(jobId)
    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 })
    }

    // Fail-closed ownership check — no admin override on write path
    if (job.ownerUid !== callerUid) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const bucket = getStorageBucket()
    const storagePath = `uploads/${jobId}/${filename}`
    const file = bucket.file(storagePath)

    const [uploadUrl] = await file.getSignedUrl({
      version: "v4",
      action: "write",
      expires: Date.now() + 15 * 60 * 1000, // 15 minutes
      contentType,
    })

    return NextResponse.json({ uploadUrl, storagePath })
  } catch (err) {
    console.error("[upload/presign]", err)
    return NextResponse.json({ error: "Failed to generate upload URL" }, { status: 500 })
  }
}
