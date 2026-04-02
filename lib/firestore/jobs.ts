// lib/firestore/jobs.ts — Firestore job CRUD for Session 005 schema v2

import type { JobV2, CreateJobInput, AccessAttempt, PlatformCards, JobStatusV2 } from "@/types/jobs"
import { getDb } from "@/lib/jobStore"

const COLLECTION = "console_jobs_v2"

function now(): string {
  return new Date().toISOString()
}

function newId(): string {
  return `job-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

export async function createJobV2(input: CreateJobInput): Promise<JobV2> {
  const db = getDb()
  const id = newId()
  const ts = now()

  const job: JobV2 = {
    id,
    status: "created",
    phase: 1,
    sourceUrl: input.sourceUrl ?? null,
    sourceType: input.sourceType ?? null,
    storagePath: null,
    accessMethod: null,
    ingestion: {
      title: null,
      duration: null,
      thumbnail: null,
      transcriptSummary: null,
      transcriptStatus: "pending",
      provenance: "unavailable",
    },
    confirmedFocus: null,
    selectedPlatforms: [],
    cards: {},
    accessAttempts: [],
    oauthPlatform: null,
    error: null,
    createdAt: ts,
    updatedAt: ts,
  }

  await db.collection(COLLECTION).doc(id).set(job)
  return job
}

export async function getJobV2(id: string): Promise<JobV2 | undefined> {
  const db = getDb()
  const doc = await db.collection(COLLECTION).doc(id).get()
  return doc.exists ? (doc.data() as JobV2) : undefined
}

export async function updateJobV2(
  id: string,
  partial: Partial<Omit<JobV2, "id" | "createdAt">>
): Promise<void> {
  const db = getDb()
  await db.collection(COLLECTION).doc(id).update({
    ...partial,
    updatedAt: now(),
  })
}

export async function updateJobStatusV2(
  id: string,
  status: JobStatusV2,
  error?: string
): Promise<void> {
  const update: Partial<JobV2> = { status }
  if (error !== undefined) update.error = error
  await updateJobV2(id, update)
}

export async function updateCard(
  id: string,
  platform: string,
  cardType: keyof Omit<PlatformCards, "provenance">,
  data: Record<string, unknown>
): Promise<void> {
  const db = getDb()
  await db.collection(COLLECTION).doc(id).update({
    [`cards.${platform}.${cardType}`]: data,
    updatedAt: now(),
  })
}

export async function appendAccessAttempt(
  id: string,
  attempt: AccessAttempt
): Promise<void> {
  const { FieldValue } = await import("firebase-admin/firestore")
  const db = getDb()
  await db.collection(COLLECTION).doc(id).update({
    accessAttempts: FieldValue.arrayUnion(attempt),
    updatedAt: now(),
  })
}
