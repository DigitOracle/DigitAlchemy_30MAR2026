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
        // YouTube URLs: use Supadata transcript API (Deepgram can't fetch from YouTube)
        console.log("[analyze] YouTube URL — using Supadata transcript API")
        const ytTranscript = await fetchSupadataTranscript(sourceUrl)
        if (!ytTranscript) {
          return NextResponse.json({ error: "Could not get transcript for this YouTube video. It may not have captions or speech." }, { status: 400 })
        }
        const dna = await extractContentDNA(ytTranscript, platform, { title: filename })
        if (!dna) {
          return NextResponse.json({ error: "Could not extract content DNA" }, { status: 500 })
        }
        return NextResponse.json({ dna, transcript: ytTranscript.slice(0, 200) })
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

      // Download file via Admin SDK (bypasses storage rules, no auth needed)
      const bucket = getStorageBucket()
      const file = bucket.file(storagePath)
      const [exists] = await file.exists()
      if (!exists) {
        return NextResponse.json({ error: "File not found in storage" }, { status: 404 })
      }
      const [downloaded] = await file.download()
      console.log("[analyze] downloaded from storage via Admin SDK", { path: storagePath, sizeBytes: downloaded.length })
      filename = storagePath.split("/").pop() ?? "upload.mp4"

      // Upload buffer to Deepgram directly (no URL needed)
      const transcript = await transcribeBufferWithDeepgram(downloaded, filename)
      if (!transcript) {
        console.log("[analyze] REJECT:deepgram-null-storage", { filename, sizeBytes: downloaded.length })
        return NextResponse.json({ error: "Could not transcribe video audio. The file may not contain audible speech." }, { status: 400 })
      }

      // Cleanup storage
      file.delete().catch(() => {})

      const dna = await extractContentDNA(transcript, platform, { title: filename })
      if (!dna) {
        return NextResponse.json({ error: "Could not extract content DNA" }, { status: 500 })
      }
      return NextResponse.json({ dna, transcript: transcript.slice(0, 200) })
    } else {
      return NextResponse.json({ error: "Either sourceUrl or storagePath is required" }, { status: 400 })
    }

    if (!videoUrl) {
      return NextResponse.json({ error: "Could not determine video URL" }, { status: 400 })
    }

    const transcript = await transcribeWithDeepgram(videoUrl)

    if (!transcript) {
      console.log("[analyze] REJECT:deepgram-null", { filename, videoUrl: videoUrl.slice(0, 100) })
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

async function transcribeWithDeepgram(url: string): Promise<string | null> {
  const apiKey = process.env.DEEPGRAM_API_KEY
  if (!apiKey) { console.log("[CONTENT-DNA] No DEEPGRAM_API_KEY"); return null }
  try {
    console.log("[CONTENT-DNA] Deepgram transcribing:", url.slice(0, 80))
    const start = Date.now()
    const res = await fetch("https://api.deepgram.com/v1/listen?model=nova-3&smart_format=true", {
      method: "POST",
      headers: { Authorization: `Token ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    })
    if (!res.ok) {
      const errBody = await res.text().catch(() => "")
      console.log("[CONTENT-DNA] Deepgram failed:", res.status, errBody.slice(0, 200))
      return null
    }
    const data = await res.json()
    const transcript = (data?.results?.channels?.[0]?.alternatives?.[0]?.transcript as string) || null
    console.log("[CONTENT-DNA] Deepgram done in", Date.now() - start, "ms, chars:", transcript?.length)
    return transcript
  } catch (e) { console.log("[CONTENT-DNA] Deepgram exception:", e); return null }
}

/** Deepgram: transcribe from a Buffer (for Firebase Storage uploads) */
async function transcribeBufferWithDeepgram(buffer: Buffer, filename: string): Promise<string | null> {
  const apiKey = process.env.DEEPGRAM_API_KEY
  if (!apiKey) { console.log("[CONTENT-DNA] No DEEPGRAM_API_KEY"); return null }
  try {
    console.log("[CONTENT-DNA] Deepgram buffer transcribe:", filename, buffer.length, "bytes")
    const start = Date.now()
    const res = await fetch("https://api.deepgram.com/v1/listen?model=nova-3&smart_format=true", {
      method: "POST",
      headers: { Authorization: `Token ${apiKey}`, "Content-Type": "application/octet-stream" },
      body: new Uint8Array(buffer),
    })
    if (!res.ok) {
      const errBody = await res.text().catch(() => "")
      console.log("[CONTENT-DNA] Deepgram buffer failed:", res.status, errBody.slice(0, 200))
      return null
    }
    const data = await res.json()
    const transcript = (data?.results?.channels?.[0]?.alternatives?.[0]?.transcript as string) || null
    console.log("[CONTENT-DNA] Deepgram buffer done in", Date.now() - start, "ms, chars:", transcript?.length)
    return transcript
  } catch (e) { console.log("[CONTENT-DNA] Deepgram buffer exception:", e); return null }
}

/** Supadata: fetch transcript for YouTube URLs */
async function fetchSupadataTranscript(url: string): Promise<string | null> {
  const apiKey = process.env.SUPADATA_API_KEY
  if (!apiKey) { console.log("[CONTENT-DNA] No SUPADATA_API_KEY"); return null }
  try {
    console.log("[CONTENT-DNA] Supadata YouTube transcript:", url.slice(0, 80))
    const res = await fetch(
      `https://api.supadata.ai/v1/youtube/transcript?url=${encodeURIComponent(url)}&text=true`,
      { headers: { "x-api-key": apiKey }, signal: AbortSignal.timeout(15000) },
    )
    if (!res.ok) {
      const errBody = await res.text().catch(() => "")
      console.log("[CONTENT-DNA] Supadata failed:", res.status, errBody.slice(0, 200))
      return null
    }
    const data = await res.json()
    const content = (data.content as string) || ""
    console.log("[CONTENT-DNA] Supadata transcript:", content.length, "chars")
    return content || null
  } catch (e) { console.log("[CONTENT-DNA] Supadata exception:", e); return null }
}
