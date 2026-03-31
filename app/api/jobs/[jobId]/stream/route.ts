import { NextRequest } from "next/server"
import { getJobV2, updateJobStatusV2, updateCard } from "@/lib/firestore/jobs"
import { PLATFORMS } from "@/config/platforms"
import Anthropic from "@anthropic-ai/sdk"

export const runtime = "nodejs"
export const maxDuration = 60

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

function encodeEvent(event: string, data: unknown): Uint8Array {
  return new TextEncoder().encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
}

function ping(): Uint8Array {
  return new TextEncoder().encode(": ping\n\n")
}

async function callClaude(prompt: string, maxTokens = 1200): Promise<Record<string, unknown>> {
  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: maxTokens,
    messages: [{ role: "user", content: prompt }],
  })
  const text = response.content[0].type === "text" ? response.content[0].text : ""
  const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim()
  try {
    return JSON.parse(cleaned)
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/)
    if (match) {
      try { return JSON.parse(match[0]) } catch { /* fall through */ }
    }
    return {}
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: { jobId: string } }
) {
  const job = await getJobV2(params.jobId)
  if (!job) return new Response("Job not found", { status: 404 })
  if (job.phase !== 2 || job.status !== "generating") {
    return new Response("Job not in generating state", { status: 400 })
  }

  const stream = new ReadableStream({
    async start(controller) {
      const keepAlive = setInterval(() => {
        try { controller.enqueue(ping()) } catch { /* closed */ }
      }, 8000)

      const emit = (event: string, data: unknown) => {
        try { controller.enqueue(encodeEvent(event, data)) } catch { /* closed */ }
      }

      try {
        const ingestion = job.ingestion
        const topic = ingestion.title ?? "the submitted content"
        const summary = ingestion.transcriptSummary ?? ""
        const provenance = ingestion.provenance

        for (const platformId of job.selectedPlatforms) {
          const config = PLATFORMS[platformId]
          if (!config) continue

          emit("processor.started", { platform: platformId, label: `Generating ${config.label} pack\u2026` })

          const prompt = `You are DigitAlchemy\u00ae content pack generator for ${config.label}. Return JSON only.

TOPIC: ${topic}
TRANSCRIPT SUMMARY: ${summary}
PLATFORM: ${config.label}
PROVENANCE: ${provenance}

Return ONLY this JSON:
{
  "trending": { "hashtags": ["string"], "notes": "string" },
  "audio": { "suggestions": ["string"], "mood": "string" },
  "hooks": [{ "text": "string", "type": "opening|question|statistic" }],
  "captions": [{ "text": "string", "variant": "short|long|story" }],
  "schedule": { "bestTimes": ["string"], "frequency": "string", "notes": "string" }
}

Make every field specific to ${config.label} conventions and norms.`

          const cardData = await callClaude(prompt, 1200)

          const cardTypes = ["trending", "audio", "hooks", "captions", "schedule"] as const
          for (const cardType of cardTypes) {
            if (cardData[cardType]) {
              const data = cardData[cardType] as Record<string, unknown>
              await updateCard(params.jobId, platformId, cardType, data)
              emit("card", { platform: platformId, cardType, data })
            }
          }
        }

        await updateJobStatusV2(params.jobId, "complete")
        emit("complete", { jobId: params.jobId })

      } catch (err) {
        const message = err instanceof Error ? err.message : "Generation failed"
        console.error("[jobs stream]", err)
        try { await updateJobStatusV2(params.jobId, "error", message) } catch { /* ignore */ }
        emit("error", { jobId: params.jobId, error: message })
      } finally {
        clearInterval(keepAlive)
        controller.close()
      }
    }
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  })
}
