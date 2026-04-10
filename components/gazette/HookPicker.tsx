"use client"
import { useState } from "react"
import { T } from "./tokens"
import type { GazetteCard, HookAngle } from "@/types/gazette-ui"

const DEFAULT_ANGLES: HookAngle[] = [
  { type: "Curiosity gap", hookText: "The thing nobody tells you about X" },
  { type: "Numbers", hookText: "3 reasons X happened (and who wins)" },
  { type: "Hot take", hookText: "Everyone\u2019s wrong about X. Here\u2019s proof" },
  { type: "Story", hookText: "A client asked me about X last week\u2026" },
  { type: "Question", hookText: "Is X still worth it? I asked 50 people." },
]

export function HookPicker({ card, onAct, onClose }: {
  card: GazetteCard
  onAct: (angle: HookAngle, format: string) => void
  onClose: () => void
}) {
  const [selectedAngle, setSelectedAngle] = useState<number | null>(null)
  const [selectedFormat, setSelectedFormat] = useState<number | null>(null)
  const angles = card.angles.length > 0 ? card.angles : DEFAULT_ANGLES
  const formats = card.suggestedFormats.length > 0 ? card.suggestedFormats : [
    "30-second TikTok reaction",
    "90-second Reel with data",
    "LinkedIn carousel (5 slides)",
    "YouTube Short \u2014 talking head",
  ]
  const canAct = selectedAngle !== null && selectedFormat !== null
  const cat = T.categories[card.category]

  return (
    <div className="gazette-hook-overlay" onClick={onClose}>
      <div className="gazette-hook-panel" onClick={e => e.stopPropagation()}>
        <div className="gazette-hook-header">
          <span className="gazette-hook-badge" style={{ background: cat.bg }}>
            {cat.icon} {card.category.replace(/_/g, " ")}
          </span>
          <button className="gazette-hook-close" onClick={onClose}>\u2715</button>
        </div>

        <h2 className="gazette-hook-headline">{card.headline}</h2>
        <p className="gazette-hook-suggestion">{card.hookSuggestion}</p>

        <div className="gazette-hook-chips">
          <span className="gazette-hook-chip">{card.timeWindow}</span>
          <span className="gazette-hook-chip">{card.effort}</span>
          {card.dnaMatch != null && <span className="gazette-hook-chip">DNA {card.dnaMatch}%</span>}
        </div>

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
        .gazette-hook-close {
          background: none; border: none; color: ${T.muted};
          font-size: 18px; cursor: pointer;
        }
        .gazette-hook-headline {
          font-family: 'Playfair Display', Georgia, serif;
          font-size: 20px; font-weight: 700; color: ${T.text};
          margin: 0 0 6px; line-height: 1.3;
        }
        .gazette-hook-suggestion {
          font-size: 14px; font-style: italic; color: ${T.accent};
          margin: 0 0 12px;
        }
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
        .gazette-hook-act-btn {
          width: 100%; padding: 12px; border-radius: 6px;
          background: ${T.mid}; border: none; color: ${T.text};
          font-size: 14px; font-weight: 600; cursor: pointer;
          font-family: 'IBM Plex Sans', system-ui, sans-serif;
          transition: background 0.2s;
        }
        .gazette-hook-act-btn:hover:not(:disabled) { background: ${T.accent}; }
        .gazette-hook-act-btn:disabled { opacity: 0.4; cursor: not-allowed; }
      `}</style>
    </div>
  )
}
