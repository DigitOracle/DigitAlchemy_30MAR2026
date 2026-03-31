"use client"
import { useState } from "react"
import { PLATFORMS } from "@/config/platforms"

type Props = {
  onConfirm: (platforms: string[]) => void
}

const publishPlatforms = Object.values(PLATFORMS).filter((p) => p.id !== "heygen")

export function PlatformSelectionStage({ onConfirm }: Props) {
  const [selected, setSelected] = useState<string[]>([])

  const toggle = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    )
  }

  return (
    <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm animate-fade-in">
      <h3 className="text-sm font-semibold text-gray-900 mb-1">Where are you posting this content?</h3>
      <p className="text-xs text-gray-500 mb-4">Select one or more platforms to generate tailored content packs.</p>

      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-4">
        {publishPlatforms.map((p) => (
          <button
            key={p.id}
            onClick={() => toggle(p.id)}
            className={`flex flex-col items-center gap-1 px-3 py-3 rounded-lg border-2 text-xs font-medium transition-colors ${
              selected.includes(p.id)
                ? "border-[#190A46] bg-[#190A46]/5 text-[#190A46]"
                : "border-gray-200 text-gray-500 hover:border-gray-300"
            }`}
          >
            <span className="text-sm font-bold">{p.icon}</span>
            <span className="text-[10px]">{p.label}</span>
          </button>
        ))}
      </div>

      <button
        onClick={() => onConfirm(selected)}
        disabled={selected.length === 0}
        className="w-full bg-[#190A46] text-white text-sm font-medium py-2.5 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#190A46]/90 transition-colors"
      >
        Generate Content &rarr;
      </button>
    </div>
  )
}
