import { NextRequest, NextResponse } from "next/server"
import { getStorageBucket } from "@/lib/jobStore"

export const runtime = "nodejs"

const ALLOWED_TYPES = new Set([
  "video/mp4",
  "video/mov",
  "video/quicktime",
  "video/webm",
])

export async function POST(req: NextRequest) {
  try {
    const { filename, contentType, jobId } = await req.json()

    if (!filename || !contentType || !jobId) {
      return NextResponse.json({ error: "filename, contentType, and jobId required" }, { status: 400 })
    }

    if (!ALLOWED_TYPES.has(contentType)) {
      return NextResponse.json({ error: `Unsupported file type: ${contentType}. Allowed: MP4, MOV, WebM` }, { status: 400 })
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
