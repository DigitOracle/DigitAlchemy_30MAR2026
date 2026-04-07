"use client"
import { useState, useCallback } from "react"
import { auth } from "@/lib/firebase"
import type { SectionId } from "@/types"

export type StreamingSection = {
  id: SectionId
  label: string
  status: "pending" | "streaming" | "ready"
  data?: Record<string, unknown>
}

export type IngestionMeta = {
  title: string | null
  duration: string | null
  thumbnail: string | null
  provenance: string
  jobId: string
}

export type StreamState = {
  status: "idle" | "streaming" | "complete" | "failed"
  workflowLabel: string | null
  sections: StreamingSection[]
  currentProcessor: string | null
  error: string | null
  ingestion: IngestionMeta | null
  jobIdV2: string | null
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
    ingestion: null,
    jobIdV2: null,
  })

  const startStream = useCallback(async (
    task: string,
    workflowId: string | null,
    workflowLabel: string | null,
    intakeContext: Record<string, string | string[]>
  ) => {
    setState({ status: "streaming", workflowLabel, sections: [], currentProcessor: null, error: null, ingestion: null, jobIdV2: null })

    try {
      const idToken = await auth?.currentUser?.getIdToken() ?? ""
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}) },
        body: JSON.stringify({
          task,
          workflowId,
          workflowLabel,
          intakeContext,
          // Extract storagePath to top-level so /api/analyze can detect upload flow
          storagePath: intakeContext.storagePath ?? undefined,
          // Pass uid for Content DNA extraction
          uid: intakeContext.uid ?? undefined,
        }),
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

              if (currentEvent === "job.created") {
                if (payload.jobIdV2) {
                  setState((s) => ({ ...s, jobIdV2: payload.jobIdV2 }))
                }
              } else if (currentEvent === "section.ready") {
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
              } else if (currentEvent === "ingestion_complete") {
                setState((s) => ({ ...s, ingestion: payload as IngestionMeta }))
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
    setState({ status: "idle", workflowLabel: null, sections: [], currentProcessor: null, error: null, ingestion: null, jobIdV2: null })
  }, [])

  return { state, startStream, reset }
}
