"use client"

type TrendItem = {
  entity: string
  entityType: string
  confidenceTier: string
  trendCause: string
  cross_platform_echo: number
  stillWorthMaking: string
  whyStillMatters: string
  production_lag_fit: Record<string, number>
}

type Props = { data: Record<string, unknown>; platform: string }

const TIER_LABELS: Record<string, { label: string; color: string }> = {
  tier_1_official: { label: "Official source", color: "text-green-700 bg-green-50" },
  tier_2_live_scraped: { label: "Live scraped", color: "text-green-600 bg-green-50" },
  tier_3_context_enriched: { label: "Web search signal", color: "text-amber-600 bg-amber-50" },
  tier_4_inferred: { label: "AI estimated", color: "text-gray-500 bg-gray-50" },
}

const CAUSE_LABELS: Record<string, string> = {
  calendar_event: "Seasonal / calendar event",
  creator_spillover: "Creator-driven virality",
  search_demand: "Active search demand",
  cross_platform_migration: "Multi-platform spread",
  platform_feature_push: "Platform algorithm boost",
  evergreen_topic: "Evergreen topic",
  unknown: "Cause unclear",
}

const WORTH_STYLES: Record<string, { label: string; color: string }> = {
  yes: { label: "Good to make now", color: "text-green-700 bg-green-100 border-green-200" },
  maybe: { label: "Mixed signals", color: "text-amber-700 bg-amber-100 border-amber-200" },
  no: { label: "Probably too late", color: "text-red-600 bg-red-100 border-red-200" },
}

export function WhyStillMattersCard({ data, platform }: Props) {
  const trends = (data.trends as TrendItem[]) ?? []
  const productionLag = (data.productionLag as string) ?? "same_day"

  // Show top 5 trends with explanations
  const top = trends.filter((t) => t.stillWorthMaking !== "no").slice(0, 5)
  if (top.length === 0 && trends.length === 0) return null

  return (
    <div className="space-y-2">
      {top.map((t, i) => {
        const tier = TIER_LABELS[t.confidenceTier] ?? TIER_LABELS.tier_4_inferred
        const cause = CAUSE_LABELS[t.trendCause] ?? CAUSE_LABELS.unknown
        const worth = WORTH_STYLES[t.stillWorthMaking] ?? WORTH_STYLES.maybe

        return (
          <div key={i} className="bg-white border border-gray-100 rounded-lg p-3">
            <div className="flex items-start justify-between gap-2 mb-1.5">
              <span className="text-sm font-medium text-gray-900">
                {t.entityType === "hashtag" ? `#${t.entity}` : t.entity}
              </span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded border shrink-0 ${worth.color}`}>
                {worth.label}
              </span>
            </div>
            <p className="text-xs text-gray-600 mb-2">{t.whyStillMatters}</p>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className={`text-[10px] px-1.5 py-0.5 rounded ${tier.color}`}>{tier.label}</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-50 text-gray-500">{cause}</span>
              {t.cross_platform_echo > 0 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-600">
                  echo: {t.cross_platform_echo}%
                </span>
              )}
            </div>
          </div>
        )
      })}

      {/* Trends marked "no" */}
      {trends.filter((t) => t.stillWorthMaking === "no").length > 0 && (
        <div className="bg-red-50 border border-red-100 rounded-lg p-2.5 mt-2">
          <p className="text-[10px] font-medium text-red-700 uppercase mb-1">Probably too late</p>
          <div className="flex flex-wrap gap-1">
            {trends.filter((t) => t.stillWorthMaking === "no").slice(0, 8).map((t, i) => (
              <span key={i} className="text-[10px] text-red-500">
                {t.entityType === "hashtag" ? `#${t.entity}` : t.entity}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
