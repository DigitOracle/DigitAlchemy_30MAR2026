"use client"
import { CopyButton } from "@/components/console/CopyButton"

type Props = { data: Record<string, unknown>; platform: string }

const SOURCE_LABELS: Record<string, { text: string; companion: string; live: boolean }> = {
  scrape_creators_tiktok: { text: "ScrapeCreators", companion: "Live platform scrape", live: true },
  scrape_creators_instagram_support: { text: "ScrapeCreators", companion: "Reel metadata", live: false },
  apify_live_scrape: { text: "Apify", companion: "Live scrape", live: true },
  xpoz_social_signal: { text: "xpoz", companion: "Social signal", live: true },
  context_guided: { text: "Perplexity", companion: "Web-guided result", live: false },
  official_platform: { text: "Platform API", companion: "Official source", live: true },
  inferred_fallback: { text: "DigitAlchemy", companion: "Generated recommendation", live: false },
  claude_inference: { text: "DigitAlchemy", companion: "Generated recommendation", live: false },
}

export function MusicAudioCard({ data, platform }: Props) {
  const suggestions = (data.suggestions as string[]) ?? []
  const mood = (data.mood as string) ?? ""
  const source = (data.source as string) ?? "inferred_fallback"
  const copyText = suggestions.join("\n") + (mood ? `\nMood: ${mood}` : "")

  // Separate trending (live) from inferred suggestions
  const trendingSounds = (data.trendingSounds as string[]) ?? []
  const commercialSafe = (data.commercialSafe as string[]) ?? []
  const label = SOURCE_LABELS[source] ?? SOURCE_LABELS.inferred_fallback
  const isLive = label.live && trendingSounds.length > 0

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <span className={`text-[10px] ${isLive ? "text-green-600" : "text-gray-400"}`}>
            {isLive ? "live" : "inferred"}
          </span>
          <span className="text-[10px] text-gray-300">{label.text}</span>
        </div>
        <CopyButton text={copyText} label="Copy all" />
      </div>

      {trendingSounds.length > 0 && (
        <div className="mb-3">
          <p className="text-[10px] font-semibold text-gray-400 uppercase mb-1">Trending Now</p>
          {trendingSounds.map((s, i) => (
            <div key={i} className="flex items-center justify-between bg-green-50 rounded-lg px-3 py-1.5 mb-1">
              <span className="text-sm text-gray-700">{s}</span>
              <CopyButton text={s} />
            </div>
          ))}
        </div>
      )}

      {commercialSafe.length > 0 && (
        <div className="mb-3">
          <p className="text-[10px] font-semibold text-gray-400 uppercase mb-1">Commercial-Safe</p>
          {commercialSafe.map((s, i) => (
            <div key={i} className="flex items-center justify-between bg-blue-50 rounded-lg px-3 py-1.5 mb-1">
              <span className="text-sm text-gray-700">{s}</span>
              <CopyButton text={s} />
            </div>
          ))}
        </div>
      )}

      <div>
        {(trendingSounds.length > 0 || commercialSafe.length > 0) && suggestions.length > 0 && (
          <p className="text-[10px] font-semibold text-gray-400 uppercase mb-1">Vibe Suggestions</p>
        )}
        {suggestions.map((s, i) => (
          <div key={i} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-1.5 mb-1">
            <span className="text-sm text-gray-700">{s}</span>
            <CopyButton text={s} />
          </div>
        ))}
      </div>
      {mood && <p className="text-xs text-gray-500 mt-2">Mood: {mood}</p>}
    </div>
  )
}
