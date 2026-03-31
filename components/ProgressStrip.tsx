"use client"

export type ProgressChip = {
  id: string
  label: string
  summary: string
  completed: boolean
}

type Props = {
  chips: ProgressChip[]
  onChipClick?: (id: string) => void
}

export function ProgressStrip({ chips, onChipClick }: Props) {
  const completedChips = chips.filter((c) => c.completed)
  if (completedChips.length === 0) return null

  return (
    <div className="overflow-x-auto pb-1 -mx-1 px-1 mb-5">
      <div className="flex items-center gap-2 min-w-0">
        {completedChips.map((chip) => (
          <button
            key={chip.id}
            onClick={() => onChipClick?.(chip.id)}
            className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-full px-3 py-1.5 text-xs whitespace-nowrap shrink-0 hover:border-[#190A46]/30 transition-colors group"
          >
            <span className="text-green-500 text-xs">&#10003;</span>
            <span className="text-gray-500 font-medium">{chip.label}</span>
            <span className="text-gray-400 group-hover:text-gray-600 max-w-[140px] truncate">{chip.summary}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
