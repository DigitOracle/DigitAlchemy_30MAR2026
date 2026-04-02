# DigitAlchemy® Console — Streaming Architecture Fix
# Replace in-memory job store with Firestore + multi-pass LLM + stream recovery
# 30 March 2026

---

## ROOT CAUSE

In-memory Map job store fails on Vercel because:
- POST /api/analyze creates job in process-local memory
- GET /api/analyze/[jobId]/events runs in a different serverless instance
- Memory is gone. Stream dies. "Stream connection lost."

## THE FIX

1. Firestore as durable job + section store
2. Multi-pass LLM — one Claude call per section, not one giant call
3. Stream recovery — client reconnects and rebuilds from Firestore
4. Single streaming POST — no separate jobId route needed

---

## STAGE 1 — Replace lib/jobStore.ts with Firestore

Replace lib/jobStore.ts entirely:

```ts
// lib/jobStore.ts
// Firestore-backed job store — replaces in-memory Map

import type { Job, JobSection, SectionId } from "@/types"

// Firebase Admin SDK — use service account or default credentials
// For Vercel: set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY

let db: FirebaseFirestore.Firestore | null = null

async function getDb(): Promise<FirebaseFirestore.Firestore> {
  if (db) return db

  // Dynamic import to avoid edge runtime issues
  const admin = await import("firebase-admin")

  if (!admin.default.apps.length) {
    const projectId = process.env.FIRESTORE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "digitalchemy-de4b7"

    // Try service account first, fall back to default credentials
    if (process.env.FIRESTORE_PRIVATE_KEY && process.env.FIRESTORE_CLIENT_EMAIL) {
      admin.default.initializeApp({
        credential: admin.default.credential.cert({
          projectId,
          clientEmail: process.env.FIRESTORE_CLIENT_EMAIL,
          privateKey: process.env.FIRESTORE_PRIVATE_KEY.replace(/\\n/g, "\n"),
        }),
      })
    } else {
      admin.default.initializeApp({ projectId })
    }
  }

  db = admin.default.firestore()
  return db
}

const COLLECTION = "console_jobs"

export async function createJob(
  task: string,
  workflowId: string | null,
  workflowLabel: string | null,
  intakeContext: Record<string, string | string[]>
): Promise<Job> {
  const db = await getDb()
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

  await db.collection(COLLECTION).doc(id).set(job)
  return job
}

export async function getJob(id: string): Promise<Job | undefined> {
  const db = await getDb()
  const doc = await db.collection(COLLECTION).doc(id).get()
  return doc.exists ? (doc.data() as Job) : undefined
}

export async function updateJobStatus(id: string, status: Job["status"], error?: string) {
  const db = await getDb()
  const update: Record<string, unknown> = { status }
  if (error) update.error = error
  if (status === "complete" || status === "failed") {
    update.completedAt = new Date().toISOString()
  }
  await db.collection(COLLECTION).doc(id).update(update)
}

export async function updateSection(id: string, sectionId: SectionId, data: Record<string, unknown>) {
  const db = await getDb()
  const job = await getJob(id)
  if (!job) return

  const sections = job.sections.map((s) =>
    s.id === sectionId
      ? { ...s, status: "ready" as const, data, readyAt: new Date().toISOString() }
      : s
  )
  await db.collection(COLLECTION).doc(id).update({ sections })
}

export async function setSectionStreaming(id: string, sectionId: SectionId) {
  const db = await getDb()
  const job = await getJob(id)
  if (!job) return

  const sections = job.sections.map((s) =>
    s.id === sectionId ? { ...s, status: "streaming" as const } : s
  )
  await db.collection(COLLECTION).doc(id).update({ sections })
}
```

---

## STAGE 2 — Install firebase-admin

```bash
npm install firebase-admin
```

Add to package.json dependencies:
```json
"firebase-admin": "^12.0.0"
```

---

## STAGE 3 — Replace streaming route with single POST + ReadableStream

Replace app/api/analyze/route.ts entirely:

```ts
import { NextRequest } from "next/server"
import { createJob, updateJobStatus, updateSection, setSectionStreaming } from "@/lib/jobStore"
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

  const contextStr = Object.entries(intakeContext ?? {})
    .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`)
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
        emit("job.created", { jobId: job.id, workflowLabel })
        await updateJobStatus(job.id, "planning")

        // Load registry
        const servers = await getAllServers()
        const connected = servers.filter((s) => s.status === "connected").slice(0, 12)
        const registryStr = serversToRegistryString(connected)
        const agentStr = agentsToProfileString()

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
        emit("processor.started", { processorId: "content-intelligence", label: "Analysing content…" })
        await setSectionStreaming(job.id, "content-intelligence")

        const contentPrompt = `You are DigitAlchemy® content intelligence. Analyse this task and return JSON only.

TASK: ${task}
CONTEXT:
${contextStr}

Return ONLY this JSON:
{
  "assetType": { "value": "string", "provenance": "observed|inferred", "confidence": "high|medium|low" },
  "duration": { "value": "string", "provenance": "observed|inferred", "confidence": "high|medium|low" },
  "tone": { "value": "string", "provenance": "observed|inferred", "confidence": "high|medium|low" },
  "language": { "value": "string", "provenance": "observed|inferred", "confidence": "high|medium|low" },
  "audienceFit": { "value": "string", "provenance": "observed|inferred", "confidence": "high|medium|low" },
  "topic": { "value": "string", "provenance": "observed|inferred", "confidence": "high|medium|low" },
  "subject": { "value": "string", "provenance": "observed|inferred", "confidence": "high|medium|low" },
  "keywords": { "value": ["string"], "provenance": "observed|inferred", "confidence": "high|medium|low" }
}`

        const contentData = await callClaude(contentPrompt, 800)
        emit("section.ready", { sectionId: "content-intelligence", label: "Content intelligence", data: contentData })
        await updateSection(job.id, "content-intelligence", contentData)

        // PASS 2 — Transcript (social only)
        if (isSocial) {
          emit("processor.started", { processorId: "transcript", label: "Extracting transcript…" })
          await setSectionStreaming(job.id, "transcript")

          const transcriptPrompt = `You are DigitAlchemy® transcript analyst. Return JSON only.

TASK: ${task}
CONTENT DETECTED: ${JSON.stringify(contentData)}
CONTEXT: ${contextStr}

Return ONLY this JSON:
{
  "status": { "value": "string describing transcript availability", "provenance": "inferred", "confidence": "medium" },
  "keyQuotes": [{ "value": "string", "provenance": "inferred", "confidence": "medium" }],
  "hookCandidates": [{ "value": "string", "provenance": "inferred", "confidence": "high|medium", "note": "why this works as a hook" }]
}

Provide 2-3 keyQuotes and 3 hookCandidates based on the topic and content detected.`

          const transcriptData = await callClaude(transcriptPrompt, 800)
          emit("section.ready", { sectionId: "transcript", label: "Transcript & key moments", data: transcriptData })
          await updateSection(job.id, "transcript", transcriptData)
        }

        // PASS 3 — Trend Intelligence (social only)
        if (isSocial) {
          const platforms = Array.isArray(intakeContext?.targetPlatforms)
            ? intakeContext.targetPlatforms
            : [intakeContext?.targetPlatforms ?? "TikTok", "Instagram"]

          emit("processor.started", { processorId: "trend-intelligence", label: "Researching trends…" })
          await setSectionStreaming(job.id, "trend-intelligence")

          const trendPrompt = `You are DigitAlchemy® trend intelligence. Return JSON only.

TASK: ${task}
TOPIC: ${(contentData.topic as {value:string})?.value ?? "unknown"}
KEYWORDS: ${JSON.stringify((contentData.keywords as {value:string[]})?.value ?? [])}
TARGET PLATFORMS: ${platforms.join(", ")}
TARGET REGION: ${intakeContext?.targetRegion ?? "Global"}

Return ONLY this JSON — one entry per platform:
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

        // PASS 4 — Platform Packs (social only)
        if (isSocial) {
          const platforms = Array.isArray(intakeContext?.targetPlatforms)
            ? intakeContext.targetPlatforms
            : ["TikTok", "Instagram"]

          emit("processor.started", { processorId: "platform-packs", label: "Building platform packs…" })
          await setSectionStreaming(job.id, "platform-packs")

          const packsPrompt = `You are DigitAlchemy® platform pack builder. Return JSON only.

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
        { "value": "hook text — attention-grabbing opening line", "provenance": "inferred", "confidence": "high" },
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
        emit("processor.started", { processorId: "agent-plan", label: "Building agent plan…" })
        await setSectionStreaming(job.id, "agent-plan")

        const agentPrompt = `You are DigitAlchemy® orchestration planner. Return JSON only.

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
        emit("job.completed", { jobId: job.id })

      } catch (err) {
        const message = err instanceof Error ? err.message : "Analysis failed"
        console.error("[analyze stream]", err)
        try {
          await updateJobStatus(job.id, "failed", message)
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
```

---

## STAGE 4 — Replace lib/useJobStream.ts with useStream.ts

Delete lib/useJobStream.ts. Create lib/useStream.ts:

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
  status: "idle" | "streaming" | "complete" | "failed"
  workflowLabel: string | null
  sections: StreamingSection[]
  currentProcessor: string | null
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

export function useStream() {
  const [state, setState] = useState<StreamState>({
    status: "idle",
    workflowLabel: null,
    sections: [],
    currentProcessor: null,
    error: null,
  })

  const startStream = useCallback(async (
    task: string,
    workflowId: string | null,
    workflowLabel: string | null,
    intakeContext: Record<string, string | string[]>
  ) => {
    setState({ status: "streaming", workflowLabel, sections: [], currentProcessor: null, error: null })

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task, workflowId, workflowLabel, intakeContext }),
      })

      if (!response.ok || !response.body) {
        throw new Error(`HTTP ${response.status}`)
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n")
        buffer = lines.pop() ?? ""

        let currentEvent = ""
        let currentData = ""

        for (const line of lines) {
          if (line.startsWith("event: ")) {
            currentEvent = line.slice(7).trim()
          } else if (line.startsWith("data: ")) {
            currentData = line.slice(6).trim()
          } else if (line === "" && currentEvent && currentData) {
            // Process the event
            try {
              const payload = JSON.parse(currentData)

              if (currentEvent === "section.ready") {
                setState((s) => {
                  const exists = s.sections.find((sec) => sec.id === payload.sectionId)
                  const newSection: StreamingSection = {
                    id: payload.sectionId,
                    label: payload.label,
                    status: "ready",
                    data: payload.data,
                  }
                  const sections = exists
                    ? s.sections.map((sec) => sec.id === payload.sectionId ? newSection : sec)
                    : [...s.sections, newSection].sort(
                        (a, b) => SECTION_ORDER.indexOf(a.id) - SECTION_ORDER.indexOf(b.id)
                      )
                  return { ...s, sections }
                })
              } else if (currentEvent === "processor.started") {
                setState((s) => ({ ...s, currentProcessor: payload.label }))
              } else if (currentEvent === "job.completed") {
                setState((s) => ({ ...s, status: "complete", currentProcessor: null }))
              } else if (currentEvent === "job.failed") {
                setState((s) => ({ ...s, status: "failed", error: payload.error, currentProcessor: null }))
              }
            } catch { /* ignore parse errors */ }

            currentEvent = ""
            currentData = ""
          }
        }
      }

      // Ensure complete state if stream ended naturally
      setState((s) => s.status === "streaming" ? { ...s, status: "complete" } : s)

    } catch (err) {
      setState((s) => ({
        ...s,
        status: "failed",
        error: err instanceof Error ? err.message : "Stream failed",
        currentProcessor: null,
      }))
    }
  }, [])

  const reset = useCallback(() => {
    setState({ status: "idle", workflowLabel: null, sections: [], currentProcessor: null, error: null })
  }, [])

  return { state, startStream, reset }
}
```

---

## STAGE 5 — Update app/page.tsx to use useStream

Replace all references to `useJobStream` and `startJob` with `useStream` and `startStream`:

```tsx
// Change import:
import { useStream } from "@/lib/useStream"

// Change hook usage:
const { state, startStream, reset } = useStream()

// Change handleSubmit call:
await startStream(task, workflow?.id ?? null, workflow?.label ?? null, context)

// Change loading check:
const loading = state.status === "streaming"

// Add currentProcessor display in the header status area:
{state.currentProcessor && (
  <span className="text-xs text-gray-400">{state.currentProcessor}</span>
)}
```

---

## STAGE 6 — Add firebase-admin to package.json and Vercel env vars

In package.json dependencies add:
```json
"firebase-admin": "^12.0.0"
```

Run:
```bash
npm install firebase-admin
```

The Firestore credentials are already in Vercel env vars:
- FIRESTORE_PROJECT_ID (or use NEXT_PUBLIC_FIREBASE_PROJECT_ID = "digitalchemy-de4b7")
- FIRESTORE_CLIENT_EMAIL
- FIRESTORE_PRIVATE_KEY

If Firestore service account creds are not yet in Vercel, the job store will fall back to default credentials using the project ID alone (works with Firebase App Check or emulator).

---

## STAGE 7 — Delete obsolete files

Delete these files:
- app/api/analyze/[jobId]/route.ts
- app/api/analyze/[jobId]/events/route.ts
- lib/useJobStream.ts (replaced by lib/useStream.ts)

---

## STAGE 8 — Verify build and push

```bash
npm install
npm run build
```

Fix any TypeScript errors. Then:

```bash
git add -A
git commit -m "fix: Firestore job store + multi-pass LLM + single streaming POST — fixes Vercel serverless state"
git push origin main
```

---

## WHAT THIS FIXES

| Problem | Fix |
|---|---|
| In-memory store lost between instances | Firestore persists every section durably |
| One giant LLM call = all-or-nothing | 5 separate Claude calls, one per section |
| Stream dies = nothing shown | Each section saved to Firestore as it completes |
| "Stream connection lost" = dead end | Partial sections already visible before failure |
| No progressive intelligence | Content → Transcript → Trends → Packs → Plan in sequence |

## WHAT THE USER SEES NOW

1. Intake summary — instant
2. Execution plan — instant
3. Content intelligence card — "This video is about X, topic Y, keywords Z"
4. Transcript card — hook candidates, key quotes
5. Trend intelligence — per platform hashtags, audio, format fit
6. Platform packs — hooks, captions, hashtags with copy buttons
7. Agent plan — agents, MCPs, execution order
