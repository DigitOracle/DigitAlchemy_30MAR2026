"use client"
import { useState } from "react"
import { BROADSHEET } from "./tokens"
import type { TopPost, RepurposeOption } from "@/types/gazette-ui"

const B = BROADSHEET

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
      <div style={{
        maxWidth: 700, margin: "0 auto", padding: "60px 20px",
        textAlign: "center", fontFamily: "'Playfair Display', Georgia, serif",
      }}>
        <div style={{
          fontSize: 12, letterSpacing: "0.3em", color: B.inkFaded,
          marginBottom: 16, fontVariant: "small-caps",
        }}>
          {"\u25C6 \u25C6 \u25C6"}
        </div>
        <p style={{ fontSize: 16, fontStyle: "italic", color: B.inkFaded, marginBottom: 16 }}>
          Connect your accounts to see your top performing content.
        </p>
        <a href="/accounts" style={{
          display: "inline-block", padding: "8px 20px",
          background: B.ink, color: B.paper, textDecoration: "none",
          fontFamily: "'Playfair Display', Georgia, serif",
          fontSize: 12, fontVariant: "small-caps", letterSpacing: "0.1em",
        }}>
          Go to Linked Accounts {"\u2192"}
        </a>
      </div>
    )
  }

  const daysAgo = Math.round((Date.now() - new Date(topPost.publishedAt).getTime()) / 86400000)

  return (
    <div style={{
      maxWidth: 700, margin: "0 auto", padding: "20px",
      fontFamily: "'Playfair Display', Georgia, serif",
    }}>
      {/* Top performer card */}
      <div style={{
        background: B.paperDark, border: `1px solid ${B.rule}`,
        padding: 20, marginBottom: 20,
      }}>
        <h3 style={{
          fontSize: 11, fontWeight: 700, letterSpacing: "0.14em",
          textTransform: "uppercase", color: B.accent, margin: "0 0 8px",
          fontVariant: "small-caps",
        }}>
          Your Best Performer {"\u2014"} Still Getting Traction
        </h3>
        <p style={{
          fontSize: 14, color: B.ink, margin: "0 0 10px", lineHeight: 1.5,
        }}>
          {topPost.text.slice(0, 200)}
        </p>
        <div style={{ display: "flex", gap: 16, fontSize: 12, color: B.inkFaded }}>
          <span>{topPost.views.toLocaleString()} views</span>
          <span>Posted {daysAgo} days ago</span>
          <span>{"\u2713"} {topPost.platform}</span>
        </div>
      </div>

      {/* Repurpose options */}
      <h4 style={{
        fontSize: 11, fontWeight: 700, letterSpacing: "0.14em",
        textTransform: "uppercase", color: B.inkFaded, margin: "0 0 12px",
        fontVariant: "small-caps",
      }}>
        Repurpose This Into:
      </h4>
      <div style={{
        display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10,
        marginBottom: 24,
      }}>
        {REPURPOSE_OPTIONS.map(opt => {
          const isSaved = saved.has(opt.label)
          return (
            <button
              key={opt.label}
              onClick={() => handleSave(opt.label)}
              disabled={isSaved}
              style={{
                display: "flex", flexDirection: "column", gap: 4,
                padding: 16, background: isSaved ? B.paperDark : B.paper,
                border: `1px solid ${isSaved ? B.accent : B.rule}`,
                cursor: isSaved ? "default" : "pointer", textAlign: "left",
                fontFamily: "'Playfair Display', Georgia, serif",
                opacity: isSaved ? 0.7 : 1,
              }}
            >
              <span style={{ fontSize: 24 }}>{opt.icon}</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: B.ink }}>{opt.label}</span>
              <span style={{ fontSize: 11, color: B.inkFaded }}>
                {isSaved ? "\u2713 Added to queue" : opt.description}
              </span>
            </button>
          )
        })}
      </div>

      {/* Pillar-to-Micro */}
      <div style={{
        background: B.paperDark, border: `1px solid ${B.rule}`,
        padding: 16,
      }}>
        <h4 style={{ fontSize: 14, color: B.ink, margin: "0 0 6px" }}>
          {"\u26A1"} Pillar-to-Micro Strategy
        </h4>
        <p style={{ fontSize: 13, color: B.inkFaded, margin: "0 0 8px", lineHeight: 1.5 }}>
          One deep piece of content (your {"\u201C"}pillar{"\u201D"}) becomes 15+ short pieces.
          You filmed once. The Console tells you what to extract.
        </p>
        <p style={{ fontWeight: 700, color: B.accent, fontSize: 12, margin: 0 }}>
          1 YouTube video {"\u2192"} 5 TikToks + 5 Reels + 5 Shorts + 1 LinkedIn post + 1 Blog post
        </p>
      </div>

      <style>{`
        @media (max-width: 640px) {
          div[style*="grid-template-columns: 1fr 1fr"] {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  )
}
