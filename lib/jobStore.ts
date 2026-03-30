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
