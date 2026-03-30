import type { RecommendedAgent, RecommendedMCP } from "@/types"

export function AgentPlanCard({ data }: { data: Record<string, unknown> }) {
  const agents = data.recommendedAgents as RecommendedAgent[] | undefined
  const mcps = data.recommendedMCPs as RecommendedMCP[] | undefined
  const steps = data.executionOrder as string[] | undefined
  const warnings = data.warnings as string[] | undefined
  const nextActions = data.nextActions as string[] | undefined

  return (
    <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <span className="w-2 h-2 rounded-full bg-purple-500" />
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Agent & MCP plan</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        {agents && agents.length > 0 && (
          <div>
            <p className="text-xs font-medium text-gray-500 mb-2">Agents</p>
            <div className="space-y-2">
              {agents.map((agent) => (
                <div key={agent.id} className="flex items-start gap-2 text-sm">
                  <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-[#190A46] mt-1.5" />
                  <div>
                    <span className="font-medium text-gray-900">{agent.displayName}</span>
                    <span className="text-gray-400 text-xs ml-1">&mdash; {agent.shortDescription}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {mcps && mcps.length > 0 && (
          <div>
            <p className="text-xs font-medium text-gray-500 mb-2">MCP tools</p>
            <div className="space-y-1">
              {mcps.filter(m => m.priority === "core").map((mcp, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <span className="text-xs bg-[#190A46] text-white px-1.5 py-0.5 rounded">core</span>
                  <span className="text-gray-800">{mcp.name}</span>
                </div>
              ))}
              {mcps.filter(m => m.priority === "supporting").map((mcp, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <span className="text-xs bg-gray-100 text-gray-600 border border-gray-200 px-1.5 py-0.5 rounded">supporting</span>
                  <span className="text-gray-700">{mcp.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {steps && steps.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-medium text-gray-500 mb-2">Execution order</p>
          <ol className="space-y-1">
            {steps.map((step, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                <span className="shrink-0 w-5 h-5 rounded-full bg-[#190A46] text-white text-xs flex items-center justify-center">{i + 1}</span>
                <span className="mt-0.5">{step}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {warnings && warnings.length > 0 && (
        <div className="bg-amber-50 border border-amber-100 rounded-lg p-3 mb-3">
          {warnings.map((w, i) => (
            <p key={i} className="text-xs text-amber-800 flex items-start gap-1"><span>&#9888;</span>{w}</p>
          ))}
        </div>
      )}

      {nextActions && nextActions.length > 0 && (
        <div>
          <p className="text-xs font-medium text-gray-500 mb-2">Next actions</p>
          {nextActions.map((a, i) => (
            <p key={i} className="text-sm text-gray-700 flex items-start gap-2">
              <span className="text-[#b87333] shrink-0">&rarr;</span>{a}
            </p>
          ))}
        </div>
      )}
    </div>
  )
}
