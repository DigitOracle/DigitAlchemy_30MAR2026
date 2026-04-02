"use client"

type OutlookItem = {
  entity: string
  entityType: string
  trendOutlook: {
    direction: string
    stillWorthMaking: string
    forecastConfidence: string
    publishWindowFit: string
    rationale: string
    forecastModelUsed: string
    historyDepth: number
    recommendedNextStep: string
  }
  confidenceTier: string
  cross_platform_echo: number
}

type Props = { data: Record<string, unknown>; platform: string }

const DIR_STYLES: Record<string, { label: string; icon: string; color: string }> = {
  rising: { label: "Rising now", icon: "\u2197", color: "text-green-600" },
  stable: { label: "Probably stable", icon: "\u2192", color: "text-blue-600" },
  peaking: { label: "Peaking fast", icon: "\u2B06", color: "text-amber-600" },
  fading: { label: "Fading out", icon: "\u2198", color: "text-red-500" },
  unclear: { label: "Too early to tell", icon: "?", color: "text-gray-400" },
}

const WORTH_STYLES: Record<string, { label: string; bg: string }> = {
  yes: { label: "Good to make now", bg: "bg-green-100 text-green-700 border-green-200" },
  maybe: { label: "Could work, mixed signals", bg: "bg-amber-100 text-amber-700 border-amber-200" },
  no: { label: "Probably not worth it", bg: "bg-red-100 text-red-600 border-red-200" },
}

const STEP_LABELS: Record<string, string> = {
  make_now: "Start creating",
  monitor: "Keep watching",
  wait_for_confirmation: "Wait for more data",
  skip: "Skip this one",
}

export function TrendOutlookCard({ data, platform }: Props) {
  const trends = (data.trends as OutlookItem[]) ?? []
  const insufficientHistory = (data.insufficientHistory as boolean) ?? true

  // Show trends that have outlook data, prioritize yes/maybe
  const withOutlook = trends.filter((t) => t.trendOutlook)
  const sorted = [...withOutlook].sort((a, b) => {
    const order: Record<string, number> = { yes: 0, maybe: 1, no: 2 }
    return (order[a.trendOutlook.stillWorthMaking] ?? 1) - (order[b.trendOutlook.stillWorthMaking] ?? 1)
  })
  const top = sorted.slice(0, 8)

  if (top.length === 0) {
    return (
      <div className="bg-gray-50 border border-gray-100 rounded-lg p-4 text-center">
        <p className="text-xs text-gray-500">No trend outlook data available yet.</p>
        <p className="text-[10px] text-gray-400 mt-1">Run more captures over time to build forecast history.</p>
      </div>
    )
  }

  return (
    <div>
      {insufficientHistory && (
        <div className="bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 mb-3">
          <p className="text-[10px] text-amber-700">Early signal only \u2014 more captures needed for higher-confidence outlook.</p>
        </div>
      )}

      <div className="space-y-2">
        {top.map((t, i) => {
          const ol = t.trendOutlook
          const dir = DIR_STYLES[ol.direction] ?? DIR_STYLES.unclear
          const worth = WORTH_STYLES[ol.stillWorthMaking] ?? WORTH_STYLES.maybe
          const step = STEP_LABELS[ol.recommendedNextStep] ?? "Monitor"

          return (
            <div key={i} className="border border-gray-100 rounded-lg p-3">
              {/* Header: entity + direction + verdict */}
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className={`text-sm ${dir.color}`}>{dir.icon}</span>
                  <span className="text-sm font-medium text-gray-900 truncate">
                    {t.entityType === "hashtag" ? `#${t.entity}` : t.entity}
                  </span>
                  <span className={`text-[10px] ${dir.color}`}>{dir.label}</span>
                </div>
                <span className={`text-[10px] px-1.5 py-0.5 rounded border shrink-0 ${worth.bg}`}>
                  {worth.label}
                </span>
              </div>

              {/* Rationale */}
              <p className="text-xs text-gray-600 mb-2">{ol.rationale}</p>

              {/* Meta row */}
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-50 text-gray-500">
                  {ol.publishWindowFit === "poor_fit" ? "No good window" : `Best: ${ol.publishWindowFit === "same_day" ? "today" : ol.publishWindowFit}`}
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-50 text-gray-500">
                  {step}
                </span>
                {ol.forecastConfidence !== "high" && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-50 text-gray-400">
                    {ol.forecastConfidence} confidence
                  </span>
                )}
                <span className="text-[10px] text-gray-300">{ol.forecastModelUsed}</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
