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
    console.log("[IntakePanel] state change:", stepId, value)
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
