"use client"

import type { GazetteFilterState, Region, Platform, Horizon, Branch, Industry, Audience } from "@/types/gazette"
import {
  REGION_SHORT_LABELS, PLATFORM_LABELS, HORIZON_LABELS,
  INDUSTRY_LABELS, AUDIENCE_LABELS, horizonToBranch,
} from "@/types/gazette"

const DISPLAY = "'Playfair Display', Georgia, serif"
const LABEL = "'Franklin Gothic Medium', 'Arial Narrow', Arial, sans-serif"
const BROWN = "#3E2723"
const ACCENT = "#8B7355"
const RULE = "#C4B9A0"

const BRANCH_HORIZONS: Record<Branch, Horizon[]> = {
  react_now: ["same_day", "24h", "48h", "72h"],
  plan_ahead: ["1w", "2w", "4w"],
  analyse_history: ["6m", "12m"],
}

const BRANCH_LABELS: Record<Branch, string> = {
  react_now: "React Now",
  plan_ahead: "Plan Ahead",
  analyse_history: "Analyse History",
}

function FilterSelect<T extends string>({ value, options, labels, onChange, width }: {
  value: T; options: T[]; labels: Record<T, string>; onChange: (v: T) => void; width?: number
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      style={{
        fontFamily: LABEL, fontSize: 10, fontWeight: 700, textTransform: "uppercase",
        letterSpacing: "0.06em", color: BROWN, backgroundColor: "transparent",
        border: `1px solid ${RULE}`, padding: "4px 8px", cursor: "pointer",
        width: width || "auto",
      }}
    >
      {options.map((o) => (
        <option key={o} value={o}>{labels[o]}</option>
      ))}
    </select>
  )
}

export function GazetteFilters({ filters, onChange }: {
  filters: GazetteFilterState
  onChange: (next: GazetteFilterState) => void
}) {
  const regions = Object.keys(REGION_SHORT_LABELS) as Region[]
  const platforms = Object.keys(PLATFORM_LABELS) as Platform[]
  const branches = Object.keys(BRANCH_LABELS) as Branch[]
  const horizonOptions = BRANCH_HORIZONS[filters.mode]
  const industries = Object.keys(INDUSTRY_LABELS) as Industry[]
  const audiences = Object.keys(AUDIENCE_LABELS) as Audience[]

  return (
    <div style={{
      display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8,
      padding: "8px 0", borderBottom: `1px solid ${RULE}`, marginBottom: 14,
    }}>
      {/* Region */}
      <FilterSelect value={filters.region} options={regions} labels={REGION_SHORT_LABELS} onChange={(v) => onChange({ ...filters, region: v })} />

      {/* Platform */}
      <FilterSelect value={filters.platform} options={platforms} labels={PLATFORM_LABELS} onChange={(v) => onChange({ ...filters, platform: v })} />

      {/* Mode */}
      <div style={{ display: "flex", border: `1px solid ${RULE}` }}>
        {branches.map((b) => (
          <button key={b} onClick={() => {
            const newHorizons = BRANCH_HORIZONS[b]
            onChange({ ...filters, mode: b, horizon: newHorizons[0] })
          }}
            style={{
              fontFamily: LABEL, fontSize: 9, fontWeight: 700, textTransform: "uppercase",
              letterSpacing: "0.06em", padding: "4px 10px", cursor: "pointer",
              border: "none", backgroundColor: filters.mode === b ? BROWN : "transparent",
              color: filters.mode === b ? "#F4F1E4" : ACCENT,
            }}>
            {BRANCH_LABELS[b]}
          </button>
        ))}
      </div>

      {/* Horizon */}
      <FilterSelect value={filters.horizon} options={horizonOptions} labels={HORIZON_LABELS} onChange={(v) => onChange({ ...filters, horizon: v })} />

      {/* Industry */}
      <select
        value={filters.industry || ""}
        onChange={(e) => onChange({ ...filters, industry: (e.target.value || undefined) as Industry | undefined })}
        style={{
          fontFamily: LABEL, fontSize: 10, fontWeight: 700, textTransform: "uppercase",
          letterSpacing: "0.06em", color: BROWN, backgroundColor: "transparent",
          border: `1px solid ${RULE}`, padding: "4px 8px", cursor: "pointer",
        }}
      >
        <option value="">All Industries</option>
        {industries.map((i) => <option key={i} value={i}>{INDUSTRY_LABELS[i]}</option>)}
      </select>

      {/* Divider */}
      <div style={{ width: 1, height: 20, backgroundColor: RULE, margin: "0 4px" }} />

      {/* Actor Type */}
      <div style={{ display: "flex", border: `1px solid ${RULE}` }}>
        {(["b2b", "b2c"] as const).map((t) => (
          <button key={t} onClick={() => onChange({ ...filters, actorType: t })}
            style={{
              fontFamily: LABEL, fontSize: 9, fontWeight: 700, textTransform: "uppercase",
              padding: "4px 10px", cursor: "pointer", border: "none",
              backgroundColor: filters.actorType === t ? BROWN : "transparent",
              color: filters.actorType === t ? "#F4F1E4" : ACCENT,
            }}>
            {t.toUpperCase()}
          </button>
        ))}
      </div>
    </div>
  )
}
