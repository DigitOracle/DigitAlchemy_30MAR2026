"use client"
import { useState, useEffect } from "react"
import { CopyButton } from "@/components/console/CopyButton"

type TrendItem = {
  entity: string
  entityType: string
  classification: string
  classificationConfidence: string
  insufficientHistory: boolean
  velocity_24h: number
  persistence: number
  decay_risk: number
  production_lag_fit: Record<string, number>
  estimated_half_life_hours: number | null
  niche_fit: number
}

type Props = { data: Record<string, unknown>; platform: string }

const CLASS_STYLES: Record<string, { label: string; bg: string; text: string }> = {
  breakout_candidate: { label: "Breakout", bg: "bg-purple-50", text: "text-purple-700" },
  stable_opportunity: { label: "Stable", bg: "bg-green-50", text: "text-green-700" },
  fading_fast: { label: "Fading", bg: "bg-red-50", text: "text-red-600" },
  recurring_pattern: { label: "Recurring", bg: "bg-blue-50", text: "text-blue-700" },
  niche_advantage: { label: "Niche Fit", bg: "bg-amber-50", text: "text-amber-700" },
}

function VelocityArrow({ v }: { v: number }) {
  if (v > 20) return <span className="text-green-600 text-[10px] font-bold">&uarr;&uarr;</span>
  if (v > 5) return <span className="text-green-500 text-[10px]">&uarr;</span>
  if (v < -20) return <span className="text-red-600 text-[10px] font-bold">&darr;&darr;</span>
  if (v < -5) return <span className="text-red-500 text-[10px]">&darr;</span>
  return <span className="text-gray-400 text-[10px]">&minus;</span>
}

export function TrendRadarCard({ data, platform }: Props) {
  const trends = (data.trends as TrendItem[]) ?? []
  const insufficientHistory = (data.insufficientHistory as boolean) ?? true
  const snapshotCount = (data.snapshotCount as number) ?? 0
  const productionLag = (data.productionLag as string) ?? "same_day"
  const [showAll, setShowAll] = useState(false)

  // Reset showAll when data changes (tab switch)
  useEffect(() => { setShowAll(false) }, [data])

  if (trends.length === 0) {
    return (
      <div className="bg-gray-50 border border-gray-100 rounded-lg p-4 text-center">
        <p className="text-xs text-gray-500">No trend data captured yet.</p>
        <p className="text-[10px] text-gray-400 mt-1">Run a capture first: POST /api/trend-radar/capture</p>
      </div>
    )
  }

  const displayItems = showAll ? trends : trends.slice(0, 18)

  return (
    <div>
      {/* Status bar */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-400">{snapshotCount} snapshots &middot; {trends.length} trends</span>
          {insufficientHistory && (
            <span className="text-[10px] bg-amber-50 text-amber-600 border border-amber-200 px-1.5 py-0.5 rounded">
              Insufficient history &mdash; low confidence
            </span>
          )}
        </div>
        <span className="text-[10px] text-gray-400">lag: {productionLag.replace(/_/g, " ")}</span>
      </div>

      {/* 6-column grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
        {displayItems.map((t, i) => {
          const cls = CLASS_STYLES[t.classification] ?? CLASS_STYLES.stable_opportunity
          const lagFit = t.production_lag_fit[productionLag] ?? 0
          const entityLabel = t.entityType === "hashtag" ? `#${t.entity}` : t.entity
          return (
            <div key={i} className="border border-gray-100 rounded-lg p-2.5 bg-white hover:shadow-sm transition-shadow" style={{ minHeight: 100 }}>
              {/* Top: entity + badge */}
              <div className="flex items-start justify-between gap-1 mb-1">
                <span className="text-xs font-bold text-gray-900 truncate flex-1">{entityLabel}</span>
                <span className={`text-[8px] px-1 py-0.5 rounded-full whitespace-nowrap font-medium shrink-0 ${cls.bg} ${cls.text}`}>
                  {cls.label}
                </span>
              </div>

              {/* Velocity + scores */}
              <div className="flex items-center gap-1.5 mb-1.5">
                <VelocityArrow v={t.velocity_24h} />
                <span className="text-[9px] text-gray-400">p:{t.persistence}%</span>
                <span className="text-[9px] text-gray-400">d:{t.decay_risk}%</span>
              </div>

              {/* Tags row */}
              <div className="flex flex-wrap gap-1">
                <span className={`text-[8px] px-1 py-0.5 rounded ${lagFit >= 70 ? "bg-green-50 text-green-600" : lagFit >= 40 ? "bg-amber-50 text-amber-600" : "bg-red-50 text-red-500"}`}>
                  {productionLag.replace(/_/g, " ")} {lagFit}%
                </span>
                {t.estimated_half_life_hours !== null && (
                  <span className="text-[8px] px-1 py-0.5 bg-gray-50 text-gray-400 rounded">~{t.estimated_half_life_hours}h</span>
                )}
                {t.insufficientHistory && (
                  <span className="text-[8px] px-1 py-0.5 bg-amber-50 text-amber-500 rounded">low data</span>
                )}
              </div>

              {/* Copy (bottom right) */}
              <div className="flex justify-end mt-1">
                <CopyButton text={entityLabel} />
              </div>
            </div>
          )
        })}
      </div>

      {/* Show all */}
      {trends.length > 18 && !showAll && (
        <button
          onClick={() => setShowAll(true)}
          className="mt-3 text-xs text-gray-500 hover:text-gray-700 w-full text-center py-1"
        >
          Show all {trends.length} &rarr;
        </button>
      )}
    </div>
  )
}
