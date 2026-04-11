"use client"
import { useState } from "react"
import { BROADSHEET } from "./tokens"
import type { GazetteMode } from "@/types/gazette-ui"

const MODES: { mode: GazetteMode; icon: string; title: string; desc: string }[] = [
  { mode: "REACT_NOW", icon: "\u26A1", title: "React Now", desc: "Live trends \u2014 short windows" },
  { mode: "PLAN_AHEAD", icon: "\u2726", title: "In My Lane", desc: "DNA-filtered to your niche" },
  { mode: "REPURPOSE", icon: "\u21BA", title: "Analyse History", desc: "Extract more from what worked" },
]

export function ModeSelector({ onChange }: { onChange: (mode: GazetteMode) => void }) {
  const [selected, setSelected] = useState<GazetteMode>(
    () => (typeof window !== "undefined" ? localStorage.getItem("da_gazette_mode") as GazetteMode : null) ?? "REACT_NOW"
  )

  const handleSelect = (mode: GazetteMode) => {
    setSelected(mode)
    localStorage.setItem("da_gazette_mode", mode)
    onChange(mode)
    document.getElementById("gazette-cards")?.scrollIntoView({ behavior: "smooth" })
  }

  return (
    <div style={{ background: BROADSHEET.paper, borderBottom: `2px solid ${BROADSHEET.rule}` }}>
      <div style={{
        textAlign: "center", fontSize: 11, letterSpacing: "0.2em",
        color: BROADSHEET.inkFaded, padding: "8px 0 6px",
        fontFamily: "'Playfair Display', Georgia, serif", fontVariant: "small-caps",
      }}>
        {"— What are you making today? —"}
      </div>
      <div style={{
        display: "grid", gridTemplateColumns: "1fr 1fr 1fr",
        borderTop: `1px solid ${BROADSHEET.rule}`,
      }}>
        {MODES.map((m, i) => (
          <button
            key={m.mode}
            onClick={() => handleSelect(m.mode)}
            style={{
              background: selected === m.mode ? BROADSHEET.paperDark : BROADSHEET.paper,
              border: "none",
              borderRight: i < 2 ? `1px solid ${BROADSHEET.rule}` : "none",
              borderBottom: selected === m.mode ? `3px solid ${BROADSHEET.ink}` : "3px solid transparent",
              padding: "14px 12px", cursor: "pointer", textAlign: "center",
              fontFamily: "'Playfair Display', Georgia, serif",
            }}
          >
            <div style={{ fontSize: 20, marginBottom: 6, color: BROADSHEET.ink }}>{m.icon}</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: BROADSHEET.ink, letterSpacing: "0.04em" }}>{m.title}</div>
            <div style={{ fontSize: 10, fontStyle: "italic", color: BROADSHEET.inkFaded, marginTop: 3 }}>{m.desc}</div>
          </button>
        ))}
      </div>
    </div>
  )
}
