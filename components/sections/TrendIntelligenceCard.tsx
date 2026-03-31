import { ProvenanceBadge } from "./ProvenanceBadge"
import type { ProvenanceType, ConfidenceLevel } from "@/types"

type OutputItem = { value: string | string[]; provenance: ProvenanceType; confidence: ConfidenceLevel; note?: string }
type PlatformTrend = {
  platform: string
  trendingHashtags: OutputItem
  emergingHashtags: OutputItem
  audioSuggestions: OutputItem
  formatFit: OutputItem
  trendNotes: OutputItem
}

const platformColors: Record<string, string> = {
  TikTok: "bg-black text-white",
  Instagram: "bg-gradient-to-r from-purple-500 to-pink-500 text-white",
  LinkedIn: "bg-blue-700 text-white",
  "X/Twitter": "bg-black text-white",
  "YouTube Shorts": "bg-red-600 text-white",
}

export function TrendIntelligenceCard({ data }: { data: Record<string, unknown> }) {
  const platforms = data.platforms as PlatformTrend[] | undefined
  if (!platforms?.length) return null

  return (
    <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <span className="w-2 h-2 rounded-full bg-green-500" />
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Trend intelligence</h3>
      </div>
      <div className="space-y-5">
        {platforms.map((platform, i) => (
          <div key={i} className="border border-gray-100 rounded-lg overflow-hidden">
            <div className={`px-3 py-2 text-xs font-bold ${platformColors[platform.platform] ?? "bg-gray-100 text-gray-800"}`}>
              {platform.platform}
            </div>
            <div className="p-3 space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-gray-500">Trending hashtags</span>
                  <ProvenanceBadge provenance={platform.trendingHashtags?.provenance} confidence={platform.trendingHashtags?.confidence} />
                </div>
                <div className="flex flex-wrap gap-1">
                  {(Array.isArray(platform.trendingHashtags?.value) ? platform.trendingHashtags.value : [platform.trendingHashtags?.value ?? ""]).map((tag, j) => (
                    <span key={j} className="text-xs bg-gray-900 text-white px-2 py-0.5 rounded">#{(tag as string).replace(/^#/, "")}</span>
                  ))}
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-gray-500">Audio suggestions</span>
                  <ProvenanceBadge provenance={platform.audioSuggestions?.provenance} confidence={platform.audioSuggestions?.confidence} />
                </div>
                <p className="text-sm text-gray-700">
                  {Array.isArray(platform.audioSuggestions?.value) ? platform.audioSuggestions.value.join(", ") : platform.audioSuggestions?.value ?? ""}
                </p>
              </div>
              <div>
                <span className="text-xs text-gray-500">Format fit: </span>
                <span className="text-sm text-gray-800">{(platform.formatFit?.value as string) ?? ""}</span>
              </div>
              {platform.trendNotes?.value && (
                <p className="text-xs text-gray-500 italic">{(platform.trendNotes?.value as string) ?? ""}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
