"use client"
import { CopyButton } from "@/components/console/CopyButton"

type Props = { data: Record<string, unknown>; platform: string }

export function VibeSuggestionsCard({ data, platform }: Props) {
  const suggestions = (data.suggestions as string[]) ?? []
  const mood = (data.mood as string) ?? ""
  const source = (data.source as string) ?? "inferred_fallback"
  const provenance = (data.provenance as string) ?? "inferred"
  const copyText = suggestions.join("\n") + (mood ? `\nMood: ${mood}` : "")

  if (suggestions.length === 0 && !mood) {
    return null
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] text-gray-400">Creative direction — not live trend data</p>
        <CopyButton text={copyText} label="Copy all" />
      </div>
      {suggestions.map((s, i) => (
        <div key={i} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-1.5 mb-1">
          <span className="text-sm text-gray-700">{s}</span>
          <CopyButton text={s} />
        </div>
      ))}
      {mood && <p className="text-xs text-gray-500 mt-2">Mood: {mood}</p>}
      <div className="flex items-center gap-3 mt-2 pt-2 border-t border-gray-50 text-[10px] text-gray-300">
        <span>Creative direction, not live trend data</span>
        <span>DigitAlchemy</span>
      </div>
    </div>
  )
}
