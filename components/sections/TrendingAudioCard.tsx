"use client"
import { CopyButton } from "@/components/console/CopyButton"

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

type LicenseEntry = { track: string; license: string; note?: string }

const LICENSE_BADGES: Record<string, { className: string; label: string }> = {
  COMMERCIAL: { className: "bg-green-50 text-green-700 border-green-200", label: "COMMERCIAL \u2713" },
  PERSONAL_USE_ONLY: { className: "bg-red-50 text-red-700 border-red-200", label: "PERSONAL USE ONLY" },
  CHECK_LICENSE: { className: "bg-amber-50 text-amber-700 border-amber-200", label: "CHECK LICENSE" },
}

export function TrendingAudioCard({ data, platform }: Props) {
  const trendingSounds = (data.trendingSounds as string[]) ?? []
  const licensing = (data.licensing as LicenseEntry[] | undefined) ?? []
  const source = (data.source as string) ?? "inferred_fallback"
  const mode = (data.mode as string) ?? "live_trend"
  const provenance = (data.provenance as string) ?? "inferred"
  const fetchedAt = (data.fetchedAt as string) ?? null
  const label = SOURCE_LABELS[source] ?? SOURCE_LABELS.inferred_fallback
  const hasLiveData = label.live && trendingSounds.length > 0

  if (!hasLiveData) {
    return (
      <div>
        <div className="bg-gray-50 border border-gray-100 rounded-lg p-3 text-center">
          <p className="text-xs text-gray-500">No verified live trending audio found at runtime.</p>
          <p className="text-[10px] text-gray-400 mt-1">Live sources checked: ScrapeCreators, Apify, xpoz</p>
        </div>
        <div className="flex items-center gap-3 mt-2 pt-2 border-t border-gray-50 text-[10px] text-gray-300">
          <span>{hasLiveData ? "Live platform audio" : "No live audio found"}</span>
          <span>{label.companion}</span>
        </div>
      </div>
    )
  }

  const copyText = trendingSounds.join("\n")

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-medium text-green-600">live</span>
          <span className="text-[10px] text-gray-300">{label.text}</span>
          {fetchedAt && <span className="text-[10px] text-gray-300">{new Date(fetchedAt).toLocaleTimeString()}</span>}
        </div>
        <CopyButton text={copyText} label="Copy all" />
      </div>
      {trendingSounds.map((s, i) => {
        const licenseEntry = licensing.find((l) => l.track === s)
        const badge = licenseEntry ? LICENSE_BADGES[licenseEntry.license] ?? LICENSE_BADGES.CHECK_LICENSE : null
        return (
          <div key={i} className="flex items-center justify-between bg-green-50 rounded-lg px-3 py-1.5 mb-1">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-sm text-gray-700 truncate">{s}</span>
              {badge && (
                <span className={`text-[9px] border px-1.5 py-0.5 rounded whitespace-nowrap ${badge.className}`}>{badge.label}</span>
              )}
            </div>
            <CopyButton text={s} />
          </div>
        )
      })}
      <div className="flex items-center gap-3 mt-2 pt-2 border-t border-gray-50 text-[10px] text-gray-300">
          <span>Live platform audio</span>
          <span>{label.companion}</span>
        </div>
    </div>
  )
}
