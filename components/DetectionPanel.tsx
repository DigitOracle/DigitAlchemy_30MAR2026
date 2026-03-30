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
