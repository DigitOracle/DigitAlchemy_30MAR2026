import { NextResponse } from "next/server"
import { getAuth } from "firebase-admin/auth"
import { extractContentDNA } from "@/lib/profile/extractContentDNA"
import { getDb, getStorageBucket } from "@/lib/jobStore"
import { isHeyGenDashboardUrl, resolveHeyGenUrl, HeyGenResolveError } from "@/lib/heygen/resolveHeyGenUrl"
import { AssemblyAI } from "assemblyai"

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

      // Generate a signed URL so AssemblyAI can fetch the file directly
      const [signedUrl] = await file.getSignedUrl({
        action: "read",
        expires: Date.now() + 10 * 60 * 1000, // 10 minutes
      })
      videoUrl = signedUrl
      console.log("[analyze] generated signed URL for storage file", { path: storagePath })
      filename = storagePath.split("/").pop() ?? "upload.mp4"

      // Cleanup after generating URL (AssemblyAI will fetch before expiry)
      file.delete().catch(() => {})
    } else {
      return NextResponse.json({ error: "Either sourceUrl or storagePath is required" }, { status: 400 })
    }

    if (!videoUrl) {
      return NextResponse.json({ error: "Could not determine video URL" }, { status: 400 })
    }

    const transcript = await transcribeWithAssemblyAI(videoUrl)

    if (!transcript) {
      console.log("[analyze] REJECT:assemblyai-null", { filename, videoUrl: videoUrl.slice(0, 100) })
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

async function transcribeWithAssemblyAI(url: string): Promise<string | null> {
  const apiKey = process.env.ASSEMBLYAI_API_KEY
  if (!apiKey) { console.log("[CONTENT-DNA] No ASSEMBLYAI_API_KEY"); return null }
  try {
    console.log("[CONTENT-DNA] Downloading bytes from:", url.slice(0, 80))
    const dlRes = await fetch(url, { signal: AbortSignal.timeout(30000) })
    if (!dlRes.ok) { console.log("[CONTENT-DNA] Download failed:", dlRes.status); return null }
    const buffer = Buffer.from(await dlRes.arrayBuffer())
    console.log("[CONTENT-DNA] Downloaded bytes:", buffer.length)
    const client = new AssemblyAI({ apiKey })
    const transcript = await client.transcripts.transcribe({ audio: buffer })
    console.log("[CONTENT-DNA] AssemblyAI result:", transcript.status, "chars:", transcript.text?.length)
    return transcript.text || null
  } catch (e) { console.log("[CONTENT-DNA] AssemblyAI error:", e); return null }
}
