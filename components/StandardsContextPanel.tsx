import type { StandardsContext } from "@/types"

export function StandardsContextPanel({ context }: { context: StandardsContext }) {
  return (
    <div className="bg-white border border-gray-100 rounded-lg p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <span className="w-2 h-2 rounded-full bg-[#b87333]" />
        <h3 className="text-sm font-semibold text-gray-900">Standards context</h3>
        <span className="ml-auto text-xs text-gray-400 bg-gray-50 px-2 py-0.5 rounded">
          {context.source}
        </span>
      </div>
      {context.collectionsConsulted.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Collections consulted</p>
          <div className="flex flex-wrap gap-1.5">
            {context.collectionsConsulted.map((c, i) => (
              <span key={i} className="text-xs bg-gray-50 border border-gray-100 text-gray-600 px-2 py-0.5 rounded">
                {c}
              </span>
            ))}
          </div>
        </div>
      )}
      {context.relevantStandards.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Relevant standards</p>
          <div className="space-y-2">
            {context.relevantStandards.map((s, i) => (
              <div key={i} className="flex items-start gap-3 py-2 border-b border-gray-50 last:border-0">
                <span className="text-xs font-mono text-[#190A46] bg-blue-50 px-1.5 py-0.5 rounded shrink-0">
                  {s.code}
                </span>
                <div>
                  <p className="text-sm text-gray-800">{s.title}</p>
                  <p className="text-xs text-gray-400">{s.reason}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {context.standardsActions.length > 0 && (
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Recommended actions</p>
          <ul className="space-y-1">
            {context.standardsActions.map((a, i) => (
              <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                <span className="text-[#b87333] shrink-0">{"\u2192"}</span>
                <span>{a}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
