"use client"
import { CopyButton } from "@/components/console/CopyButton"
import { HashtagChip } from "@/components/console/HashtagChip"

type Props = { data: Record<string, unknown>; platform: string }

const SOURCE_LABELS: Record<string, { text: string; companion: string; live: boolean }> = {
  scrape_creators_tiktok: { text: "ScrapeCreators", companion: "Live platform scrape", live: true },
  apify_live_scrape: { text: "Apify", companion: "Live scrape", live: true },
  xpoz_social_signal: { text: "xpoz", companion: "Social signal", live: true },
  official_platform: { text: "Platform API", companion: "Official source", live: true },
  perplexity: { text: "Perplexity", companion: "Web-guided result", live: false },
  context_guided: { text: "Perplexity", companion: "Web-guided result", live: false },
  claude: { text: "DigitAlchemy", companion: "Generated recommendation", live: false },
  inferred_fallback: { text: "DigitAlchemy", companion: "Generated recommendation", live: false },
}

function formatSourceLine(label: typeof SOURCE_LABELS[string], elapsedMs: number | null): string {
  if (elapsedMs && (label.text === "Perplexity")) {
    const sec = (elapsedMs / 1000).toFixed(0)
    return `${label.companion} \u00B7 ${sec}s`
  }
  return label.companion
}

type TrendingSong = { title: string; author: string; usageCount?: number }
type ContentOpportunity = { trend: string; fit: "high" | "medium" | "low"; action: string }

export function PlatformTrendsCard({ data, platform }: Props) {
  const hashtags = (data.hashtags as string[]) ?? []
  const songs = (data.trendingSongs as TrendingSong[]) ?? []
  const themes = (data.themes as string[]) ?? []
  const notes = (data.notes as string) ?? ""
  const source = (data.source as string) ?? "inferred_fallback"
  const mode = (data.mode as string) ?? "live_trend"
  const provenance = (data.provenance as string) ?? "inferred"
  const fetchedAt = (data.fetchedAt as string) ?? null
  const opportunities = (data.opportunities as ContentOpportunity[]) ?? []
  const sourceElapsedMs = (data.sourceElapsedMs as number) ?? null
  const label = SOURCE_LABELS[source] ?? SOURCE_LABELS.inferred_fallback
  const isLive = label.live
  const sourceLine = formatSourceLine(label, sourceElapsedMs)
  const copyText = hashtags.map((h) => `#${h.replace(/^#/, "")}`).join(" ")

  return (
    <div>
      {/* Source meta strip */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5">
          <span className={`text-[10px] font-medium ${isLive ? "text-green-600" : "text-amber-500"}`}>
            {isLive ? "live" : "context-guided"}
          </span>
          <span className="text-[10px] text-gray-300">{label.text}</span>
          <span className="text-[10px] text-gray-300">{sourceLine}</span>
        </div>
        <CopyButton text={copyText} label="Copy all" />
      </div>

      {/* Non-live disclaimer */}
      {!isLive && hashtags.length > 0 && (
        <div className="bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 mb-3">
          <p className="text-[10px] text-amber-700">These signals are web-search guided, not scraped from the platform in real time. Treat as directional, not authoritative.</p>
        </div>
      )}

      {/* Hashtags */}
      {hashtags.length > 0 && (
        <div className="mb-3">
          <p className="text-[10px] font-semibold text-gray-400 uppercase mb-1.5">{isLive ? "Trending Hashtags" : "Suggested Hashtags"}</p>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
            {hashtags.map((tag, i) => (
              <HashtagChip key={i} tag={tag} />
            ))}
          </div>
          {hashtags.length > 0 && (
            <div className="mt-2">
              <button onClick={() => navigator.clipboard.writeText(copyText)} className="w-full text-center text-[10px] text-gray-400 hover:text-[#b87333] py-1 transition-colors">Copy all hashtags</button>
            </div>
          )}
        </div>
      )}

      {/* Trending Songs (TikTok mainly) */}
      {songs.length > 0 && (
        <div className="mb-3">
          <p className="text-[10px] font-semibold text-gray-400 uppercase mb-1.5">{isLive ? "Trending Songs" : "Suggested Songs"}</p>
          {songs.map((s, i) => (
            <div key={i} className="flex items-center justify-between bg-green-50 rounded-lg px-3 py-1.5 mb-1">
              <div className="min-w-0">
                <span className="text-sm text-gray-800">{s.title}</span>
                <span className="text-xs text-gray-500 ml-1.5">— {s.author}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {s.usageCount && <span className="text-[10px] text-gray-400">{s.usageCount.toLocaleString()} videos</span>}
                <CopyButton text={`${s.title} — ${s.author}`} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Themes / Formats */}
      {themes.length > 0 && (
        <div className="mb-3">
          <p className="text-[10px] font-semibold text-gray-400 uppercase mb-1.5">{isLive ? "Trending Themes" : "Suggested Themes"}</p>
          {themes.map((t, i) => (
            <div key={i} className="text-sm text-gray-700 bg-gray-50 rounded-lg px-3 py-1.5 mb-1">{t}</div>
          ))}
        </div>
      )}

      {notes && <p className="text-xs text-gray-500 mb-3">{notes}</p>}

      {/* Content Opportunity Block */}
      {opportunities.length > 0 && (
        <div className="border-t border-gray-100 pt-3 mt-2">
          <p className="text-[10px] font-semibold text-gray-400 uppercase mb-1.5">Content Opportunities</p>
          {opportunities.map((opp, i) => {
            const fitColor = opp.fit === "high" ? "bg-green-100 text-green-700" : opp.fit === "medium" ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-500"
            return (
              <div key={i} className="flex items-start gap-2 mb-1.5">
                <span className={`text-[10px] px-1.5 py-0.5 rounded shrink-0 ${fitColor}`}>{opp.fit}</span>
                <div className="min-w-0">
                  <p className="text-xs text-gray-800">{opp.trend}</p>
                  <p className="text-[10px] text-gray-500">{opp.action}</p>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Provenance footer */}
      <div className="flex items-center gap-3 mt-2 pt-2 border-t border-gray-50 text-[10px] text-gray-300">
        <span>{isLive ? "Live data" : "Web-guided signal"}</span>
        <span>{sourceLine}</span>
      </div>
    </div>
  )
}
