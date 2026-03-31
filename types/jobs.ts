// types/jobs.ts — Session 005 job schema v2

export type JobStatusV2 =
  | "created"
  | "ingesting"
  | "ingestion_complete"
  | "platform_selection_pending"
  | "generating"
  | "complete"
  | "error"

export type JobPhase = 1 | 2

export type ProvenanceLevel = "observed" | "derived" | "inferred" | "unavailable"

export type TranscriptStatus = "pending" | "complete" | "failed"

export type AccessResult = "success" | "auth_required" | "not_found" | "failed"

export type AccessMethod = "public" | "oauth" | "share_link" | null

export type SourceType = "url" | "upload" | null

export type IngestionData = {
  title: string | null
  duration: string | null
  thumbnail: string | null
  transcriptSummary: string | null
  transcriptStatus: TranscriptStatus
  provenance: ProvenanceLevel
}

export type PlatformCards = {
  trending: Record<string, unknown> | null
  audio: Record<string, unknown> | null
  hooks: Record<string, unknown> | null
  captions: Record<string, unknown> | null
  schedule: Record<string, unknown> | null
  provenance: ProvenanceLevel
}

export type AccessAttempt = {
  url: string
  timestamp: string
  result: AccessResult
  detectedPlatform: string | null
  oauthAvailable: boolean
}

export type JobV2 = {
  id: string
  status: JobStatusV2
  phase: JobPhase
  sourceUrl: string | null
  sourceType: SourceType
  accessMethod: AccessMethod
  ingestion: IngestionData
  selectedPlatforms: string[]
  cards: Record<string, PlatformCards>
  accessAttempts: AccessAttempt[]
  oauthPlatform: string | null
  error: string | null
  createdAt: string
  updatedAt: string
}

export type CreateJobInput = {
  task: string
  sourceUrl?: string | null
  sourceType?: SourceType
  workflowId?: string | null
  workflowLabel?: string | null
  intakeContext?: Record<string, string | string[]>
}
