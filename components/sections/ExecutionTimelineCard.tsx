const statusColors = {
  running: "bg-[#b87333]",
  complete: "bg-green-500",
  pending: "bg-gray-200",
  failed: "bg-red-500",
}

export function ExecutionTimelineCard({ data }: { data: Record<string, unknown> }) {
  const steps = data.steps as { label: string; status: string }[] | undefined
  return (
    <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Execution plan</h3>
      <div className="flex items-center gap-0">
        {steps?.map((step, i) => (
          <div key={i} className="flex items-center gap-0 flex-1">
            <div className="flex flex-col items-center gap-1">
              <div className={`w-3 h-3 rounded-full ${statusColors[step.status as keyof typeof statusColors] ?? "bg-gray-200"}`} />
              <span className="text-xs text-gray-500 text-center leading-tight max-w-16">{step.label}</span>
            </div>
            {i < (steps.length - 1) && <div className="flex-1 h-px bg-gray-200 mb-4 mx-1" />}
          </div>
        ))}
      </div>
    </div>
  )
}
