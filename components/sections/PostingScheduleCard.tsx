"use client"
import { CopyButton } from "@/components/console/CopyButton"

type Props = { data: Record<string, unknown>; platform: string }

export function PostingScheduleCard({ data, platform }: Props) {
  const bestTimes = (data.bestTimes as string[]) ?? []
  const frequency = (data.frequency as string) ?? ""
  const notes = (data.notes as string) ?? ""
  const copyText = `Best times: ${bestTimes.join(", ")}\nFrequency: ${frequency}${notes ? `\n${notes}` : ""}`

  return (
    <div>
      <div className="flex justify-end mb-2">
        <CopyButton text={copyText} label="Copy all" />
      </div>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {bestTimes.map((t, i) => (
          <span key={i} className="text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded">{t}</span>
        ))}
      </div>
      {frequency && <p className="text-sm text-gray-700 mb-1">Frequency: {frequency}</p>}
      {notes && <p className="text-xs text-gray-500">{notes}</p>}
    </div>
  )
}
