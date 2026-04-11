"use client"
import { BROADSHEET, type CategoryKey } from "./tokens"
import { ConceptCard } from "./ConceptCard"
import type { GazetteCard } from "@/types/gazette-ui"

const CATEGORY_ICONS: Record<string, string> = {
  AUDIO_VIRAL: "\u266A", TREND_ALERT: "\u2191", BRAND_SIGNAL: "\u25C6",
  CULTURAL_MOMENT: "\u25C9", CREATOR_SPOTLIGHT: "\u2605",
  REGIONAL_PULSE: "\u25CF", TECH_INNOVATION: "\u2699",
}

export function CardRow({ category, cards, loading, onTap, onDismiss, onSave, indexOffset = 0 }: {
  category: CategoryKey
  cards: GazetteCard[]
  loading: boolean
  onTap: (card: GazetteCard) => void
  onDismiss: (card: GazetteCard) => void
  onSave: (card: GazetteCard) => void
  indexOffset?: number
}) {
  const visibleCards = cards.filter(c => !c.dismissed)
  if (!loading && visibleCards.length === 0) return null

  const icon = CATEGORY_ICONS[category] || "\u25C6"
  const label = category.replace(/_/g, " ")

  const burntEdge: React.CSSProperties = {
    height: 5,
    background: `repeating-linear-gradient(90deg, ${BROADSHEET.paperDark} 0px, ${BROADSHEET.burnEdge} 3px, ${BROADSHEET.paperDark} 6px, #B8A898 9px, ${BROADSHEET.paperDark} 12px)`,
    opacity: 0.8,
  }

  return (
    <div style={{ marginBottom: 0 }}>
      {/* Section header */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "baseline",
        padding: "7px 20px 6px",
        borderTop: `2px solid ${BROADSHEET.rule}`, borderBottom: `1px solid ${BROADSHEET.rule}`,
        background: BROADSHEET.paperDark,
      }}>
        <div style={{
          fontFamily: "'Playfair Display', Georgia, serif",
          fontSize: 12, fontWeight: 900, letterSpacing: "0.14em",
          textTransform: "uppercase", color: BROADSHEET.ink,
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <span>{icon}</span>
          <span>{label}</span>
          {!loading && (
            <span style={{
              fontSize: 10, fontWeight: 400, fontVariant: "small-caps",
              color: BROADSHEET.inkFaded, marginLeft: 4,
            }}>
              {"—"} {visibleCards.length} {visibleCards.length === 1 ? "dispatch" : "dispatches"}
            </span>
          )}
        </div>
        <span style={{
          fontSize: 10, fontStyle: "italic", color: BROADSHEET.inkFaded,
          fontFamily: "'Playfair Display', Georgia, serif",
        }}>
          Updated just now
        </span>
      </div>

      {/* Burnt edge top */}
      <div style={burntEdge} />

      {/* Cards — newspaper grid */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
        background: BROADSHEET.paper,
        overflowX: "hidden",
        width: "100%",
      }}>
        {loading ? (
          [0, 1, 2].map(i => (
            <div key={i} style={{
              height: 200,
              borderRight: `1px solid ${BROADSHEET.ruleLight}`,
              borderBottom: `1px solid ${BROADSHEET.ruleLight}`,
              padding: 14, background: BROADSHEET.paper,
            }}>
              {[80, 60, 100, 40].map((w, j) => (
                <div key={j} style={{
                  height: 10, width: `${w}%`, background: BROADSHEET.paperDark,
                  marginBottom: 10, animation: "pulse 1.5s infinite",
                }} />
              ))}
            </div>
          ))
        ) : (
          visibleCards.map((card, i) => (
            <ConceptCard
              key={card.id}
              card={card}
              cardIndex={indexOffset + i}
              onTap={() => onTap(card)}
              onDismiss={() => onDismiss(card)}
              onSave={() => onSave(card)}
            />
          ))
        )}
      </div>

      {/* Burnt edge bottom */}
      <div style={burntEdge} />
    </div>
  )
}
