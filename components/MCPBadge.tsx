import type { RecommendedMCP } from "@/types"

const priorityConfig = {
  core: { label: "Core", className: "bg-[#190A46] text-white" },
  supporting: { label: "Supporting", className: "bg-gray-100 text-gray-700 border border-gray-200" },
  optional: { label: "Optional", className: "bg-white text-gray-500 border border-gray-200" },
}

export function MCPBadge({ mcp }: { mcp: RecommendedMCP }) {
  const config = priorityConfig[mcp.priority]
  return (
    <div className="flex items-start gap-2 py-2 border-b border-gray-50 last:border-0">
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium shrink-0 mt-0.5 ${config.className}`}>
        {config.label}
      </span>
      <div className="min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{mcp.name}</p>
        <p className="text-xs text-gray-500 truncate">{mcp.role}</p>
        {mcp.source === "missing_but_recommended" && (
          <p className="text-xs text-amber-600 mt-0.5">Not currently connected</p>
        )}
      </div>
    </div>
  )
}
