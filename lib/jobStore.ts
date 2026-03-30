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
