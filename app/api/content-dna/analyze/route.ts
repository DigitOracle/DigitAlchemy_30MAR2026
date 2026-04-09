import { NextResponse } from "next/server"
import { getAuth } from "firebase-admin/auth"
import { extractContentDNA } from "@/lib/profile/extractContentDNA"
import { getDb } from "@/lib/jobStore"

export const runtime = "nodejs"
export const maxDuration = 60
// TODO Phase 4 — migrate to Vercel Blob direct upload for files > 4.5 MB.
// Vercel serverless body limit is 4.5 MB. Client enforces 4 MB in app/upload/page.tsx.

export async function POST(req: Request): Promise<NextResponse> {
  try {
    // Require Firebase Auth — prevents unauthenticated Groq/Claude cost abuse
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

    const formData = await req.formData()
    const file = formData.get("file") as File | null
    const platform = (formData.get("platform") as string) || "tiktok"

    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 })

    const buffer = Buffer.from(await file.arrayBuffer())
    const transcript = await transcribeWithWhisper(buffer, file.name)

    if (!transcript) {
      return NextResponse.json({ error: "Could not transcribe video audio" }, { status: 400 })
    }

    const dna = await extractContentDNA(transcript, platform, { title: file.name })

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
