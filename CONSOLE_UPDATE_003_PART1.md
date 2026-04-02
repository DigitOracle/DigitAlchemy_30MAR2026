# DigitAlchemy® Console — Refined Architecture v3.0
# Part 1 of 3: Core type system, condition evaluator, ranked detection, compound tasks
# 30 March 2026

---

## INSTRUCTION TO CLAUDE CODE

Read this file and implement ALL changes exactly as specified.
This is a pre-implementation architecture document — not pseudocode.
Every type, every function, every interface is production-ready.
Implement in this order. Commit after each named stage.

---

## STAGE A — REPLACE types/index.ts ENTIRELY

```ts
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
```

Commit: "feat: complete type system v3 — conditions, detection, compound, processors, provenance"

---

## STAGE B — CREATE lib/conditionEvaluator.ts

```ts
// lib/conditionEvaluator.ts
// Safe, declarative condition evaluator — no eval, no new Function

import type { IntakeCondition, StepCondition, CompoundCondition, IntakeState, IntakeFieldValue } from "@/types"

function isCompound(c: IntakeCondition): c is CompoundCondition {
  return "logic" in c && "conditions" in c
}

function evaluateSimple(condition: StepCondition, state: IntakeState): boolean {
  const raw = state[condition.field]
  const fieldValue: IntakeFieldValue = raw !== undefined ? raw : null

  switch (condition.operator) {
    case "exists":
      return fieldValue !== null && fieldValue !== undefined && fieldValue !== ""

    case "not_exists":
      return fieldValue === null || fieldValue === undefined || fieldValue === ""

    case "eq":
      if (Array.isArray(fieldValue)) return false
      return String(fieldValue ?? "") === String(condition.value ?? "")

    case "neq":
      if (Array.isArray(fieldValue)) return false
      return String(fieldValue ?? "") !== String(condition.value ?? "")

    case "includes":
      if (Array.isArray(fieldValue)) {
        return fieldValue.includes(String(condition.value ?? ""))
      }
      return String(fieldValue ?? "").includes(String(condition.value ?? ""))

    case "not_includes":
      if (Array.isArray(fieldValue)) {
        return !fieldValue.includes(String(condition.value ?? ""))
      }
      return !String(fieldValue ?? "").includes(String(condition.value ?? ""))

    case "contains":
      if (Array.isArray(fieldValue)) {
        return Array.isArray(condition.value)
          ? condition.value.every((v) => fieldValue.includes(String(v)))
          : fieldValue.includes(String(condition.value ?? ""))
      }
      return String(fieldValue ?? "").toLowerCase().includes(String(condition.value ?? "").toLowerCase())

    case "gt":
      return Number(fieldValue) > Number(condition.value)

    case "lt":
      return Number(fieldValue) < Number(condition.value)

    default:
      return true
  }
}

export function evaluateCondition(condition: IntakeCondition, state: IntakeState): boolean {
  if (isCompound(condition)) {
    const results = condition.conditions.map((c) => evaluateCondition(c, state))
    return condition.logic === "and"
      ? results.every(Boolean)
      : results.some(Boolean)
  }
  return evaluateSimple(condition, state)
}

export function getVisibleSteps(
  steps: import("@/types").IntakeStep[],
  state: IntakeState
) {
  return steps.filter((step) => {
    if (!step.condition) return true
    return evaluateCondition(step.condition, state)
  })
}

export function validateIntakeState(
  steps: import("@/types").IntakeStep[],
  state: IntakeState
): import("@/types").IntakeValidationResult {
  const visibleSteps = getVisibleSteps(steps, state)
  const missingFields: { id: string; label: string }[] = []

  for (const step of visibleSteps) {
    if (step.required === false) continue
    const value = state[step.id]
    if (value === null || value === undefined || value === "") {
      missingFields.push({ id: step.id, label: step.label })
    } else if (Array.isArray(value) && value.length === 0) {
      missingFields.push({ id: step.id, label: step.label })
    }
  }

  return { valid: missingFields.length === 0, missingFields }
}
```

Commit: "feat: safe declarative condition evaluator — no eval/Function"

---

## STAGE C — CREATE lib/workflowDetector.ts (ranked detection)

```ts
// lib/workflowDetector.ts
// Ranked multi-candidate workflow detection — replaces first-match routing

import workflowsData from "@/data/workflows.json"
import type { WorkflowDefinition, WorkflowCandidate, ConfidenceLevel, CompoundTaskPlan, WorkflowBranch } from "@/types"

const STRONG_KEYWORD_WEIGHT = 4
const KEYWORD_WEIGHT = 2
const PHRASE_BONUS = 3

function scoreWorkflow(workflow: WorkflowDefinition, lower: string): { score: number; matched: string[] } {
  let score = 0
  const matched: string[] = []

  for (const kw of workflow.triggers.keywords) {
    if (lower.includes(kw)) {
      score += KEYWORD_WEIGHT
      matched.push(kw)
    }
  }

  for (const kw of workflow.triggers.strongKeywords ?? []) {
    if (lower.includes(kw)) {
      score += STRONG_KEYWORD_WEIGHT
      if (!matched.includes(kw)) matched.push(kw)
    }
  }

  // Phrase-level bonus: check if multiple keywords appear close together
  if (matched.length >= 3) score += PHRASE_BONUS

  return { score, matched }
}

function scoreToConfidence(score: number, maxScore: number): ConfidenceLevel {
  const ratio = maxScore > 0 ? score / maxScore : 0
  if (ratio >= 0.7) return "high"
  if (ratio >= 0.35) return "medium"
  return "low"
}

export function detectWorkflowCandidates(
  task: string,
  topN = 3
): WorkflowCandidate[] {
  const lower = task.toLowerCase()
  const workflows = workflowsData as WorkflowDefinition[]

  const scored = workflows
    .map((workflow) => {
      const { score, matched } = scoreWorkflow(workflow, lower)
      return { workflow, score, matched }
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)

  const maxScore = scored[0]?.score ?? 1

  return scored.slice(0, topN).map(({ workflow, score, matched }) => ({
    workflow,
    score,
    matchedKeywords: matched,
    confidence: scoreToConfidence(score, maxScore),
    reason: `Matched: ${matched.slice(0, 3).join(", ")}${matched.length > 3 ? ` +${matched.length - 3} more` : ""}`,
  }))
}

export function detectPrimaryWorkflow(task: string): WorkflowDefinition | null {
  const candidates = detectWorkflowCandidates(task, 1)
  return candidates[0]?.workflow ?? null
}

export function detectCompoundTask(task: string, threshold = 2): CompoundTaskPlan | null {
  const candidates = detectWorkflowCandidates(task, 5)
  const qualifying = candidates.filter((c) => c.score >= threshold)

  if (qualifying.length < 2) return null

  // Check canCompound compatibility
  const primary = qualifying[0]
  const compatibleBranches = qualifying.filter((c, i) => {
    if (i === 0) return true
    const canCombine = primary.workflow.canCompound?.includes(c.workflow.id)
    return canCombine
  })

  if (compatibleBranches.length < 2) return null

  const totalScore = compatibleBranches.reduce((sum, c) => sum + c.score, 0)

  const branches: WorkflowBranch[] = compatibleBranches.map((c, i) => ({
    workflowId: c.workflow.id,
    workflowLabel: c.workflow.label,
    weight: c.score / totalScore,
    sequencePosition: i,
    dependsOn: i > 0 ? [compatibleBranches[i - 1].workflow.id] : undefined,
  }))

  return {
    isCompound: true,
    branches,
    executionMode: "sequential",
    mergeStrategy: "weighted",
    totalEstimatedMs: branches.length * 8000,
  }
}

export function getAllWorkflows(): WorkflowDefinition[] {
  return workflowsData as WorkflowDefinition[]
}

export function getWorkflowById(id: string): WorkflowDefinition | null {
  return (workflowsData as WorkflowDefinition[]).find((w) => w.id === id) ?? null
}
```

Commit: "feat: ranked workflow detector with compound task detection"

---

## STAGE D — UPDATE data/workflows.json

Add `strongKeywords` and `canCompound` to all workflow entries.
Also convert all `condition` strings to declarative objects.

Replace the entire workflows.json with this:

```json
[
  {
    "id": "social-video-optimization",
    "label": "Social Video Intelligence",
    "description": "Analyze a video and generate social posting strategy",
    "icon": "video",
    "color": "pink",
    "triggers": {
      "assetTypes": ["video"],
      "sourceFamilies": ["heygen", "youtube", "tiktok", "instagram", "upload"],
      "keywords": ["video", "tiktok", "instagram", "hashtag", "social", "content", "trend", "post", "publish", "reel", "caption", "music", "creator"],
      "strongKeywords": ["heygen", "going viral", "content strategy", "social media optimization"]
    },
    "canCompound": ["compliance-regulatory-mapping", "document-analysis"],
    "intakeSteps": [
      {
        "id": "videoSource",
        "label": "Where is the video?",
        "type": "select",
        "required": true,
        "options": [
          { "value": "heygen", "label": "HeyGen link" },
          { "value": "youtube", "label": "YouTube URL" },
          { "value": "tiktok", "label": "TikTok URL" },
          { "value": "instagram", "label": "Instagram Reel" },
          { "value": "upload", "label": "Upload video file" }
        ]
      },
      {
        "id": "videoUrl",
        "label": "Video URL",
        "type": "url",
        "required": true,
        "placeholder": "Paste your video URL here…",
        "condition": { "field": "videoSource", "operator": "neq", "value": "upload" },
        "helpText": "Paste the full URL including https://"
      },
      {
        "id": "videoFile",
        "label": "Upload video file",
        "type": "upload",
        "required": true,
        "accept": ".mp4,.mov,.avi,.webm,.mkv",
        "maxFileSizeMb": 500,
        "condition": { "field": "videoSource", "operator": "eq", "value": "upload" }
      },
      {
        "id": "targetPlatforms",
        "label": "Target platforms",
        "type": "multiselect",
        "required": true,
        "options": [
          { "value": "tiktok", "label": "TikTok" },
          { "value": "instagram", "label": "Instagram" },
          { "value": "linkedin", "label": "LinkedIn" },
          { "value": "twitter", "label": "X / Twitter" },
          { "value": "youtube", "label": "YouTube Shorts" }
        ]
      },
      {
        "id": "targetRegion",
        "label": "Target region",
        "type": "text",
        "required": false,
        "placeholder": "e.g. UAE, UK, US, Global…",
        "helpText": "Affects trend data and hashtag localisation"
      },
      {
        "id": "audienceDescription",
        "label": "Target audience",
        "type": "text",
        "required": false,
        "placeholder": "e.g. AEC professionals, digital nomads, Gen Z…"
      }
    ],
    "agents": ["SOCIAL-01", "SOCIAL-02", "SOCIAL-03", "SOCIAL-04"],
    "mcpTools": ["youtube-transcript", "ayrshare", "xpoz", "docker-brave", "docker-playwright"],
    "processorChain": ["video-url-extract", "transcript", "social-trend-lookup", "llm-recommendation"],
    "outputs": ["transcript", "summary", "hooks", "captions", "hashtags", "music-suggestions", "platform-notes"]
  },
  {
    "id": "bim-model-review",
    "label": "BIM / Model Review",
    "description": "Analyze a BIM model for classification, quality, and compliance",
    "icon": "cube",
    "color": "blue",
    "triggers": {
      "assetTypes": ["bim"],
      "sourceFamilies": ["upload"],
      "keywords": ["bim", "model", "cobie", "uniclass", "classification", "autocad", "dwg", "level of information", "loi", "lod"],
      "strongKeywords": ["ifc", "revit", "rvt", "nwd", "ifcopenshell", "iso 19650", "bim model"]
    },
    "canCompound": ["compliance-regulatory-mapping", "document-analysis", "digital-twin"],
    "intakeSteps": [
      {
        "id": "modelFormat",
        "label": "Model format",
        "type": "select",
        "required": true,
        "options": [
          { "value": "ifc", "label": "IFC (.ifc)" },
          { "value": "rvt", "label": "Revit (.rvt)" },
          { "value": "nwd", "label": "Navisworks (.nwd)" },
          { "value": "dwg", "label": "AutoCAD (.dwg)" },
          { "value": "dxf", "label": "DXF (.dxf)" }
        ]
      },
      {
        "id": "modelFile",
        "label": "Upload model file",
        "type": "upload",
        "required": true,
        "accept": ".ifc,.rvt,.nwd,.dwg,.dxf",
        "maxFileSizeMb": 500
      },
      {
        "id": "reviewGoals",
        "label": "Review goals",
        "type": "multiselect",
        "required": true,
        "options": [
          { "value": "classification", "label": "Classification completeness" },
          { "value": "cobie", "label": "COBie data quality" },
          { "value": "compliance", "label": "Standards compliance" },
          { "value": "clash", "label": "Clash detection" },
          { "value": "metadata", "label": "Property extraction" },
          { "value": "loi", "label": "Level of Information check" }
        ]
      },
      {
        "id": "applicableStandard",
        "label": "Applicable standard",
        "type": "text",
        "required": false,
        "placeholder": "e.g. ISO 19650, BS EN 17412, UAE BIM mandate…",
        "helpText": "Leave blank to auto-detect applicable standards"
      },
      {
        "id": "projectStage",
        "label": "Project stage",
        "type": "select",
        "required": false,
        "options": [
          { "value": "design", "label": "Design" },
          { "value": "construction", "label": "Construction" },
          { "value": "handover", "label": "Handover" },
          { "value": "operations", "label": "Operations (FM)" }
        ]
      }
    ],
    "agents": ["DA-02", "DA-11", "DA-12"],
    "mcpTools": ["revit-mcp", "autocad-mcp", "ifcmcp", "docker-markdownify"],
    "processorChain": ["file-parse", "ifc-extract", "classification-check", "llm-analysis"],
    "outputs": ["bim-metrics", "compliance-flags", "schema-metadata", "json-structured"]
  },
  {
    "id": "gis-spatial-analysis",
    "label": "GIS / Spatial Analysis",
    "description": "Process geospatial data, maps, and spatial queries",
    "icon": "map",
    "color": "green",
    "triggers": {
      "assetTypes": ["gis", "document", "url"],
      "keywords": ["gis", "spatial", "map", "geospatial", "coordinates", "layer", "shapefile", "geojson", "kml", "mapping"],
      "strongKeywords": ["esri", "arcgis", "qgis", "wms", "wfs", "epsg", "bounding box"]
    },
    "canCompound": ["compliance-regulatory-mapping", "iot-sensor-planning", "digital-twin"],
    "intakeSteps": [
      {
        "id": "spatialInputType",
        "label": "What are you working with?",
        "type": "select",
        "required": true,
        "options": [
          { "value": "upload", "label": "Upload spatial file" },
          { "value": "url", "label": "Data URL or service endpoint" },
          { "value": "coordinates", "label": "Coordinates / bounding box" },
          { "value": "description", "label": "Text description only" }
        ]
      },
      {
        "id": "spatialFile",
        "label": "Upload spatial file",
        "type": "upload",
        "required": true,
        "accept": ".shp,.geojson,.kml,.kmz,.json,.gpkg,.csv",
        "maxFileSizeMb": 100,
        "condition": { "field": "spatialInputType", "operator": "eq", "value": "upload" }
      },
      {
        "id": "spatialUrl",
        "label": "Service endpoint URL",
        "type": "url",
        "required": true,
        "placeholder": "https://…",
        "helpText": "WMS, WFS, REST API, or direct file URL",
        "condition": { "field": "spatialInputType", "operator": "eq", "value": "url" }
      },
      {
        "id": "coordinatesText",
        "label": "Coordinates or bounding box",
        "type": "text",
        "required": true,
        "placeholder": "e.g. 24.4539, 54.3773 or BBOX: minX,minY,maxX,maxY",
        "condition": { "field": "spatialInputType", "operator": "eq", "value": "coordinates" }
      }
    ],
    "agents": ["DA-03", "DA-01"],
    "mcpTools": ["cesium-mcp", "autocad-mcp", "docker-playwright"],
    "processorChain": ["spatial-parse", "llm-analysis"],
    "outputs": ["summary", "json-structured", "schema-metadata"]
  },
  {
    "id": "compliance-regulatory-mapping",
    "label": "Compliance / Regulatory Mapping",
    "description": "Map tasks to regulatory frameworks, standards, and compliance requirements",
    "icon": "shield",
    "color": "amber",
    "triggers": {
      "assetTypes": ["text-prompt", "document", "url"],
      "keywords": ["compliance", "regulation", "standard", "permit", "approval", "handover", "gateway", "audit", "review"],
      "strongKeywords": ["iso 19650", "addc", "dda", "uae fire", "authority approval", "noc", "moccae", "cbuae"]
    },
    "canCompound": ["bim-model-review", "document-analysis", "gis-spatial-analysis"],
    "intakeSteps": [
      {
        "id": "complianceDomain",
        "label": "Compliance domain",
        "type": "select",
        "required": true,
        "options": [
          { "value": "bim-delivery", "label": "BIM / Digital Delivery (ISO 19650)" },
          { "value": "uae-local", "label": "UAE Local Regulations (ADDC, DDA, DM)" },
          { "value": "smart-city", "label": "Smart City / IoT (ISO 37100)" },
          { "value": "construction", "label": "Construction / RIBA / NEC" },
          { "value": "fire-safety", "label": "Fire Safety / Life Safety" },
          { "value": "general", "label": "General standards lookup" }
        ]
      },
      {
        "id": "complianceDoc",
        "label": "Document to review",
        "type": "upload",
        "required": false,
        "accept": ".pdf,.docx,.txt,.xlsx",
        "maxFileSizeMb": 50,
        "helpText": "Upload the document or specification you want checked"
      },
      {
        "id": "jurisdiction",
        "label": "Jurisdiction",
        "type": "text",
        "required": false,
        "placeholder": "e.g. Abu Dhabi, Dubai, ADGM, Federal UAE…"
      }
    ],
    "agents": ["DA-04", "DA-11", "DA-01"],
    "mcpTools": ["perplexity", "docker-wikipedia", "docker-brave", "docker-neo4j", "docker-markdownify"],
    "processorChain": ["standards-lookup", "doc-parse", "llm-analysis"],
    "outputs": ["compliance-flags", "summary", "json-structured"]
  },
  {
    "id": "iot-sensor-planning",
    "label": "IoT / Sensor Planning",
    "description": "VIPER® sensor deployment strategy and IoT pipeline planning",
    "icon": "cpu",
    "color": "purple",
    "triggers": {
      "assetTypes": ["text-prompt", "document", "bim"],
      "keywords": ["sensor", "iot", "telemetry", "time-series", "placement", "coverage", "mqtt", "influx", "monitoring", "building management"],
      "strongKeywords": ["viper", "sensor derivation", "304 sensors", "bms", "scada"]
    },
    "canCompound": ["bim-model-review", "gis-spatial-analysis", "digital-twin"],
    "intakeSteps": [
      {
        "id": "spaceDescription",
        "label": "Describe the space or project",
        "type": "textarea",
        "required": true,
        "placeholder": "e.g. 50,000 sqm mixed-use development, 12 floors, Abu Dhabi…",
        "helpText": "Include floor count, total area, building type, and location if known"
      },
      {
        "id": "floorPlan",
        "label": "Floor plan or model",
        "type": "upload",
        "required": false,
        "accept": ".pdf,.png,.jpg,.dwg,.ifc",
        "maxFileSizeMb": 100
      },
      {
        "id": "sensorScopes",
        "label": "Sensor scopes required",
        "type": "multiselect",
        "required": true,
        "options": [
          { "value": "hvac", "label": "HVAC / Temperature / Humidity" },
          { "value": "occupancy", "label": "Occupancy detection" },
          { "value": "energy", "label": "Energy metering" },
          { "value": "air-quality", "label": "Air quality / CO2 / VOC" },
          { "value": "security", "label": "Access control / Security" },
          { "value": "lighting", "label": "Lighting / Daylight" },
          { "value": "water", "label": "Water / Plumbing" },
          { "value": "fire", "label": "Fire safety / Smoke" },
          { "value": "structural", "label": "Structural monitoring" }
        ]
      }
    ],
    "agents": ["DA-07", "DA-06", "DA-03"],
    "mcpTools": ["docker-timestream", "firebase-mcp", "cesium-mcp"],
    "processorChain": ["space-analysis", "viper-derivation", "llm-planning"],
    "outputs": ["json-structured", "summary", "schema-metadata"]
  },
  {
    "id": "digital-twin",
    "label": "Digital Twin",
    "description": "Digital twin governance, simulation, and asset model analysis",
    "icon": "layers",
    "color": "cyan",
    "triggers": {
      "assetTypes": ["text-prompt", "url", "bim"],
      "keywords": ["digital twin", "twin", "simulation", "asset model", "dtdl", "azure twin", "real-time data", "live model"],
      "strongKeywords": ["digital thread", "twin state", "DTDL schema", "azure digital twins"]
    },
    "canCompound": ["bim-model-review", "iot-sensor-planning", "compliance-regulatory-mapping"],
    "intakeSteps": [
      {
        "id": "twinInputType",
        "label": "What do you have?",
        "type": "select",
        "required": true,
        "options": [
          { "value": "description", "label": "Text description of the twin" },
          { "value": "endpoint", "label": "Twin service endpoint URL" },
          { "value": "model-file", "label": "Upload model or schema file" }
        ]
      },
      {
        "id": "twinEndpoint",
        "label": "Twin service endpoint",
        "type": "url",
        "required": true,
        "placeholder": "https://…",
        "condition": { "field": "twinInputType", "operator": "eq", "value": "endpoint" }
      },
      {
        "id": "twinFile",
        "label": "Upload model or schema",
        "type": "upload",
        "required": true,
        "accept": ".ifc,.json,.dtdl,.jsonld",
        "maxFileSizeMb": 100,
        "condition": { "field": "twinInputType", "operator": "eq", "value": "model-file" }
      }
    ],
    "agents": ["DA-06", "DA-07", "DA-02"],
    "mcpTools": ["revit-mcp", "cesium-mcp", "firebase-mcp", "docker-neo4j"],
    "processorChain": ["model-parse", "twin-analysis", "llm-analysis"],
    "outputs": ["summary", "json-structured", "compliance-flags"]
  },
  {
    "id": "document-analysis",
    "label": "Document Analysis",
    "description": "Extract, summarize, and structure information from any document",
    "icon": "file-text",
    "color": "gray",
    "triggers": {
      "assetTypes": ["document", "url"],
      "keywords": ["pdf", "document", "report", "summarize", "extract", "read", "review", "analyse", "letter", "contract", "spec"],
      "strongKeywords": ["summarise this document", "extract from pdf", "read this report", "what does this say"]
    },
    "canCompound": ["compliance-regulatory-mapping", "bim-model-review"],
    "intakeSteps": [
      {
        "id": "docSource",
        "label": "Document source",
        "type": "select",
        "required": true,
        "options": [
          { "value": "upload", "label": "Upload file" },
          { "value": "url", "label": "Web page or public URL" },
          { "value": "google-doc", "label": "Google Doc link" }
        ]
      },
      {
        "id": "docFile",
        "label": "Upload document",
        "type": "upload",
        "required": true,
        "accept": ".pdf,.docx,.txt,.xlsx,.csv,.pptx",
        "maxFileSizeMb": 50,
        "condition": { "field": "docSource", "operator": "eq", "value": "upload" }
      },
      {
        "id": "docUrl",
        "label": "Document URL",
        "type": "url",
        "required": true,
        "placeholder": "https://…",
        "condition": {
          "logic": "or",
          "conditions": [
            { "field": "docSource", "operator": "eq", "value": "url" },
            { "field": "docSource", "operator": "eq", "value": "google-doc" }
          ]
        }
      },
      {
        "id": "extractionGoals",
        "label": "What do you need?",
        "type": "multiselect",
        "required": true,
        "options": [
          { "value": "summary", "label": "Executive summary" },
          { "value": "key-points", "label": "Key points / bullet list" },
          { "value": "structured-data", "label": "Structured data / JSON" },
          { "value": "action-items", "label": "Action items" },
          { "value": "compliance-check", "label": "Compliance check" },
          { "value": "translation", "label": "Translation (Arabic ↔ English)" }
        ]
      }
    ],
    "agents": ["DA-10", "DA-11", "DA-01"],
    "mcpTools": ["docker-markdownify", "docker-markitdown", "google-docs", "notebooklm-mcp"],
    "processorChain": ["doc-parse", "llm-analysis"],
    "outputs": ["summary", "json-structured", "export-package"]
  },
  {
    "id": "general-orchestration",
    "label": "General Orchestration",
    "description": "Multi-domain or complex task — Command Desk routes intelligently",
    "icon": "terminal",
    "color": "gray",
    "triggers": {
      "assetTypes": ["text-prompt"],
      "keywords": [],
      "strongKeywords": []
    },
    "canCompound": [],
    "intakeSteps": [],
    "agents": ["DA-01"],
    "mcpTools": [],
    "processorChain": ["llm-classification", "llm-analysis"],
    "outputs": ["summary", "json-structured"]
  }
]
```

Commit: "feat: workflows.json v3 — declarative conditions, strongKeywords, canCompound"
