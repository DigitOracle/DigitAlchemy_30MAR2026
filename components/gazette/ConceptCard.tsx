"use client"
import { useState, useEffect } from "react"
import { BROADSHEET } from "./tokens"
import type { GazetteCard } from "@/types/gazette-ui"

const CAT_COLORS: Record<string, string> = {
  AUDIO_VIRAL: BROADSHEET.accentAmber,
  TREND_ALERT: BROADSHEET.accent,
  BRAND_SIGNAL: "#1A3A5C",
  CULTURAL_MOMENT: "#1A3A2A",
  CREATOR_SPOTLIGHT: "#5C3A00",
  REGIONAL_PULSE: "#5C1A00",
  TECH_INNOVATION: "#1A3A4A",
}

export function ConceptCard({ card, onTap, onDismiss, onSave }: {
  card: GazetteCard
  onTap: () => void
  onDismiss: () => void
  onSave: () => void
}) {
  const [saved, setSaved] = useState(card.saved)
  const [actedOn, setActedOn] = useState(card.actedOn)
  const [removing, setRemoving] = useState(false)
  const isWeak = card.confidence < 50

  useEffect(() => {
    if (actedOn) {
      const t = setTimeout(() => setRemoving(true), 1500)
      return () => clearTimeout(t)
    }
  }, [actedOn])

  if (card.dismissed || removing) return null

  const badgeColor = CAT_COLORS[card.category] || BROADSHEET.accent

  return (
    <div
      onClick={onTap}
      style={{
        minWidth: 240, maxWidth: 240, flexShrink: 0,
        borderRight: `1px solid ${BROADSHEET.ruleLight}`,
        padding: "14px 14px 10px",
        background: actedOn ? "#E8F0E0" : isWeak ? BROADSHEET.paperDark : BROADSHEET.paper,
        cursor: "pointer", opacity: isWeak ? 0.75 : 1, position: "relative",
      }}
    >
      {/* Category badge + time window */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <span style={{
          fontSize: 9, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase",
          color: BROADSHEET.paper, background: badgeColor, padding: "2px 6px",
          fontFamily: "'Playfair Display', Georgia, serif",
        }}>
          {card.category.replace(/_/g, " ")}
        </span>
        <span style={{
          fontSize: 9, color: BROADSHEET.inkFaded,
          fontFamily: "'Playfair Display', Georgia, serif",
          fontVariant: "small-caps", letterSpacing: "0.08em",
        }}>
          {card.timeWindow}
        </span>
      </div>

      {/* Confidence bar */}
      <div style={{
        height: 2, background: BROADSHEET.paperDark, marginBottom: 8,
        border: `1px solid ${BROADSHEET.ruleLight}`, position: "relative",
      }}>
        <div style={{
          position: "absolute", top: 0, left: 0, height: "100%",
          width: `${card.confidence}%`,
          background: isWeak ? BROADSHEET.inkLight : BROADSHEET.ink,
        }} />
      </div>

      {/* Headline */}
      <div style={{
        fontFamily: "'Playfair Display', Georgia, serif",
        fontSize: 15, fontWeight: 700, lineHeight: 1.3,
        color: BROADSHEET.ink, marginBottom: 6,
      }}>
        {actedOn ? "\u2713 Making this" : card.headline}
      </div>

      {/* Hook — italic byline */}
      {!actedOn && card.hookSuggestion && (
        <div style={{
          fontSize: 11, fontStyle: "italic", color: BROADSHEET.inkFaded,
          lineHeight: 1.4, marginBottom: 10, paddingLeft: 8,
          borderLeft: `2px solid ${BROADSHEET.ruleLight}`,
          fontFamily: "'Playfair Display', Georgia, serif",
        }}>
          {card.hookSuggestion}
        </div>
      )}

      {/* Platform fit */}
      <div style={{
        fontSize: 9, letterSpacing: "0.08em", color: BROADSHEET.inkFaded,
        marginBottom: 10, fontFamily: "'Playfair Display', Georgia, serif",
        fontVariant: "small-caps",
      }}>
        {card.platformFit.join(" \u00B7 ")}
      </div>

      {/* Weak signal */}
      {isWeak && (
        <div style={{
          fontSize: 9, letterSpacing: "0.1em", color: BROADSHEET.inkFaded,
          fontVariant: "small-caps", fontStyle: "italic", marginBottom: 6,
          fontFamily: "'Playfair Display', Georgia, serif",
        }}>
          {"— Weak signal —"}
        </div>
      )}

      {/* Action row */}
      <div
        style={{
          display: "flex", gap: 6,
          borderTop: `1px solid ${BROADSHEET.ruleLight}`,
          paddingTop: 8, marginTop: 4,
        }}
        onClick={e => e.stopPropagation()}
      >
        <button onClick={onTap} style={{
          flex: 1, padding: "5px 0", background: BROADSHEET.ink, color: BROADSHEET.paper,
          border: "none", fontFamily: "'Playfair Display', Georgia, serif",
          fontSize: 10, fontVariant: "small-caps", letterSpacing: "0.08em", cursor: "pointer",
        }}>
          Post This Today
        </button>
        <button onClick={() => { setSaved(s => !s); onSave() }} style={{
          padding: "5px 8px", background: "transparent",
          color: saved ? BROADSHEET.accentAmber : BROADSHEET.inkFaded,
          border: `1px solid ${BROADSHEET.ruleLight}`,
          fontFamily: "'Playfair Display', Georgia, serif",
          fontSize: 10, fontVariant: "small-caps", cursor: "pointer",
        }}>
          {saved ? "\u2605" : "\u2606"}
        </button>
        <button onClick={onDismiss} style={{
          padding: "5px 8px", background: "transparent", color: BROADSHEET.inkFaded,
          border: `1px solid ${BROADSHEET.ruleLight}`,
          fontFamily: "'Playfair Display', Georgia, serif",
          fontSize: 10, cursor: "pointer",
        }}>
          {"\u2715"}
        </button>
      </div>
    </div>
  )
}
