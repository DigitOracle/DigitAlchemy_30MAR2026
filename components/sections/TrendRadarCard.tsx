"use client"
import { CopyButton } from "@/components/console/CopyButton"

type TrendItem = {
  entity: string
  entityType: string
  classification: string
  classificationConfidence: string
  insufficientHistory: boolean
  velocity_24h: number
  persistence: number
  novelty: number
  decay_risk: number
  production_lag_fit: Record<string, number>
  estimated_half_life_hours: number | null
  niche_fit: number
}

type Props = { data: Record<string, unknown>; platform: string }

const CLASS_STYLES: Record<string, { label: string; bg: string; text: string }> = {
  breakout_candidate: { label: "Breakout", bg: "bg-purple-100", text: "text-purple-700" },
  stable_opportunity: { label: "Stable", bg: "bg-green-100", text: "text-green-700" },
  fading_fast: { label: "Fading", bg: "bg-red-100", text: "text-red-600" },
  recurring_pattern: { label: "Recurring", bg: "bg-blue-100", text: "text-blue-700" },
  niche_advantage: { label: "Niche Fit", bg: "bg-amber-100", text: "text-amber-700" },
}

function VelocityArrow({ v }: { v: number }) {
  if (v > 20) return <span className="text-green-600 text-xs font-bold">&uarr;&uarr;</span>
  if (v > 5) return <span className="text-green-500 text-xs">&uarr;</span>
  if (v < -20) return <span className="text-red-600 text-xs font-bold">&darr;&darr;</span>
  if (v < -5) return <span className="text-red-500 text-xs">&darr;</span>
  return <span className="text-gray-400 text-xs">&minus;</span>
}

function LagBadge({ fit, lag }: { fit: number; lag: string }) {
  const color = fit >= 70 ? "text-green-600" : fit >= 40 ? "text-amber-600" : "text-red-500"
  return <span className={`text-[10px] ${color}`}>{lag}: {fit}%</span>
}

export function TrendRadarCard({ data, platform }: Props) {
  const trends = (data.trends as TrendItem[]) ?? []
  const insufficientHistory = (data.insufficientHistory as boolean) ?? true
  const snapshotCount = (data.snapshotCount as number) ?? 0
  const productionLag = (data.productionLag as string) ?? "same_day"

  if (trends.length === 0) {
    return (
      <div className="bg-gray-50 border border-gray-100 rounded-lg p-4 text-center">
        <p className="text-xs text-gray-500">No trend data captured yet.</p>
        <p className="text-[10px] text-gray-400 mt-1">Run a capture first: POST /api/trend-radar/capture</p>
      </div>
    )
  }

  return (
    <div>
      {/* Status bar */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-400">{snapshotCount} snapshots</span>
          {insufficientHistory && (
            <span className="text-[10px] bg-amber-50 text-amber-600 border border-amber-200 px-1.5 py-0.5 rounded">
              Insufficient history &mdash; classifications are low confidence
            </span>
          )}
        </div>
        <span className="text-[10px] text-gray-400">lag: {productionLag.replace("_", " ")}</span>
      </div>

      {/* Trend list */}
      <div className="space-y-1.5">
        {trends.map((t, i) => {
          const cls = CLASS_STYLES[t.classification] ?? CLASS_STYLES.stable_opportunity
          const lagFit = t.production_lag_fit[productionLag] ?? 0
          return (
            <div key={i} className="flex items-center gap-2 bg-white border border-gray-100 rounded-lg px-3 py-2">
              {/* Classification badge */}
              <span className={`text-[10px] px-1.5 py-0.5 rounded shrink-0 ${cls.bg} ${cls.text}`}>
                {cls.label}
              </span>

              {/* Entity */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm text-gray-900 truncate">
                    {t.entityType === "hashtag" ? `#${t.entity}` : t.entity}
                  </span>
                  <VelocityArrow v={t.velocity_24h} />
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] text-gray-400">persist: {t.persistence}%</span>
                  <span className="text-[10px] text-gray-400">decay: {t.decay_risk}%</span>
                  {t.estimated_half_life_hours !== null && (
                    <span className="text-[10px] text-gray-400">~{t.estimated_half_life_hours}h half-life</span>
                  )}
                  {t.insufficientHistory && <span className="text-[10px] text-amber-500">*low data</span>}
                </div>
              </div>

              {/* Lag fitness */}
              <div className="shrink-0 text-right">
                <LagBadge fit={lagFit} lag={productionLag.replace("_", " ")} />
              </div>

              {/* Copy */}
              <CopyButton text={t.entityType === "hashtag" ? `#${t.entity}` : t.entity} />
            </div>
          )
        })}
      </div>
    </div>
  )
}
