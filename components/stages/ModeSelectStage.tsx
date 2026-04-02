"use client"

type AppMode = "optimize" | "reverse_engineer"
type Props = { onSelect: (mode: AppMode) => void }

export function ModeSelectStage({ onSelect }: Props) {
  return (
    <div className="bg-white border border-gray-100 rounded-xl p-6 shadow-sm animate-fade-in max-w-lg mx-auto">
      <h2 className="text-sm font-semibold text-gray-900 mb-1">What do you want to do?</h2>
      <p className="text-xs text-gray-500 mb-5">Choose your starting point.</p>

      <div className="space-y-3">
        <button
          onClick={() => onSelect("optimize")}
          className="w-full text-left border-2 border-gray-200 rounded-xl px-5 py-4 hover:border-[#190A46] hover:bg-[#190A46]/5 transition-colors group"
        >
          <div className="flex items-center gap-3">
            <span className="w-8 h-8 rounded-lg bg-[#190A46]/10 flex items-center justify-center text-sm shrink-0">
              <span className="text-[#190A46] font-bold">&uarr;</span>
            </span>
            <div>
              <p className="text-sm font-semibold text-gray-900 group-hover:text-[#190A46]">Optimize Existing Content</p>
              <p className="text-xs text-gray-500 mt-0.5">Upload or link a video &rarr; get platform-tailored output</p>
            </div>
          </div>
        </button>

        <button
          onClick={() => onSelect("reverse_engineer")}
          className="w-full text-left border-2 border-gray-200 rounded-xl px-5 py-4 hover:border-[#b87333] hover:bg-[#b87333]/5 transition-colors group"
        >
          <div className="flex items-center gap-3">
            <span className="w-8 h-8 rounded-lg bg-[#b87333]/10 flex items-center justify-center text-sm shrink-0">
              <span className="text-[#b87333] font-bold">&darr;</span>
            </span>
            <div>
              <p className="text-sm font-semibold text-gray-900 group-hover:text-[#b87333]">Spot Trends Before You Create</p>
              <p className="text-xs text-gray-500 mt-0.5">No upload needed &rarr; see what&rsquo;s taking off, then decide what to make</p>
            </div>
          </div>
        </button>
      </div>
    </div>
  )
}
