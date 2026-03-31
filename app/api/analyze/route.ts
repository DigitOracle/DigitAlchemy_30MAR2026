import { NextRequest } from "next/server"
import { createJob, updateJobStatus, updateSection, setSectionStreaming } from "@/lib/jobStore"
import { createJobV2, updateJobStatusV2, updateJobV2 } from "@/lib/firestore/jobs"
import { attemptMediaAccess } from "@/lib/media/access"
import { getAllServers, serversToRegistryString } from "@/lib/registry"
import { agentsToProfileString } from "@/lib/agentProfiles"
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

async function callClaude(prompt: string, maxTokens = 1500): Promise<Record<string, unknown>> {
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

export async function POST(req: NextRequest): Promise<Response> {
  const body = await req.json()
  const { task, workflowId, workflowLabel, intakeContext } = body

  if (!task || task.trim().length < 5) {
    return new Response(JSON.stringify({ success: false, error: "Task required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    })
  }

  const job = await createJob(task.trim(), workflowId ?? null, workflowLabel ?? null, intakeContext ?? {})
  const isSocial = workflowId === "social-video-optimization"

  // Create v2 job document with extended schema
  const sourceUrl = (intakeContext?.videoUrl as string) ?? null
  const jobV2 = await createJobV2({
    task: task.trim(),
    sourceUrl,
    sourceType: sourceUrl ? "url" : null,
    workflowId: workflowId ?? null,
    workflowLabel: workflowLabel ?? null,
    intakeContext: intakeContext ?? {},
  })
  await updateJobStatusV2(jobV2.id, "ingesting")

  const contextStr = Object.entries(intakeContext ?? {})
    .map(([k, v]: [string, unknown]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`)
    .join("\n")

  const stream = new ReadableStream({
    async start(controller) {
      // Keep connection alive with periodic pings
      const keepAlive = setInterval(() => {
        try { controller.enqueue(ping()) } catch { /* closed */ }
      }, 8000)

      const emit = (event: string, data: unknown) => {
        try { controller.enqueue(encodeEvent(event, data)) } catch { /* closed */ }
      }

      try {
        emit("job.created", { jobId: job.id, jobIdV2: jobV2.id, workflowLabel })
        await updateJobStatus(job.id, "planning")

        // Load registry
        const servers = await getAllServers()
        const connected = servers.filter((s) => s.status === "connected").slice(0, 12)
        const registryStr = serversToRegistryString(connected)
        const agentStr = agentsToProfileString()

        // Attempt media access if URL provided (HeyGen API key, public URL, etc.)
        let videoMeta: { title?: string; duration?: number; thumbnailUrl?: string; videoUrl?: string; captionUrl?: string } | null = null
        let mediaAccessSuccess = false

        if (sourceUrl && isSocial) {
          emit("processor.started", { processorId: "media-access", label: "Fetching video metadata\u2026" })
          const access = await attemptMediaAccess(sourceUrl, jobV2.id)

          if (access.success && access.videoMeta) {
            mediaAccessSuccess = true
            videoMeta = access.videoMeta
            await updateJobV2(jobV2.id, {
              accessMethod: access.accessMethod,
              oauthPlatform: access.detectedPlatform,
              ingestion: {
                title: videoMeta.title ?? null,
                duration: videoMeta.duration ? `${Math.round(videoMeta.duration)}s` : null,
                thumbnail: videoMeta.thumbnailUrl ?? null,
                transcriptSummary: null,
                transcriptStatus: "pending",
                provenance: "observed",
              },
            })

            // Emit ingestion confirmed
            emit("ingestion_complete", {
              title: videoMeta.title ?? null,
              duration: videoMeta.duration ? `${Math.round(videoMeta.duration)}s` : null,
              thumbnail: videoMeta.thumbnailUrl ?? null,
              provenance: "observed",
              jobId: jobV2.id,
            })
          }
        }

        // SECTION 1 — Intake summary (immediate)
        const intakeSectionData = { task: task.trim(), workflowLabel, intakeContext }
        emit("section.ready", { sectionId: "intake-summary", label: "Intake summary", data: intakeSectionData })
        await updateSection(job.id, "intake-summary", intakeSectionData)

        // SECTION 2 — Execution timeline (immediate)
        const timelineData = {
          steps: isSocial ? [
            { label: "Content intelligence", status: "running" },
            { label: "Transcript analysis", status: "pending" },
            { label: "Trend research", status: "pending" },
            { label: "Platform packs", status: "pending" },
            { label: "Agent plan", status: "pending" },
          ] : [
            { label: "Task classification", status: "running" },
            { label: "Standards lookup", status: "pending" },
            { label: "Agent routing", status: "pending" },
          ]
        }
        emit("section.ready", { sectionId: "execution-timeline", label: "Execution plan", data: timelineData })
        await updateSection(job.id, "execution-timeline", timelineData)

        await updateJobStatus(job.id, "running")

        // PASS 1 — Content Intelligence
        emit("processor.started", { processorId: "content-intelligence", label: "Analysing content\u2026" })
        await setSectionStreaming(job.id, "content-intelligence")

        // Build video metadata context for the LLM
        const videoContext = videoMeta
          ? `\nVIDEO METADATA (extracted via API — provenance: observed):\n- Duration: ${videoMeta.duration ? `${Math.round(videoMeta.duration)} seconds` : "unknown"}\n- Title: ${videoMeta.title ?? "untitled"}\n- Video URL: available\n- Thumbnail: available`
          : ""

        const contentPrompt = `You are DigitAlchemy\u00ae content intelligence. Analyse this task and return JSON only.

CRITICAL: You must ONLY use information explicitly provided in the task, context, and video metadata below.
If no video metadata is provided and the URL cannot be accessed:
- Set all content fields to null with provenance "unavailable"
- Do NOT infer, guess, or use training knowledge about the video
- Return canProceed: false in your response

If video metadata IS provided below, use it directly with provenance "observed".
If the task description contains enough explicit detail, you may proceed with provenance "observed" for fields derived from the task text.

TASK: ${task}
CONTEXT:
${contextStr}${videoContext}

Return ONLY this JSON:
{
  "canProceed": true|false,
  "assetType": { "value": "string|null", "provenance": "observed|inferred|unavailable", "confidence": "high|medium|low" },
  "duration": { "value": "string|null", "provenance": "observed|inferred|unavailable", "confidence": "high|medium|low" },
  "tone": { "value": "string|null", "provenance": "observed|inferred|unavailable", "confidence": "high|medium|low" },
  "language": { "value": "string|null", "provenance": "observed|inferred|unavailable", "confidence": "high|medium|low" },
  "audienceFit": { "value": "string|null", "provenance": "observed|inferred|unavailable", "confidence": "high|medium|low" },
  "topic": { "value": "string|null", "provenance": "observed|inferred|unavailable", "confidence": "high|medium|low" },
  "subject": { "value": "string|null", "provenance": "observed|inferred|unavailable", "confidence": "high|medium|low" },
  "keywords": { "value": ["string"]|null, "provenance": "observed|inferred|unavailable", "confidence": "high|medium|low" }
}`

        const contentData = await callClaude(contentPrompt, 800)
        emit("section.ready", { sectionId: "content-intelligence", label: "Content intelligence", data: contentData })
        await updateSection(job.id, "content-intelligence", contentData)

        // Update v2 job — ingestion complete, move to platform selection
        await updateJobStatusV2(jobV2.id, "ingestion_complete")
        await updateJobStatusV2(jobV2.id, "platform_selection_pending")

        // Check if content is accessible — block pipeline if not
        const canProceed = contentData.canProceed !== false

        if (!canProceed && isSocial) {
          // Emit blocked section
          emit("section.ready", {
            sectionId: "transcript",
            label: "Content not accessible",
            data: {
              blocked: true,
              message: "Video content could not be accessed. Please provide a public URL or upload the transcript.",
              reason: "The video URL provided requires authentication or is not publicly accessible.",
              suggestion: "To proceed: paste a public YouTube URL, or provide the video transcript as text.",
            }
          })
          await updateSection(job.id, "transcript", { blocked: true })
        }

        // PASS 2 — Transcript (social only, if content accessible)
        if (isSocial && canProceed) {
          emit("processor.started", { processorId: "transcript", label: "Extracting transcript\u2026" })
          await setSectionStreaming(job.id, "transcript")

          const transcriptPrompt = `You are DigitAlchemy\u00ae transcript analyst. Return JSON only.

CRITICAL: Only use information from the task description, video metadata, and content analysis below. Do NOT fabricate transcript content from training data.
${mediaAccessSuccess ? "Video was successfully accessed via API. Use the metadata to inform your analysis." : "Video could not be accessed directly. Derive insights from the task description only."}

TASK: ${task}
CONTENT DETECTED: ${JSON.stringify(contentData)}${videoContext}
CONTEXT: ${contextStr}

Return ONLY this JSON:
{
  "status": { "value": "string describing transcript availability", "provenance": "${mediaAccessSuccess ? "observed" : "inferred"}", "confidence": "${mediaAccessSuccess ? "high" : "medium"}" },
  "keyQuotes": [{ "value": "string", "provenance": "inferred", "confidence": "medium" }],
  "hookCandidates": [{ "value": "string", "provenance": "inferred", "confidence": "high|medium", "note": "why this works as a hook" }]
}

Provide 2-3 keyQuotes and 3 hookCandidates based on the topic and content detected.`

          const transcriptData = await callClaude(transcriptPrompt, 800)
          emit("section.ready", { sectionId: "transcript", label: "Transcript & key moments", data: transcriptData })
          await updateSection(job.id, "transcript", transcriptData)

          // Update v2 job with transcript summary
          const transcriptStatus = transcriptData.status as { value?: string } | undefined
          if (transcriptStatus?.value) {
            try {
              await updateJobV2(jobV2.id, {
                ingestion: {
                  title: videoMeta?.title ?? null,
                  duration: videoMeta?.duration ? `${Math.round(videoMeta.duration)}s` : null,
                  thumbnail: videoMeta?.thumbnailUrl ?? null,
                  transcriptSummary: transcriptStatus.value,
                  transcriptStatus: "complete",
                  provenance: mediaAccessSuccess ? "observed" : "inferred",
                },
              })
            } catch { /* non-critical */ }
          }
        }

        // PASS 3 — Trend Intelligence (social only, if content accessible)
        if (isSocial && canProceed) {
          const platforms = Array.isArray(intakeContext?.targetPlatforms)
            ? intakeContext.targetPlatforms
            : [intakeContext?.targetPlatforms ?? "TikTok", "Instagram"]

          emit("processor.started", { processorId: "trend-intelligence", label: "Researching trends\u2026" })
          await setSectionStreaming(job.id, "trend-intelligence")

          const trendPrompt = `You are DigitAlchemy\u00ae trend intelligence. Return JSON only.

TASK: ${task}
TOPIC: ${(contentData.topic as {value:string})?.value ?? "unknown"}
KEYWORDS: ${JSON.stringify((contentData.keywords as {value:string[]})?.value ?? [])}
TARGET PLATFORMS: ${platforms.join(", ")}
TARGET REGION: ${intakeContext?.targetRegion ?? "Global"}

Return ONLY this JSON \u2014 one entry per platform:
{
  "platforms": [
    {
      "platform": "platform name",
      "trendingHashtags": { "value": ["hashtag1", "hashtag2", "hashtag3"], "provenance": "inferred", "confidence": "medium", "note": "trend context" },
      "emergingHashtags": { "value": ["hashtag1", "hashtag2"], "provenance": "inferred", "confidence": "low" },
      "audioSuggestions": { "value": ["track or genre suggestion"], "provenance": "inferred", "confidence": "medium" },
      "formatFit": { "value": "description of best format for this platform", "provenance": "inferred", "confidence": "high" },
      "trendNotes": { "value": "platform-specific trend observation", "provenance": "inferred", "confidence": "medium" }
    }
  ]
}

Provide data for these platforms: ${platforms.join(", ")}
Make hashtags specific to the topic: ${(contentData.topic as {value:string})?.value ?? task}`

          const trendResult = await callClaude(trendPrompt, 1200)
          const trendData = trendResult.platforms ? trendResult : { platforms: [trendResult] }
          emit("section.ready", { sectionId: "trend-intelligence", label: "Trend intelligence", data: trendData })
          await updateSection(job.id, "trend-intelligence", trendData)
        }

        // PASS 4 — Platform Packs (social only, if content accessible)
        if (isSocial && canProceed) {
          const platforms = Array.isArray(intakeContext?.targetPlatforms)
            ? intakeContext.targetPlatforms
            : ["TikTok", "Instagram"]

          emit("processor.started", { processorId: "platform-packs", label: "Building platform packs\u2026" })
          await setSectionStreaming(job.id, "platform-packs")

          const packsPrompt = `You are DigitAlchemy\u00ae platform pack builder. Return JSON only.

TASK: ${task}
TOPIC: ${(contentData.topic as {value:string})?.value ?? "unknown"}
SUBJECT: ${(contentData.subject as {value:string})?.value ?? "unknown"}
KEYWORDS: ${JSON.stringify((contentData.keywords as {value:string[]})?.value ?? [])}
AUDIENCE: ${intakeContext?.audienceDescription ?? "general"}
TARGET PLATFORMS: ${platforms.join(", ")}
TARGET REGION: ${intakeContext?.targetRegion ?? "UAE"}

Return ONLY this JSON:
{
  "packs": [
    {
      "platform": "platform name",
      "hookOptions": [
        { "value": "hook text \u2014 attention-grabbing opening line", "provenance": "inferred", "confidence": "high" },
        { "value": "alternative hook", "provenance": "inferred", "confidence": "high" }
      ],
      "captionVariants": [
        { "value": "full caption text with emojis appropriate for platform", "provenance": "inferred", "confidence": "high" },
        { "value": "shorter variant caption", "provenance": "inferred", "confidence": "medium" }
      ],
      "hashtags": { "value": ["hashtag1", "hashtag2", "hashtag3", "hashtag4", "hashtag5"], "provenance": "inferred", "confidence": "medium" },
      "musicSuggestion": { "value": "specific track name or genre/vibe description", "provenance": "inferred", "confidence": "medium" },
      "postingGuidance": { "value": "best time/day, format notes, CTA recommendation", "provenance": "inferred", "confidence": "high" }
    }
  ]
}

Build packs for: ${platforms.join(", ")}
Make each pack specific to the topic and platform norms.`

          const packsResult = await callClaude(packsPrompt, 2000)
          const packsData = packsResult.packs ? packsResult : { packs: [packsResult] }
          emit("section.ready", { sectionId: "platform-packs", label: "Platform packs", data: packsData })
          await updateSection(job.id, "platform-packs", packsData)
        }

        // PASS 5 — Agent Plan (all workflows)
        emit("processor.started", { processorId: "agent-plan", label: "Building agent plan\u2026" })
        await setSectionStreaming(job.id, "agent-plan")

        const agentPrompt = `You are DigitAlchemy\u00ae orchestration planner. Return JSON only.

WORKFLOW: ${workflowLabel ?? "General Orchestration"}
TASK: ${task}
CONTEXT: ${contextStr}

AGENT PROFILES:
${agentStr}

MCP REGISTRY:
${registryStr}

Return ONLY this JSON:
{
  "workflowType": "string",
  "taskSummary": "one sentence summary",
  "recommendedAgents": [{ "id": "string", "displayName": "string", "shortDescription": "string", "category": "string" }],
  "recommendedMCPs": [{ "name": "string", "role": "string", "priority": "core|supporting|optional", "reason": "string", "source": "registry|missing_but_recommended", "confidence": "high|medium|low" }],
  "executionOrder": ["step 1", "step 2", "step 3"],
  "warnings": ["string"],
  "nextActions": ["string"]
}`

        const agentData = await callClaude(agentPrompt, 1200)
        emit("section.ready", { sectionId: "agent-plan", label: "Agent & MCP plan", data: agentData })
        await updateSection(job.id, "agent-plan", agentData)

        // Actions section
        const actionsData = {
          canExportJson: true,
          canSendAyrshare: isSocial,
          jobId: job.id,
        }
        emit("section.ready", { sectionId: "actions", label: "Actions", data: actionsData })
        await updateSection(job.id, "actions", actionsData)

        // Complete
        await updateJobStatus(job.id, "complete")
        await updateJobStatusV2(jobV2.id, "complete")
        emit("job.completed", { jobId: job.id, jobIdV2: jobV2.id })

      } catch (err) {
        const message = err instanceof Error ? err.message : "Analysis failed"
        console.error("[analyze stream]", err)
        try {
          await updateJobStatus(job.id, "failed", message)
          await updateJobStatusV2(jobV2.id, "error", message)
        } catch { /* ignore */ }
        emit("job.failed", { jobId: job.id, error: message })
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
      "Access-Control-Allow-Origin": "*",
    },
  })
}
