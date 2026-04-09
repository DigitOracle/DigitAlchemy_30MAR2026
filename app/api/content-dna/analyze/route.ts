import { NextResponse } from "next/server"
import { getAuth } from "firebase-admin/auth"
import { extractContentDNA } from "@/lib/profile/extractContentDNA"
import { getDb, getStorageBucket } from "@/lib/jobStore"

export const runtime = "nodejs"
export const maxDuration = 60

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

    // Accept JSON body with storagePath (Firebase Storage direct upload pattern)
    const body = await req.json()
    const storagePath = body.storagePath as string | undefined
    const platform = (body.platform as string) || "tiktok"

    if (!storagePath) {
      return NextResponse.json({ error: "storagePath is required" }, { status: 400 })
    }

    // Verify the path belongs to the authenticated user
    if (!storagePath.startsWith(`dna-uploads/${callerUid}/`)) {
      return NextResponse.json({ error: "Forbidden — path does not match authenticated user" }, { status: 403 })
    }

    // Download file from Firebase Storage (no Vercel body limit — server-to-Storage)
    const bucket = getStorageBucket()
    const file = bucket.file(storagePath)
    const [exists] = await file.exists()
    if (!exists) {
      return NextResponse.json({ error: "File not found in storage" }, { status: 404 })
    }

    const [buffer] = await file.download()
    console.log("[analyze] downloaded from storage", { path: storagePath, sizeBytes: buffer.length })

    // Extract filename from storage path for Whisper
    const filename = storagePath.split("/").pop() ?? "upload.mp4"

    const transcript = await transcribeWithWhisper(buffer, filename)

    // Cleanup: delete the uploaded file from Storage to avoid accumulating costs
    file.delete().catch(() => { /* non-blocking cleanup */ })

    if (!transcript) {
      return NextResponse.json({ error: "Could not transcribe video audio" }, { status: 400 })
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

    if (!res.ok) { console.log("[CONTENT-DNA] Whisper failed:", res.status); return null }
    const data = await res.json()
    return (data.text as string) || null
  } catch (e) { console.log("[CONTENT-DNA] Whisper error:", e); return null }
}
