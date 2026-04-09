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

    let buffer: Buffer | null = null
    let filename: string = "video.mp4"
    let transcriptUrl: string | null = null

    if (sourceUrl) {
      // ── URL-based ingestion ──
      if (!isAllowedUrl(sourceUrl)) {
        console.log("[analyze] REJECT:domain", sourceUrl.slice(0, 80))
        return NextResponse.json({ error: "Only YouTube, HeyGen, Google Drive, or direct video file URLs are supported." }, { status: 400 })
      }

      console.log("[analyze] fetching from URL", { sourceUrl: sourceUrl.slice(0, 100) })

      let fetchUrl = sourceUrl

      // Resolve HeyGen dashboard URLs to CDN video URLs via API
      if (isHeyGenDashboardUrl(sourceUrl)) {
        try {
          fetchUrl = await resolveHeyGenUrl(sourceUrl)
          console.log("[analyze] resolved HeyGen dashboard URL to CDN", { cdnUrl: fetchUrl.slice(0, 100) })
          // Pass CDN URL directly to Groq — skip downloading bytes through Vercel
          transcriptUrl = fetchUrl
          filename = new URL(sourceUrl).pathname.split("/").pop() ?? "video.mp4"
          if (!filename.includes(".")) filename += ".mp4"
        } catch (e) {
          const msg = e instanceof HeyGenResolveError ? e.message : "Could not resolve HeyGen video URL."
          console.log("[analyze] REJECT:heygen", msg)
          return NextResponse.json({ error: msg }, { status: 400 })
        }
      } else if (sourceUrl.includes("drive.google.com")) {
        fetchUrl = googleDriveDirectUrl(sourceUrl)
      } else if (sourceUrl.includes("youtube.com") || sourceUrl.includes("youtu.be")) {
        console.log("[analyze] REJECT:youtube")
        return NextResponse.json({ error: "YouTube URL support coming soon. For now, download the video first and use Upload File." }, { status: 400 })
      }

      // Download bytes for non-HeyGen URLs (HeyGen passes URL directly to Groq)
      if (!transcriptUrl) {
        try {
          const res = await fetch(fetchUrl, {
            signal: AbortSignal.timeout(30000),
            headers: { "User-Agent": "DigitAlchemy/1.0" },
          })
          if (!res.ok) {
            console.log("[analyze] REJECT:download-fail", res.status, fetchUrl.slice(0, 100))
            return NextResponse.json({ error: "Could not download video. Check the URL is accessible." }, { status: 400 })
          }

          const contentLength = parseInt(res.headers.get("content-length") ?? "0", 10)
          if (contentLength > 100 * 1024 * 1024) {
            console.log("[analyze] REJECT:too-large-header", contentLength)
            return NextResponse.json({ error: "Video is too large. Maximum 100 MB." }, { status: 400 })
          }

          const arrayBuf = await res.arrayBuffer()
          buffer = Buffer.from(arrayBuf)

          if (buffer.length > 100 * 1024 * 1024) {
            console.log("[analyze] REJECT:too-large-body", buffer.length)
            return NextResponse.json({ error: "Video is too large. Maximum 100 MB." }, { status: 400 })
          }

          console.log("[analyze] downloaded from URL", { sizeBytes: buffer.length })
          filename = new URL(sourceUrl).pathname.split("/").pop() ?? "video.mp4"
          if (!filename.includes(".")) filename += ".mp4"
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          if (msg.includes("timeout") || msg.includes("TimeoutError")) {
            console.log("[analyze] REJECT:timeout")
            return NextResponse.json({ error: "Download timed out after 30 seconds. Try a smaller file or check the URL." }, { status: 400 })
          }
          console.log("[analyze] REJECT:download-err", msg.slice(0, 100))
          return NextResponse.json({ error: "Could not download video. Check the URL is accessible." }, { status: 400 })
        }
      }
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

      const [downloaded] = await file.download()
      buffer = downloaded
      console.log("[analyze] downloaded from storage", { path: storagePath, sizeBytes: buffer.length })
      filename = storagePath.split("/").pop() ?? "upload.mp4"

      // Cleanup
      file.delete().catch(() => {})
    } else {
      return NextResponse.json({ error: "Either sourceUrl or storagePath is required" }, { status: 400 })
    }

    const transcript = transcriptUrl
      ? await transcribeWithWhisperUrl(transcriptUrl)
      : await transcribeWithWhisper(buffer!, filename)

    if (!transcript) {
      console.log("[analyze] REJECT:whisper-null", { filename, sizeBytes: buffer?.length ?? 0, viaUrl: !!transcriptUrl })
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

async function transcribeWithWhisper(buffer: Buffer, filename: string): Promise<string | null> {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) { console.log("[CONTENT-DNA] No GROQ_API_KEY"); return null }

  try {
    const form = new FormData()
    form.append("file", new Blob([new Uint8Array(buffer)]), filename)
    form.append("model", "whisper-large-v3")

    const res = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    })

    if (!res.ok) {
      const body = await res.text().catch(() => "")
      console.log("[CONTENT-DNA] Whisper failed:", res.status, body.slice(0, 200))
      return null
    }
    const data = await res.json()
    return (data.text as string) || null
  } catch (e) { console.log("[CONTENT-DNA] Whisper error:", e); return null }
}

/** Transcribe by passing a public URL directly to Groq — avoids downloading bytes through Vercel. */
async function transcribeWithWhisperUrl(url: string): Promise<string | null> {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) { console.log("[CONTENT-DNA] No GROQ_API_KEY"); return null }

  try {
    console.log("[CONTENT-DNA] Whisper via URL", url.slice(0, 100))
    const form = new FormData()
    form.append("url", url)
    form.append("model", "whisper-large-v3")

    const res = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    })

    if (!res.ok) {
      const body = await res.text().catch(() => "")
      console.log("[CONTENT-DNA] Whisper URL failed:", res.status, body.slice(0, 200))
      // Fall back to null — caller can retry with buffer if needed
      return null
    }
    const data = await res.json()
    return (data.text as string) || null
  } catch (e) { console.log("[CONTENT-DNA] Whisper URL error:", e); return null }
}
