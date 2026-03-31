"use client"
import { CopyButton } from "@/components/console/CopyButton"

type Props = { data: Record<string, unknown>; platform: string }

export function PostingScheduleCard({ data, platform }: Props) {
  const bestTimes = (data.bestTimes as string[]) ?? []
  const frequency = (data.frequency as string) ?? ""
  const notes = (data.notes as string) ?? ""
  const copyText = `Best times: ${bestTimes.join(", ")}\nFrequency: ${frequency}${notes ? `\n${notes}` : ""}`

  return (
    <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Posting Schedule</h4>
        <CopyButton text={copyText} label="Copy all" />
      </div>
      <div className="flex flex-wrap gap-2 mb-3">
        {bestTimes.map((t, i) => (
          <span key={i} className="text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-1 rounded">{t}</span>
        ))}
      </div>
      {frequency && <p className="text-sm text-gray-700 mb-1">Frequency: {frequency}</p>}
      {notes && <p className="text-xs text-gray-500">{notes}</p>}
    </div>
  )
}
