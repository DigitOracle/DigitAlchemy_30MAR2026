"use client"

import { useState } from "react"
import type { GazetteFilterState, Region, Platform, Horizon, Branch, Industry, Audience } from "@/types/gazette"
import {
  REGION_SHORT_LABELS, PLATFORM_LABELS, HORIZON_LABELS,
  INDUSTRY_LABELS, horizonsForMode, audienceLabel,
} from "@/types/gazette"

const DISPLAY = "'Playfair Display', Georgia, serif"
const LABEL = "'Franklin Gothic Medium', 'Arial Narrow', Arial, sans-serif"
const BROWN = "#3E2723"
const ACCENT = "#8B7355"
const RULE = "#C4B9A0"

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
  const horizonOptions = horizonsForMode(filters.mode)
  const industries = Object.keys(INDUSTRY_LABELS) as Industry[]
  const allAudiences: Audience[] = ["gen_z", "millennials", "gen_x", "boomers", "all_ages"]
  const [audienceOpen, setAudienceOpen] = useState(false)

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
            const newHorizons = horizonsForMode(b)
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

      {/* Audience (multi-select, max 2) */}
      <div style={{ position: "relative" }}>
        <button onClick={() => setAudienceOpen(!audienceOpen)} style={{
          fontFamily: LABEL, fontSize: 10, fontWeight: 700, textTransform: "uppercase",
          letterSpacing: "0.06em", color: BROWN, backgroundColor: "transparent",
          border: `1px solid ${RULE}`, padding: "4px 8px", cursor: "pointer",
        }}>
          {filters.audience.length === 0 ? "Audience"
            : filters.audience.length === 1 ? audienceLabel(filters.audience[0]).split(" (")[0]
            : `${audienceLabel(filters.audience[0]).split(" (")[0]} +${filters.audience.length - 1}`}
          {" \u25BE"}
        </button>
        {audienceOpen && (
          <div style={{
            position: "absolute", top: "100%", left: 0, marginTop: 2, zIndex: 30,
            backgroundColor: "#FDFCF8", border: `1px solid ${RULE}`, minWidth: 160, padding: "4px 0",
          }}>
            {allAudiences.map((a) => {
              const selected = filters.audience.includes(a)
              return (
                <label key={a} style={{
                  display: "flex", alignItems: "center", gap: 6, padding: "4px 10px", cursor: "pointer",
                  fontFamily: LABEL, fontSize: 10, color: selected ? BROWN : ACCENT,
                }} onClick={() => {
                  let next: Audience[]
                  if (selected) {
                    next = filters.audience.filter((x) => x !== a)
                  } else {
                    next = [...filters.audience, a]
                    if (next.length > 2) next = next.slice(-2) // FIFO: keep 2 most recent
                  }
                  onChange({ ...filters, audience: next })
                }}>
                  <input type="checkbox" checked={selected} readOnly style={{ accentColor: BROWN }} />
                  {audienceLabel(a)}
                </label>
              )
            })}
          </div>
        )}
      </div>

      {/* Divider */}
      <div style={{ width: 1, height: 20, backgroundColor: RULE, margin: "0 4px" }} />

      {/* Actor Type — TODO Phase 3b.5: wire actor_type into /api/concept-cards as ranking signal */}
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
