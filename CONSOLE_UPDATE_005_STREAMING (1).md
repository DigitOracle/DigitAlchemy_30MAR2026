# DigitAlchemy® Console — Streaming Operator Dashboard
# Stage 1: Job architecture, SSE streaming, Content Intelligence, Transcript cards
# 30 March 2026

---

## WHAT THIS BUILDS

Replace the black-box single-request model with a live streaming operator dashboard.

User submits → job created → SSE stream opens → cards appear progressively as processors complete.

No more waiting for a final report. Intelligence appears in real time.

---

## STAGE 1 — TYPES

Add these to types/index.ts:

```ts
// ── Job architecture ─────────────────────────────────────────────────────────

export type JobStatus = "created" | "planning" | "running" | "complete" | "failed"

export type JobEvent = {
  type:
    | "job.created"
    | "workflow.detected"
    | "plan.generated"
    | "processor.started"
    | "processor.completed"
    | "section.ready"
    | "job.completed"
    | "job.failed"
  jobId: string
  timestamp: string
  data: Record<string, unknown>
}

export type SectionId =
  | "intake-summary"
  | "execution-timeline"
  | "content-intelligence"
  | "transcript"
  | "trend-intelligence"
  | "platform-packs"
  | "agent-plan"
  | "actions"

export type SectionStatus = "pending" | "streaming" | "ready" | "failed"

export type OutputItem = {
  label: string
  value: string | string[]
  provenance: ProvenanceType
  confidence: ConfidenceLevel
  note?: string
}

export type ContentIntelligence = {
  assetType: OutputItem
  duration?: OutputItem
  tone: OutputItem
  language: OutputItem
  audienceFit: OutputItem
  topic: OutputItem
  subject: OutputItem
  keywords: OutputItem
}

export type TranscriptSection = {
  status: OutputItem
  keyQuotes: OutputItem[]
  hookCandidates: OutputItem[]
  segmentNotes?: OutputItem[]
}

export type PlatformTrend = {
  platform: string
  trendingHashtags: OutputItem
  emergingHashtags: OutputItem
  audioSuggestions: OutputItem
  formatFit: OutputItem
  trendNotes: OutputItem
}

export type PlatformPack = {
  platform: string
  hookOptions: OutputItem[]
  captionVariants: OutputItem[]
  hashtags: OutputItem
  musicSuggestion: OutputItem
  postingGuidance: OutputItem
}

export type JobSection = {
  id: SectionId
  label: string
  status: SectionStatus
  data?: Record<string, unknown>
  readyAt?: string
}

export type Job = {
  id: string
  status: JobStatus
  workflowId: string | null
  workflowLabel: string | null
  task: string
  intakeContext: Record<string, string | string[]>
  sections: JobSection[]
  createdAt: string
  completedAt?: string
  error?: string
}
```

Commit: "feat: job + streaming types"

---

## STAGE 2 — JOB STORE

Create lib/jobStore.ts:

```ts
// lib/jobStore.ts
// In-memory job store for MVP. Replace with Redis/Firestore for production.

import type { Job, JobSection, SectionId } from "@/types"

const jobs = new Map<string, Job>()

export function createJob(
  task: string,
  workflowId: string | null,
  workflowLabel: string | null,
  intakeContext: Record<string, string | string[]>
): Job {
  const id = `job-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
  const sections: JobSection[] = [
    { id: "intake-summary", label: "Intake summary", status: "pending" },
    { id: "execution-timeline", label: "Execution plan", status: "pending" },
    { id: "content-intelligence", label: "Content intelligence", status: "pending" },
    { id: "transcript", label: "Transcript & key moments", status: "pending" },
    { id: "trend-intelligence", label: "Trend intelligence", status: "pending" },
    { id: "platform-packs", label: "Platform packs", status: "pending" },
    { id: "agent-plan", label: "Agent & MCP plan", status: "pending" },
    { id: "actions", label: "Actions", status: "pending" },
  ]

  const job: Job = {
    id,
    status: "created",
    workflowId,
    workflowLabel,
    task,
    intakeContext,
    sections,
    createdAt: new Date().toISOString(),
  }

  jobs.set(id, job)
  return job
}

export function getJob(id: string): Job | undefined {
  return jobs.get(id)
}

export function updateJobStatus(id: string, status: Job["status"], error?: string) {
  const job = jobs.get(id)
  if (!job) return
  job.status = status
  if (error) job.error = error
  if (status === "complete" || status === "failed") {
    job.completedAt = new Date().toISOString()
  }
  jobs.set(id, job)
}

export function updateSection(id: string, sectionId: SectionId, data: Record<string, unknown>) {
  const job = jobs.get(id)
  if (!job) return
  const section = job.sections.find((s) => s.id === sectionId)
  if (!section) return
  section.status = "ready"
  section.data = data
  section.readyAt = new Date().toISOString()
  jobs.set(id, job)
}

export function setSectionStreaming(id: string, sectionId: SectionId) {
  const job = jobs.get(id)
  if (!job) return
  const section = job.sections.find((s) => s.id === sectionId)
  if (section) {
    section.status = "streaming"
    jobs.set(id, job)
  }
}
```

Commit: "feat: in-memory job store"

---

## STAGE 3 — JOB CREATION ROUTE

Create app/api/analyze/route.ts (replace existing):

```ts
import { NextRequest, NextResponse } from "next/server"
import { createJob } from "@/lib/jobStore"

export const runtime = "nodejs"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { task, workflowId, workflowLabel, intakeContext } = body

    if (!task || typeof task !== "string" || task.trim().length < 5) {
      return NextResponse.json({ success: false, error: "Task description required." }, { status: 400 })
    }

    const job = createJob(
      task.trim(),
      workflowId ?? null,
      workflowLabel ?? null,
      intakeContext ?? {}
    )

    return NextResponse.json({ success: true, jobId: job.id })
  } catch (err) {
    console.error("[analyze] error:", err)
    return NextResponse.json({ success: false, error: "Failed to create job" }, { status: 500 })
  }
}
```

Commit: "feat: job creation route — returns jobId immediately"

---

## STAGE 4 — JOB STATUS ROUTE

Create app/api/analyze/[jobId]/route.ts:

```ts
import { NextRequest, NextResponse } from "next/server"
import { getJob } from "@/lib/jobStore"

export async function GET(req: NextRequest, { params }: { params: { jobId: string } }) {
  const job = getJob(params.jobId)
  if (!job) {
    return NextResponse.json({ success: false, error: "Job not found" }, { status: 404 })
  }
  return NextResponse.json({ success: true, job })
}
```

Commit: "feat: job status route"

---

## STAGE 5 — SSE STREAMING ROUTE

Create app/api/analyze/[jobId]/events/route.ts:

```ts
import { NextRequest } from "next/server"
import { getJob, updateJobStatus, updateSection, setSectionStreaming } from "@/lib/jobStore"
import { getAllServers, serversToRegistryString } from "@/lib/registry"
import { agentsToProfileString } from "@/lib/agentProfiles"
import { getStandardsContext } from "@/lib/standards"
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
      "platform": "TikTok|Instagram|LinkedIn|X/Twitter|YouTube Shorts",
      "trendingHashtags": { "value": ["string"], "provenance": "inferred", "confidence": "medium|low", "note": "string" },
      "emergingHashtags": { "value": ["string"], "provenance": "inferred", "confidence": "medium|low" },
      "audioSuggestions": { "value": ["string"], "provenance": "inferred", "confidence": "medium|low" },
      "formatFit": { "value": "string", "provenance": "inferred", "confidence": "high|medium|low" },
      "trendNotes": { "value": "string", "provenance": "inferred", "confidence": "medium|low" }
    }
  ],
  "platformPacks": [
    {
      "platform": "TikTok|Instagram|LinkedIn|X/Twitter|YouTube Shorts",
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

        // Call Claude API
        const response = await client.messages.create({
          model: "claude-sonnet-4-6",
          max_tokens: 3000,
          messages: [{ role: "user", content: prompt }],
        })

        const text = response.content[0].type === "text" ? response.content[0].text : ""

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
    }
  })
}
```

Commit: "feat: SSE streaming route — progressive section emission"

---

## STAGE 6 — RESULT SECTION COMPONENTS

Create components/sections/IntakeSummaryCard.tsx:

```tsx
import type { Job } from "@/types"

export function IntakeSummaryCard({ data }: { data: Record<string, unknown> }) {
  const context = data.intakeContext as Record<string, string | string[]> | undefined
  return (
    <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Intake summary</h3>
      <p className="text-sm text-gray-800 mb-3">{data.task as string}</p>
      {context && Object.keys(context).length > 0 && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(context).map(([k, v]) => (
            <span key={k} className="text-xs bg-gray-50 border border-gray-100 text-gray-600 px-2 py-1 rounded">
              <span className="text-gray-400">{k}:</span> {Array.isArray(v) ? v.join(", ") : v}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
```

Create components/sections/ExecutionTimelineCard.tsx:

```tsx
const statusColors = {
  running: "bg-[#b87333]",
  complete: "bg-green-500",
  pending: "bg-gray-200",
  failed: "bg-red-500",
}

export function ExecutionTimelineCard({ data }: { data: Record<string, unknown> }) {
  const steps = data.steps as { label: string; status: string }[] | undefined
  return (
    <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Execution plan</h3>
      <div className="flex items-center gap-0">
        {steps?.map((step, i) => (
          <div key={i} className="flex items-center gap-0 flex-1">
            <div className="flex flex-col items-center gap-1">
              <div className={`w-3 h-3 rounded-full ${statusColors[step.status as keyof typeof statusColors] ?? "bg-gray-200"}`} />
              <span className="text-xs text-gray-500 text-center leading-tight max-w-16">{step.label}</span>
            </div>
            {i < (steps.length - 1) && <div className="flex-1 h-px bg-gray-200 mb-4 mx-1" />}
          </div>
        ))}
      </div>
    </div>
  )
}
```

Create components/sections/ProvenanceBadge.tsx:

```tsx
import type { ProvenanceType, ConfidenceLevel } from "@/types"

const provenanceConfig = {
  observed: { label: "observed", className: "bg-green-50 text-green-700 border-green-200" },
  inferred: { label: "inferred", className: "bg-blue-50 text-blue-700 border-blue-200" },
  registry: { label: "registry", className: "bg-purple-50 text-purple-700 border-purple-200" },
  "user-provided": { label: "provided", className: "bg-gray-50 text-gray-600 border-gray-200" },
}

const confidenceConfig = {
  high: "●●●",
  medium: "●●○",
  low: "●○○",
}

export function ProvenanceBadge({ provenance, confidence }: { provenance: ProvenanceType; confidence: ConfidenceLevel }) {
  const pc = provenanceConfig[provenance] ?? provenanceConfig.inferred
  return (
    <span className="inline-flex items-center gap-1">
      <span className={`text-xs px-1.5 py-0.5 rounded border ${pc.className}`}>{pc.label}</span>
      <span className="text-xs text-gray-400 font-mono">{confidenceConfig[confidence]}</span>
    </span>
  )
}
```

Create components/sections/ContentIntelligenceCard.tsx:

```tsx
import { ProvenanceBadge } from "./ProvenanceBadge"
import type { ProvenanceType, ConfidenceLevel } from "@/types"

type OutputItem = { value: string | string[]; provenance: ProvenanceType; confidence: ConfidenceLevel; note?: string }

const fieldLabels: Record<string, string> = {
  assetType: "Asset type",
  duration: "Duration",
  tone: "Tone",
  language: "Language",
  audienceFit: "Audience fit",
  topic: "Topic",
  subject: "Subject",
  keywords: "Keywords",
}

export function ContentIntelligenceCard({ data }: { data: Record<string, unknown> }) {
  const entries = Object.entries(data).filter(([k]) => k in fieldLabels)
  return (
    <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <span className="w-2 h-2 rounded-full bg-[#190A46]" />
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Content intelligence</h3>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {entries.map(([key, item]) => {
          const output = item as OutputItem
          const val = Array.isArray(output.value) ? output.value.join(", ") : output.value
          return (
            <div key={key} className="border border-gray-50 rounded-lg p-3 bg-gray-50/50">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-gray-500">{fieldLabels[key]}</span>
                <ProvenanceBadge provenance={output.provenance} confidence={output.confidence} />
              </div>
              <p className="text-sm text-gray-900">{val}</p>
              {output.note && <p className="text-xs text-gray-400 mt-1">{output.note}</p>}
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

Create components/sections/TranscriptCard.tsx:

```tsx
import { ProvenanceBadge } from "./ProvenanceBadge"
import type { ProvenanceType, ConfidenceLevel } from "@/types"

type OutputItem = { value: string; provenance: ProvenanceType; confidence: ConfidenceLevel; note?: string }

export function TranscriptCard({ data }: { data: Record<string, unknown> }) {
  const status = data.status as OutputItem | undefined
  const keyQuotes = data.keyQuotes as OutputItem[] | undefined
  const hookCandidates = data.hookCandidates as OutputItem[] | undefined

  return (
    <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <span className="w-2 h-2 rounded-full bg-[#b87333]" />
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Transcript & key moments</h3>
        {status && <ProvenanceBadge provenance={status.provenance} confidence={status.confidence} />}
      </div>

      {status && (
        <p className="text-sm text-gray-600 mb-4 bg-gray-50 rounded-lg px-3 py-2">{status.value}</p>
      )}

      {hookCandidates && hookCandidates.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-semibold text-[#190A46] uppercase tracking-wide mb-2">Hook candidates</p>
          <div className="space-y-2">
            {hookCandidates.map((hook, i) => (
              <div key={i} className="border border-[#190A46]/10 bg-[#190A46]/5 rounded-lg p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium text-gray-900">"{hook.value}"</p>
                  <ProvenanceBadge provenance={hook.provenance} confidence={hook.confidence} />
                </div>
                {hook.note && <p className="text-xs text-gray-500 mt-1">{hook.note}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {keyQuotes && keyQuotes.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Key quotes</p>
          <div className="space-y-2">
            {keyQuotes.map((quote, i) => (
              <div key={i} className="flex items-start gap-2 py-2 border-b border-gray-50 last:border-0">
                <span className="text-[#b87333] shrink-0 mt-0.5">›</span>
                <p className="text-sm text-gray-700 italic">"{quote.value}"</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
```

Create components/sections/TrendIntelligenceCard.tsx:

```tsx
import { ProvenanceBadge } from "./ProvenanceBadge"
import type { ProvenanceType, ConfidenceLevel } from "@/types"

type OutputItem = { value: string | string[]; provenance: ProvenanceType; confidence: ConfidenceLevel; note?: string }
type PlatformTrend = {
  platform: string
  trendingHashtags: OutputItem
  emergingHashtags: OutputItem
  audioSuggestions: OutputItem
  formatFit: OutputItem
  trendNotes: OutputItem
}

const platformColors: Record<string, string> = {
  TikTok: "bg-black text-white",
  Instagram: "bg-gradient-to-r from-purple-500 to-pink-500 text-white",
  LinkedIn: "bg-blue-700 text-white",
  "X/Twitter": "bg-black text-white",
  "YouTube Shorts": "bg-red-600 text-white",
}

export function TrendIntelligenceCard({ data }: { data: Record<string, unknown> }) {
  const platforms = data.platforms as PlatformTrend[] | undefined
  if (!platforms?.length) return null

  return (
    <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <span className="w-2 h-2 rounded-full bg-green-500" />
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Trend intelligence</h3>
      </div>
      <div className="space-y-5">
        {platforms.map((platform, i) => (
          <div key={i} className="border border-gray-100 rounded-lg overflow-hidden">
            <div className={`px-3 py-2 text-xs font-bold ${platformColors[platform.platform] ?? "bg-gray-100 text-gray-800"}`}>
              {platform.platform}
            </div>
            <div className="p-3 space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-gray-500">Trending hashtags</span>
                  <ProvenanceBadge provenance={platform.trendingHashtags.provenance} confidence={platform.trendingHashtags.confidence} />
                </div>
                <div className="flex flex-wrap gap-1">
                  {(Array.isArray(platform.trendingHashtags.value) ? platform.trendingHashtags.value : [platform.trendingHashtags.value]).map((tag, j) => (
                    <span key={j} className="text-xs bg-gray-900 text-white px-2 py-0.5 rounded">#{tag.replace(/^#/, "")}</span>
                  ))}
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-gray-500">Audio suggestions</span>
                  <ProvenanceBadge provenance={platform.audioSuggestions.provenance} confidence={platform.audioSuggestions.confidence} />
                </div>
                <p className="text-sm text-gray-700">
                  {Array.isArray(platform.audioSuggestions.value) ? platform.audioSuggestions.value.join(", ") : platform.audioSuggestions.value}
                </p>
              </div>
              <div>
                <span className="text-xs text-gray-500">Format fit: </span>
                <span className="text-sm text-gray-800">{platform.formatFit.value as string}</span>
              </div>
              {platform.trendNotes?.value && (
                <p className="text-xs text-gray-500 italic">{platform.trendNotes.value as string}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
```

Create components/sections/PlatformPacksCard.tsx:

```tsx
"use client"
import { useState } from "react"
import { ProvenanceBadge } from "./ProvenanceBadge"
import type { ProvenanceType, ConfidenceLevel } from "@/types"

type OutputItem = { value: string | string[]; provenance: ProvenanceType; confidence: ConfidenceLevel }
type PlatformPack = {
  platform: string
  hookOptions: OutputItem[]
  captionVariants: OutputItem[]
  hashtags: OutputItem
  musicSuggestion: OutputItem
  postingGuidance: OutputItem
}

const platformColors: Record<string, string> = {
  TikTok: "border-black",
  Instagram: "border-purple-400",
  LinkedIn: "border-blue-700",
  "X/Twitter": "border-gray-800",
  "YouTube Shorts": "border-red-500",
}

export function PlatformPacksCard({ data }: { data: Record<string, unknown> }) {
  const packs = data.packs as PlatformPack[] | undefined
  const [activePlatform, setActivePlatform] = useState(packs?.[0]?.platform ?? "")
  const [copied, setCopied] = useState<string | null>(null)

  if (!packs?.length) return null

  const active = packs.find((p) => p.platform === activePlatform) ?? packs[0]

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
  }

  const hashtagsStr = Array.isArray(active.hashtags.value)
    ? active.hashtags.value.map((h: string) => `#${h.replace(/^#/, "")}`).join(" ")
    : String(active.hashtags.value)

  return (
    <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <span className="w-2 h-2 rounded-full bg-[#b87333]" />
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Platform packs</h3>
      </div>

      {/* Platform tabs */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {packs.map((pack) => (
          <button
            key={pack.platform}
            onClick={() => setActivePlatform(pack.platform)}
            className={`text-xs font-medium px-3 py-1.5 rounded-full border-2 transition-colors ${
              activePlatform === pack.platform
                ? `${platformColors[pack.platform] ?? "border-[#190A46]"} bg-gray-50`
                : "border-gray-200 text-gray-500 hover:border-gray-300"
            }`}
          >
            {pack.platform}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {/* Hooks */}
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Hook options</p>
          <div className="space-y-2">
            {active.hookOptions.map((hook, i) => (
              <div key={i} className="flex items-start justify-between gap-2 bg-[#190A46]/5 border border-[#190A46]/10 rounded-lg p-3">
                <p className="text-sm text-gray-900">{hook.value as string}</p>
                <button
                  onClick={() => copyToClipboard(hook.value as string, `hook-${i}`)}
                  className="text-xs text-gray-400 hover:text-[#190A46] shrink-0"
                >
                  {copied === `hook-${i}` ? "✓" : "Copy"}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Captions */}
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Caption variants</p>
          <div className="space-y-2">
            {active.captionVariants.map((cap, i) => (
              <div key={i} className="flex items-start justify-between gap-2 bg-gray-50 border border-gray-100 rounded-lg p-3">
                <p className="text-sm text-gray-800 whitespace-pre-wrap">{cap.value as string}</p>
                <button
                  onClick={() => copyToClipboard(cap.value as string, `cap-${i}`)}
                  className="text-xs text-gray-400 hover:text-[#190A46] shrink-0"
                >
                  {copied === `cap-${i}` ? "✓" : "Copy"}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Hashtags */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Hashtags</p>
            <div className="flex items-center gap-2">
              <ProvenanceBadge provenance={active.hashtags.provenance} confidence={active.hashtags.confidence} />
              <button
                onClick={() => copyToClipboard(hashtagsStr, "hashtags")}
                className="text-xs text-gray-400 hover:text-[#190A46]"
              >
                {copied === "hashtags" ? "✓ Copied" : "Copy all"}
              </button>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(Array.isArray(active.hashtags.value) ? active.hashtags.value : [active.hashtags.value]).map((tag: string, i: number) => (
              <span
                key={i}
                onClick={() => copyToClipboard(`#${tag.replace(/^#/, "")}`, `tag-${i}`)}
                className="text-xs bg-gray-900 text-white px-2 py-1 rounded cursor-pointer hover:bg-[#190A46] transition-colors"
              >
                #{tag.replace(/^#/, "")}
              </span>
            ))}
          </div>
        </div>

        {/* Music */}
        <div className="flex items-center justify-between bg-gray-50 rounded-lg p-3">
          <div>
            <span className="text-xs text-gray-500">Music suggestion</span>
            <p className="text-sm text-gray-800">{active.musicSuggestion.value as string}</p>
          </div>
          <ProvenanceBadge provenance={active.musicSuggestion.provenance} confidence={active.musicSuggestion.confidence} />
        </div>

        {/* Posting guidance */}
        <div className="bg-amber-50 border border-amber-100 rounded-lg p-3">
          <span className="text-xs font-medium text-amber-700">Posting guidance</span>
          <p className="text-sm text-amber-900 mt-0.5">{active.postingGuidance.value as string}</p>
        </div>
      </div>
    </div>
  )
}
```

Create components/sections/AgentPlanCard.tsx:

```tsx
import type { RecommendedAgent, RecommendedMCP } from "@/types"

export function AgentPlanCard({ data }: { data: Record<string, unknown> }) {
  const agents = data.recommendedAgents as RecommendedAgent[] | undefined
  const mcps = data.recommendedMCPs as RecommendedMCP[] | undefined
  const steps = data.executionOrder as string[] | undefined
  const warnings = data.warnings as string[] | undefined
  const nextActions = data.nextActions as string[] | undefined

  return (
    <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <span className="w-2 h-2 rounded-full bg-purple-500" />
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Agent & MCP plan</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        {agents && agents.length > 0 && (
          <div>
            <p className="text-xs font-medium text-gray-500 mb-2">Agents</p>
            <div className="space-y-2">
              {agents.map((agent) => (
                <div key={agent.id} className="flex items-start gap-2 text-sm">
                  <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-[#190A46] mt-1.5" />
                  <div>
                    <span className="font-medium text-gray-900">{agent.displayName}</span>
                    <span className="text-gray-400 text-xs ml-1">— {agent.shortDescription}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {mcps && mcps.length > 0 && (
          <div>
            <p className="text-xs font-medium text-gray-500 mb-2">MCP tools</p>
            <div className="space-y-1">
              {mcps.filter(m => m.priority === "core").map((mcp, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <span className="text-xs bg-[#190A46] text-white px-1.5 py-0.5 rounded">core</span>
                  <span className="text-gray-800">{mcp.name}</span>
                </div>
              ))}
              {mcps.filter(m => m.priority === "supporting").map((mcp, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <span className="text-xs bg-gray-100 text-gray-600 border border-gray-200 px-1.5 py-0.5 rounded">supporting</span>
                  <span className="text-gray-700">{mcp.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {steps && steps.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-medium text-gray-500 mb-2">Execution order</p>
          <ol className="space-y-1">
            {steps.map((step, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                <span className="shrink-0 w-5 h-5 rounded-full bg-[#190A46] text-white text-xs flex items-center justify-center">{i + 1}</span>
                <span className="mt-0.5">{step}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {warnings && warnings.length > 0 && (
        <div className="bg-amber-50 border border-amber-100 rounded-lg p-3 mb-3">
          {warnings.map((w, i) => (
            <p key={i} className="text-xs text-amber-800 flex items-start gap-1"><span>⚠</span>{w}</p>
          ))}
        </div>
      )}

      {nextActions && nextActions.length > 0 && (
        <div>
          <p className="text-xs font-medium text-gray-500 mb-2">Next actions</p>
          {nextActions.map((a, i) => (
            <p key={i} className="text-sm text-gray-700 flex items-start gap-2">
              <span className="text-[#b87333] shrink-0">→</span>{a}
            </p>
          ))}
        </div>
      )}
    </div>
  )
}
```

Commit: "feat: all result section cards — IntakeSummary, ExecutionTimeline, ContentIntelligence, Transcript, TrendIntelligence, PlatformPacks, AgentPlan"

---

## STAGE 7 — STREAMING CLIENT + MAIN PAGE

Create lib/useJobStream.ts:

```ts
"use client"
import { useState, useCallback } from "react"
import type { SectionId } from "@/types"

export type StreamingSection = {
  id: SectionId
  label: string
  status: "pending" | "streaming" | "ready"
  data?: Record<string, unknown>
}

export type StreamState = {
  jobId: string | null
  status: "idle" | "creating" | "streaming" | "complete" | "failed"
  workflowLabel: string | null
  sections: StreamingSection[]
  error: string | null
}

const SECTION_ORDER: SectionId[] = [
  "intake-summary",
  "execution-timeline",
  "content-intelligence",
  "transcript",
  "trend-intelligence",
  "platform-packs",
  "agent-plan",
  "actions",
]

export function useJobStream() {
  const [state, setState] = useState<StreamState>({
    jobId: null,
    status: "idle",
    workflowLabel: null,
    sections: [],
    error: null,
  })

  const startJob = useCallback(async (
    task: string,
    workflowId: string | null,
    workflowLabel: string | null,
    intakeContext: Record<string, string | string[]>
  ) => {
    setState({ jobId: null, status: "creating", workflowLabel, sections: [], error: null })

    try {
      // Create job
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task, workflowId, workflowLabel, intakeContext }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error)

      const jobId = data.jobId
      setState((s) => ({ ...s, jobId, status: "streaming" }))

      // Open SSE stream
      const eventSource = new EventSource(`/api/analyze/${jobId}/events`)

      eventSource.addEventListener("section.ready", (e) => {
        const payload = JSON.parse(e.data)
        setState((s) => {
          const existing = s.sections.find((sec) => sec.id === payload.sectionId)
          if (existing) {
            return {
              ...s,
              sections: s.sections.map((sec) =>
                sec.id === payload.sectionId
                  ? { ...sec, status: "ready", data: payload.data }
                  : sec
              ),
            }
          }
          // Insert in correct order
          const newSection: StreamingSection = {
            id: payload.sectionId,
            label: payload.label,
            status: "ready",
            data: payload.data,
          }
          const newSections = [...s.sections, newSection].sort(
            (a, b) => SECTION_ORDER.indexOf(a.id) - SECTION_ORDER.indexOf(b.id)
          )
          return { ...s, sections: newSections }
        })
      })

      eventSource.addEventListener("job.completed", () => {
        setState((s) => ({ ...s, status: "complete" }))
        eventSource.close()
      })

      eventSource.addEventListener("job.failed", (e) => {
        const payload = JSON.parse(e.data)
        setState((s) => ({ ...s, status: "failed", error: payload.error }))
        eventSource.close()
      })

      eventSource.onerror = () => {
        setState((s) => ({ ...s, status: "failed", error: "Stream connection lost" }))
        eventSource.close()
      }

    } catch (err) {
      setState((s) => ({
        ...s,
        status: "failed",
        error: err instanceof Error ? err.message : "Failed to start job",
      }))
    }
  }, [])

  const reset = useCallback(() => {
    setState({ jobId: null, status: "idle", workflowLabel: null, sections: [], error: null })
  }, [])

  return { state, startJob, reset }
}
```

Replace app/page.tsx entirely:

```tsx
"use client"
import { TaskInput } from "@/components/TaskInput"
import { useJobStream } from "@/lib/useJobStream"
import { IntakeSummaryCard } from "@/components/sections/IntakeSummaryCard"
import { ExecutionTimelineCard } from "@/components/sections/ExecutionTimelineCard"
import { ContentIntelligenceCard } from "@/components/sections/ContentIntelligenceCard"
import { TranscriptCard } from "@/components/sections/TranscriptCard"
import { TrendIntelligenceCard } from "@/components/sections/TrendIntelligenceCard"
import { PlatformPacksCard } from "@/components/sections/PlatformPacksCard"
import { AgentPlanCard } from "@/components/sections/AgentPlanCard"
import type { WorkflowDefinition, IntakeState, CompoundTaskPlan } from "@/types"

function SectionRenderer({ id, data }: { id: string; data: Record<string, unknown> }) {
  switch (id) {
    case "intake-summary": return <IntakeSummaryCard data={data} />
    case "execution-timeline": return <ExecutionTimelineCard data={data} />
    case "content-intelligence": return <ContentIntelligenceCard data={data} />
    case "transcript": return <TranscriptCard data={data} />
    case "trend-intelligence": return <TrendIntelligenceCard data={data} />
    case "platform-packs": return <PlatformPacksCard data={data} />
    case "agent-plan": return <AgentPlanCard data={data} />
    default: return null
  }
}

const stageLabels: Record<string, string> = {
  idle: "",
  creating: "Creating job…",
  streaming: "Analysis running…",
  complete: "Complete",
  failed: "Failed",
}

export default function ConsolePage() {
  const { state, startJob, reset } = useJobStream()
  const loading = state.status === "creating" || state.status === "streaming"

  const handleSubmit = async (
    task: string,
    workflow: WorkflowDefinition | null,
    intakeState: IntakeState,
    _compoundPlan: CompoundTaskPlan | null
  ) => {
    const context: Record<string, string | string[]> = {}
    for (const [key, value] of Object.entries(intakeState)) {
      if (!value) continue
      if (typeof value === "object" && !Array.isArray(value) && "originalName" in value) continue
      if (Array.isArray(value)) context[key] = value as string[]
      else if (typeof value === "string") context[key] = value
    }

    await startJob(task, workflow?.id ?? null, workflow?.label ?? null, context)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded bg-[#190A46] flex items-center justify-center">
              <span className="text-white text-xs font-bold">DA</span>
            </div>
            <div>
              <span className="text-sm font-semibold text-gray-900">DigitAlchemy®</span>
              <span className="text-sm text-gray-400 ml-2">Console</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {state.status !== "idle" && (
              <div className="flex items-center gap-2">
                {loading && <div className="w-2 h-2 rounded-full bg-[#b87333] animate-pulse" />}
                {state.status === "complete" && <div className="w-2 h-2 rounded-full bg-green-500" />}
                {state.status === "failed" && <div className="w-2 h-2 rounded-full bg-red-500" />}
                <span className="text-xs text-gray-500">{stageLabels[state.status]}</span>
              </div>
            )}
            {(state.status === "complete" || state.status === "failed") && (
              <button
                onClick={reset}
                className="text-xs text-gray-400 hover:text-[#190A46] border border-gray-200 px-3 py-1 rounded-lg"
              >
                New task
              </button>
            )}
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-green-400" />
              <span className="text-xs text-gray-500">Connected</span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        {state.status === "idle" && (
          <div className="mb-6">
            <h1 className="text-xl font-semibold text-gray-900">Task analysis</h1>
            <p className="text-sm text-gray-500 mt-1">
              Describe a task. Command Desk classifies it, gathers context, and streams intelligence as it arrives.
            </p>
          </div>
        )}

        <div className="space-y-5">
          {state.status === "idle" && (
            <TaskInput onSubmit={handleSubmit} loading={false} />
          )}

          {loading && state.sections.length === 0 && (
            <div className="bg-white border border-gray-100 rounded-xl p-8 flex items-center justify-center gap-3">
              <div className="w-4 h-4 border-2 border-[#190A46] border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-gray-500">Initialising analysis pipeline…</p>
            </div>
          )}

          {/* Progressive section rendering */}
          {state.sections
            .filter((s) => s.status === "ready" && s.data && s.id !== "actions")
            .map((section) => (
              <div key={section.id} className="animate-fade-in">
                <SectionRenderer id={section.id} data={section.data!} />
              </div>
            ))}

          {state.status === "failed" && state.error && (
            <div className="bg-red-50 border border-red-100 rounded-xl p-5">
              <p className="text-sm font-medium text-red-800">Analysis failed</p>
              <p className="text-sm text-red-600 mt-1">{state.error}</p>
              <button onClick={reset} className="text-xs text-red-500 hover:underline mt-2">Try again</button>
            </div>
          )}

          {state.status === "complete" && (
            <div className="bg-green-50 border border-green-100 rounded-xl p-4 flex items-center justify-between">
              <p className="text-sm text-green-800">Analysis complete</p>
              <button onClick={reset} className="text-xs text-green-700 border border-green-200 px-3 py-1 rounded-lg hover:bg-green-100">
                New task
              </button>
            </div>
          )}
        </div>
      </main>

      <footer className="max-w-5xl mx-auto px-6 py-6 mt-8 border-t border-gray-100">
        <p className="text-xs text-gray-400">
          DigitAlchemy® Tech Limited · ADGM No. 35004 · Sky Tower, Al Reem Island, Abu Dhabi, UAE
        </p>
      </footer>
    </div>
  )
}
```

Add to app/globals.css:

```css
@keyframes fade-in {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
.animate-fade-in {
  animation: fade-in 0.3s ease-out;
}
```

Commit: "feat: streaming client hook + progressive page — sections appear as they arrive"

---

## STAGE 8 — CREATE sections directory and run build

```bash
mkdir -p components/sections
npm run build
```

Fix any TypeScript errors. Then:

```bash
git add -A
git commit -m "feat: streaming operator dashboard v1 — job architecture, SSE events, progressive section cards"
git push origin main
```

---

## WHAT THIS DELIVERS

- Job created instantly → jobId returned
- SSE stream opens → sections appear one by one as Claude completes each
- Content Intelligence card: asset type, tone, topic, keywords — each with provenance badge
- Transcript card: hook candidates highlighted, key quotes listed
- Trend Intelligence card: per-platform hashtags, audio, format notes
- Platform Packs card: tabbed per platform, hooks + captions + hashtags + music, copy buttons on every item
- Agent Plan card: agents, MCPs, execution order, warnings, next actions
- Fade-in animation on each section arrival
- Status indicator in header (pulsing amber while streaming, green when complete)
- "New task" button to reset and start again
