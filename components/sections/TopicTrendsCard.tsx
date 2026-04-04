"use client"
import { CopyButton } from "@/components/console/CopyButton"
import { HashtagChip } from "@/components/console/HashtagChip"

type Props = { data: Record<string, unknown>; platform: string }

const SOURCE_LABELS: Record<string, { text: string; companion: string; live: boolean }> = {
  scrape_creators_tiktok: { text: "ScrapeCreators", companion: "Live platform scrape", live: true },
  scrape_creators_instagram_support: { text: "ScrapeCreators", companion: "Reel metadata", live: false },
  apify_live_scrape: { text: "Apify", companion: "Live scrape", live: true },
  xpoz_social_signal: { text: "xpoz", companion: "Social signal", live: true },
  official_platform: { text: "Platform API", companion: "Official source", live: true },
  perplexity: { text: "Perplexity", companion: "Web-guided result", live: false },
  context_guided: { text: "Perplexity", companion: "Web-guided result", live: false },
  claude: { text: "DigitAlchemy", companion: "Generated recommendation", live: false },
  inferred_fallback: { text: "DigitAlchemy", companion: "Generated recommendation", live: false },
}

export function TopicTrendsCard({ data, platform }: Props) {
  const hashtags = (data.hashtags as string[]) ?? []
  const overlapping = (data.overlapping as string[]) ?? []
  const topicSpecific = (data.topicSpecific as string[]) ?? []
  const notes = (data.notes as string) ?? ""
  const source = (data.source as string) ?? "inferred_fallback"
  const mode = (data.mode as string) ?? "topic_aligned"
  const provenance = (data.provenance as string) ?? "inferred"
  const fetchedAt = (data.fetchedAt as string) ?? null
  const sourceElapsedMs = (data.sourceElapsedMs as number) ?? null
  const label = SOURCE_LABELS[source] ?? SOURCE_LABELS.inferred_fallback
  const allTags = hashtags.length > 0 ? hashtags : [...overlapping, ...topicSpecific]
  const copyText = allTags.map((h) => `#${h.replace(/^#/, "")}`).join(" ")

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5">
          <span className={`text-[10px] font-medium ${label.live ? "text-green-600" : "text-gray-400"}`}>
            {label.live ? "live + topic" : "topic-aligned"}
          </span>
          <span className="text-[10px] text-gray-300">{label.text}</span>
          <span className="text-[10px] text-gray-300">
            {sourceElapsedMs && label.text === "Perplexity" ? `${label.companion} \u00B7 ${(sourceElapsedMs / 1000).toFixed(0)}s` : label.companion}
          </span>
        </div>
        <CopyButton text={copyText} label="Copy all" />
      </div>

      {/* Overlapping with platform trends */}
      {overlapping.length > 0 && (
        <div className="mb-3">
          <p className="text-[10px] font-semibold text-green-600 uppercase mb-1.5">Overlaps with Platform Trends</p>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
            {overlapping.map((tag, i) => (
              <HashtagChip key={i} tag={tag} />
            ))}
          </div>
        </div>
      )}

      {/* Topic-specific tags */}
      {topicSpecific.length > 0 && (
        <div className="mb-3">
          <p className="text-[10px] font-semibold text-gray-400 uppercase mb-1.5">Topic-Specific</p>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
            {topicSpecific.map((tag, i) => (
              <HashtagChip key={i} tag={tag} />
            ))}
          </div>
        </div>
      )}

      {/* Fallback: flat hashtags if no split */}
      {overlapping.length === 0 && topicSpecific.length === 0 && hashtags.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2 mb-3">
          {hashtags.map((tag, i) => (
            <HashtagChip key={i} tag={tag} />
          ))}
        </div>
      )}

      {notes && <p className="text-xs text-gray-500 mb-2">{notes}</p>}

      <div className="flex items-center gap-3 mt-2 pt-2 border-t border-gray-50 text-[10px] text-gray-300">
        <span>{label.live ? "Live + topic match" : "Topic-guided signal"}</span>
        <span>{sourceElapsedMs && label.text === "Perplexity" ? `${label.companion} \u00B7 ${(sourceElapsedMs / 1000).toFixed(0)}s` : label.companion}</span>
      </div>
    </div>
  )
}
