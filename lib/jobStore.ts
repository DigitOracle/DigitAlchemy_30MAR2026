// lib/jobStore.ts
// Firestore-backed job store — explicit cert credentials for Vercel

import type { Job, JobSection, SectionId } from "@/types"
import { cert, getApps, initializeApp } from "firebase-admin/app"
import { getFirestore } from "firebase-admin/firestore"
import { getStorage as getAdminStorage } from "firebase-admin/storage"

const STORAGE_BUCKET = "digitalchemy-de4b7.appspot.com"

function initApp() {
  if (getApps().length > 0) return

  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT
  if (!serviceAccount) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT env var is missing")
  }

  const sa = JSON.parse(serviceAccount)

  initializeApp({
    credential: cert({
      projectId: sa.project_id,
      clientEmail: sa.client_email,
      privateKey: sa.private_key,
    }),
    storageBucket: STORAGE_BUCKET,
  })
}

export function getDb() {
  initApp()
  return getFirestore()
}

export function getStorageBucket() {
  initApp()
  return getAdminStorage().bucket()
}

const COLLECTION = "console_jobs"

export async function createJob(
  task: string,
  workflowId: string | null,
  workflowLabel: string | null,
  intakeContext: Record<string, string | string[]>
): Promise<Job> {
  const db = getDb()
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
  const db = getDb()
  const doc = await db.collection(COLLECTION).doc(id).get()
  return doc.exists ? (doc.data() as Job) : undefined
}

export async function updateJobStatus(id: string, status: Job["status"], error?: string) {
  const db = getDb()
  const update: Record<string, unknown> = { status }
  if (error) update.error = error
  if (status === "complete" || status === "failed") {
    update.completedAt = new Date().toISOString()
  }
  await db.collection(COLLECTION).doc(id).update(update)
}

export async function updateSection(id: string, sectionId: SectionId, data: Record<string, unknown>) {
  const db = getDb()
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
  const db = getDb()
  const job = await getJob(id)
  if (!job) return

  const sections = job.sections.map((s) =>
    s.id === sectionId ? { ...s, status: "streaming" as const } : s
  )
  await db.collection(COLLECTION).doc(id).update({ sections })
}
