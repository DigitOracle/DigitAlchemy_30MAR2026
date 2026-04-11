"use client"
import { useState } from "react"
import { T, type CategoryKey } from "./tokens"
import type { GazetteCard } from "@/types/gazette-ui"

function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.min(100, Math.max(0, value))
  const color = pct >= 70 ? "#22c55e" : pct >= 40 ? "#eab308" : "#ef4444"
  return (
    <div className="gazette-conf-bar">
      <div className="gazette-conf-fill" style={{ width: `${pct}%`, background: color }} />
    </div>
  )
}

function CategoryBadge({ category }: { category: CategoryKey }) {
  const cat = T.categories[category]
  return (
    <span className="gazette-cat-badge" style={{ background: cat.bg }}>
      {cat.icon} {category.replace(/_/g, " ")}
    </span>
  )
}

export function ConceptCard({ card, onTap, onDismiss, onSave }: {
  card: GazetteCard
  onTap: () => void
  onDismiss: () => void
  onSave: () => void
}) {
  const [dismissed, setDismissed] = useState(false)
  const isLow = card.confidence < 50
  const isExpired = card.timeWindow === "Expired"

  if (card.dismissed || dismissed) return null

  return (
    <div
      className={`gazette-card ${isLow ? "gazette-card-low" : ""} ${isExpired ? "gazette-card-expired" : ""} ${card.actedOn ? "gazette-card-acted" : ""} ${dismissed ? "gazette-card-dismiss-anim" : ""}`}
      onClick={onTap}
    >
      <div className="gazette-card-top">
        <CategoryBadge category={card.category} />
        <ConfidenceBar value={card.confidence} />
        <span className="gazette-card-window">{card.timeWindow}</span>
      </div>

      <h3 className="gazette-card-headline">{card.headline}</h3>
      <p className="gazette-card-hook">{card.hookSuggestion}</p>

      <div className="gazette-card-meta">
        {card.platformFit.map(p => (
          <span key={p} className="gazette-card-chip">{p}</span>
        ))}
        <span className="gazette-card-chip gazette-card-effort">{card.effort}</span>
        {card.dnaMatch != null && (
          <span className="gazette-card-chip gazette-card-dna">DNA {card.dnaMatch}%</span>
        )}
      </div>

      {card.sourceSignal && (
        <div className="gazette-card-source">{card.sourceSignal}</div>
      )}

      <div className="gazette-card-actions" onClick={e => e.stopPropagation()}>
        <button className="gazette-card-act-btn gazette-card-act-primary" onClick={onTap}>Post this today</button>
        <button className="gazette-card-act-btn" onClick={onSave} style={{ color: card.saved ? "#F59E0B" : undefined, transition: "color 0.2s ease" }}>{card.saved ? "\uD83D\uDD16" : "\uD83D\uDD0E"} Save</button>
        <button className="gazette-card-act-btn" onClick={() => { setDismissed(true); setTimeout(onDismiss, 300) }}>\u2715 Skip</button>
      </div>

      {isLow && <div className="gazette-card-weak">Weak signal</div>}
      {card.actedOn && <div className="gazette-card-check">\u2713</div>}

      <style>{`
        .gazette-card {
          flex: 0 0 300px; min-width: 280px; max-width: 320px;
          background: ${T.surface}; border: 1px solid ${T.border};
          border-radius: 10px; padding: 16px; cursor: pointer;
          transition: transform 0.3s, opacity 0.3s;
          position: relative; overflow: hidden;
          font-family: 'IBM Plex Sans', system-ui, sans-serif;
        }
        .gazette-card:hover { transform: translateY(-2px); border-color: ${T.accent}; }
        .gazette-card-low { opacity: 0.6; border-style: dashed; }
        .gazette-card-expired { opacity: 0.4; filter: grayscale(0.5); }
        .gazette-card-acted { border-color: #22c55e; }
        .gazette-card-dismiss-anim { transform: translateX(-110%); opacity: 0; }
        .gazette-card-top { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; flex-wrap: wrap; }
        .gazette-cat-badge {
          font-size: 10px; font-weight: 700; text-transform: uppercase;
          letter-spacing: 0.05em; padding: 3px 8px; border-radius: 4px;
          color: #fff; white-space: nowrap;
        }
        .gazette-conf-bar {
          flex: 1; height: 4px; background: rgba(255,255,255,0.1);
          border-radius: 2px; min-width: 40px;
        }
        .gazette-conf-fill { height: 100%; border-radius: 2px; transition: width 0.5s; }
        .gazette-card-window {
          font-size: 10px; color: ${T.muted}; white-space: nowrap;
          padding: 2px 6px; border: 1px solid ${T.border}; border-radius: 4px;
        }
        .gazette-card-headline {
          font-family: 'Playfair Display', Georgia, serif;
          font-size: 16px; font-weight: 700; color: ${T.text};
          margin: 0 0 6px; line-height: 1.3;
          display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
        }
        .gazette-card-hook {
          font-size: 13px; font-style: italic; color: ${T.accent};
          margin: 0 0 10px; line-height: 1.4;
          display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
        }
        .gazette-card-meta { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 8px; }
        .gazette-card-chip {
          font-size: 10px; padding: 2px 6px; border-radius: 3px;
          background: rgba(123,94,167,0.15); color: ${T.muted};
        }
        .gazette-card-effort { background: rgba(232,93,4,0.15); color: #E85D04; }
        .gazette-card-dna { background: rgba(34,197,94,0.15); color: #22c55e; }
        .gazette-card-source { font-size: 10px; color: ${T.muted}; opacity: 0.6; margin-bottom: 8px; }
        .gazette-card-actions { display: flex; gap: 6px; }
        .gazette-card-act-btn {
          flex: 1; font-size: 11px; padding: 6px 4px; border-radius: 4px;
          border: 1px solid ${T.border}; background: transparent;
          color: ${T.muted}; cursor: pointer; white-space: nowrap;
          font-family: 'IBM Plex Sans', system-ui, sans-serif;
        }
        .gazette-card-act-btn:hover { border-color: ${T.accent}; color: ${T.text}; }
        .gazette-card-act-primary {
          background: ${T.mid}; border-color: ${T.mid}; color: ${T.text};
        }
        .gazette-card-act-primary:hover { background: ${T.accent}; }
        .gazette-card-weak {
          position: absolute; top: 8px; right: 8px;
          font-size: 9px; color: #ef4444; text-transform: uppercase;
          letter-spacing: 0.1em;
        }
        .gazette-card-check {
          position: absolute; top: 50%; left: 50%;
          transform: translate(-50%, -50%);
          font-size: 48px; color: #22c55e; opacity: 0.3;
        }
        @media (max-width: 640px) {
          .gazette-card { flex: 0 0 260px; min-width: 240px; }
        }
      `}</style>
    </div>
  )
}
