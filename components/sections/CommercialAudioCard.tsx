"use client"
import { CopyButton } from "@/components/console/CopyButton"

type Props = { data: Record<string, unknown>; platform: string }

export function CommercialAudioCard({ data, platform }: Props) {
  const commercialSafe = (data.commercialSafe as string[]) ?? []
  const source = (data.source as string) ?? "inferred_fallback"
  const provenance = (data.provenance as string) ?? "inferred"
  const copyText = commercialSafe.join("\n")

  if (commercialSafe.length === 0) {
    return (
      <div className="bg-gray-50 border border-gray-100 rounded-lg p-3 text-center">
        <p className="text-xs text-gray-500">No commercial-safe audio suggestions generated.</p>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] text-gray-400">Licensed / royalty-free options</p>
        <CopyButton text={copyText} label="Copy all" />
      </div>
      {commercialSafe.map((s, i) => (
        <div key={i} className="flex items-center justify-between bg-blue-50 rounded-lg px-3 py-1.5 mb-1">
          <span className="text-sm text-gray-700">{s}</span>
          <CopyButton text={s} />
        </div>
      ))}
      <div className="flex items-center gap-3 mt-2 pt-2 border-t border-gray-50 text-[10px] text-gray-300">
        <span>Licensed / royalty-free options</span>
        <span>DigitAlchemy</span>
      </div>
    </div>
  )
}
