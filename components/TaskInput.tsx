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
