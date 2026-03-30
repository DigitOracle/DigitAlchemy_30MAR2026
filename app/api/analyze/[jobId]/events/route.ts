import { NextRequest } from "next/server"
import { getJob, updateJobStatus, updateSection, setSectionStreaming } from "@/lib/jobStore"
import { getAllServers, serversToRegistryString } from "@/lib/registry"
import { agentsToProfileString } from "@/lib/agentProfiles"
import Anthropic from "@anthropic-ai/sdk"

export const runtime = "nodejs"
export const maxDuration = 60

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

function emit(controller: ReadableStreamDefaultController, event: string, data: unknown) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
  controller.enqueue(new TextEncoder().encode(payload))
}

function buildSocialPrompt(task: string, intakeContext: Record<string, string | string[]>, registryStr: string, agentStr: string): string {
  const platforms = Array.isArray(intakeContext.targetPlatforms)
    ? intakeContext.targetPlatforms.join(", ")
    : intakeContext.targetPlatforms ?? "all platforms"

  return `You are the DigitAlchemy® analysis engine for a Social Video Intelligence task.

TASK: ${task}

INTAKE CONTEXT:
${Object.entries(intakeContext).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`).join("\n")}

AGENT PROFILES:
${agentStr}

MCP REGISTRY (connected):
${registryStr}

CRITICAL RULES:
1. Return ONLY valid JSON — no prose, no markdown fences
2. Return ALL sections even if some data must be inferred
3. Mark provenance accurately: "observed" if from task/context, "inferred" if reasoned
4. ScrapeCreators handles TikTok trends. Xpoz handles Instagram/Twitter. Never swap.
5. Platform packs must be specific, actionable, and platform-native

Return this exact JSON structure:

{
  "contentIntelligence": {
    "assetType": { "value": "string", "provenance": "observed|inferred", "confidence": "high|medium|low" },
    "duration": { "value": "string", "provenance": "observed|inferred", "confidence": "high|medium|low" },
    "tone": { "value": "string", "provenance": "observed|inferred", "confidence": "high|medium|low" },
    "language": { "value": "string", "provenance": "observed|inferred", "confidence": "high|medium|low" },
    "audienceFit": { "value": "string", "provenance": "observed|inferred", "confidence": "high|medium|low" },
    "topic": { "value": "string", "provenance": "observed|inferred", "confidence": "high|medium|low" },
    "subject": { "value": "string", "provenance": "observed|inferred", "confidence": "high|medium|low" },
    "keywords": { "value": ["string"], "provenance": "observed|inferred", "confidence": "high|medium|low" }
  },
  "transcript": {
    "status": { "value": "string", "provenance": "observed|inferred", "confidence": "high|medium|low" },
    "keyQuotes": [{ "value": "string", "provenance": "observed|inferred", "confidence": "high|medium|low" }],
    "hookCandidates": [{ "value": "string", "provenance": "inferred", "confidence": "high|medium|low", "note": "string" }]
  },
  "trendIntelligence": [
    {
      "platform": "${platforms}",
      "trendingHashtags": { "value": ["string"], "provenance": "inferred", "confidence": "medium|low", "note": "string" },
      "emergingHashtags": { "value": ["string"], "provenance": "inferred", "confidence": "medium|low" },
      "audioSuggestions": { "value": ["string"], "provenance": "inferred", "confidence": "medium|low" },
      "formatFit": { "value": "string", "provenance": "inferred", "confidence": "high|medium|low" },
      "trendNotes": { "value": "string", "provenance": "inferred", "confidence": "medium|low" }
    }
  ],
  "platformPacks": [
    {
      "platform": "${platforms}",
      "hookOptions": [{ "value": "string", "provenance": "inferred", "confidence": "high|medium|low" }],
      "captionVariants": [{ "value": "string", "provenance": "inferred", "confidence": "high|medium|low" }],
      "hashtags": { "value": ["string"], "provenance": "inferred", "confidence": "medium|low" },
      "musicSuggestion": { "value": "string", "provenance": "inferred", "confidence": "medium|low" },
      "postingGuidance": { "value": "string", "provenance": "inferred", "confidence": "high|medium|low" }
    }
  ],
  "agentPlan": {
    "workflowType": "string",
    "recommendedAgents": [{ "id": "string", "displayName": "string", "shortDescription": "string", "category": "string" }],
    "recommendedMCPs": [{ "name": "string", "role": "string", "priority": "core|supporting|optional", "reason": "string", "source": "registry|missing_but_recommended", "confidence": "high|medium|low" }],
    "executionOrder": ["string"],
    "warnings": ["string"],
    "nextActions": ["string"]
  }
}`
}

function buildGeneralPrompt(task: string, intakeContext: Record<string, string | string[]>, registryStr: string, agentStr: string, workflowLabel: string | null): string {
  return `You are the DigitAlchemy® analysis engine.

WORKFLOW: ${workflowLabel ?? "General Orchestration"}
TASK: ${task}

INTAKE CONTEXT:
${Object.entries(intakeContext).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`).join("\n")}

AGENT PROFILES:
${agentStr}

MCP REGISTRY (connected):
${registryStr}

Return ONLY valid JSON:
{
  "contentIntelligence": {
    "assetType": { "value": "string", "provenance": "observed|inferred", "confidence": "high|medium|low" },
    "tone": { "value": "string", "provenance": "observed|inferred", "confidence": "high|medium|low" },
    "topic": { "value": "string", "provenance": "observed|inferred", "confidence": "high|medium|low" },
    "subject": { "value": "string", "provenance": "observed|inferred", "confidence": "high|medium|low" },
    "keywords": { "value": ["string"], "provenance": "observed|inferred", "confidence": "high|medium|low" }
  },
  "agentPlan": {
    "workflowType": "string",
    "taskSummary": "string",
    "recommendedAgents": [{ "id": "string", "displayName": "string", "shortDescription": "string", "category": "string" }],
    "recommendedMCPs": [{ "name": "string", "role": "string", "priority": "core|supporting|optional", "reason": "string", "source": "registry|missing_but_recommended", "confidence": "high|medium|low" }],
    "executionOrder": ["string"],
    "dependencies": ["string"],
    "warnings": ["string"],
    "nextActions": ["string"]
  }
}`
}

export async function GET(req: NextRequest, { params }: { params: { jobId: string } }) {
  const job = getJob(params.jobId)
  if (!job) {
    return new Response("Job not found", { status: 404 })
  }

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Emit job created
        emit(controller, "job.created", { jobId: job.id, workflowLabel: job.workflowLabel })
        updateJobStatus(job.id, "planning")

        // Emit intake summary section
        setSectionStreaming(job.id, "intake-summary")
        emit(controller, "section.ready", {
          sectionId: "intake-summary",
          label: "Intake summary",
          data: {
            task: job.task,
            workflowLabel: job.workflowLabel,
            intakeContext: job.intakeContext,
          }
        })
        updateSection(job.id, "intake-summary", { task: job.task })

        // Load registry + agents
        const servers = await getAllServers()
        const connected = servers.filter((s) => s.status === "connected").slice(0, 15)
        const registryStr = serversToRegistryString(connected)
        const agentStr = agentsToProfileString()

        // Emit plan
        emit(controller, "plan.generated", {
          workflowId: job.workflowId,
          workflowLabel: job.workflowLabel,
          processorCount: 4,
        })
        emit(controller, "section.ready", {
          sectionId: "execution-timeline",
          label: "Execution plan",
          data: {
            steps: [
              { label: "Content intelligence", status: "running" },
              { label: "Transcript analysis", status: "pending" },
              { label: "Trend research", status: "pending" },
              { label: "Platform packs", status: "pending" },
            ]
          }
        })

        updateJobStatus(job.id, "running")

        // Emit processor started
        emit(controller, "processor.started", { processorId: "llm-analysis", label: "Analysis engine" })
        setSectionStreaming(job.id, "content-intelligence")

        // Build prompt based on workflow
        const isSocial = job.workflowId === "social-video-optimization"
        const prompt = isSocial
          ? buildSocialPrompt(job.task, job.intakeContext, registryStr, agentStr)
          : buildGeneralPrompt(job.task, job.intakeContext, registryStr, agentStr, job.workflowLabel)

        // Keepalive ping to prevent Vercel from killing the connection
        const pingInterval = setInterval(() => {
          controller.enqueue(new TextEncoder().encode(": ping\n\n"))
        }, 5000)

        // Call Claude API
        let text = ""
        try {
          const response = await client.messages.create({
            model: "claude-sonnet-4-6",
            max_tokens: 3000,
            messages: [{ role: "user", content: prompt }],
          })
          text = response.content[0].type === "text" ? response.content[0].text : ""
        } finally {
          clearInterval(pingInterval)
        }

        // Parse response
        let parsed: Record<string, unknown> = {}
        try {
          const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim()
          parsed = JSON.parse(cleaned)
        } catch {
          const match = text.match(/\{[\s\S]*\}/)
          if (match) {
            try { parsed = JSON.parse(match[0]) } catch { /* fall through */ }
          }
        }

        // Emit content intelligence section
        if (parsed.contentIntelligence) {
          emit(controller, "section.ready", {
            sectionId: "content-intelligence",
            label: "Content intelligence",
            data: parsed.contentIntelligence,
          })
          updateSection(job.id, "content-intelligence", parsed.contentIntelligence as Record<string, unknown>)
        }

        // Emit transcript section (social only)
        if (parsed.transcript) {
          emit(controller, "section.ready", {
            sectionId: "transcript",
            label: "Transcript & key moments",
            data: parsed.transcript,
          })
          updateSection(job.id, "transcript", parsed.transcript as Record<string, unknown>)
        }

        // Emit trend intelligence section (social only)
        if (parsed.trendIntelligence) {
          emit(controller, "section.ready", {
            sectionId: "trend-intelligence",
            label: "Trend intelligence",
            data: { platforms: parsed.trendIntelligence },
          })
          updateSection(job.id, "trend-intelligence", { platforms: parsed.trendIntelligence })
        }

        // Emit platform packs section (social only)
        if (parsed.platformPacks) {
          emit(controller, "section.ready", {
            sectionId: "platform-packs",
            label: "Platform packs",
            data: { packs: parsed.platformPacks },
          })
          updateSection(job.id, "platform-packs", { packs: parsed.platformPacks })
        }

        // Emit agent plan section
        if (parsed.agentPlan) {
          emit(controller, "section.ready", {
            sectionId: "agent-plan",
            label: "Agent & MCP plan",
            data: parsed.agentPlan,
          })
          updateSection(job.id, "agent-plan", parsed.agentPlan as Record<string, unknown>)
        }

        // Emit actions section
        emit(controller, "section.ready", {
          sectionId: "actions",
          label: "Actions",
          data: {
            canExportJson: true,
            canSendAyrshare: job.workflowId === "social-video-optimization",
            jobId: job.id,
          }
        })

        // Complete
        updateJobStatus(job.id, "complete")
        emit(controller, "job.completed", { jobId: job.id })

      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error"
        updateJobStatus(job.id, "failed", message)
        emit(controller, "job.failed", { jobId: job.id, error: message })
      } finally {
        controller.close()
      }
    }
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
      "Transfer-Encoding": "chunked",
    }
  })
}
