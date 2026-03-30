export function IntakeSummaryCard({ data }: { data: Record<string, unknown> }) {
  const context = data.intakeContext as Record<string, string | string[]> | undefined
  return (
    <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Intake summary</h3>
      <p className="text-sm text-gray-800 mb-3">{data.task as string}</p>
      {context && Object.keys(context).length > 0 && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(context).map(([k, v]) => (
            <span key={k} className="text-xs bg-gray-50 border border-gray-100 text-gray-600 px-2 py-1 rounded">
              <span className="text-gray-400">{k}:</span> {Array.isArray(v) ? v.join(", ") : v}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
