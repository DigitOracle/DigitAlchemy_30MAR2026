"use client"
import { useState, useEffect } from "react"
import { doc, updateDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { useAuth } from "@/lib/AuthContext"
import { BROADSHEET } from "./tokens"
import {
  REGION_LABELS, PLATFORM_LABELS, INDUSTRY_LABELS, AUDIENCE_LABELS, AUDIENCE_SUBTITLES,
  type Region, type Platform, type Industry, type Audience,
} from "@/types/gazette"
import type { GazettePlatform } from "@/types/gazette-ui"

// Map API-style platform to UI-style GazettePlatform for TimeBanner/HookPicker
const PLATFORM_TO_UI: Record<string, GazettePlatform> = {
  tiktok: "TikTok", instagram: "Instagram", youtube: "YouTube Shorts",
  linkedin: "LinkedIn", facebook: "Facebook", x: "TikTok",
}

const REGIONS = Object.entries(REGION_LABELS) as [Region, string][]
const PLATFORMS = (Object.entries(PLATFORM_LABELS) as [Platform, string][]).filter(([k]) => k !== "all")
const INDUSTRIES = Object.entries(INDUSTRY_LABELS) as [Industry, string][]
const AUDIENCES = Object.entries(AUDIENCE_LABELS) as [Audience, string][]

interface Filters {
  region: Region
  platform: Platform
  industry: Industry | ""
  audience: Audience | ""
}

export function GazetteFilterBar() {
  const { user, profile } = useAuth()
  const [expanded, setExpanded] = useState(false)
  const [filters, setFilters] = useState<Filters>({
    region: "AE",
    platform: "tiktok",
    industry: "",
    audience: "",
  })
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)

  // Seed from profile on mount
  useEffect(() => {
    if (!profile) return
    setFilters({
      region: (profile.defaultRegion || "AE") as Region,
      platform: (localStorage.getItem("da_gazette_target_platform") as Platform) || "tiktok",
      industry: (profile.defaultIndustry || "") as Industry | "",
      audience: (profile.defaultAudience || "") as Audience | "",
    })
  }, [profile])

  const handleChange = (field: keyof Filters, value: string) => {
    setFilters(prev => ({ ...prev, [field]: value }))
    setDirty(true)
  }

  const handleApply = async () => {
    if (!user || !db) return
    setSaving(true)
    try {
      await updateDoc(doc(db, "users", user.uid), {
        defaultRegion: filters.region,
        defaultIndustry: filters.industry || null,
        defaultAudience: filters.audience || null,
      })
      localStorage.setItem("da_gazette_target_region", filters.region)
      const uiPlatform = PLATFORM_TO_UI[filters.platform] ?? "TikTok"
      localStorage.setItem("da_gazette_target_platform", uiPlatform)
      setDirty(false)
      window.dispatchEvent(new CustomEvent("gazette:filters:changed", {
        detail: {
          region: filters.region,
          platform: uiPlatform,
          industry: filters.industry,
          audience: filters.audience,
        },
      }))
    } catch (e) {
      console.error("[GazetteFilterBar] save error:", e)
    } finally {
      setSaving(false)
    }
  }

  const B = BROADSHEET

  const selectStyle: React.CSSProperties = {
    background: B.paper,
    border: `1px solid ${B.rule}`,
    color: B.ink,
    fontFamily: "'Playfair Display', Georgia, serif",
    fontSize: 11,
    fontVariant: "small-caps",
    letterSpacing: "0.06em",
    padding: "3px 6px",
    borderRadius: 0,
    cursor: "pointer",
  }

  const labelStyle: React.CSSProperties = {
    fontSize: 9,
    fontVariant: "small-caps",
    letterSpacing: "0.12em",
    color: B.inkFaded,
    fontFamily: "'Playfair Display', Georgia, serif",
    display: "block",
    marginBottom: 2,
  }

  // Summary for collapsed state
  const regionLabel = REGION_LABELS[filters.region] || filters.region
  const platformLabel = PLATFORM_LABELS[filters.platform] || filters.platform
  const industryLabel = filters.industry ? INDUSTRY_LABELS[filters.industry] : "Any"
  const audienceLabel = filters.audience
    ? `${AUDIENCE_LABELS[filters.audience]} (${AUDIENCE_SUBTITLES[filters.audience]})`
    : "All Ages"

  return (
    <div style={{ borderBottom: `1px solid ${B.ruleLight}`, background: B.paper }}>
      {/* Toggle row */}
      <button
        onClick={() => setExpanded(e => !e)}
        style={{
          background: "transparent",
          border: "none",
          borderBottom: expanded ? `1px solid ${B.ruleLight}` : "none",
          padding: "5px 24px",
          cursor: "pointer",
          fontFamily: "'Playfair Display', Georgia, serif",
          fontSize: 10,
          fontVariant: "small-caps",
          letterSpacing: "0.12em",
          color: dirty ? B.accent : B.inkFaded,
          display: "flex",
          alignItems: "center",
          gap: 6,
          width: "100%",
          textAlign: "left",
        }}
      >
        {expanded ? "\u25B4" : "\u25BE"} Filters
        {dirty && (
          <span style={{ fontSize: 9, color: B.accent, fontStyle: "italic" }}>
            {"\u2014"} unsaved changes
          </span>
        )}
        {!expanded && (
          <span style={{ marginLeft: 8, color: B.inkLight, fontStyle: "italic" }}>
            {regionLabel} {"\u00B7"} {platformLabel} {"\u00B7"} {industryLabel} {"\u00B7"} {audienceLabel}
          </span>
        )}
      </button>

      {/* Expanded filter row */}
      {expanded && (
        <div style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 16,
          padding: "10px 24px 12px",
          alignItems: "flex-end",
          background: B.paperDark,
        }}>
          {/* Region */}
          <div>
            <span style={labelStyle}>Region</span>
            <select value={filters.region} onChange={e => handleChange("region", e.target.value)} style={selectStyle}>
              {REGIONS.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>

          {/* Platform */}
          <div>
            <span style={labelStyle}>Platform</span>
            <select value={filters.platform} onChange={e => handleChange("platform", e.target.value)} style={selectStyle}>
              {PLATFORMS.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>

          {/* Industry */}
          <div>
            <span style={labelStyle}>Industry</span>
            <select value={filters.industry} onChange={e => handleChange("industry", e.target.value)} style={selectStyle}>
              <option value="">Any</option>
              {INDUSTRIES.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>

          {/* Audience */}
          <div>
            <span style={labelStyle}>Target Audience</span>
            <select value={filters.audience} onChange={e => handleChange("audience", e.target.value)} style={selectStyle}>
              <option value="">All Ages</option>
              {AUDIENCES.map(([k, v]) => <option key={k} value={k}>{v} ({AUDIENCE_SUBTITLES[k]})</option>)}
            </select>
          </div>

          {/* Apply */}
          <button
            onClick={handleApply}
            disabled={!dirty || saving}
            style={{
              background: dirty ? B.ink : B.paperDark,
              color: dirty ? B.paper : B.inkFaded,
              border: `1px solid ${B.rule}`,
              padding: "5px 16px",
              fontFamily: "'Playfair Display', Georgia, serif",
              fontSize: 10,
              fontVariant: "small-caps",
              letterSpacing: "0.1em",
              cursor: dirty ? "pointer" : "default",
              borderRadius: 0,
            }}
          >
            {saving ? "Saving\u2026" : "Apply"}
          </button>
        </div>
      )}
    </div>
  )
}
