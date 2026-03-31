"use client"
import { CopyButton } from "@/components/console/CopyButton"

const PLATFORM_LIMITS: Record<string, number> = {
  instagram: 2200,
  tiktok: 4000,
  linkedin: 3000,
  x: 280,
  youtube: 5000,
  facebook: 63206,
}

type Caption = { text: string; variant: string }
type Props = { data: Record<string, unknown>; platform: string }

export function CaptionsCopyCard({ data, platform }: Props) {
  const captions = Array.isArray(data) ? (data as Caption[]) : []
  const limit = PLATFORM_LIMITS[platform] ?? 5000
  const copyText = captions.map((c) => c.text).join("\n\n---\n\n")

  return (
    <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Captions / Copy</h4>
        <CopyButton text={copyText} label="Copy all" />
      </div>
      <div className="space-y-3">
        {captions.map((cap, i) => {
          const overLimit = cap.text.length > limit
          return (
            <div key={i} className="bg-gray-50 border border-gray-100 rounded-lg p-3">
              <div className="flex items-start justify-between gap-2 mb-1">
                <span className="text-xs text-gray-400 capitalize">{cap.variant}</span>
                <CopyButton text={cap.text} />
              </div>
              <p className="text-sm text-gray-800 whitespace-pre-wrap">{cap.text}</p>
              <div className="flex items-center gap-2 mt-2">
                <span className={`text-xs ${overLimit ? "text-red-500" : "text-gray-400"}`}>
                  {cap.text.length} / {limit} chars
                </span>
                {overLimit && <span className="text-xs text-red-500 font-medium">Over limit</span>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
