import { NextRequest } from "next/server"
import { getAuth } from "firebase-admin/auth"
import { createJob, updateJobStatus, updateSection, setSectionStreaming, getDb } from "@/lib/jobStore"
import { createJobV2, updateJobStatusV2, updateJobV2 } from "@/lib/firestore/jobs"
import { attemptMediaAccess } from "@/lib/media/access"
import { transcribeFromUrl } from "@/lib/transcription/whisper"
import { getSupadataTranscript } from "@/lib/transcription/supadata"
import { getAllServers, serversToRegistryString } from "@/lib/registry"
import { agentsToProfileString } from "@/lib/agentProfiles"
import Anthropic from "@anthropic-ai/sdk"
import { extractContentDNA } from "@/lib/profile/extractContentDNA"
import { saveDNASample, loadContentProfile, saveContentProfile, mergeProfileWithSample } from "@/lib/firestore/contentProfile"

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
  // Require Firebase Auth — uid derived from token, not request body
  getDb()
  const authHeader = req.headers.get("authorization")
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Authentication required" }), {
      status: 401, headers: { "Content-Type": "application/json" },
    })
  }
  let authenticatedUid: string
  try {
    const token = await getAuth().verifyIdToken(authHeader.slice(7))
    authenticatedUid = token.uid
  } catch {
    return new Response(JSON.stringify({ error: "Invalid auth token" }), {
      status: 401, headers: { "Content-Type": "application/json" },
    })
  }

  const body = await req.json()
  const { task, workflowId, workflowLabel, intakeContext, storagePath: uploadedStoragePath } = body
  // Ignore caller-supplied uid — use the verified token uid for all user-scoped writes
  const requestUid = authenticatedUid

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
  const isUpload = !!uploadedStoragePath
  const jobV2 = await createJobV2({
    ownerUid: authenticatedUid,
    task: task.trim(),
    sourceUrl,
    sourceType: isUpload ? "upload" : (sourceUrl ? "url" : null),
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

        // Attempt media access — either from URL (HeyGen API, YouTube) or from uploaded file (Firebase Storage)
        let videoMeta: { title?: string; duration?: number; thumbnailUrl?: string; videoUrl?: string; captionUrl?: string } | null = null
        let mediaAccessSuccess = false
        let youtubeTranscript: string | null = null

        // Handle uploaded file: generate signed read URL from GCS bucket
        if (isUpload && uploadedStoragePath) {
          emit("processor.started", { processorId: "media-access", label: "Processing uploaded file\u2026" })
          console.log("[analyze] upload flow — storagePath:", uploadedStoragePath)
          try {
            const { getStorageBucket } = await import("@/lib/jobStore")
            const bucket = getStorageBucket()
            console.log("[analyze] bucket name:", bucket.name)

            // Verify file exists
            const file = bucket.file(uploadedStoragePath)
            const [exists] = await file.exists()
            console.log("[analyze] file exists:", exists)

            if (!exists) {
              console.error("[analyze] uploaded file not found in bucket:", uploadedStoragePath)
              emit("processor.started", { processorId: "media-access", label: "Upload file not found in storage" })
            }

            const [signedUrl] = await file.getSignedUrl({
              version: "v4",
              action: "read",
              expires: Date.now() + 60 * 60 * 1000, // 1 hour
            })
            console.log("[analyze] signed read URL generated, length:", signedUrl.length)

            mediaAccessSuccess = true
            const filename = uploadedStoragePath.split("/").pop() ?? "uploaded video"
            videoMeta = { videoUrl: signedUrl, title: filename }
            await updateJobV2(jobV2.id, {
              storagePath: uploadedStoragePath,
              accessMethod: "api_key",
              ingestion: {
                title: filename,
                duration: null,
                thumbnail: null,
                transcriptSummary: null,
                transcriptStatus: "pending",
                provenance: "derived",
              },
            })
            emit("ingestion_complete", {
              title: filename,
              duration: null,
              thumbnail: null,
              provenance: "derived",
              jobId: jobV2.id,
            })
          } catch (err) {
            console.error("[analyze] storage read URL failed:", err)
            // Still set mediaAccessSuccess for uploads — we know the file is there
            mediaAccessSuccess = true
            videoMeta = { title: uploadedStoragePath.split("/").pop() }
            emit("ingestion_complete", {
              title: videoMeta.title ?? null,
              duration: null,
              thumbnail: null,
              provenance: "derived",
              jobId: jobV2.id,
            })
          }
        }

        // Try Supadata transcript for social video URLs (YouTube, TikTok, Instagram, X, Facebook)
        const supadataPatterns = /youtube\.com|youtu\.be|tiktok\.com|instagram\.com|twitter\.com|x\.com|facebook\.com|fb\.watch/
        const isSupadataUrl = sourceUrl ? supadataPatterns.test(sourceUrl) : false
        if (sourceUrl && isSupadataUrl && !isUpload) {
          emit("processor.started", { processorId: "media-access", label: "Extracting video transcript\u2026" })
          const supadataResult = await getSupadataTranscript(sourceUrl)

          if (supadataResult) {
            mediaAccessSuccess = true
            youtubeTranscript = supadataResult.text
            await updateJobV2(jobV2.id, {
              accessMethod: "public",
              ingestion: {
                title: null,
                duration: null,
                thumbnail: null,
                transcriptSummary: supadataResult.text.slice(0, 500),
                transcriptStatus: "complete",
                provenance: "observed",
              },
            })
            emit("ingestion_complete", {
              title: null,
              duration: null,
              thumbnail: null,
              provenance: "observed",
              jobId: jobV2.id,
            })
          }
        }

        // Handle HeyGen + other URLs (skip if Supadata already handled)
        if (sourceUrl && isSocial && !isUpload && !isSupadataUrl) {
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

        // Build video metadata + transcript context for the LLM
        const uploadProvenance = isUpload ? "derived" : "observed"
        // For uploads, label the filename explicitly as a filename — not as a "Title"
        // This prevents Claude from using the filename as the topic
        const titleLabel = isUpload
          ? `- Filename (NOT the topic): ${videoMeta?.title ?? "unknown"}`
          : `- Title: ${videoMeta?.title ?? "untitled"}`
        const videoContext = videoMeta
          ? `\nVIDEO METADATA (provenance: ${uploadProvenance}):\n- Duration: ${videoMeta.duration ? `${Math.round(videoMeta.duration)} seconds` : "unknown"}\n${titleLabel}\n- Source: ${isUpload ? "uploaded file" : "API"}\n- Video file: available`
          : ""
        const transcriptContext = youtubeTranscript
          ? `\nTRANSCRIPT (extracted — provenance: observed):\n${youtubeTranscript.slice(0, 4000)}`
          : ""

        console.log("[analyze] pipeline state:", { isUpload, mediaAccessSuccess, hasVideoMeta: !!videoMeta, hasTranscript: !!youtubeTranscript, storagePath: uploadedStoragePath ?? "none" })

        const contentPrompt = `You are DigitAlchemy\u00ae content intelligence. Analyse this task and return JSON only.

CRITICAL: You must ONLY use information explicitly provided in the task, context, and video metadata below.
${isUpload ? "This is an UPLOADED FILE — the content is available. Set canProceed: true and use provenance 'derived'." : `If no video metadata is provided and the URL cannot be accessed:
- Set all content fields to null with provenance "unavailable"
- Do NOT infer, guess, or use training knowledge about the video
- Return canProceed: false in your response`}

If video metadata IS provided below, use it directly. Set canProceed: true.
If the task description contains enough explicit detail, you may proceed.

TASK: ${task}
CONTEXT:
${contextStr}${videoContext}${transcriptContext}

Return ONLY this JSON:
{
  "canProceed": true|false,
  "assetType": { "value": "string|null", "provenance": "observed|inferred|unavailable", "confidence": "high|medium|low" },
  "duration": { "value": "string|null", "provenance": "observed|inferred|unavailable", "confidence": "high|medium|low" },
  "tone": { "value": "string|null", "provenance": "observed|inferred|unavailable", "confidence": "high|medium|low" },
  "language": { "value": "string|null", "provenance": "observed|inferred|unavailable", "confidence": "high|medium|low" },
  "audienceFit": { "value": "string|null", "provenance": "observed|inferred|unavailable", "confidence": "high|medium|low" },
  "topic": { "value": "string|null", "provenance": "observed|inferred|unavailable", "confidence": "high|medium|low" },
  "summary": { "value": "2-4 sentence plain-English description of what this content is about|null", "provenance": "observed|inferred|unavailable", "confidence": "high|medium|low" },
  "subject": { "value": "string|null", "provenance": "observed|inferred|unavailable", "confidence": "high|medium|low" },
  "keywords": { "value": ["string"]|null, "provenance": "observed|inferred|unavailable", "confidence": "high|medium|low" }
}

IMPORTANT:
- "topic" should be a short plain-English label (e.g. "DigitAlchemy product demo", "cooking tutorial", "fitness routine")
- "summary" should be 2-4 sentences describing what the content covers and its purpose
- Do NOT use the filename as the topic unless there is truly nothing else to work with
- If a transcript is provided, derive the topic and summary from it, not from the filename
- If no transcript and no meaningful metadata exist, set topic/summary confidence to "low"`

        const contentData = await callClaude(contentPrompt, 800)
        emit("section.ready", { sectionId: "content-intelligence", label: "Content intelligence", data: contentData })
        await updateSection(job.id, "content-intelligence", contentData)

        // Update v2 job — ingestion complete, move to platform selection
        await updateJobStatusV2(jobV2.id, "ingestion_complete")
        await updateJobStatusV2(jobV2.id, "platform_selection_pending")

        // Check if content is accessible — block pipeline if not
        // For uploads: always proceed — file is in our bucket
        const canProceed = isUpload ? true : contentData.canProceed !== false

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

          // Use YouTube transcript if already extracted, otherwise try Groq Whisper
          let whisperTranscript: string | null = youtubeTranscript
          let whisperSucceeded = !!youtubeTranscript
          if (!whisperSucceeded) {
            const transcriptionVideoUrl = videoMeta?.videoUrl
            if (transcriptionVideoUrl) {
              const whisperResult = await transcribeFromUrl(transcriptionVideoUrl)
              if (whisperResult.status === "complete" && whisperResult.transcript) {
                whisperTranscript = whisperResult.transcript
                whisperSucceeded = true
              }
            }
            // If Whisper failed, fall through to Claude summary — no pipeline block
          }

          // Determine provenance: observed if HeyGen URL + Whisper, derived if upload + Whisper, inferred if Claude fallback
          const transcriptProvenance = whisperSucceeded
            ? (isUpload ? "derived" : "observed")
            : "inferred"

          const transcriptPrompt = whisperSucceeded
            ? `You are DigitAlchemy\u00ae transcript analyst. A real transcript was extracted via Whisper. Return JSON only.

TRANSCRIPT (extracted via audio transcription — provenance: ${transcriptProvenance}):
${whisperTranscript!.slice(0, 4000)}

TASK: ${task}
CONTEXT: ${contextStr}

Return ONLY this JSON:
{
  "status": { "value": "Transcript extracted via Whisper audio transcription", "provenance": "${transcriptProvenance}", "confidence": "high" },
  "topic": { "value": "short plain-English topic/title for this content (5-10 words max)", "provenance": "${transcriptProvenance}", "confidence": "high" },
  "summary": { "value": "2-4 sentence summary of what the speaker/content covers", "provenance": "${transcriptProvenance}", "confidence": "high" },
  "transcriptExcerpt": { "value": "first 2-3 meaningful sentences from the transcript verbatim", "provenance": "${transcriptProvenance}", "confidence": "high" },
  "keyQuotes": [{ "value": "exact quote from transcript", "provenance": "${transcriptProvenance}", "confidence": "high" }],
  "hookCandidates": [{ "value": "hook derived from transcript", "provenance": "${transcriptProvenance}", "confidence": "high", "note": "why this works" }]
}

IMPORTANT:
- "topic" must be a short plain-English label derived from what is actually said in the transcript (e.g. "Blissful Breeze massage promotion", "DigitAlchemy product walkthrough"). NEVER use the filename.
- "summary" must be a real 2-4 sentence description of the content, NOT a status message
- "transcriptExcerpt" must be actual words from the transcript, verbatim
Extract 2-3 real keyQuotes from the transcript and 3 hookCandidates.`
            : `You are DigitAlchemy\u00ae transcript analyst. No audio transcript available. Return JSON only.

TASK: ${task}
CONTENT DETECTED: ${JSON.stringify(contentData)}${videoContext}
CONTEXT: ${contextStr}

Return ONLY this JSON:
{
  "status": { "value": "No audio transcript available — AI summary only", "provenance": "inferred", "confidence": "medium" },
  "topic": { "value": "short plain-English topic/title based on available context, or null", "provenance": "inferred", "confidence": "medium" },
  "summary": { "value": "2-4 sentence description based on available metadata and task context, or null if nothing meaningful", "provenance": "inferred", "confidence": "medium" },
  "transcriptExcerpt": null,
  "keyQuotes": [{ "value": "string", "provenance": "inferred", "confidence": "medium" }],
  "hookCandidates": [{ "value": "string", "provenance": "inferred", "confidence": "medium", "note": "why this works as a hook" }]
}

IMPORTANT: "topic" must be a descriptive label, NOT the filename. If you cannot determine a meaningful topic, return null.
Provide 2-3 keyQuotes and 3 hookCandidates based on the topic and content detected.`

          const transcriptData = await callClaude(transcriptPrompt, 800)
          emit("section.ready", { sectionId: "transcript", label: "Transcript & key moments", data: transcriptData })
          await updateSection(job.id, "transcript", transcriptData)

          // Update v2 job with transcript info — prefer real summary over raw transcript or status string
          const tSummary = (transcriptData.summary as { value?: string })?.value ?? null
          const tExcerpt = (transcriptData.transcriptExcerpt as { value?: string })?.value ?? null
          const ciSummary = (contentData.summary as { value?: string })?.value ?? null
          const realSummary = tSummary ?? ciSummary ?? (whisperTranscript ? whisperTranscript.slice(0, 500) : null)
          try {
            await updateJobV2(jobV2.id, {
              ingestion: {
                title: videoMeta?.title ?? null,
                duration: videoMeta?.duration ? `${Math.round(videoMeta.duration)}s` : null,
                thumbnail: videoMeta?.thumbnailUrl ?? null,
                transcriptSummary: realSummary,
                transcriptStatus: whisperSucceeded ? "complete" : "failed",
                provenance: transcriptProvenance as "observed" | "derived" | "inferred" | "unavailable",
              },
            })
          } catch { /* non-critical */ }

          // Extract Content DNA from transcript (non-blocking)
          if (whisperTranscript && requestUid) {
          try {
            const platform = (intakeContext?.platform as string) || "tiktok"
            const dna = await extractContentDNA(whisperTranscript, platform, {
              duration: videoMeta?.duration,
              title: videoMeta?.title,
              description: undefined,
            })
            if (dna) {
              const dnaSample = {
                sourceType: (isUpload ? "upload" : "url") as "upload" | "url",
                platform,
                transcript: whisperTranscript.slice(0, 500),
                topics: dna.topics,
                tone: dna.tone,
                visualStyle: dna.visualStyle,
                audioPreference: dna.audioPreference,
                captionStyle: dna.captionStyle,
                hashtags: dna.hashtags,
                duration: videoMeta?.duration ? Math.round(videoMeta.duration) : 0,
                analyzedAt: new Date().toISOString(),
              }
              await saveDNASample(requestUid, dnaSample)
              const existingProfile = await loadContentProfile(requestUid)
              const updatedProfile = mergeProfileWithSample(existingProfile, dnaSample)
              await saveContentProfile(requestUid, updatedProfile)
              console.log("[CONTENT DNA] Profile updated:", requestUid, "samples:", updatedProfile.sampleCount, "confidence:", updatedProfile.confidence)
            }
          } catch (err) { console.log("[CONTENT DNA] Non-critical error:", err) }
          }
        }

        // Phase 1 complete — ingestion + content intelligence done
        // Trend, packs, and agent plan are generated in Phase 2 after platform selection
        await updateJobStatus(job.id, "complete")
        await updateJobStatusV2(jobV2.id, "platform_selection_pending")
        console.log("[analyze] Phase 1 complete — awaiting platform selection. jobIdV2:", jobV2.id)
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
    },
  })
}
