"use client"
import { CopyButton } from "@/components/console/CopyButton"

type Idea = { title: string; hook: string; format: string; why: string }
type Props = { data: Record<string, unknown>; platform: string }

export function VideoIdeasCard({ data, platform }: Props) {
  const ideas = (data.ideas as Idea[]) ?? []
  const copyAll = ideas.map((i, idx) => `${idx + 1}. ${i.title}\n   Hook: ${i.hook}\n   Format: ${i.format}\n   Why: ${i.why}`).join("\n\n")

  if (ideas.length === 0) return null

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] text-gray-400">DigitAlchemy &middot; Generated recommendation</p>
        <CopyButton text={copyAll} label="Copy all" />
      </div>
      <div className="space-y-2">
        {ideas.map((idea, i) => {
          const fullPackage = `${idea.title}\nHook: "${idea.hook}"\nFormat: ${idea.format}\nWhy: ${idea.why}`
          return (
            <div key={i} className="bg-[#b87333]/5 border border-[#b87333]/10 rounded-lg p-3">
              <div className="flex items-start justify-between gap-2 mb-1">
                <p className="text-sm font-medium text-gray-900">{idea.title}</p>
                <div className="flex items-center gap-1 shrink-0">
                  <span className="text-[10px] bg-[#b87333]/10 text-[#b87333] px-1.5 py-0.5 rounded">{idea.format}</span>
                  <CopyButton text={fullPackage} label="Copy" />
                </div>
              </div>
              <div className="flex items-start justify-between gap-2 mb-1">
                <p className="text-xs text-gray-700">&ldquo;{idea.hook}&rdquo;</p>
                <CopyButton text={idea.hook} />
              </div>
              <p className="text-[10px] text-gray-500">{idea.why}</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
