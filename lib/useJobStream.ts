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
