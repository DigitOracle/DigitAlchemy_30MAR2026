import type { AnalyzeTaskResult } from "@/types"
import { WorkflowTypeTag } from "./WorkflowTypeTag"
import { AgentCard } from "./AgentCard"
import { MCPBadge } from "./MCPBadge"
import { DependencyAlert } from "./DependencyAlert"
import { StandardsContextPanel } from "./StandardsContextPanel"

export function ExecutionPlan({ result }: { result: AnalyzeTaskResult }) {
  const coreMCPs = result.recommendedMCPs.filter((m) => m.priority === "core")
  const supportingMCPs = result.recommendedMCPs.filter((m) => m.priority === "supporting")
  const optionalMCPs = result.recommendedMCPs.filter((m) => m.priority === "optional")

  return (
    <div className="space-y-5">
      {/* Header */}
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Agents */}
        <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Recommended agents
          </h3>
          <div className="space-y-3">
            {result.recommendedAgents.map((agent) => (
              <AgentCard key={agent.id} agent={agent} />
            ))}
          </div>
        </div>

        {/* MCPs */}
        <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            MCP tools
          </h3>
          {coreMCPs.length > 0 && (
            <div className="mb-3">
              <p className="text-xs text-gray-400 mb-1">Core</p>
              {coreMCPs.map((m, i) => <MCPBadge key={i} mcp={m} />)}
            </div>
          )}
          {supportingMCPs.length > 0 && (
            <div className="mb-3">
              <p className="text-xs text-gray-400 mb-1">Supporting</p>
              {supportingMCPs.map((m, i) => <MCPBadge key={i} mcp={m} />)}
            </div>
          )}
          {optionalMCPs.length > 0 && (
            <div>
              <p className="text-xs text-gray-400 mb-1">Optional</p>
              {optionalMCPs.map((m, i) => <MCPBadge key={i} mcp={m} />)}
            </div>
          )}
        </div>
      </div>

      {/* Execution order */}
      <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Execution order
        </h3>
        <ol className="space-y-2">
          {result.executionOrder.map((step, i) => (
            <li key={i} className="flex items-start gap-3 text-sm text-gray-800">
              <span className="shrink-0 w-6 h-6 rounded-full bg-[#190A46] text-white text-xs flex items-center justify-center font-medium">
                {i + 1}
              </span>
              <span className="mt-0.5">{step}</span>
            </li>
          ))}
        </ol>
      </div>

      {/* Dependencies + warnings */}
      {(result.dependencies.length > 0 || result.warnings.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {result.dependencies.length > 0 && <DependencyAlert items={result.dependencies} type="dependency" />}
          {result.warnings.length > 0 && <DependencyAlert items={result.warnings} type="warning" />}
        </div>
      )}

      {/* Next actions */}
      {result.nextActions.length > 0 && (
        <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Next actions
          </h3>
          <ul className="space-y-2">
            {result.nextActions.map((a, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-800">
                <span className="text-[#b87333] shrink-0 mt-0.5">{"\u2192"}</span>
                <span>{a}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Standards context */}
      {result.standardsContext && <StandardsContextPanel context={result.standardsContext} />}
    </div>
  )
}
