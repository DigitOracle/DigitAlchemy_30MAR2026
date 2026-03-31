// lib/transcription/whisper.ts — Groq Whisper transcription with 25MB limit handling

import Groq from "groq-sdk"

export type TranscriptionResult = {
  transcript: string | null
  summary: string | null
  status: "complete" | "failed"
  error: string | null
}

const MAX_WHISPER_BYTES = 25 * 1024 * 1024 // 25MB Groq limit

export async function transcribeFromUrl(videoUrl: string): Promise<TranscriptionResult> {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) {
    return {
      transcript: null,
      summary: null,
      status: "failed",
      error: "GROQ_API_KEY not configured",
    }
  }

  try {
    // Fetch the video file
    const res = await fetch(videoUrl)
    if (!res.ok) {
      return {
        transcript: null,
        summary: null,
        status: "failed",
        error: `Failed to fetch video: HTTP ${res.status}`,
      }
    }

    const contentLength = Number(res.headers.get("content-length") ?? 0)

    // If file is too large for Whisper, return gracefully
    if (contentLength > MAX_WHISPER_BYTES) {
      return {
        transcript: null,
        summary: null,
        status: "failed",
        error: `Video file too large for transcription (${(contentLength / 1024 / 1024).toFixed(0)}MB, limit 25MB). Falling back to AI summary.`,
      }
    }

    const buffer = Buffer.from(await res.arrayBuffer())

    // Double-check actual size
    if (buffer.length > MAX_WHISPER_BYTES) {
      return {
        transcript: null,
        summary: null,
        status: "failed",
        error: `Video file too large after download (${(buffer.length / 1024 / 1024).toFixed(0)}MB)`,
      }
    }

    const groq = new Groq({ apiKey })

    // Create a File-like object for the Groq SDK
    const file = new File([buffer], "video.mp4", { type: "video/mp4" })

    const transcription = await groq.audio.transcriptions.create({
      file,
      model: "whisper-large-v3-turbo",
      response_format: "text",
    })

    const transcript = typeof transcription === "string"
      ? transcription
      : (transcription as { text?: string }).text ?? null

    if (!transcript || transcript.trim().length === 0) {
      return {
        transcript: null,
        summary: null,
        status: "failed",
        error: "Whisper returned empty transcript",
      }
    }

    return {
      transcript,
      summary: null, // Caller should generate summary via Claude
      status: "complete",
      error: null,
    }
  } catch (err) {
    return {
      transcript: null,
      summary: null,
      status: "failed",
      error: err instanceof Error ? err.message : "Transcription failed",
    }
  }
}
