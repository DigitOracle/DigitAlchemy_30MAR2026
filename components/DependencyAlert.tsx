export function DependencyAlert({ items, type }: { items: string[]; type: "dependency" | "warning" }) {
  if (!items.length) return null
  const isWarning = type === "warning"
  return (
    <div className={`rounded-lg p-4 ${isWarning ? "bg-amber-50 border border-amber-100" : "bg-gray-50 border border-gray-100"}`}>
      <p className={`text-xs font-semibold uppercase tracking-wide mb-2 ${isWarning ? "text-amber-700" : "text-gray-500"}`}>
        {isWarning ? "Warnings" : "Dependencies"}
      </p>
      <ul className="space-y-1">
        {items.map((item, i) => (
          <li key={i} className={`text-sm flex items-start gap-2 ${isWarning ? "text-amber-800" : "text-gray-700"}`}>
            <span className="shrink-0 mt-0.5">{isWarning ? "\u26A0" : "\u2192"}</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
