"use client"
import { CopyButton } from "@/components/console/CopyButton"

type Props = { data: Record<string, unknown>; platform: string }

export function TrendingTopicsCard({ data, platform }: Props) {
  const hashtags = (data.hashtags as string[]) ?? []
  const notes = (data.notes as string) ?? ""
  const copyText = hashtags.map((h) => `#${h.replace(/^#/, "")}`).join(" ") + (notes ? `\n${notes}` : "")

  return (
    <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Trending Topics</h4>
        <CopyButton text={copyText} label="Copy all" />
      </div>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {hashtags.map((tag, i) => (
          <span key={i} className="text-xs bg-gray-900 text-white px-2 py-1 rounded cursor-pointer hover:bg-[#190A46] transition-colors"
            onClick={() => navigator.clipboard.writeText(`#${tag.replace(/^#/, "")}`)}
          >
            #{tag.replace(/^#/, "")}
          </span>
        ))}
      </div>
      {notes && <p className="text-xs text-gray-500 mt-2">{notes}</p>}
    </div>
  )
}
