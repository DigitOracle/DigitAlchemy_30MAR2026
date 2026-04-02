"use client"
import { CopyButton } from "@/components/console/CopyButton"

const PLATFORM_LIMITS: Record<string, number> = {
  instagram: 2200, tiktok: 4000, linkedin: 3000, x: 280, youtube: 5000, facebook: 63206,
}

type Caption = { text: string; variant: string }
type Props = { data: Record<string, unknown>; platform: string }

export function CaptionsCopyCard({ data, platform }: Props) {
  const captions = Array.isArray(data) ? (data as Caption[]) : Array.isArray((data as Record<string, unknown>).captions) ? ((data as Record<string, unknown>).captions as Caption[]) : []
  const limit = PLATFORM_LIMITS[platform] ?? 5000
  const copyText = captions.map((c) => c.text).join("\n\n---\n\n")

  return (
    <div>
      <div className="flex justify-end mb-2">
        <CopyButton text={copyText} label="Copy all" />
      </div>
      <div className="space-y-2">
        {captions.map((cap, i) => {
          const overLimit = cap.text.length > limit
          return (
            <div key={i} className="bg-gray-50 border border-gray-100 rounded-lg p-2.5">
              <div className="flex items-start justify-between gap-2 mb-1">
                <span className="text-[10px] text-gray-400 capitalize">{cap.variant}</span>
                <CopyButton text={cap.text} />
              </div>
              <p className="text-sm text-gray-800 whitespace-pre-wrap">{cap.text}</p>
              <div className="flex items-center gap-2 mt-1.5">
                <span className={`text-[10px] ${overLimit ? "text-red-500" : "text-gray-400"}`}>
                  {cap.text.length}/{limit}
                </span>
                {overLimit && <span className="text-[10px] text-red-500 font-medium">Over limit</span>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
