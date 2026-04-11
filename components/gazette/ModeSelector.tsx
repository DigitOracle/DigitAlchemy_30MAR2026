"use client"
import { useState, useEffect } from "react"
import { T } from "./tokens"
import type { GazetteMode } from "@/types/gazette-ui"

const MODES: { mode: GazetteMode; icon: string; label: string; sub: string }[] = [
  { mode: "REACT_NOW", icon: "\u26A1", label: "Jumping on something trending", sub: "React Now \u2014 live trends, short windows" },
  { mode: "PLAN_AHEAD", icon: "\uD83D\uDCCB", label: "Creating planned content", sub: "In My Lane \u2014 DNA-filtered to your niche" },
  { mode: "REPURPOSE", icon: "\uD83D\uDD01", label: "Repurposing something I already made", sub: "Analyse History \u2014 extract more from what worked" },
]

const LS_KEY = "da_gazette_mode"

export function ModeSelector({ onChange }: { onChange: (mode: GazetteMode) => void }) {
  const [selected, setSelected] = useState<GazetteMode>("REACT_NOW")

  useEffect(() => {
    const stored = localStorage.getItem(LS_KEY) as GazetteMode | null
    if (stored && MODES.some(m => m.mode === stored)) {
      setSelected(stored)
      onChange(stored)
    }
  }, [onChange])

  const select = (mode: GazetteMode) => {
    setSelected(mode)
    localStorage.setItem(LS_KEY, mode)
    onChange(mode)
    document.getElementById("gazette-cards")?.scrollIntoView({ behavior: "smooth" })
  }

  return (
    <div className="gazette-mode-selector">
      <h2 className="gazette-mode-heading">What are you making today?</h2>
      <div className="gazette-mode-grid">
        {MODES.map(m => (
          <button
            key={m.mode}
            onClick={() => select(m.mode)}
            className={`gazette-mode-btn ${selected === m.mode ? "gazette-mode-btn-active" : ""}`}
          >
            <span className="gazette-mode-icon">{m.icon}</span>
            <span className="gazette-mode-label">{m.label}</span>
            <span className="gazette-mode-sub">{m.sub}</span>
          </button>
        ))}
      </div>

      <style>{`
        .gazette-mode-selector {
          padding: 32px 20px 24px; text-align: center;
        }
        .gazette-mode-heading {
          font-family: 'Playfair Display', Georgia, serif;
          font-size: 24px; font-weight: 700; color: ${T.text};
          margin: 0 0 20px;
        }
        .gazette-mode-grid {
          display: grid; grid-template-columns: repeat(3, 1fr);
          gap: 12px; max-width: 900px; margin: 0 auto;
        }
        .gazette-mode-btn {
          display: flex; flex-direction: column; align-items: center;
          gap: 6px; padding: 20px 16px;
          background: ${T.surface}; border: 1px solid ${T.border};
          border-radius: 8px; cursor: pointer;
          transition: border-color 0.2s, background 0.2s;
          text-align: center;
        }
        .gazette-mode-btn:hover { border-color: ${T.accent}; }
        .gazette-mode-btn-active {
          border-color: ${T.accent};
          background: rgba(123,94,167,0.15);
        }
        .gazette-mode-icon { font-size: 28px; }
        .gazette-mode-label {
          font-family: 'IBM Plex Sans', system-ui, sans-serif;
          font-size: 14px; font-weight: 600; color: ${T.text};
        }
        .gazette-mode-sub {
          font-size: 11px; color: ${T.muted};
          font-family: 'IBM Plex Sans', system-ui, sans-serif;
        }
        @media (max-width: 640px) {
          .gazette-mode-grid { grid-template-columns: 1fr; }
          .gazette-mode-heading { font-size: 20px; }
        }
      `}</style>
    </div>
  )
}
