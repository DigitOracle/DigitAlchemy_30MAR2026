"use client"
import { CopyButton } from "@/components/console/CopyButton"

type Props = { data: Record<string, unknown>; platform: string }

type LicenseEntry = { track: string; license: string; note?: string; whyTrending?: string }
type SongObject = { title: string; author: string; relatedCount?: number; cover?: string; link?: string; rank?: number; rankDiff?: number }
type SongScore = { track: string; persistence?: number; decay_risk?: number; classification?: string; velocity_24h?: number }

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

const LICENSE_BADGES: Record<string, { className: string; label: string }> = {
  COMMERCIAL: { className: "bg-green-50 text-green-700 border-green-200", label: "COMMERCIAL \u2713" },
  PERSONAL_USE_ONLY: { className: "bg-red-50 text-red-700 border-red-200", label: "PERSONAL USE" },
  CHECK_LICENSE: { className: "bg-amber-50 text-amber-700 border-amber-200", label: "CHECK" },
}

const CLASS_BADGES: Record<string, { className: string; label: string }> = {
  breakout_candidate: { className: "bg-purple-100 text-purple-700", label: "Breakout" },
  stable_opportunity: { className: "bg-green-100 text-green-700", label: "Stable" },
  fading_fast: { className: "bg-red-100 text-red-600", label: "Fading" },
  recurring_pattern: { className: "bg-blue-100 text-blue-700", label: "Recurring" },
  niche_advantage: { className: "bg-amber-100 text-amber-700", label: "Niche" },
}

export function TrendingAudioCard({ data, platform }: Props) {
  const trendingSounds = (data.trendingSounds as string[]) ?? []
  const songs = (data.songs as SongObject[] | undefined) ?? []
  const licensing = (data.licensing as LicenseEntry[] | undefined) ?? []
  const songScores = (data.songScores as (SongScore | null)[] | undefined) ?? []
  const source = (data.source as string) ?? "inferred_fallback"
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

      <div className="space-y-1">
        {trendingSounds.map((s, i) => {
          const song = songs[i]
          const licenseEntry = licensing.find((l) => l.track === s)
          const licenseBadge = licenseEntry ? LICENSE_BADGES[licenseEntry.license] ?? LICENSE_BADGES.CHECK_LICENSE : null
          const score = songScores[i] ?? null
          const classBadge = score?.classification ? CLASS_BADGES[score.classification] : null

          return (
            <div key={i} className="bg-green-50 rounded-lg px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                  {classBadge && (
                    <span className={`text-[9px] px-1.5 py-0.5 rounded shrink-0 ${classBadge.className}`}>{classBadge.label}</span>
                  )}
                  <span className="text-sm text-gray-800 truncate">{s}</span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {score && typeof score.persistence === "number" && (
                    <span className="text-[9px] text-gray-400">persist: {score.persistence}%</span>
                  )}
                  {song?.relatedCount && song.relatedCount > 0 && (
                    <span className="text-[9px] text-gray-400">~{song.relatedCount} videos</span>
                  )}
                  {licenseBadge && (
                    <span className={`text-[9px] border px-1.5 py-0.5 rounded whitespace-nowrap ${licenseBadge.className}`}>{licenseBadge.label}</span>
                  )}
                  <CopyButton text={s} />
                </div>
              </div>
              {licenseEntry?.whyTrending && (
                <p className="text-[10px] text-gray-500 mt-1">{licenseEntry.whyTrending}</p>
              )}
            </div>
          )
        })}
      </div>

      <div className="flex items-center gap-3 mt-2 pt-2 border-t border-gray-50 text-[10px] text-gray-300">
        <span>Live platform audio</span>
        <span>{label.companion}</span>
      </div>
    </div>
  )
}
