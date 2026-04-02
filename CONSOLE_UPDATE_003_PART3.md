# DigitAlchemy® Console — Refined Architecture v3.0
# Part 3 of 3: Detection panel, validation, multi-stage status, API route, analysis engine
# 30 March 2026

---

## STAGE I — CREATE components/DetectionPanel.tsx

```tsx
// components/DetectionPanel.tsx
// Shows ranked workflow candidates with scores and reasons
// Supports auto-detect mode and manual override

"use client"
import type { WorkflowCandidate, WorkflowDefinition, DetectionMode } from "@/types"

const confidenceColors = {
  high: "text-green-700 bg-green-50 border-green-200",
  medium: "text-amber-700 bg-amber-50 border-amber-200",
  low: "text-gray-500 bg-gray-50 border-gray-200",
}

const workflowColors: Record<string, string> = {
  pink: "bg-pink-50 text-pink-800 border-pink-200",
  blue: "bg-blue-50 text-blue-800 border-blue-200",
  green: "bg-green-50 text-green-800 border-green-200",
  amber: "bg-amber-50 text-amber-800 border-amber-200",
  purple: "bg-purple-50 text-purple-800 border-purple-200",
  cyan: "bg-cyan-50 text-cyan-800 border-cyan-200",
  gray: "bg-gray-50 text-gray-700 border-gray-200",
}

interface DetectionPanelProps {
  candidates: WorkflowCandidate[]
  selected: WorkflowDefinition | null
  allWorkflows: WorkflowDefinition[]
  mode: DetectionMode
  isCompound: boolean
  compoundLabels?: string[]
  onSelect: (workflow: WorkflowDefinition) => void
  onModeChange: (mode: DetectionMode) => void
}

export function DetectionPanel({
  candidates,
  selected,
  allWorkflows,
  mode,
  isCompound,
  compoundLabels,
  onSelect,
  onModeChange,
}: DetectionPanelProps) {
  const primary = candidates[0]
  const alternatives = candidates.slice(1)

  if (mode === "manual") {
    return (
      <div className="flex items-center gap-3 flex-wrap">
        <select
          value={selected?.id ?? ""}
          onChange={(e) => {
            const wf = allWorkflows.find((w) => w.id === e.target.value)
            if (wf) onSelect(wf)
          }}
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#190A46]"
        >
          <option value="">Select workflow…</option>
          {allWorkflows.map((wf) => (
            <option key={wf.id} value={wf.id}>{wf.label}</option>
          ))}
        </select>
        <button
          onClick={() => onModeChange("auto")}
          className="text-xs text-gray-400 hover:text-[#190A46] underline"
        >
          Switch to auto-detect
        </button>
      </div>
    )
  }

  if (!primary) return null

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        {/* Primary detection */}
        <button
          onClick={() => onSelect(primary.workflow)}
          className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
            selected?.id === primary.workflow.id
              ? workflowColors[primary.workflow.color] ?? workflowColors.gray
              : "bg-white text-gray-700 border-gray-200 hover:border-[#190A46]"
          }`}
        >
          <span>{primary.workflow.label}</span>
          <span className={`px-1.5 py-0.5 rounded text-xs border ${confidenceColors[primary.confidence]}`}>
            {primary.confidence}
          </span>
        </button>

        {/* Alternative candidates */}
        {alternatives.length > 0 && (
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-gray-400">Also consider:</span>
            {alternatives.map((c) => (
              <button
                key={c.workflow.id}
                onClick={() => onSelect(c.workflow)}
                className={`inline-flex items-center gap-1.5 px-2 py-1 rounded border text-xs transition-colors ${
                  selected?.id === c.workflow.id
                    ? workflowColors[c.workflow.color] ?? workflowColors.gray
                    : "bg-white text-gray-500 border-gray-200 hover:border-[#190A46] hover:text-gray-700"
                }`}
              >
                {c.workflow.label}
              </button>
            ))}
          </div>
        )}

        <button
          onClick={() => onModeChange("manual")}
          className="text-xs text-gray-400 hover:text-[#190A46] ml-auto"
        >
          Choose manually
        </button>
      </div>

      {/* Compound task indicator */}
      {isCompound && compoundLabels && compoundLabels.length > 1 && (
        <div className="flex items-center gap-2 bg-[#190A46]/5 border border-[#190A46]/10 rounded-lg px-3 py-2">
          <span className="text-xs font-medium text-[#190A46]">Compound task detected</span>
          <span className="text-xs text-gray-500">
            This task spans {compoundLabels.join(" + ")}
          </span>
        </div>
      )}

      {/* Matched keywords for primary */}
      {primary.matchedKeywords.length > 0 && (
        <p className="text-xs text-gray-400">
          Matched: {primary.matchedKeywords.slice(0, 4).join(", ")}
          {primary.matchedKeywords.length > 4 && ` +${primary.matchedKeywords.length - 4} more`}
        </p>
      )}
    </div>
  )
}
```

Commit: "feat: DetectionPanel — ranked candidates, confidence labels, compound indicator, manual override"

---

## STAGE J — CREATE components/OrchestrationStatus.tsx

```tsx
// components/OrchestrationStatus.tsx
// Multi-stage progress indicator for orchestration pipeline

"use client"
import type { OrchestrationStage } from "@/types"

const stages: { id: OrchestrationStage; label: string; description: string }[] = [
  { id: "classifying", label: "Classifying", description: "Identifying workflow type and branches" },
  { id: "gathering-context", label: "Context", description: "Processing files and inputs" },
  { id: "building-plan", label: "Planning", description: "Building execution plan" },
  { id: "reasoning", label: "Reasoning", description: "Generating recommendations" },
  { id: "complete", label: "Complete", description: "Analysis ready" },
]

const stageOrder: OrchestrationStage[] = [
  "idle", "classifying", "gathering-context", "building-plan", "reasoning", "complete"
]

interface OrchestrationStatusProps {
  stage: OrchestrationStage
  elapsedMs?: number
  currentStep?: string
}

export function OrchestrationStatus({ stage, elapsedMs, currentStep }: OrchestrationStatusProps) {
  if (stage === "idle" || stage === "complete" || stage === "failed") return null

  const currentIndex = stageOrder.indexOf(stage)

  return (
    <div className="bg-white border border-gray-100 rounded-xl p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-medium text-gray-900">
          {stages.find((s) => s.id === stage)?.description ?? "Processing…"}
        </p>
        {elapsedMs !== undefined && (
          <span className="text-xs text-gray-400 font-mono">{(elapsedMs / 1000).toFixed(1)}s</span>
        )}
      </div>

      {/* Stage progress bar */}
      <div className="flex items-center gap-1 mb-3">
        {stages.map((s, i) => {
          const sIndex = stageOrder.indexOf(s.id)
          const isActive = s.id === stage
          const isDone = sIndex < currentIndex
          return (
            <div key={s.id} className="flex-1 flex flex-col items-center gap-1">
              <div className={`h-1.5 w-full rounded-full transition-all duration-500 ${
                isDone ? "bg-[#190A46]" : isActive ? "bg-[#b87333]" : "bg-gray-100"
              }`} />
              <span className={`text-xs hidden sm:block ${
                isActive ? "text-[#b87333] font-medium" : isDone ? "text-[#190A46]" : "text-gray-300"
              }`}>
                {s.label}
              </span>
            </div>
          )
        })}
      </div>

      {/* Current step detail */}
      {currentStep && (
        <div className="flex items-center gap-2 mt-2">
          <div className="w-3 h-3 border-2 border-[#b87333] border-t-transparent rounded-full animate-spin shrink-0" />
          <p className="text-xs text-gray-500">{currentStep}</p>
        </div>
      )}
    </div>
  )
}
```

Commit: "feat: multi-stage orchestration status with elapsed timer and step detail"

---

## STAGE K — UPDATE components/IntakePanel.tsx (add validation)

```tsx
"use client"
import { useState, useEffect } from "react"
import type { WorkflowDefinition, IntakeState, IntakeValidationResult } from "@/types"
import { getVisibleSteps, validateIntakeState } from "@/lib/conditionEvaluator"
import { IntakeStepRenderer } from "./IntakeStepRenderer"

interface IntakePanelProps {
  workflow: WorkflowDefinition
  onStateChange: (state: IntakeState, validation: IntakeValidationResult) => void
}

export function IntakePanel({ workflow, onStateChange }: IntakePanelProps) {
  const [state, setState] = useState<IntakeState>({})

  useEffect(() => {
    setState({})
    onStateChange({}, validateIntakeState(workflow.intakeSteps, {}))
  }, [workflow.id])

  const handleChange = (stepId: string, value: IntakeState[string]) => {
    const newState = { ...state, [stepId]: value }
    setState(newState)
    const visibleSteps = getVisibleSteps(workflow.intakeSteps, newState)
    const validation = validateIntakeState(visibleSteps, newState)
    onStateChange(newState, validation)
  }

  const visibleSteps = getVisibleSteps(workflow.intakeSteps, state)

  if (!visibleSteps.length) return null

  return (
    <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm space-y-5">
      <div className="flex items-center gap-2">
        <div className="w-5 h-5 rounded-full bg-[#190A46] flex items-center justify-center shrink-0">
          <span className="text-white text-xs font-bold">→</span>
        </div>
        <p className="text-sm font-semibold text-gray-800">Command Desk needs more context</p>
        <span className="ml-auto text-xs text-gray-400">{visibleSteps.length} field{visibleSteps.length !== 1 ? "s" : ""}</span>
      </div>
      {visibleSteps.map((step) => (
        <IntakeStepRenderer
          key={step.id}
          step={step}
          state={state}
          onChange={handleChange}
        />
      ))}
    </div>
  )
}
```

---

## STAGE L — UPDATE components/TaskInput.tsx (full replacement with all features)

```tsx
"use client"
import { useState, useEffect } from "react"
import { detectWorkflowCandidates, detectCompoundTask, getAllWorkflows } from "@/lib/workflowDetector"
import type {
  WorkflowDefinition, WorkflowCandidate, IntakeState,
  IntakeValidationResult, DetectionMode, CompoundTaskPlan
} from "@/types"
import { DetectionPanel } from "./DetectionPanel"
import { IntakePanel } from "./IntakePanel"

const EXAMPLE_PROMPTS = [
  "Analyze this HeyGen video and recommend trending hashtags and music for TikTok",
  "Review this IFC model and identify classification issues and missing COBie data",
  "Map this ISO 19650 handover process to the correct agents and toolchain",
  "Plan the sensor deployment strategy for a 50,000 sqm mixed-use development in Abu Dhabi",
  "Summarize this PDF report and extract key action items",
]

interface TaskInputProps {
  onSubmit: (
    task: string,
    workflow: WorkflowDefinition | null,
    intakeState: IntakeState,
    compoundPlan: CompoundTaskPlan | null
  ) => void
  loading: boolean
}

export function TaskInput({ onSubmit, loading }: TaskInputProps) {
  const [task, setTask] = useState("")
  const [candidates, setCandidates] = useState<WorkflowCandidate[]>([])
  const [selectedWorkflow, setSelectedWorkflow] = useState<WorkflowDefinition | null>(null)
  const [mode, setMode] = useState<DetectionMode>("auto")
  const [intakeState, setIntakeState] = useState<IntakeState>({})
  const [validation, setValidation] = useState<IntakeValidationResult>({ valid: true, missingFields: [] })
  const [compoundPlan, setCompoundPlan] = useState<CompoundTaskPlan | null>(null)
  const allWorkflows = getAllWorkflows()

  const activeWorkflow = selectedWorkflow ?? candidates[0]?.workflow ?? null

  useEffect(() => {
    const debounce = setTimeout(() => {
      if (task.trim().length > 10) {
        const detected = detectWorkflowCandidates(task, 3)
        setCandidates(detected)
        const compound = detectCompoundTask(task)
        setCompoundPlan(compound)
        if (mode === "auto") setSelectedWorkflow(null)
      } else {
        setCandidates([])
        setCompoundPlan(null)
      }
    }, 400)
    return () => clearTimeout(debounce)
  }, [task])

  const handleIntakeChange = (state: IntakeState, val: IntakeValidationResult) => {
    setIntakeState(state)
    setValidation(val)
  }

  const canSubmit =
    task.trim().length >= 5 &&
    !loading &&
    (activeWorkflow === null || activeWorkflow.intakeSteps.length === 0 || validation.valid)

  const handleSubmit = () => {
    if (!canSubmit) return
    onSubmit(task.trim(), activeWorkflow, intakeState, compoundPlan)
  }

  return (
    <div className="space-y-4">
      <div className="bg-white border border-gray-100 rounded-xl p-6 shadow-sm">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Describe your task or workflow
        </label>
        <textarea
          value={task}
          onChange={(e) => setTask(e.target.value)}
          placeholder="e.g. Analyze a HeyGen video and recommend hashtags, review an IFC model, map a compliance workflow…"
          rows={4}
          className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#190A46] focus:border-transparent resize-none"
          onKeyDown={(e) => { if (e.key === "Enter" && e.metaKey) handleSubmit() }}
        />

        {/* Detection panel */}
        {(candidates.length > 0 || mode === "manual") && (
          <div className="mt-3">
            <DetectionPanel
              candidates={candidates}
              selected={selectedWorkflow}
              allWorkflows={allWorkflows}
              mode={mode}
              isCompound={compoundPlan?.isCompound ?? false}
              compoundLabels={compoundPlan?.branches.map((b) => b.workflowLabel)}
              onSelect={(wf) => { setSelectedWorkflow(wf); setIntakeState({}); setValidation({ valid: true, missingFields: [] }) }}
              onModeChange={setMode}
            />
          </div>
        )}

        <div className="mt-4 flex items-center justify-between gap-4">
          <div className="flex flex-wrap gap-2">
            {EXAMPLE_PROMPTS.slice(0, 3).map((p, i) => (
              <button
                key={i}
                onClick={() => setTask(p)}
                className="text-xs text-gray-500 hover:text-[#190A46] border border-gray-200 hover:border-[#190A46] rounded px-2 py-1 transition-colors"
              >
                {p.slice(0, 36)}…
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {/* Validation state */}
            {activeWorkflow && !validation.valid && validation.missingFields.length > 0 && (
              <span className="text-xs text-amber-600">
                {validation.missingFields.length} required field{validation.missingFields.length > 1 ? "s" : ""}
              </span>
            )}
            <button
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="bg-[#190A46] text-white text-sm font-medium px-6 py-2 rounded-lg hover:bg-[#2a1560] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? "Analyzing…" : "Analyze"}
            </button>
          </div>
        </div>
        <p className="text-xs text-gray-400 mt-2">⌘ + Enter to submit</p>
      </div>

      {/* Intake panel — only when workflow has steps */}
      {activeWorkflow && activeWorkflow.intakeSteps.length > 0 && (
        <IntakePanel
          workflow={activeWorkflow}
          onStateChange={handleIntakeChange}
        />
      )}
    </div>
  )
}
```

Commit: "feat: TaskInput v3 — ranked detection, validation-gated submit, compound task support"

---

## STAGE M — UPDATE app/page.tsx (add OrchestrationStatus)

```tsx
"use client"
import { useState, useRef } from "react"
import { TaskInput } from "@/components/TaskInput"
import { ExecutionPlan } from "@/components/ExecutionPlan"
import { OrchestrationStatus } from "@/components/OrchestrationStatus"
import type { AnalyzeTaskResult, WorkflowDefinition, IntakeState, CompoundTaskPlan, OrchestrationStage, ParsedFileContent } from "@/types"
import { parsedFileToContextString } from "@/lib/fileHandler"

export default function ConsolePage() {
  const [result, setResult] = useState<AnalyzeTaskResult | null>(null)
  const [stage, setStage] = useState<OrchestrationStage>("idle")
  const [currentStep, setCurrentStep] = useState<string | undefined>()
  const [elapsedMs, setElapsedMs] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startTimeRef = useRef<number>(0)

  const startTimer = () => {
    startTimeRef.current = Date.now()
    timerRef.current = setInterval(() => {
      setElapsedMs(Date.now() - startTimeRef.current)
    }, 100)
  }

  const stopTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current)
  }

  const buildIntakeContext = (state: IntakeState): { context: Record<string, string | string[]>; parsedFiles: ParsedFileContent[] } => {
    const context: Record<string, string | string[]> = {}
    const parsedFiles: ParsedFileContent[] = []

    for (const [key, value] of Object.entries(state)) {
      if (!value) continue
      if (value && typeof value === "object" && !Array.isArray(value) && "originalName" in value) {
        parsedFiles.push(value as ParsedFileContent)
      } else if (Array.isArray(value)) {
        context[key] = value as string[]
      } else if (typeof value === "string") {
        context[key] = value
      }
    }

    return { context, parsedFiles }
  }

  const handleSubmit = async (
    task: string,
    workflow: WorkflowDefinition | null,
    intakeState: IntakeState,
    compoundPlan: CompoundTaskPlan | null
  ) => {
    setResult(null)
    setError(null)
    setElapsedMs(0)
    startTimer()

    try {
      setStage("classifying")
      setCurrentStep("Classifying task type and identifying branches…")

      const { context, parsedFiles } = buildIntakeContext(intakeState)

      // Build enriched task with parsed file content
      const fileContextLines = parsedFiles.map(parsedFileToContextString)
      const contextLines = Object.entries(context).map(([k, v]) =>
        `${k}: ${Array.isArray(v) ? v.join(", ") : v}`
      )

      const enrichedTask = [
        task,
        contextLines.length ? `\nContext:\n${contextLines.join("\n")}` : "",
        fileContextLines.length ? `\nFiles:\n${fileContextLines.join("\n\n")}` : "",
      ].filter(Boolean).join("")

      setStage("gathering-context")
      setCurrentStep("Processing files and intake context…")

      await new Promise((r) => setTimeout(r, 200)) // allow UI to update

      setStage("building-plan")
      setCurrentStep("Building orchestration plan…")

      setStage("reasoning")
      setCurrentStep("Generating agent recommendations and execution path…")

      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task: enrichedTask,
          workflowId: workflow?.id ?? null,
          workflowLabel: workflow?.label ?? null,
          intakeContext: context,
          parsedFiles: parsedFiles.map((f) => ({
            originalName: f.originalName,
            contentType: f.contentType,
            metadata: f.metadata,
          })),
          isCompound: compoundPlan?.isCompound ?? false,
          compoundBranches: compoundPlan?.branches ?? [],
        }),
      })

      const data = await res.json()

      if (data.success) {
        setResult(data.result)
        setStage("complete")
      } else {
        setError(data.error ?? "Analysis failed")
        setStage("failed")
      }
    } catch {
      setError("Failed to connect to analysis engine")
      setStage("failed")
    } finally {
      stopTimer()
    }
  }

  const loading = stage !== "idle" && stage !== "complete" && stage !== "failed"

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded bg-[#190A46] flex items-center justify-center">
              <span className="text-white text-xs font-bold">DA</span>
            </div>
            <div>
              <span className="text-sm font-semibold text-gray-900">DigitAlchemy®</span>
              <span className="text-sm text-gray-400 ml-2">Console</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-400" />
            <span className="text-xs text-gray-500">Orchestration layer connected</span>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-gray-900">Task analysis</h1>
          <p className="text-sm text-gray-500 mt-1">
            Describe a task. Command Desk classifies it, gathers context, and generates the execution plan.
          </p>
        </div>

        <div className="space-y-5">
          <TaskInput onSubmit={handleSubmit} loading={loading} />

          {loading && (
            <OrchestrationStatus
              stage={stage}
              elapsedMs={elapsedMs}
              currentStep={currentStep}
            />
          )}

          {error && (
            <div className="bg-red-50 border border-red-100 rounded-xl p-5">
              <p className="text-sm font-medium text-red-800">Analysis failed</p>
              <p className="text-sm text-red-600 mt-1">{error}</p>
              <button
                onClick={() => { setError(null); setStage("idle") }}
                className="text-xs text-red-500 hover:underline mt-2"
              >
                Dismiss
              </button>
            </div>
          )}

          {result && <ExecutionPlan result={result} />}
        </div>
      </main>

      <footer className="max-w-5xl mx-auto px-6 py-6 mt-8 border-t border-gray-100">
        <p className="text-xs text-gray-400">
          DigitAlchemy® Tech Limited · ADGM No. 35004 · Sky Tower, Al Reem Island, Abu Dhabi, UAE
        </p>
      </footer>
    </div>
  )
}
```

Commit: "feat: page.tsx v3 — multi-stage status, real file context, compound plan support"

---

## STAGE N — UPDATE lib/analyzeTask.ts (provenance + compound support)

Update the function signature and system prompt:

```ts
export async function analyzeTask(
  task: string,
  workflowId: string | null,
  workflowLabel: string | null,
  isCompound: boolean = false,
  compoundBranches: { workflowId: string; workflowLabel: string; weight: number }[] = []
): Promise<AnalyzeTaskResult>
```

Update the system prompt to include provenance instructions:

Add to buildSystemPrompt():
```
## PROVENANCE AND CONFIDENCE RULES
Every output field that is an AnnotatedValue must include:
- confidence: "high" | "medium" | "low"
- provenance: "observed" (from explicit task content) | "inferred" (from context) | "registry" (from MCP/agent registry) | "user-provided" (from intake form)
- reason: brief explanation

## COMPOUND TASK RULES
${isCompound && compoundBranches.length > 1
  ? `This is a compound task spanning: ${compoundBranches.map(b => b.workflowLabel).join(", ")}. Set isCompound: true and list compoundBranches in your response.`
  : "This is a single-workflow task. Set isCompound: false."}
```

Update the response schema in the system prompt:
```json
{
  "taskSummary": { "value": "string", "confidence": "high|medium|low", "provenance": "observed|inferred|registry|user-provided", "reason": "string" },
  "workflowType": { "value": "string", "confidence": "high|medium|low", "provenance": "observed|inferred", "reason": "string" },
  "isCompound": false,
  "compoundBranches": [],
  "recommendedAgents": [{
    "id": "string", "displayName": "string", "shortDescription": "string", "category": "string",
    "confidence": "high|medium|low", "provenance": "registry|inferred"
  }],
  "recommendedMCPs": [{
    "name": "string", "role": "string", "priority": "core|supporting|optional",
    "reason": "string", "source": "registry|missing_but_recommended", "confidence": "high|medium|low"
  }],
  "executionOrder": ["string"],
  "dependencies": ["string"],
  "warnings": ["string"],
  "nextActions": ["string"]
}
```

Commit: "feat: analysis engine — provenance annotations, compound task support"

---

## STAGE O — UPDATE components/ExecutionPlan.tsx (render AnnotatedValue fields)

Update to render taskSummary and workflowType as AnnotatedValue:

```tsx
// In ExecutionPlan, replace header section:
<div className="bg-white border border-gray-100 rounded-xl p-6 shadow-sm">
  <div className="flex items-start gap-3 mb-3 flex-wrap">
    <WorkflowTypeTag type={result.workflowType.value} />
    <span className={`text-xs px-2 py-0.5 rounded border ${
      result.workflowType.confidence === "high"
        ? "bg-green-50 text-green-700 border-green-200"
        : result.workflowType.confidence === "medium"
        ? "bg-amber-50 text-amber-700 border-amber-200"
        : "bg-gray-50 text-gray-500 border-gray-200"
    }`}>
      {result.workflowType.confidence} confidence · {result.workflowType.provenance}
    </span>
    {result.isCompound && result.compoundBranches && (
      <span className="text-xs bg-[#190A46]/10 text-[#190A46] px-2 py-0.5 rounded border border-[#190A46]/20">
        Compound — {result.compoundBranches.map(b => b.label).join(" + ")}
      </span>
    )}
  </div>
  <p className="text-base text-gray-800 leading-relaxed">{result.taskSummary.value}</p>
  {result.taskSummary.reason && (
    <p className="text-xs text-gray-400 mt-2">{result.taskSummary.reason}</p>
  )}
</div>
```

Commit: "feat: ExecutionPlan renders AnnotatedValue with confidence and provenance labels"

---

## FINAL COMMIT AND PUSH

```bash
git add -A
git commit -m "feat: Console v3 — full orchestration architecture, safe condition evaluator, ranked detection, compound tasks, real file handling, provenance annotations, multi-stage status"
git push origin main
```

---

## SUMMARY OF ALL CHANGES IN v3.0

| Feature | Status |
|---|---|
| Safe condition evaluator (no new Function) | ✅ Part 1 Stage B |
| Ranked multi-candidate workflow detection | ✅ Part 1 Stage C |
| Compound task detection | ✅ Part 1 Stage C |
| Expanded processor registry with full contracts | ✅ Part 2 Stage E |
| Orchestration plan layer | ✅ Part 2 Stage F |
| Real file handling (IFC metadata, text extract) | ✅ Part 2 Stage G |
| File parsing in IntakeStepRenderer | ✅ Part 2 Stage H |
| DetectionPanel with candidates + manual mode | ✅ Part 3 Stage I |
| Multi-stage OrchestrationStatus with timer | ✅ Part 3 Stage J |
| Validation-gated submit | ✅ Part 3 Stage K+L |
| Auto-detect + manual selection modes | ✅ Part 3 Stage L |
| Provenance + confidence annotations | ✅ Part 3 Stage N |
| Compound task support in analysis engine | ✅ Part 3 Stage N |
| AnnotatedValue rendering in ExecutionPlan | ✅ Part 3 Stage O |
| Timeout fix (60s, reduced tokens) | ✅ Carried from v2 |
| Config-driven extensibility | ✅ workflows.json throughout |
