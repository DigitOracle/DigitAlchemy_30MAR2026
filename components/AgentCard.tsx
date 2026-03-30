import type { RecommendedAgent } from "@/types"

const categoryAccent: Record<string, string> = {
  Orchestration: "border-l-[#190A46]",
  BIM: "border-l-blue-500",
  GIS: "border-l-green-500",
  Regulatory: "border-l-amber-500",
  Visualisation: "border-l-purple-500",
  "Digital Twin": "border-l-cyan-500",
  IoT: "border-l-orange-500",
  DevOps: "border-l-gray-500",
  Documentation: "border-l-indigo-500",
  Standards: "border-l-red-500",
  "Asset Management": "border-l-teal-500",
  Social: "border-l-pink-500",
}

export function AgentCard({ agent }: { agent: RecommendedAgent }) {
  const accent = categoryAccent[agent.category] ?? "border-l-gray-300"
  return (
    <div className={`bg-white border border-gray-100 border-l-4 ${accent} rounded-lg p-4 shadow-sm`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-gray-900">{agent.displayName}</p>
          <p className="text-xs text-gray-500 mt-0.5">{agent.shortDescription}</p>
        </div>
        <span className="text-xs text-gray-400 shrink-0 mt-0.5 bg-gray-50 px-2 py-0.5 rounded">
          {agent.category}
        </span>
      </div>
    </div>
  )
}
