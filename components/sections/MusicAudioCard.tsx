"use client"
import { CopyButton } from "@/components/console/CopyButton"

type Props = { data: Record<string, unknown>; platform: string }

export function MusicAudioCard({ data, platform }: Props) {
  const suggestions = (data.suggestions as string[]) ?? []
  const mood = (data.mood as string) ?? ""
  const copyText = suggestions.join("\n") + (mood ? `\nMood: ${mood}` : "")

  return (
    <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Music / Audio</h4>
        <CopyButton text={copyText} label="Copy all" />
      </div>
      <div className="space-y-2">
        {suggestions.map((s, i) => (
          <div key={i} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
            <span className="text-sm text-gray-700">{s}</span>
            <CopyButton text={s} />
          </div>
        ))}
      </div>
      {mood && <p className="text-xs text-gray-500 mt-3">Mood: {mood}</p>}
    </div>
  )
}
