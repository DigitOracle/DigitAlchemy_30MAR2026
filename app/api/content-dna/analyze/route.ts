import { NextResponse } from "next/server"
import { getAuth } from "firebase-admin/auth"
import { extractContentDNA } from "@/lib/profile/extractContentDNA"
import { getDb, getStorageBucket } from "@/lib/jobStore"
import { isHeyGenDashboardUrl, resolveHeyGenUrl, HeyGenResolveError } from "@/lib/heygen/resolveHeyGenUrl"

export const runtime = "nodejs"
export const maxDuration = 60

// Allowed domains for URL-based video ingestion
const ALLOWED_DOMAINS = [
  "youtube.com", "www.youtube.com", "youtu.be", "m.youtube.com",
  "heygen.com", "www.heygen.com", "app.heygen.ai",
  "drive.google.com",
]

function isAllowedUrl(url: string): boolean {
  try {
    const u = new URL(url)
    if (u.protocol !== "https:") return false
    // Allow any URL ending in a video extension
    if (/\.(mp4|mov|webm|m4v)$/i.test(u.pathname)) return true
    // Allow whitelisted domains
    return ALLOWED_DOMAINS.some(d => u.hostname === d || u.hostname.endsWith("." + d))
  } catch { return false }
}

function googleDriveDirectUrl(url: string): string {
  const match = url.match(/\/file\/d\/([^/]+)/)
  if (match) return `https://drive.google.com/uc?export=download&id=${match[1]}`
  return url
}

export async function POST(req: Request): Promise<NextResponse> {
  try {
    // Require Firebase Auth
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

    const body = await req.json()
    const sourceUrl = body.sourceUrl as string | undefined
    const storagePath = body.storagePath as string | undefined
    const platform = (body.platform as string) || "tiktok"

    let videoUrl: string | null = null
    let filename: string = "video.mp4"

    if (sourceUrl) {
      // ── URL-based ingestion ──
      if (!isAllowedUrl(sourceUrl)) {
        console.log("[analyze] REJECT:domain", sourceUrl.slice(0, 80))
        return NextResponse.json({ error: "Only YouTube, HeyGen, Google Drive, or direct video file URLs are supported." }, { status: 400 })
      }

      console.log("[analyze] URL ingestion", { sourceUrl: sourceUrl.slice(0, 100) })

      // Resolve HeyGen dashboard URLs to CDN video URLs via API
      if (isHeyGenDashboardUrl(sourceUrl)) {
        try {
          videoUrl = await resolveHeyGenUrl(sourceUrl)
          console.log("[analyze] resolved HeyGen URL to CDN", { cdnUrl: videoUrl.slice(0, 100) })
        } catch (e) {
          const msg = e instanceof HeyGenResolveError ? e.message : "Could not resolve HeyGen video URL."
          console.log("[analyze] REJECT:heygen", msg)
          return NextResponse.json({ error: msg }, { status: 400 })
        }
      } else if (sourceUrl.includes("drive.google.com")) {
        videoUrl = googleDriveDirectUrl(sourceUrl)
      } else if (sourceUrl.includes("youtube.com") || sourceUrl.includes("youtu.be")) {
        // Supadata supports YouTube URLs natively
        videoUrl = sourceUrl
      } else {
        videoUrl = sourceUrl
      }

      filename = new URL(sourceUrl).pathname.split("/").pop() ?? "video.mp4"
      if (!filename.includes(".")) filename += ".mp4"

    } else if (storagePath) {
      // ── Firebase Storage path (file upload via client) ──
      if (!storagePath.startsWith(`dna-uploads/${callerUid}/`)) {
        return NextResponse.json({ error: "Forbidden — path does not match authenticated user" }, { status: 403 })
      }

      const bucket = getStorageBucket()
      const file = bucket.file(storagePath)
      const [exists] = await file.exists()
      if (!exists) {
        return NextResponse.json({ error: "File not found in storage" }, { status: 404 })
      }

      // Generate a signed URL so Supadata can fetch the file directly
      const [signedUrl] = await file.getSignedUrl({
        action: "read",
        expires: Date.now() + 10 * 60 * 1000, // 10 minutes
      })
      videoUrl = signedUrl
      console.log("[analyze] generated signed URL for storage file", { path: storagePath })
      filename = storagePath.split("/").pop() ?? "upload.mp4"

      // Cleanup after generating URL (Supadata will fetch before expiry)
      file.delete().catch(() => {})
    } else {
      return NextResponse.json({ error: "Either sourceUrl or storagePath is required" }, { status: 400 })
    }

    if (!videoUrl) {
      return NextResponse.json({ error: "Could not determine video URL" }, { status: 400 })
    }

    const transcript = await transcribeWithSupadata(videoUrl)

    if (!transcript) {
      console.log("[analyze] REJECT:supadata-null", { filename, videoUrl: videoUrl.slice(0, 100) })
      return NextResponse.json({ error: "Could not transcribe video audio. The file may not contain audible speech." }, { status: 400 })
    }

    const dna = await extractContentDNA(transcript, platform, { title: filename })

    if (!dna) {
      return NextResponse.json({ error: "Could not extract content DNA" }, { status: 500 })
    }

    return NextResponse.json({ dna, transcript: transcript.slice(0, 200) })
  } catch (err) {
    console.error("[CONTENT-DNA] Analyze error:", err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

async function transcribeWithSupadata(url: string): Promise<string | null> {
  const apiKey = process.env.SUPADATA_API_KEY
  if (!apiKey) { console.log("[CONTENT-DNA] No SUPADATA_API_KEY"); return null }

  try {
    console.log("[CONTENT-DNA] Supadata transcribe", url.slice(0, 100))
    const res = await fetch(
      `https://api.supadata.ai/v1/transcript?url=${encodeURIComponent(url)}&text=true`,
      {
        headers: { "x-api-key": apiKey },
        signal: AbortSignal.timeout(15000),
      },
    )

    if (res.status === 200) {
      const data = await res.json()
      const content = (data.content as string) || ""
      if (content) {
        console.log("[CONTENT-DNA] Supadata transcript ready", { chars: content.length })
        return content
      }
      return null
    }

    if (res.status === 202) {
      // Async job — poll for completion
      const data = await res.json()
      const jobId = data.jobId as string
      if (!jobId) { console.log("[CONTENT-DNA] Supadata 202 but no jobId"); return null }

      console.log("[CONTENT-DNA] Supadata async job", { jobId })
      const maxWait = 50_000
      const pollInterval = 3_000
      const start = Date.now()

      while (Date.now() - start < maxWait) {
        await new Promise(r => setTimeout(r, pollInterval))

        const pollRes = await fetch(
          `https://api.supadata.ai/v1/transcript/${jobId}`,
          {
            headers: { "x-api-key": apiKey },
            signal: AbortSignal.timeout(10000),
          },
        )

        if (!pollRes.ok) {
          console.log("[CONTENT-DNA] Supadata poll failed:", pollRes.status)
          continue
        }

        const pollData = await pollRes.json()
        if (pollData.status === "completed") {
          const content = (pollData.content as string) || ""
          console.log("[CONTENT-DNA] Supadata job completed", { chars: content.length })
          return content || null
        }

        if (pollData.status === "failed" || pollData.status === "error") {
          console.log("[CONTENT-DNA] Supadata job failed:", pollData.error || pollData.status)
          return null
        }

        console.log("[CONTENT-DNA] Supadata polling...", { status: pollData.status, elapsed: Date.now() - start })
      }

      console.log("[CONTENT-DNA] Supadata job timed out after", maxWait, "ms")
      return null
    }

    const errBody = await res.text().catch(() => "")
    console.log("[CONTENT-DNA] Supadata failed:", res.status, errBody.slice(0, 200))
    return null
  } catch (e) { console.log("[CONTENT-DNA] Supadata error:", e); return null }
}
