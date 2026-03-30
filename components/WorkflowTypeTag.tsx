const categoryColors: Record<string, { bg: string; text: string; border: string }> = {
  "Social Video Intelligence": { bg: "bg-pink-50", text: "text-pink-800", border: "border-pink-200" },
  "BIM / Model Review": { bg: "bg-blue-50", text: "text-blue-800", border: "border-blue-200" },
  "GIS / Spatial Analysis": { bg: "bg-green-50", text: "text-green-800", border: "border-green-200" },
  "Compliance / Regulatory Mapping": { bg: "bg-amber-50", text: "text-amber-800", border: "border-amber-200" },
  "IoT / Sensor Planning": { bg: "bg-purple-50", text: "text-purple-800", border: "border-purple-200" },
  "Digital Twin": { bg: "bg-cyan-50", text: "text-cyan-800", border: "border-cyan-200" },
  "General Orchestration": { bg: "bg-gray-50", text: "text-gray-700", border: "border-gray-200" },
}

export function WorkflowTypeTag({ type }: { type: string }) {
  const colors = categoryColors[type] ?? categoryColors["General Orchestration"]
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${colors.bg} ${colors.text} ${colors.border}`}>
      {type}
    </span>
  )
}
