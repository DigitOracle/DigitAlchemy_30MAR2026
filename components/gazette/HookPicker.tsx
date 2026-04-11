"use client"
import { useState, useRef } from "react"
import { T } from "./tokens"
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
const LS_PLATFORM_KEY = "da_gazette_target_platform"

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
    <button ref={btnRef} className="gazette-kit-copy" onClick={handleCopy}>
      {label || "COPY"}
    </button>
  )
}

export function HookPicker({ card, onAct, onClose }: {
  card: GazetteCard
  onAct: (angle: HookAngle, format: string) => void
  onClose: () => void
}) {
  const [selectedAngle, setSelectedAngle] = useState<number | null>(null)
  const [selectedFormat, setSelectedFormat] = useState<number | null>(null)
  const [platform, setPlatform] = useState<GazettePlatform>(
    () => (typeof window !== "undefined" ? localStorage.getItem(LS_PLATFORM_KEY) as GazettePlatform : null) ?? "TikTok"
  )

  const handlePlatformSelect = (p: GazettePlatform) => {
    setPlatform(p)
    localStorage.setItem(LS_PLATFORM_KEY, p)
  }

  const angles = card.angles.length > 0 ? card.angles : DEFAULT_ANGLES
  const formats = card.suggestedFormats.length > 0 ? card.suggestedFormats : [
    "30-second TikTok reaction",
    "90-second Reel with data",
    "LinkedIn carousel (5 slides)",
    "YouTube Short \u2014 talking head",
  ]
  const canAct = selectedAngle !== null && selectedFormat !== null
  const cat = T.categories[card.category]
  const config = PLATFORM_DEFAULTS[platform]
  const visibleHashtags = (card.hashtags || []).slice(0, config.hashtagCount)
  const hashtagStr = visibleHashtags.map(t => `#${t}`).join(" ")
  const soundUrl = config.hasAudio && config.audioDeepLinkBase && card.trendingSoundName
    ? `${config.audioDeepLinkBase}${encodeURIComponent(card.trendingSoundName)}`
    : null

  return (
    <div className="gazette-hook-overlay" onClick={onClose}>
      <div className="gazette-hook-panel" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="gazette-hook-header">
          <span className="gazette-hook-badge" style={{ background: cat.bg }}>
            {cat.icon} {card.category.replace(/_/g, " ")}
          </span>
          <button className="gazette-hook-close" onClick={onClose}>\u2715</button>
        </div>

        {/* Platform selector — first decision */}
        <h3 className="gazette-hook-section-title" style={{ marginTop: 0 }}>POST TO:</h3>
        <div className="gazette-platform-row">
          {ALL_PLATFORMS.map(p => (
            <button
              key={p}
              className={`gazette-platform-pill ${platform === p ? "gazette-platform-pill-active" : ""}`}
              onClick={() => handlePlatformSelect(p)}
            >
              {p}
            </button>
          ))}
        </div>

        <div className="gazette-hook-divider" />

        <h2 className="gazette-hook-headline">{card.headline}</h2>
        <p className="gazette-hook-suggestion">{card.hookSuggestion}</p>

        <div className="gazette-hook-chips">
          <span className="gazette-hook-chip">{card.timeWindow}</span>
          <span className="gazette-hook-chip">{card.effort}</span>
          <span className="gazette-hook-chip">{config.videoLength}</span>
          {card.dnaMatch != null && <span className="gazette-hook-chip">DNA {card.dnaMatch}%</span>}
        </div>

        {/* Section 1: Angles */}
        <div className="gazette-hook-divider" />
        <h3 className="gazette-hook-section-title">PICK YOUR ANGLE</h3>
        <div className="gazette-hook-options">
          {angles.map((a, i) => (
            <button
              key={i}
              className={`gazette-hook-option ${selectedAngle === i ? "gazette-hook-option-active" : ""}`}
              onClick={() => setSelectedAngle(i)}
            >
              <span className="gazette-hook-radio">{selectedAngle === i ? "\u25C9" : "\u25CB"}</span>
              <span><strong>{a.type}</strong> \u2014 \u201C{a.hookText}\u201D</span>
            </button>
          ))}
        </div>

        {/* Section 2: Formats */}
        <div className="gazette-hook-divider" />
        <h3 className="gazette-hook-section-title">CONTENT FORMAT</h3>
        <div className="gazette-hook-options">
          {formats.map((f, i) => (
            <button
              key={i}
              className={`gazette-hook-option ${selectedFormat === i ? "gazette-hook-option-active" : ""}`}
              onClick={() => setSelectedFormat(i)}
            >
              <span className="gazette-hook-radio">{selectedFormat === i ? "\u25C9" : "\u25CB"}</span>
              <span>{f} <em className="gazette-hook-post-today">(post today)</em></span>
            </button>
          ))}
        </div>
        <span className="gazette-hook-video-hint">Recommended: {config.videoLength}</span>

        {/* Section 3: Ready-to-Post Kit */}
        <div className="gazette-hook-divider" />
        <h3 className="gazette-hook-section-title">READY TO POST</h3>

        <div className="gazette-kit-captions">
          {card.captions.map((caption, i) => {
            const adapted = adaptCaption(caption, platform)
            return (
              <div key={i} className="gazette-kit-caption-row">
                <span className="gazette-kit-caption-text">{adapted}</span>
                <CopyButton text={adapted} />
              </div>
            )
          })}
        </div>

        {config.hasAudio && card.trendingSoundName && (
          <div className="gazette-kit-sound-section">
            <div className="gazette-kit-sound-row">
              <span className="gazette-kit-sound-label">
                \uD83C\uDFB5 {card.trendingSoundName}
              </span>
              {soundUrl && (
                <a href={soundUrl} target="_blank" rel="noopener noreferrer" className="gazette-kit-sound-link">
                  {config.audioButtonLabel}
                </a>
              )}
            </div>
            {platform === "TikTok" && (
              <p className="gazette-kit-audio-warn">
                \u26A0 Business accounts: use TikTok&apos;s Commercial Music Library only. Unlicensed audio may be muted.
              </p>
            )}
            {platform === "Instagram" && (
              <p className="gazette-kit-audio-warn">
                \u26A0 Business accounts: check audio is licensed for commercial use before posting.
              </p>
            )}
          </div>
        )}

        <div className="gazette-kit-hashtag-row">
          <div className="gazette-kit-hashtag-pills">
            {visibleHashtags.map((tag, i) => (
              <span key={i} className="gazette-kit-hashtag-pill">#{tag}</span>
            ))}
          </div>
          <CopyButton text={hashtagStr} label="COPY ALL" />
        </div>
        <p className="gazette-kit-platform-hint">
          {platform}: {config.hashtagCount} hashtags recommended \u00B7 {config.captionTone}
        </p>

        {/* Section 4: Act button */}
        <div className="gazette-hook-divider" />
        <button
          className="gazette-hook-act-btn"
          disabled={!canAct}
          onClick={() => {
            if (selectedAngle !== null && selectedFormat !== null) {
              onAct(angles[selectedAngle], formats[selectedFormat])
            }
          }}
        >
          \u26A1 I\u2019m making this \u2014 mark as acting on it
        </button>
      </div>

      <style>{`
        .gazette-hook-overlay {
          position: fixed; inset: 0; z-index: 100;
          background: rgba(0,0,0,0.7); backdrop-filter: blur(4px);
          display: flex; align-items: center; justify-content: center;
          padding: 20px;
        }
        .gazette-hook-panel {
          background: ${T.surface}; border: 1px solid ${T.border};
          border-radius: 12px; padding: 24px; max-width: 520px; width: 100%;
          max-height: 90vh; overflow-y: auto;
          font-family: 'IBM Plex Sans', system-ui, sans-serif;
        }
        .gazette-hook-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
        .gazette-hook-badge {
          font-size: 10px; font-weight: 700; text-transform: uppercase;
          padding: 3px 8px; border-radius: 4px; color: #fff;
        }
        .gazette-hook-close { background: none; border: none; color: ${T.muted}; font-size: 18px; cursor: pointer; }
        .gazette-platform-row { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 4px; }
        .gazette-platform-pill {
          font-size: 11px; padding: 5px 12px; border-radius: 14px;
          border: 1px solid ${T.border}; background: ${T.surface};
          color: ${T.muted}; cursor: pointer;
          font-family: 'IBM Plex Sans', system-ui, sans-serif;
          transition: all 0.15s;
        }
        .gazette-platform-pill:hover { border-color: ${T.accent}; color: ${T.text}; }
        .gazette-platform-pill-active {
          background: ${T.accent}; border-color: ${T.accent}; color: ${T.text}; font-weight: 600;
        }
        .gazette-hook-headline {
          font-family: 'Playfair Display', Georgia, serif;
          font-size: 20px; font-weight: 700; color: ${T.text};
          margin: 0 0 6px; line-height: 1.3;
        }
        .gazette-hook-suggestion { font-size: 14px; font-style: italic; color: ${T.accent}; margin: 0 0 12px; }
        .gazette-hook-chips { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 16px; }
        .gazette-hook-chip {
          font-size: 11px; padding: 3px 8px; border-radius: 4px;
          background: rgba(123,94,167,0.15); color: ${T.muted};
        }
        .gazette-hook-divider { border-top: 1px solid ${T.border}; margin: 16px 0; }
        .gazette-hook-section-title {
          font-size: 11px; font-weight: 700; letter-spacing: 0.1em;
          color: ${T.muted}; margin: 0 0 10px;
        }
        .gazette-hook-options { display: flex; flex-direction: column; gap: 6px; }
        .gazette-hook-option {
          display: flex; align-items: flex-start; gap: 8px;
          padding: 8px 10px; border-radius: 6px;
          background: transparent; border: 1px solid transparent;
          color: ${T.text}; font-size: 13px; cursor: pointer;
          text-align: left; line-height: 1.4;
          font-family: 'IBM Plex Sans', system-ui, sans-serif;
        }
        .gazette-hook-option:hover { background: rgba(123,94,167,0.1); }
        .gazette-hook-option-active { border-color: ${T.accent}; background: rgba(123,94,167,0.15); }
        .gazette-hook-radio { flex-shrink: 0; font-size: 14px; color: ${T.accent}; margin-top: 1px; }
        .gazette-hook-post-today { font-size: 11px; color: ${T.muted}; }
        .gazette-hook-video-hint { font-size: 11px; color: ${T.muted}; margin-top: 6px; display: block; }

        .gazette-kit-captions { display: flex; flex-direction: column; gap: 8px; margin-bottom: 12px; }
        .gazette-kit-caption-row {
          display: flex; align-items: center; gap: 8px;
          padding: 10px 12px; border-radius: 6px;
          background: rgba(123,94,167,0.08);
        }
        .gazette-kit-caption-text { flex: 1; font-size: 14px; color: ${T.text}; line-height: 1.5; white-space: normal; }
        .gazette-kit-copy {
          flex-shrink: 0; font-size: 10px; font-weight: 700;
          padding: 4px 10px; border-radius: 4px;
          border: 1px solid ${T.border}; background: transparent;
          color: ${T.muted}; cursor: pointer; letter-spacing: 0.05em;
          font-family: 'IBM Plex Sans', system-ui, sans-serif;
          min-width: 60px; text-align: center;
        }
        .gazette-kit-copy:hover { border-color: ${T.accent}; color: ${T.text}; }
        .gazette-kit-sound-section { margin-bottom: 12px; }
        .gazette-kit-sound-row {
          display: flex; align-items: center; justify-content: space-between;
          padding: 8px 12px; border-radius: 6px; background: rgba(123,94,167,0.08);
        }
        .gazette-kit-sound-label { font-size: 13px; color: ${T.text}; }
        .gazette-kit-sound-link {
          font-size: 10px; font-weight: 700; padding: 4px 10px;
          border-radius: 4px; border: 1px solid ${T.border};
          color: ${T.muted}; text-decoration: none; letter-spacing: 0.05em;
        }
        .gazette-kit-sound-link:hover { border-color: ${T.accent}; color: ${T.text}; }
        .gazette-kit-audio-warn { font-size: 11px; color: ${T.muted}; margin: 4px 0 0 12px; }
        .gazette-kit-hashtag-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
        .gazette-kit-hashtag-pills { display: flex; gap: 4px; flex-wrap: wrap; flex: 1; }
        .gazette-kit-hashtag-pill {
          font-size: 11px; padding: 3px 8px; border-radius: 4px;
          background: rgba(123,94,167,0.12); color: ${T.muted};
        }
        .gazette-kit-platform-hint { font-size: 11px; color: ${T.muted}; margin: 6px 0 0; }

        .gazette-hook-act-btn {
          width: 100%; padding: 12px; border-radius: 6px;
          background: ${T.mid}; border: none; color: ${T.text};
          font-size: 14px; font-weight: 600; cursor: pointer;
          font-family: 'IBM Plex Sans', system-ui, sans-serif;
          transition: background 0.2s;
        }
        .gazette-hook-act-btn:hover:not(:disabled) { background: ${T.accent}; }
        .gazette-hook-act-btn:disabled { opacity: 0.4; cursor: not-allowed; }

        @media (max-width: 640px) {
          .gazette-kit-hashtag-row { flex-direction: column; align-items: flex-start; }
          .gazette-platform-row { gap: 4px; }
          .gazette-platform-pill { font-size: 10px; padding: 4px 8px; }
        }
      `}</style>
    </div>
  )
}
