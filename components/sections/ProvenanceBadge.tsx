import type { ProvenanceType, ConfidenceLevel } from "@/types"

const provenanceConfig = {
  observed: { label: "observed", className: "bg-green-50 text-green-700 border-green-200" },
  inferred: { label: "inferred", className: "bg-blue-50 text-blue-700 border-blue-200" },
  registry: { label: "registry", className: "bg-purple-50 text-purple-700 border-purple-200" },
  "user-provided": { label: "provided", className: "bg-gray-50 text-gray-600 border-gray-200" },
}

const confidenceConfig = {
  high: "●●●",
  medium: "●●○",
  low: "●○○",
}

export function ProvenanceBadge({ provenance, confidence }: { provenance?: ProvenanceType; confidence?: ConfidenceLevel }) {
  if (!provenance || !confidence) return null
  const pc = provenanceConfig[provenance] ?? provenanceConfig.inferred
  return (
    <span className="inline-flex items-center gap-1">
      <span className={`text-xs px-1.5 py-0.5 rounded border ${pc.className}`}>{pc.label}</span>
      <span className="text-xs text-gray-400 font-mono">{confidenceConfig[confidence] ?? "●○○"}</span>
    </span>
  )
}
