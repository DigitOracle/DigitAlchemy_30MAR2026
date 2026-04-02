# DigitAlchemy® Console — Refined Architecture v3.0
# Part 2 of 3: Processor registry, orchestration plan, file handling, UI, validation
# 30 March 2026

---

## STAGE E — CREATE data/processor_registry.json

```json
{
  "version": "3.0",
  "processors": [
    {
      "id": "video-url-extract",
      "label": "Video URL Extractor",
      "description": "Validate and normalise video URL, detect platform",
      "type": "backend-service",
      "acceptedInputTypes": ["url", "text"],
      "requiredInputs": ["videoUrl"],
      "produces": ["normalised-url", "platform-type", "video-id"],
      "timeoutMs": 5000,
      "retryPolicy": { "maxAttempts": 2, "backoffMs": 500, "retryOn": ["network-error"] },
      "failureModes": [
        { "errorType": "invalid-url", "description": "URL not parseable", "recovery": "abort" },
        { "errorType": "unsupported-platform", "description": "Platform not in supported list", "recovery": "fallback", "fallbackProcessorId": "llm-analysis" }
      ],
      "cacheStrategy": { "enabled": true, "ttlMs": 3600000, "keyFields": ["videoUrl"] },
      "reliability": "high"
    },
    {
      "id": "transcript",
      "label": "Video Transcript Extractor",
      "description": "Extract transcript from video URL via MCP",
      "type": "mcp-tool",
      "acceptedInputTypes": ["normalised-url"],
      "requiredInputs": ["normalised-url"],
      "produces": ["transcript-text", "language", "duration-seconds"],
      "timeoutMs": 30000,
      "retryPolicy": { "maxAttempts": 3, "backoffMs": 2000, "retryOn": ["timeout", "network-error"] },
      "failureModes": [
        { "errorType": "no-captions", "description": "Video has no captions/transcript", "recovery": "fallback", "fallbackProcessorId": "playwright-scrape" },
        { "errorType": "private-video", "description": "Video is private or restricted", "recovery": "abort" },
        { "errorType": "timeout", "description": "Transcript extraction timed out", "recovery": "retry" }
      ],
      "cacheStrategy": { "enabled": true, "ttlMs": 86400000, "keyFields": ["normalised-url"] },
      "primaryTool": "youtube-transcript",
      "fallbackTool": "docker-playwright",
      "reliability": "high"
    },
    {
      "id": "social-trend-lookup",
      "label": "Social Trend Research",
      "description": "Find trending hashtags, audio, and creator patterns",
      "type": "api",
      "acceptedInputTypes": ["transcript-text", "topic-tags", "target-platform"],
      "requiredInputs": ["targetPlatforms"],
      "produces": ["trending-hashtags", "trending-audio", "creator-patterns", "engagement-signals"],
      "timeoutMs": 15000,
      "retryPolicy": { "maxAttempts": 2, "backoffMs": 1000, "retryOn": ["rate-limit", "timeout"] },
      "failureModes": [
        { "errorType": "rate-limit", "description": "API rate limit hit", "recovery": "retry" },
        { "errorType": "no-data", "description": "No trend data for region/topic", "recovery": "fallback", "fallbackProcessorId": "brave-search-trends" }
      ],
      "cacheStrategy": { "enabled": true, "ttlMs": 3600000, "keyFields": ["targetPlatforms", "targetRegion"] },
      "primaryTool": "ScrapeCreators",
      "fallbackTool": "docker-brave",
      "reliability": "high",
      "notes": "ScrapeCreators for TikTok. Xpoz for Instagram/Twitter search. Never swap."
    },
    {
      "id": "file-parse",
      "label": "File Parser",
      "description": "Parse uploaded file and extract text/metadata server-side",
      "type": "backend-service",
      "acceptedInputTypes": ["file-upload"],
      "requiredInputs": ["modelFile"],
      "produces": ["extracted-text", "file-metadata", "mime-type", "file-size"],
      "timeoutMs": 60000,
      "retryPolicy": { "maxAttempts": 1, "backoffMs": 0, "retryOn": [] },
      "failureModes": [
        { "errorType": "file-too-large", "description": "File exceeds size limit", "recovery": "abort" },
        { "errorType": "unsupported-format", "description": "Format not supported by parser", "recovery": "fallback", "fallbackProcessorId": "doc-parse" },
        { "errorType": "corrupt-file", "description": "File is unreadable or corrupt", "recovery": "abort" }
      ],
      "cacheStrategy": { "enabled": false },
      "reliability": "high"
    },
    {
      "id": "ifc-extract",
      "label": "IFC Model Extractor",
      "description": "Extract IFC model metadata using IfcOpenShell",
      "type": "mcp-tool",
      "acceptedInputTypes": ["ifc-file", "file-metadata"],
      "requiredInputs": ["modelFile"],
      "produces": ["element-count", "schema-version", "property-sets", "classification-coverage", "storey-list"],
      "timeoutMs": 60000,
      "retryPolicy": { "maxAttempts": 2, "backoffMs": 3000, "retryOn": ["timeout"] },
      "failureModes": [
        { "errorType": "not-ifc", "description": "File is not valid IFC", "recovery": "fallback", "fallbackProcessorId": "file-parse" },
        { "errorType": "ifc-version-unsupported", "description": "IFC version not supported", "recovery": "fallback", "fallbackProcessorId": "file-parse" },
        { "errorType": "mcp-not-connected", "description": "ifcmcp server not running", "recovery": "fallback", "fallbackProcessorId": "doc-parse" }
      ],
      "cacheStrategy": { "enabled": true, "ttlMs": 600000, "keyFields": ["modelFile"] },
      "primaryTool": "ifcmcp",
      "fallbackTool": "docker-markdownify",
      "reliability": "medium",
      "notes": "ifcmcp needs pip install ifcopenshell fastmcp. Fallback to markdownify for basic extraction."
    },
    {
      "id": "classification-check",
      "label": "Classification Checker",
      "description": "Check element classification completeness against Uniclass/OmniClass",
      "type": "mcp-tool",
      "acceptedInputTypes": ["element-count", "property-sets"],
      "requiredInputs": ["reviewGoals"],
      "produces": ["classification-report", "missing-classifications", "compliance-score"],
      "timeoutMs": 30000,
      "retryPolicy": { "maxAttempts": 2, "backoffMs": 2000, "retryOn": ["timeout"] },
      "failureModes": [
        { "errorType": "no-classification-data", "description": "Model has no classification properties", "recovery": "skip" }
      ],
      "cacheStrategy": { "enabled": true, "ttlMs": 600000, "keyFields": ["modelFile", "reviewGoals"] },
      "primaryTool": "revit-mcp",
      "reliability": "high"
    },
    {
      "id": "standards-lookup",
      "label": "Standards Lookup",
      "description": "Look up applicable standards from Firestore corpus and web",
      "type": "multi",
      "acceptedInputTypes": ["text", "domain"],
      "requiredInputs": ["complianceDomain"],
      "produces": ["applicable-standards", "standards-citations", "regulatory-context"],
      "timeoutMs": 20000,
      "retryPolicy": { "maxAttempts": 2, "backoffMs": 1000, "retryOn": ["network-error", "timeout"] },
      "failureModes": [
        { "errorType": "no-standards-found", "description": "No matching standards in corpus", "recovery": "fallback", "fallbackProcessorId": "llm-analysis" }
      ],
      "cacheStrategy": { "enabled": true, "ttlMs": 3600000, "keyFields": ["complianceDomain", "jurisdiction"] },
      "primaryTool": "docker-neo4j",
      "fallbackTool": "perplexity",
      "reliability": "high"
    },
    {
      "id": "doc-parse",
      "label": "Document Parser",
      "description": "Convert document to Markdown for LLM consumption",
      "type": "mcp-tool",
      "acceptedInputTypes": ["pdf", "docx", "xlsx", "html", "url"],
      "requiredInputs": [],
      "produces": ["markdown-text", "document-metadata", "page-count"],
      "timeoutMs": 30000,
      "retryPolicy": { "maxAttempts": 2, "backoffMs": 2000, "retryOn": ["timeout", "network-error"] },
      "failureModes": [
        { "errorType": "protected-pdf", "description": "PDF is password protected", "recovery": "abort" },
        { "errorType": "scanned-only", "description": "PDF is scan with no text layer", "recovery": "skip" }
      ],
      "cacheStrategy": { "enabled": true, "ttlMs": 3600000, "keyFields": ["docFile", "docUrl"] },
      "primaryTool": "docker-markdownify",
      "fallbackTool": "docker-markitdown",
      "reliability": "high"
    },
    {
      "id": "spatial-parse",
      "label": "Spatial File Parser",
      "description": "Parse geospatial file and extract geometry and attributes",
      "type": "backend-service",
      "acceptedInputTypes": ["geojson", "kml", "shp", "coordinates"],
      "requiredInputs": [],
      "produces": ["feature-count", "geometry-types", "bounding-box", "attribute-schema"],
      "timeoutMs": 30000,
      "retryPolicy": { "maxAttempts": 1, "backoffMs": 0, "retryOn": [] },
      "failureModes": [
        { "errorType": "invalid-geometry", "description": "File contains invalid geometries", "recovery": "skip" }
      ],
      "cacheStrategy": { "enabled": false },
      "reliability": "medium"
    },
    {
      "id": "viper-derivation",
      "label": "VIPER® Sensor Derivation",
      "description": "DigitAlchemy proprietary sensor placement and derivation logic",
      "type": "backend-service",
      "acceptedInputTypes": ["text", "floor-plan-metadata"],
      "requiredInputs": ["sensorScopes", "spaceDescription"],
      "produces": ["sensor-count-estimate", "placement-strategy", "scope-coverage", "viper-config"],
      "timeoutMs": 15000,
      "retryPolicy": { "maxAttempts": 1, "backoffMs": 0, "retryOn": [] },
      "failureModes": [
        { "errorType": "insufficient-space-data", "description": "Not enough space description to derive sensors", "recovery": "fallback", "fallbackProcessorId": "llm-planning" }
      ],
      "cacheStrategy": { "enabled": false },
      "reliability": "high",
      "notes": "DA-07 Sensor Alchemist proprietary logic"
    },
    {
      "id": "llm-classification",
      "label": "Task Classifier",
      "description": "Fast LLM classification of task type using Haiku",
      "type": "llm",
      "acceptedInputTypes": ["text"],
      "requiredInputs": ["task"],
      "produces": ["workflow-classification", "confidence-score", "compound-detection"],
      "timeoutMs": 8000,
      "retryPolicy": { "maxAttempts": 2, "backoffMs": 1000, "retryOn": ["timeout", "rate-limit"] },
      "failureModes": [
        { "errorType": "model-unavailable", "description": "LLM unavailable", "recovery": "fallback", "fallbackProcessorId": "keyword-classification" }
      ],
      "cacheStrategy": { "enabled": true, "ttlMs": 300000, "keyFields": ["task"] },
      "reliability": "high",
      "notes": "Use claude-haiku-4-5-20251001 for speed — classification only"
    },
    {
      "id": "llm-analysis",
      "label": "Analysis Engine",
      "description": "Full Claude Sonnet analysis and execution plan generation",
      "type": "llm",
      "acceptedInputTypes": ["text", "extracted-text", "markdown-text", "metadata"],
      "requiredInputs": ["task"],
      "produces": ["task-summary", "agent-recommendations", "mcp-recommendations", "execution-order", "warnings", "next-actions"],
      "timeoutMs": 50000,
      "retryPolicy": { "maxAttempts": 2, "backoffMs": 3000, "retryOn": ["timeout", "rate-limit"] },
      "failureModes": [
        { "errorType": "context-too-long", "description": "Input exceeds context window", "recovery": "fallback", "fallbackProcessorId": "llm-analysis-compressed" },
        { "errorType": "rate-limit", "description": "API rate limit", "recovery": "retry" }
      ],
      "cacheStrategy": { "enabled": false },
      "reliability": "high",
      "notes": "Use claude-sonnet-4-6"
    },
    {
      "id": "llm-planning",
      "label": "Orchestration Planner",
      "description": "Generate deterministic orchestration plan before full reasoning",
      "type": "llm",
      "acceptedInputTypes": ["text", "workflow-classification", "intake-context"],
      "requiredInputs": ["task", "workflowId"],
      "produces": ["orchestration-plan", "step-sequence", "dependency-graph"],
      "timeoutMs": 15000,
      "retryPolicy": { "maxAttempts": 2, "backoffMs": 2000, "retryOn": ["timeout"] },
      "failureModes": [
        { "errorType": "planning-failed", "description": "Could not generate valid plan", "recovery": "skip" }
      ],
      "cacheStrategy": { "enabled": false },
      "reliability": "high"
    }
  ]
}
```

Commit: "feat: expanded processor registry — full contracts for all processors"

---

## STAGE F — CREATE lib/orchestrationPlanner.ts

```ts
// lib/orchestrationPlanner.ts
// Generates a deterministic execution plan before LLM reasoning

import { getWorkflowById } from "./workflowDetector"
import processorRegistry from "@/data/processor_registry.json"
import type { OrchestrationPlan, OrchestrationStep, WorkflowBranch, CompoundTaskPlan } from "@/types"

function getProcessor(id: string) {
  return processorRegistry.processors.find((p) => p.id === id)
}

function buildStepsForWorkflow(
  workflowId: string,
  intakeContext: Record<string, string | string[]>,
  startIndex = 0
): OrchestrationStep[] {
  const workflow = getWorkflowById(workflowId)
  if (!workflow) return []

  const steps: OrchestrationStep[] = []
  let prevStepId: string | null = null

  workflow.processorChain.forEach((processorId, i) => {
    const processor = getProcessor(processorId)
    if (!processor) return

    const stepId = `${workflowId}-${processorId}-${startIndex + i}`
    const step: OrchestrationStep = {
      stepId,
      processorId,
      processorLabel: processor.label,
      inputs: processor.requiredInputs,
      outputs: processor.produces,
      dependsOn: prevStepId ? [prevStepId] : [],
      estimatedMs: processor.timeoutMs,
      optional: false,
      status: "pending",
    }

    steps.push(step)
    prevStepId = stepId
  })

  return steps
}

export function generateOrchestrationPlan(
  workflowId: string,
  intakeContext: Record<string, string | string[]>,
  compoundPlan?: CompoundTaskPlan
): OrchestrationPlan {
  const planId = `plan-${Date.now()}`
  let steps: OrchestrationStep[] = []
  let totalMs = 0

  if (compoundPlan?.isCompound && compoundPlan.branches.length > 1) {
    // Build steps for each branch sequentially
    let offset = 0
    for (const branch of compoundPlan.branches) {
      const branchSteps = buildStepsForWorkflow(branch.workflowId, intakeContext, offset)
      steps = steps.concat(branchSteps)
      offset += branchSteps.length
    }
  } else {
    steps = buildStepsForWorkflow(workflowId, intakeContext)
  }

  // Always end with llm-analysis if not already present
  const hasAnalysis = steps.some((s) => s.processorId === "llm-analysis")
  if (!hasAnalysis) {
    const analysisProcessor = getProcessor("llm-analysis")
    if (analysisProcessor) {
      const lastStep = steps[steps.length - 1]
      steps.push({
        stepId: `final-llm-analysis`,
        processorId: "llm-analysis",
        processorLabel: analysisProcessor.label,
        inputs: ["task", "enriched-context"],
        outputs: analysisProcessor.produces,
        dependsOn: lastStep ? [lastStep.stepId] : [],
        estimatedMs: analysisProcessor.timeoutMs,
        optional: false,
        status: "pending",
      })
    }
  }

  totalMs = steps.reduce((sum, s) => sum + s.estimatedMs, 0)

  return {
    planId,
    workflowId,
    isCompound: compoundPlan?.isCompound ?? false,
    branches: compoundPlan?.branches,
    steps,
    totalEstimatedMs: totalMs,
    generatedAt: new Date().toISOString(),
  }
}

export function planToSystemPromptSummary(plan: OrchestrationPlan): string {
  const stepLines = plan.steps.map((s, i) =>
    `${i + 1}. ${s.processorLabel} → produces: ${s.outputs.join(", ")}`
  )
  return `Execution plan (${plan.steps.length} steps, est. ${Math.round(plan.totalEstimatedMs / 1000)}s):\n${stepLines.join("\n")}`
}
```

Commit: "feat: orchestration planner — deterministic plan generation before LLM reasoning"

---

## STAGE G — CREATE lib/fileHandler.ts

```ts
// lib/fileHandler.ts
// Server-side file parsing — never pass filenames only to LLM

import type { ParsedFileContent } from "@/types"

const MAX_TEXT_LENGTH = 8000  // chars to pass to LLM

export async function parseUploadedFile(
  file: File
): Promise<ParsedFileContent> {
  const name = file.name
  const sizeByes = file.size
  const mimeType = file.type || inferMimeType(name)

  // IFC files — extract metadata
  if (name.endsWith(".ifc")) {
    const text = await file.text()
    const metadata = extractIfcMetadata(text)
    return {
      originalName: name,
      mimeType: "application/x-step",
      sizeByes,
      contentType: "ifc-metadata",
      extractedText: summariseIfcText(text),
      metadata,
    }
  }

  // Text-based files
  if (
    mimeType.startsWith("text/") ||
    name.endsWith(".txt") ||
    name.endsWith(".md") ||
    name.endsWith(".csv")
  ) {
    const text = await file.text()
    return {
      originalName: name,
      mimeType,
      sizeByes,
      contentType: "text",
      extractedText: text.slice(0, MAX_TEXT_LENGTH),
      metadata: { truncated: text.length > MAX_TEXT_LENGTH, originalLength: text.length },
    }
  }

  // JSON files
  if (name.endsWith(".json") || name.endsWith(".geojson") || name.endsWith(".dtdl")) {
    try {
      const text = await file.text()
      const parsed = JSON.parse(text)
      return {
        originalName: name,
        mimeType: "application/json",
        sizeByes,
        contentType: "structured",
        extractedText: JSON.stringify(parsed, null, 2).slice(0, MAX_TEXT_LENGTH),
        metadata: {
          keys: typeof parsed === "object" ? Object.keys(parsed) : [],
          type: Array.isArray(parsed) ? "array" : "object",
          length: Array.isArray(parsed) ? parsed.length : undefined,
        },
      }
    } catch {
      return binaryFallback(name, mimeType, sizeByes)
    }
  }

  // Images — pass as binary with metadata only (LLM vision handled separately)
  if (mimeType.startsWith("image/")) {
    return {
      originalName: name,
      mimeType,
      sizeByes,
      contentType: "image",
      metadata: { note: "Image uploaded — pass to vision model separately" },
    }
  }

  // Binary files (PDF, DOCX, RVT, NWD, DWG) — metadata only
  // These need server-side parsing via markdownify/ifcmcp
  return binaryFallback(name, mimeType, sizeByes)
}

function binaryFallback(name: string, mimeType: string, sizeByes: number): ParsedFileContent {
  return {
    originalName: name,
    mimeType,
    sizeByes,
    contentType: "binary",
    metadata: {
      note: "Binary file — requires server-side parsing via markdownify or ifcmcp",
      extension: name.split(".").pop() ?? "unknown",
    },
  }
}

function inferMimeType(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() ?? ""
  const mimeMap: Record<string, string> = {
    pdf: "application/pdf",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ifc: "application/x-step",
    rvt: "application/octet-stream",
    dwg: "application/acad",
    nwd: "application/octet-stream",
    geojson: "application/geo+json",
    kml: "application/vnd.google-earth.kml+xml",
    shp: "application/octet-stream",
  }
  return mimeMap[ext] ?? "application/octet-stream"
}

function extractIfcMetadata(text: string): Record<string, unknown> {
  const lines = text.split("\n").slice(0, 200)
  const schema = lines.find((l) => l.includes("FILE_SCHEMA"))?.match(/'([^']+)'/)?.[1] ?? "unknown"
  const description = lines.find((l) => l.includes("FILE_DESCRIPTION"))?.slice(0, 200) ?? ""
  const entityCount = (text.match(/^#\d+=/gm) ?? []).length

  const typeCounts: Record<string, number> = {}
  const typeMatches = text.matchAll(/= (IFC[A-Z]+)\(/g)
  for (const match of typeMatches) {
    typeCounts[match[1]] = (typeCounts[match[1]] ?? 0) + 1
  }

  const topTypes = Object.entries(typeCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([type, count]) => ({ type, count }))

  return { schema, description, entityCount, topTypes }
}

function summariseIfcText(text: string): string {
  const lines = text.split("\n").slice(0, 100)
  return lines.join("\n").slice(0, MAX_TEXT_LENGTH)
}

export function parsedFileToContextString(file: ParsedFileContent): string {
  const lines = [
    `File: ${file.originalName} (${(file.sizeByes / 1024).toFixed(1)} KB, ${file.mimeType})`,
  ]

  if (file.contentType === "ifc-metadata" && file.metadata) {
    const m = file.metadata as Record<string, unknown>
    lines.push(`IFC Schema: ${m.schema}`)
    lines.push(`Total entities: ${m.entityCount}`)
    if (Array.isArray(m.topTypes)) {
      lines.push(`Top element types: ${(m.topTypes as {type:string;count:number}[]).map(t => `${t.type}(${t.count})`).join(", ")}`)
    }
  }

  if (file.extractedText) {
    lines.push(`\nExtracted content:\n${file.extractedText}`)
  }

  if (file.contentType === "binary") {
    lines.push(`Note: Binary file — server-side parsing required for full extraction.`)
  }

  return lines.join("\n")
}
```

Commit: "feat: real file handler — server-side parsing, IFC metadata extraction, never filename-only"

---

## STAGE H — UPDATE components/IntakeStepRenderer.tsx

Replace the file upload section to use parseUploadedFile:

```tsx
"use client"
import { useRef, useState } from "react"
import type { IntakeStep, IntakeState, ParsedFileContent } from "@/types"
import { parseUploadedFile } from "@/lib/fileHandler"

interface IntakeStepRendererProps {
  step: IntakeStep
  state: IntakeState
  onChange: (stepId: string, value: string | string[] | ParsedFileContent | null) => void
}

export function IntakeStepRenderer({ step, state, onChange }: IntakeStepRendererProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [parsing, setParsing] = useState(false)
  const value = state[step.id]

  const handleFileChange = async (file: File | null) => {
    if (!file) { onChange(step.id, null); return }
    setParsing(true)
    try {
      const parsed = await parseUploadedFile(file)
      onChange(step.id, parsed)
    } catch {
      onChange(step.id, null)
    } finally {
      setParsing(false)
    }
  }

  const isParsedFile = value && typeof value === "object" && !Array.isArray(value) && "originalName" in value

  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-medium text-gray-600">
        {step.label}
        {step.required === false && <span className="text-gray-400 ml-1">(optional)</span>}
      </label>
      {step.helpText && <p className="text-xs text-gray-400">{step.helpText}</p>}

      {step.type === "select" && (
        <select
          value={(value as string) ?? ""}
          onChange={(e) => onChange(step.id, e.target.value)}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#190A46] bg-white"
        >
          <option value="">Select…</option>
          {step.options?.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      )}

      {step.type === "multiselect" && (
        <div className="flex flex-wrap gap-2">
          {step.options?.map((opt) => {
            const selected = Array.isArray(value) && (value as string[]).includes(opt.value)
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  const current = (Array.isArray(value) ? value : []) as string[]
                  onChange(step.id, selected ? current.filter((v) => v !== opt.value) : [...current, opt.value])
                }}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                  selected
                    ? "bg-[#190A46] text-white border-[#190A46]"
                    : "bg-white text-gray-600 border-gray-200 hover:border-[#190A46]"
                }`}
              >
                {opt.label}
              </button>
            )
          })}
        </div>
      )}

      {(step.type === "url" || step.type === "url-or-upload") && (
        <input
          type="url"
          value={(value as string) ?? ""}
          onChange={(e) => onChange(step.id, e.target.value)}
          placeholder={step.placeholder}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#190A46]"
        />
      )}

      {(step.type === "upload" || step.type === "url-or-upload") && (
        <div>
          <div
            onClick={() => !parsing && fileRef.current?.click()}
            className={`border-2 border-dashed rounded-lg p-5 text-center transition-colors ${
              parsing
                ? "border-[#190A46] bg-blue-50 cursor-wait"
                : "border-gray-200 hover:border-[#190A46] cursor-pointer"
            }`}
          >
            {parsing ? (
              <div className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-[#190A46] border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-[#190A46]">Parsing file…</p>
              </div>
            ) : isParsedFile ? (
              <div>
                <p className="text-sm font-medium text-gray-800">{(value as ParsedFileContent).originalName}</p>
                <p className="text-xs text-gray-400 mt-1">
                  {((value as ParsedFileContent).sizeByes / 1024).toFixed(1)} KB · {(value as ParsedFileContent).contentType}
                </p>
                {(value as ParsedFileContent).metadata?.entityCount && (
                  <p className="text-xs text-green-600 mt-1">
                    ✓ {(value as ParsedFileContent).metadata?.entityCount as number} IFC entities extracted
                  </p>
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); onChange(step.id, null) }}
                  className="text-xs text-red-500 mt-2 hover:underline"
                >
                  Remove
                </button>
              </div>
            ) : (
              <div>
                <p className="text-sm text-gray-400">Click to browse or drag and drop</p>
                {step.accept && <p className="text-xs text-gray-300 mt-1">{step.accept}</p>}
                {step.maxFileSizeMb && <p className="text-xs text-gray-300">Max {step.maxFileSizeMb} MB</p>}
              </div>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept={step.accept}
            className="hidden"
            onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
          />
        </div>
      )}

      {(step.type === "text" || step.type === "textarea") && (
        step.type === "textarea" ? (
          <textarea
            value={(value as string) ?? ""}
            onChange={(e) => onChange(step.id, e.target.value)}
            placeholder={step.placeholder}
            rows={3}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#190A46] resize-none"
          />
        ) : (
          <input
            type="text"
            value={(value as string) ?? ""}
            onChange={(e) => onChange(step.id, e.target.value)}
            placeholder={step.placeholder}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#190A46]"
          />
        )
      )}
    </div>
  )
}
```

Commit: "feat: real file parsing in intake step renderer — IFC metadata extraction on upload"
