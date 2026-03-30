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
        {stages.map((s) => {
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
