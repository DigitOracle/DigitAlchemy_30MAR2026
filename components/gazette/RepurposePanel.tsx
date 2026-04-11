"use client"
import { useState } from "react"
import { T } from "./tokens"
import type { TopPost, RepurposeOption } from "@/types/gazette-ui"

const REPURPOSE_OPTIONS: RepurposeOption[] = [
  { icon: "\uD83C\uDFAC", label: "5 TikTok clips", description: "Extract the 5 best 30-second moments" },
  { icon: "\uD83D\uDCCA", label: "LinkedIn carousel", description: "Turn key points into 8 slides" },
  { icon: "\u25B6\uFE0F", label: "YouTube Short", description: "Isolate your strongest 60 seconds" },
  { icon: "\uD83D\uDCDD", label: "Blog post", description: "The full argument as a searchable article" },
]

export function RepurposePanel({ topPost, onSave }: {
  topPost: TopPost | null
  onSave: (option: string) => void
}) {
  const [saved, setSaved] = useState<Set<string>>(new Set())

  const handleSave = (label: string) => {
    setSaved(prev => new Set(prev).add(label))
    onSave(label)
  }

  if (!topPost) {
    return (
      <div className="gazette-repurpose" style={{ textAlign: "center", padding: "40px 20px" }}>
        <p style={{ color: T.muted, fontSize: 14, fontFamily: "'IBM Plex Sans', system-ui, sans-serif" }}>
          Connect your accounts first to see your top performing content.
        </p>
        <a href="/accounts" className="gazette-repurpose-link">Go to Accounts \u2192</a>
        <style>{repurposeStyles}</style>
      </div>
    )
  }

  const daysAgo = Math.round((Date.now() - new Date(topPost.publishedAt).getTime()) / 86400000)

  return (
    <div className="gazette-repurpose">
      <div className="gazette-repurpose-top">
        <h3 className="gazette-repurpose-heading">YOUR BEST PERFORMER \u2014 STILL GETTING TRACTION</h3>
        <p className="gazette-repurpose-caption">{topPost.text.slice(0, 200)}</p>
        <div className="gazette-repurpose-stats">
          <span>\uD83D\uDCCA {topPost.views.toLocaleString()} views</span>
          <span>Posted {daysAgo} days ago</span>
          <span>\u2713 {topPost.platform}</span>
        </div>
      </div>

      <h4 className="gazette-repurpose-sub">REPURPOSE THIS INTO:</h4>
      <div className="gazette-repurpose-grid">
        {REPURPOSE_OPTIONS.map(opt => (
          <button
            key={opt.label}
            className={`gazette-repurpose-option ${saved.has(opt.label) ? "gazette-repurpose-saved" : ""}`}
            onClick={() => handleSave(opt.label)}
            disabled={saved.has(opt.label)}
          >
            <span className="gazette-repurpose-opt-icon">{opt.icon}</span>
            <span className="gazette-repurpose-opt-label">{opt.label}</span>
            <span className="gazette-repurpose-opt-desc">{saved.has(opt.label) ? "\u2713 Added to queue" : opt.description}</span>
          </button>
        ))}
      </div>

      <div className="gazette-repurpose-pillar">
        <h4>\u26A1 Pillar-to-Micro strategy</h4>
        <p>One deep piece of content (your \u201Cpillar\u201D) becomes 15+ short pieces.
        You filmed once. The Console tells you what to extract.</p>
        <p className="gazette-repurpose-formula">
          1 YouTube video \u2192 5 TikToks + 5 Reels + 5 Shorts + 1 LinkedIn post + 1 Blog post
        </p>
      </div>

      <style>{repurposeStyles}</style>
    </div>
  )
}

const repurposeStyles = `
  .gazette-repurpose {
    max-width: 700px; margin: 0 auto; padding: 20px;
    font-family: 'IBM Plex Sans', system-ui, sans-serif;
  }
  .gazette-repurpose-top {
    background: ${T.surface}; border: 1px solid ${T.border};
    border-radius: 10px; padding: 20px; margin-bottom: 20px;
  }
  .gazette-repurpose-heading {
    font-size: 11px; font-weight: 700; letter-spacing: 0.1em;
    color: ${T.accent}; margin: 0 0 8px;
  }
  .gazette-repurpose-caption {
    font-size: 14px; color: ${T.text}; margin: 0 0 10px; line-height: 1.5;
  }
  .gazette-repurpose-stats {
    display: flex; gap: 16px; font-size: 12px; color: ${T.muted};
  }
  .gazette-repurpose-sub {
    font-size: 11px; font-weight: 700; letter-spacing: 0.1em;
    color: ${T.muted}; margin: 0 0 12px;
  }
  .gazette-repurpose-grid {
    display: grid; grid-template-columns: 1fr 1fr; gap: 10px;
    margin-bottom: 24px;
  }
  .gazette-repurpose-option {
    display: flex; flex-direction: column; gap: 4px;
    padding: 16px; background: ${T.surface}; border: 1px solid ${T.border};
    border-radius: 8px; cursor: pointer; text-align: left;
    font-family: 'IBM Plex Sans', system-ui, sans-serif;
    transition: border-color 0.2s;
  }
  .gazette-repurpose-option:hover:not(:disabled) { border-color: ${T.accent}; }
  .gazette-repurpose-saved { border-color: #22c55e; opacity: 0.7; }
  .gazette-repurpose-opt-icon { font-size: 24px; }
  .gazette-repurpose-opt-label { font-size: 14px; font-weight: 600; color: ${T.text}; }
  .gazette-repurpose-opt-desc { font-size: 11px; color: ${T.muted}; }
  .gazette-repurpose-pillar {
    background: rgba(123,94,167,0.1); border: 1px solid ${T.border};
    border-radius: 8px; padding: 16px;
  }
  .gazette-repurpose-pillar h4 { font-size: 14px; color: ${T.text}; margin: 0 0 6px; }
  .gazette-repurpose-pillar p { font-size: 13px; color: ${T.muted}; margin: 0 0 8px; line-height: 1.5; }
  .gazette-repurpose-formula { font-weight: 600; color: ${T.accent}; font-size: 12px; }
  .gazette-repurpose-link {
    display: inline-block; margin-top: 12px; padding: 8px 16px;
    background: ${T.mid}; color: ${T.text}; border-radius: 6px;
    text-decoration: none; font-size: 13px;
  }
  @media (max-width: 640px) {
    .gazette-repurpose-grid { grid-template-columns: 1fr; }
  }
`
