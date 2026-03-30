// types/index.ts — Complete replacement

export type WorkflowCategory =
  | "Social Video Intelligence"
  | "BIM / Model Review"
  | "GIS / Spatial Analysis"
  | "Compliance / Regulatory Mapping"
  | "IoT / Sensor Planning"
  | "Digital Twin"
  | "Document Analysis"
  | "General Orchestration"

export type MCPPriority = "core" | "supporting" | "optional"
export type MCPSource = "registry" | "missing_but_recommended"
export type StandardsSource = "firestore" | "local-cache"
export type ConfidenceLevel = "high" | "medium" | "low"
export type ProvenanceType = "observed" | "inferred" | "registry" | "user-provided"

// ── Registry / standards primitives ──────────────────────────────────────────

export type MCPServer = {
  id: string
  name: string
  description: string
  category: string
  status: string
  source: string
  tools?: number
}

export type StandardsEntry = {
  title: string
  code: string
  collection: string
  category: string
  tags: string[]
}

// ── Condition system (replaces new Function) ──────────────────────────────────

export type ConditionOperator =
  | "eq" | "neq" | "includes" | "not_includes"
  | "gt" | "lt" | "exists" | "not_exists" | "contains"

export type StepCondition = {
  field: string
  operator: ConditionOperator
  value?: string | string[] | number | boolean
}

export type CompoundCondition = {
  logic: "and" | "or"
  conditions: (StepCondition | CompoundCondition)[]
}

export type IntakeCondition = StepCondition | CompoundCondition

// ── Intake step types ─────────────────────────────────────────────────────────

export type IntakeStepOption = {
  value: string
  label: string
  description?: string
}

export type IntakeStep = {
  id: string
  label: string
  helpText?: string
  type: "select" | "multiselect" | "upload" | "url" | "url-or-upload" | "text" | "textarea"
  options?: IntakeStepOption[]
  condition?: IntakeCondition
  placeholder?: string
  accept?: string
  required?: boolean
  maxFileSizeMb?: number
}

// ── Workflow detection ────────────────────────────────────────────────────────

export type WorkflowCandidate = {
  workflow: WorkflowDefinition
  score: number
  matchedKeywords: string[]
  confidence: ConfidenceLevel
  reason: string
}

export type DetectionMode = "auto" | "manual"

export type WorkflowTriggers = {
  assetTypes: string[]
  sourceFamilies?: string[]
  keywords: string[]
  strongKeywords?: string[]  // higher weight
}

// ── Compound task support ─────────────────────────────────────────────────────

export type WorkflowBranch = {
  workflowId: string
  workflowLabel: string
  weight: number  // relative importance 0-1
  sequencePosition: number
  dependsOn?: string[]  // other workflowIds that must run first
}

export type CompoundTaskPlan = {
  isCompound: boolean
  branches: WorkflowBranch[]
  executionMode: "sequential" | "parallel" | "conditional"
  mergeStrategy: "union" | "primary-wins" | "weighted"
  totalEstimatedMs: number
}

// ── Processor registry ────────────────────────────────────────────────────────

export type RetryPolicy = {
  maxAttempts: number
  backoffMs: number
  retryOn: string[]  // error types
}

export type CacheStrategy = {
  enabled: boolean
  ttlMs?: number
  keyFields?: string[]  // which input fields form the cache key
}

export type FailureMode = {
  errorType: string
  description: string
  recovery: "retry" | "fallback" | "skip" | "abort"
  fallbackProcessorId?: string
}

export type ProcessorDefinition = {
  id: string
  label: string
  description: string
  type: "mcp-tool" | "backend-service" | "api" | "llm" | "multi"
  acceptedInputTypes: string[]
  requiredInputs: string[]
  produces: string[]
  timeoutMs: number
  retryPolicy: RetryPolicy
  failureModes: FailureMode[]
  cacheStrategy: CacheStrategy
  primaryTool?: string
  fallbackTool?: string
  reliability: "high" | "medium" | "low"
  notes?: string
}

// ── Orchestration plan ────────────────────────────────────────────────────────

export type OrchestrationStep = {
  stepId: string
  processorId: string
  processorLabel: string
  inputs: string[]
  outputs: string[]
  dependsOn: string[]
  estimatedMs: number
  optional: boolean
  status: "pending" | "running" | "complete" | "failed" | "skipped"
}

export type OrchestrationPlan = {
  planId: string
  workflowId: string
  isCompound: boolean
  branches?: WorkflowBranch[]
  steps: OrchestrationStep[]
  totalEstimatedMs: number
  generatedAt: string
}

// ── File handling ─────────────────────────────────────────────────────────────

export type ParsedFileContent = {
  originalName: string
  mimeType: string
  sizeByes: number
  contentType: "text" | "structured" | "binary" | "ifc-metadata" | "image"
  extractedText?: string
  metadata?: Record<string, unknown>
  previewUrl?: string
  storageId?: string
}

// ── Agent registry ────────────────────────────────────────────────────────────

export type AgentProfile = {
  id: string
  displayName: string
  shortDescription: string
  longDescription?: string
  category: string
  userVisible: boolean
  inputAffinities: string[]    // asset types this agent handles well
  outputTypes: string[]        // what it produces
  preferredTools: string[]     // MCP tool IDs
  workflowIds: string[]        // which workflows use this agent
}

// ── Analysis result ───────────────────────────────────────────────────────────

export type AnnotatedValue<T> = {
  value: T
  confidence: ConfidenceLevel
  provenance: ProvenanceType
  reason?: string
}

export type RecommendedAgent = {
  id: string
  displayName: string
  shortDescription: string
  category: string
  confidence: ConfidenceLevel
  provenance: ProvenanceType
}

export type RecommendedMCP = {
  name: string
  role: string
  priority: MCPPriority
  reason: string
  source: MCPSource
  confidence: ConfidenceLevel
}

export type StandardsContext = {
  source: StandardsSource
  collectionsConsulted: string[]
  relevantStandards: {
    title: string
    code: string
    collection: string
    reason: string
    confidence: ConfidenceLevel
  }[]
  standardsActions: string[]
}

export type AnalyzeTaskResult = {
  taskSummary: AnnotatedValue<string>
  workflowType: AnnotatedValue<string>
  isCompound: boolean
  compoundBranches?: { label: string; weight: number }[]
  recommendedAgents: RecommendedAgent[]
  recommendedMCPs: RecommendedMCP[]
  executionOrder: string[]
  dependencies: string[]
  warnings: string[]
  nextActions: string[]
  standardsContext?: StandardsContext
  orchestrationPlan?: OrchestrationPlan
}

// ── Workflow definition ───────────────────────────────────────────────────────

export type WorkflowDefinition = {
  id: string
  label: string
  description: string
  icon: string
  color: string
  triggers: WorkflowTriggers
  intakeSteps: IntakeStep[]
  agents: string[]
  mcpTools: string[]
  processorChain: string[]
  outputs: string[]
  canCompound?: string[]  // workflow IDs this can combine with
}

// ── Intake state ──────────────────────────────────────────────────────────────

export type IntakeFieldValue = string | string[] | File | ParsedFileContent | null

export type IntakeState = Record<string, IntakeFieldValue>

export type IntakeValidationResult = {
  valid: boolean
  missingFields: { id: string; label: string }[]
}

// ── Orchestration status ──────────────────────────────────────────────────────

export type OrchestrationStage =
  | "idle"
  | "classifying"
  | "gathering-context"
  | "building-plan"
  | "reasoning"
  | "complete"
  | "failed"

export type OrchestrationStatus = {
  stage: OrchestrationStage
  stageLabel: string
  startedAt?: number
  elapsedMs?: number
  progress?: number  // 0-100
  currentStep?: string
}

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

// ── Request/response ──────────────────────────────────────────────────────────

export type AnalyzeTaskRequest = {
  task: string
  workflowId: string | null
  workflowLabel: string | null
  intakeContext: Record<string, string | string[]>
  parsedFiles?: ParsedFileContent[]
  isCompound?: boolean
  compoundBranches?: WorkflowBranch[]
}

export type AnalyzeTaskResponse =
  | { success: true; result: AnalyzeTaskResult }
  | { success: false; error: string }
