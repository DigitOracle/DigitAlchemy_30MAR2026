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

export function TrendingTopicsCard({ data, platform }: Props) {
  const hashtags = (data.hashtags as string[]) ?? []
  const notes = (data.notes as string) ?? ""
  const source = (data.source as string) ?? "inferred_fallback"
  const label = SOURCE_LABELS[source] ?? SOURCE_LABELS.inferred_fallback
  const copyText = hashtags.map((h) => `#${h.replace(/^#/, "")}`).join(" ") + (notes ? `\n${notes}` : "")

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <span className={`text-[10px] ${label.live ? "text-green-600" : "text-gray-400"}`}>
            {label.live ? "live" : "inferred"}
          </span>
          <span className="text-[10px] text-gray-300">{label.text}</span>
        </div>
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
      {notes && <p className="text-xs text-gray-500 mt-1">{notes}</p>}
    </div>
  )
}
