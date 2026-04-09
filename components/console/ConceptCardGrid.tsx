"use client"

import { useState, useEffect, useCallback } from "react"
import type { ConceptCard } from "@/types/conceptCard"

// ── Fonts (match existing Gazette aesthetic) ──
const DISPLAY = "'Playfair Display', Georgia, 'Times New Roman', serif"
const BODY = "'Libre Baskerville', Georgia, 'Times New Roman', serif"
const LABEL = "'Franklin Gothic Medium', 'Arial Narrow', Arial, sans-serif"
const TYPEWRITER = "'Special Elite', 'Courier New', monospace"

// ── Colours ──
const INK = "#1A1A1A"
const RULE = "#C4B9A0"
const ACCENT = "#8B7355"
const BROWN = "#3E2723"
const PAPER_LIGHT = "#F4F1E4"

// ── Source colours ──
const SOURCE_COLORS: Record<string, string> = {
  trend: "#C0392B",   // editorial red
  style: "#2C3E50",   // dark slate blue
  blend: "#6C3483",   // deep purple
}

const SOURCE_LABELS: Record<string, string> = {
  trend: "Trending",
  style: "Your Style",
  blend: "Blended",
}

const PLATFORM_ICONS: Record<string, string> = {
  tiktok: "\u266B",
  instagram: "\uD83D\uDCF7",
  youtube: "\u25B6",
  linkedin: "in",
}

function formatRange(range: ConceptCard["likelyRange"]): string | null {
  if (!range) return null
  const fmt = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}K` : String(n)
  return `Likely ${fmt(range.p25)}\u2013${fmt(range.p75)} ${range.metric}`
}

function ConfidenceDot({ level }: { level: string }) {
  const color = level === "high" ? "#065F46" : level === "medium" ? "#92400E" : "#9CA3AF"
  return <span style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", backgroundColor: color, marginRight: 4 }} />
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    }).catch(() => {})
  }, [text])
  return (
    <button onClick={handleCopy} style={{
      fontFamily: LABEL, fontSize: 8, fontWeight: 700, color: copied ? "#065F46" : ACCENT,
      background: copied ? "#ECFDF5" : "none", border: copied ? "1px solid #A7F3D0" : `1px solid ${RULE}`,
      cursor: "pointer", padding: "2px 8px", flexShrink: 0, transition: "all 0.15s",
    }}>
      {copied ? "\u2713 Copied" : "Copy"}
    </button>
  )
}

// ── Skeleton loader ──
function SkeletonCard() {
  return (
    <div style={{ border: `1px solid ${RULE}`, padding: 16, backgroundColor: "#FDFCF8", minHeight: 180 }}>
      <div style={{ width: "60%", height: 10, backgroundColor: "#E8E0D0", marginBottom: 10, borderRadius: 2 }} />
      <div style={{ width: "90%", height: 8, backgroundColor: "#E8E0D0", marginBottom: 6, borderRadius: 2 }} />
      <div style={{ width: "80%", height: 8, backgroundColor: "#E8E0D0", marginBottom: 6, borderRadius: 2 }} />
      <div style={{ width: "40%", height: 8, backgroundColor: "#E8E0D0", borderRadius: 2 }} />
    </div>
  )
}

const MAX_CARDS_MOBILE = 6;
const MAX_CARDS_DESKTOP = 9;
const MIN_CARDS = 4;

export function ConceptCardGrid({ cards, loading }: { cards: ConceptCard[]; loading: boolean }) {
  const [isDesktop, setIsDesktop] = useState(true)

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)")
    setIsDesktop(mq.matches)
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches)
    mq.addEventListener("change", handler)
    return () => mq.removeEventListener("change", handler)
  }, [])

  // Cap cards by viewport, enforce min/max
  const maxCards = isDesktop ? MAX_CARDS_DESKTOP : MAX_CARDS_MOBILE
  const cappedCards = cards.slice(0, maxCards)
  const showBuildingHint = cappedCards.length > 0 && cappedCards.length < MIN_CARDS

  if (loading) {
    return (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14 }}>
        {[1, 2, 3].map(i => <SkeletonCard key={i} />)}
      </div>
    )
  }

  if (cards.length === 0) {
    return (
      <div style={{ fontFamily: BODY, fontStyle: "italic", fontSize: 13, color: ACCENT, padding: "16px 0" }}>
        No concept cards available yet. Connect more accounts or refresh later.
      </div>
    )
  }

  return (
    <>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14 }}>
      {cappedCards.map((card, i) => {
        const sourceColor = SOURCE_COLORS[card.source] || ACCENT
        const sourceLabel = SOURCE_LABELS[card.source] || card.source
        const platformIcon = PLATFORM_ICONS[card.platformFormat.platform] || ""
        const rangeText = formatRange(card.likelyRange)

        return (
          <div key={card.id || i} style={{
            border: `1px solid ${RULE}`,
            borderLeft: `3px solid ${sourceColor}`,
            padding: 16,
            backgroundColor: "#FDFCF8",
            position: "relative",
            transition: "border-color 0.15s",
            overflow: "hidden",
          }}>
            {/* Platform + Format badges */}
            <div style={{ display: "flex", gap: 6, marginBottom: 8, alignItems: "center" }}>
              <span style={{ fontFamily: LABEL, fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: sourceColor, backgroundColor: `${sourceColor}10`, padding: "2px 6px" }}>
                {sourceLabel}
              </span>
              <span style={{ fontFamily: LABEL, fontSize: 8, textTransform: "uppercase", letterSpacing: "0.06em", color: ACCENT }}>
                {platformIcon} {card.platformFormat.platform} &middot; {card.platformFormat.format}
              </span>
            </div>

            {/* Title */}
            <div style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 15, lineHeight: 1.3, color: INK, marginBottom: 6, overflowWrap: "break-word", wordBreak: "break-word" }}>
              {card.title}
            </div>

            {/* Hook */}
            {card.hook && (
              <div style={{ fontFamily: BODY, fontStyle: "italic", fontSize: 12, lineHeight: 1.4, color: BROWN, marginBottom: 6, overflowWrap: "break-word", wordBreak: "break-word" }}>
                {card.hook}
              </div>
            )}

            {/* Body preview (3 lines, truncated) */}
            {card.body && (
              <div style={{
                fontFamily: BODY, fontSize: 11.5, lineHeight: 1.45, color: INK, marginBottom: 8,
                overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical" as const,
                overflowWrap: "break-word", wordBreak: "break-word" as const,
              }}>
                {card.body}
              </div>
            )}

            {/* Hashtags */}
            {card.hashtags.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginBottom: 8 }}>
                {card.hashtags.slice(0, 6).map((tag, j) => (
                  <span key={j} style={{ fontFamily: BODY, fontSize: 10, color: BROWN, border: `1px dotted ${RULE}`, padding: "1px 5px", wordBreak: "break-all", maxWidth: "100%" }}>
                    {tag.startsWith("#") ? tag : `#${tag}`}
                  </span>
                ))}
              </div>
            )}

            {/* Likely range */}
            {rangeText && (
              <div style={{ fontFamily: TYPEWRITER, fontSize: 10, color: ACCENT, marginBottom: 4 }}>
                {rangeText}
              </div>
            )}

            {/* Footer: confidence + reasoning + copy */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: `1px dotted ${RULE}`, paddingTop: 6, marginTop: 4 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: LABEL, fontSize: 8, color: ACCENT, display: "flex", alignItems: "center" }}>
                  <ConfidenceDot level={card.confidence} />
                  {card.confidence} confidence
                </div>
                {card.reasoning && (
                  <div style={{ fontFamily: BODY, fontStyle: "italic", fontSize: 9, color: ACCENT, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {card.reasoning}
                  </div>
                )}
              </div>
              <CopyButton text={[card.title, card.hook, card.body, card.hashtags.join(" ")].filter(Boolean).join("\n\n")} />
            </div>
          </div>
        )
      })}
    </div>
    {showBuildingHint && (
      <div style={{ fontFamily: BODY, fontStyle: "italic", fontSize: 11, color: ACCENT, textAlign: "center", padding: "10px 0 2px" }}>
        Building your intelligence &mdash; check back later for more insights.
      </div>
    )}
    </>
  )
}
