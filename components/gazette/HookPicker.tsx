"use client"
import { useState, useRef } from "react"
import { BROADSHEET } from "./tokens"
import type { GazetteCard, HookAngle, GazettePlatform } from "@/types/gazette-ui"
import { PLATFORM_DEFAULTS } from "@/types/gazette-ui"

const DEFAULT_ANGLES: HookAngle[] = [
  { type: "Curiosity gap", hookText: "The thing nobody tells you about X" },
  { type: "Numbers", hookText: "3 reasons X happened (and who wins)" },
  { type: "Hot take", hookText: "Everyone\u2019s wrong about X. Here\u2019s proof" },
  { type: "Story", hookText: "A client asked me about X last week\u2026" },
  { type: "Question", hookText: "Is X still worth it? I asked 50 people." },
]

const ALL_PLATFORMS: GazettePlatform[] = ["TikTok", "Instagram", "YouTube Shorts", "Facebook", "LinkedIn"]

function adaptCaption(base: string, platform: GazettePlatform): string {
  switch (platform) {
    case "TikTok": return base
    case "Instagram": return `${base} \uD83D\uDCAC Save this if it helped`
    case "YouTube Shorts": return base.replace(/[^\x00-\x7F]/g, "").trim() + " #Shorts"
    case "Facebook": return `Thought this was worth sharing \u2014 ${base.toLowerCase()}`
    case "LinkedIn": return `Here\u2019s something worth thinking about: ${base} What\u2019s your take?`
    default: return base
  }
}

function CopyButton({ text, label }: { text: string; label?: string }) {
  const btnRef = useRef<HTMLButtonElement>(null)
  const handleCopy = async () => {
    await navigator.clipboard.writeText(text)
    if (btnRef.current) {
      const original = btnRef.current.innerText
      btnRef.current.innerText = "\u2713 Copied"
      setTimeout(() => { if (btnRef.current) btnRef.current.innerText = original }, 1500)
    }
  }
  return (
    <button ref={btnRef} onClick={handleCopy} style={{
      padding: "4px 10px", border: `1px solid ${BROADSHEET.ruleLight}`,
      background: "transparent", color: BROADSHEET.inkFaded,
      fontFamily: "'Playfair Display', Georgia, serif",
      fontSize: 10, fontVariant: "small-caps", cursor: "pointer", borderRadius: 0,
    }}>
      {label || "COPY"}
    </button>
  )
}

const B = BROADSHEET

export function HookPicker({ card, onAct, onClose }: {
  card: GazetteCard
  onAct: (angle: HookAngle, format: string) => void
  onClose: () => void
}) {
  const [selectedAngle, setSelectedAngle] = useState<number | null>(null)
  const [selectedFormat, setSelectedFormat] = useState<number | null>(null)
  const [platform, setPlatform] = useState<GazettePlatform>(
    () => (typeof window !== "undefined" ? localStorage.getItem("da_gazette_target_platform") as GazettePlatform : null) ?? "TikTok"
  )

  const handlePlatformSelect = (p: GazettePlatform) => {
    setPlatform(p)
    localStorage.setItem("da_gazette_target_platform", p)
  }

  const angles = card.angles.length > 0 ? card.angles : DEFAULT_ANGLES
  const formats = card.suggestedFormats.length > 0 ? card.suggestedFormats : [
    "30-second TikTok reaction", "90-second Reel with data",
    "LinkedIn carousel (5 slides)", "YouTube Short \u2014 talking head",
  ]
  const canAct = selectedAngle !== null && selectedFormat !== null
  const config = PLATFORM_DEFAULTS[platform]
  const visibleHashtags = (card.hashtags || []).slice(0, config.hashtagCount)
  const hashtagStr = visibleHashtags.map(t => `#${t}`).join(" ")
  const soundUrl = config.hasAudio && config.audioDeepLinkBase && card.trendingSoundName
    ? `${config.audioDeepLinkBase}${encodeURIComponent(card.trendingSoundName)}`
    : null

  const sectionTitle: React.CSSProperties = {
    borderTop: `1px solid ${B.ruleLight}`, paddingTop: 12, marginTop: 16,
    fontSize: 10, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase",
    color: B.inkFaded, fontVariant: "small-caps", marginBottom: 10,
  }

  const optionStyle = (active: boolean): React.CSSProperties => ({
    display: "flex", alignItems: "flex-start", gap: 8,
    padding: "8px 14px", border: `1px solid ${B.rule}`,
    background: active ? B.ink : "transparent",
    color: active ? B.paper : B.ink,
    fontFamily: "'Playfair Display', Georgia, serif",
    fontSize: 12, cursor: "pointer", borderRadius: 0,
    textAlign: "left", lineHeight: 1.4, width: "100%",
    marginBottom: 4,
  })

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, background: "rgba(26,16,8,0.7)",
      zIndex: 300, display: "flex", alignItems: "flex-end",
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: B.paper, width: "100%", maxHeight: "85vh",
        overflowY: "auto", borderTop: `3px solid ${B.rule}`,
        padding: "20px 20px 40px",
        fontFamily: "'Playfair Display', Georgia, serif",
      }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <span style={{
            fontSize: 9, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase",
            color: B.paper, background: B.accent, padding: "2px 6px",
          }}>
            {card.category.replace(/_/g, " ")}
          </span>
          <button onClick={onClose} style={{
            background: "none", border: "none", color: B.inkFaded, fontSize: 18, cursor: "pointer",
          }}>{"\u2715"}</button>
        </div>

        {/* Platform selector */}
        <div style={sectionTitle}>POST TO:</div>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 8 }}>
          {ALL_PLATFORMS.map(p => (
            <button key={p} onClick={() => handlePlatformSelect(p)} style={{
              padding: "5px 12px", border: `1px solid ${B.rule}`,
              background: platform === p ? B.ink : "transparent",
              color: platform === p ? B.paper : B.ink,
              fontFamily: "'Playfair Display', Georgia, serif",
              fontSize: 11, cursor: "pointer", borderRadius: 0,
              fontVariant: "small-caps", letterSpacing: "0.06em",
            }}>
              {p}
            </button>
          ))}
        </div>

        {/* Headline + hook */}
        <h2 style={{ fontSize: 20, fontWeight: 700, color: B.ink, margin: "12px 0 4px", lineHeight: 1.3 }}>
          {card.headline}
        </h2>
        <p style={{ fontSize: 13, fontStyle: "italic", color: B.inkFaded, margin: "0 0 8px" }}>
          {card.hookSuggestion}
        </p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 4, fontSize: 10, color: B.inkFaded, fontVariant: "small-caps" }}>
          <span>{card.timeWindow}</span>
          <span>{"\u00B7"}</span>
          <span>{card.effort}</span>
          <span>{"\u00B7"}</span>
          <span>{config.videoLength}</span>
          {card.dnaMatch != null && <><span>{"\u00B7"}</span><span>DNA {card.dnaMatch}%</span></>}
        </div>

        {/* Angles */}
        <div style={sectionTitle}>PICK YOUR ANGLE</div>
        {angles.map((a, i) => (
          <button key={i} onClick={() => setSelectedAngle(i)} style={optionStyle(selectedAngle === i)}>
            <span style={{ flexShrink: 0 }}>{selectedAngle === i ? "\u25C9" : "\u25CB"}</span>
            <span><strong>{a.type}</strong> {"\u2014"} {"\u201C"}{a.hookText}{"\u201D"}</span>
          </button>
        ))}

        {/* Formats */}
        <div style={sectionTitle}>CONTENT FORMAT</div>
        {formats.map((f, i) => (
          <button key={i} onClick={() => setSelectedFormat(i)} style={optionStyle(selectedFormat === i)}>
            <span style={{ flexShrink: 0 }}>{selectedFormat === i ? "\u25C9" : "\u25CB"}</span>
            <span>{f}</span>
          </button>
        ))}
        <div style={{ fontSize: 10, color: B.inkFaded, marginTop: 4, fontStyle: "italic" }}>
          Recommended: {config.videoLength}
        </div>

        {/* Ready-to-Post Kit */}
        <div style={sectionTitle}>READY TO POST</div>
        {card.captions.map((caption, i) => {
          const adapted = adaptCaption(caption, platform)
          return (
            <div key={i} style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "10px 12px", marginBottom: 6,
              background: B.paperDark, border: `1px solid ${B.ruleLight}`,
            }}>
              <span style={{ flex: 1, fontSize: 13, color: B.ink, lineHeight: 1.5 }}>{adapted}</span>
              <CopyButton text={adapted} />
            </div>
          )
        })}

        {/* Sound row */}
        {config.hasAudio && card.trendingSoundName && (
          <div style={{ marginTop: 8, marginBottom: 8 }}>
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "8px 12px", background: B.paperDark, border: `1px solid ${B.ruleLight}`,
            }}>
              <span style={{ fontSize: 12, color: B.ink }}>{"\u266A"} {card.trendingSoundName}</span>
              {soundUrl && (
                <a href={soundUrl} target="_blank" rel="noopener noreferrer" style={{
                  fontSize: 10, fontWeight: 700, padding: "4px 10px",
                  border: `1px solid ${B.ruleLight}`, color: B.inkFaded,
                  textDecoration: "none", fontVariant: "small-caps", letterSpacing: "0.05em",
                }}>
                  {config.audioButtonLabel}
                </a>
              )}
            </div>
            {platform === "TikTok" && (
              <p style={{ fontSize: 10, color: B.inkLight, margin: "4px 0 0 12px", fontStyle: "italic" }}>
                {"\u26A0"} Business accounts: use TikTok&apos;s Commercial Music Library only.
              </p>
            )}
            {platform === "Instagram" && (
              <p style={{ fontSize: 10, color: B.inkLight, margin: "4px 0 0 12px", fontStyle: "italic" }}>
                {"\u26A0"} Business accounts: check audio is licensed for commercial use.
              </p>
            )}
          </div>
        )}

        {/* Hashtags */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
          {visibleHashtags.map((tag, i) => (
            <span key={i} style={{
              fontSize: 11, padding: "2px 8px", background: B.paperDark,
              border: `1px solid ${B.ruleLight}`, color: B.inkFaded,
            }}>#{tag}</span>
          ))}
          <CopyButton text={hashtagStr} label="COPY ALL" />
        </div>
        <p style={{ fontSize: 10, color: B.inkLight, marginTop: 4, fontStyle: "italic" }}>
          {platform}: {config.hashtagCount} hashtags recommended {"\u00B7"} {config.captionTone}
        </p>

        {/* Act button */}
        <button
          disabled={!canAct}
          onClick={() => {
            if (selectedAngle !== null && selectedFormat !== null) {
              onAct(angles[selectedAngle], formats[selectedFormat])
            }
          }}
          style={{
            width: "100%", padding: 12, background: canAct ? B.ink : B.paperDark,
            color: canAct ? B.paper : B.inkLight,
            border: canAct ? "none" : `1px solid ${B.ruleLight}`,
            fontFamily: "'Playfair Display', Georgia, serif",
            fontSize: 13, fontWeight: 700, letterSpacing: "0.1em",
            fontVariant: "small-caps", cursor: canAct ? "pointer" : "not-allowed",
            marginTop: 16, borderRadius: 0,
          }}
        >
          {"\u26A1"} I{"\u2019"}m making this {"\u2014"} mark as acting on it
        </button>
      </div>
    </div>
  )
}
