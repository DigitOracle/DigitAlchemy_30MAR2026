"use client"
import { useState, useEffect } from "react"

type WikiItem = { name: string; views: number }
type GdeltItem = { title: string; domain: string; url?: string }
type YoutubeItem = { title: string; channel: string; views: number; thumbnail: string }
type BriefingData = { wikipedia: WikiItem[]; gdelt: GdeltItem[]; youtube: YoutubeItem[]; regionLabel: string }

const QUOTES = [
  { text: "Attention is no longer just local — but local context still decides what spreads.", by: "The Editorial Desk" },
  { text: "The trend you catch today is the campaign your competitor posts tomorrow.", by: "The Editorial Desk" },
  { text: "Every viral moment is a cultural signal. The question is whether you read it in time.", by: "The Editorial Desk" },
]

const REGIONS = [
  { id: "AE", label: "the UAE" }, { id: "SA", label: "Saudi Arabia" }, { id: "KW", label: "Kuwait" },
  { id: "QA", label: "Qatar" }, { id: "US", label: "the United States" }, { id: "SG", label: "Singapore" },
]

export function MorningBriefing() {
  const [region, setRegion] = useState("AE")
  const [data, setData] = useState<BriefingData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/morning-briefing?region=${region}`)
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [region])

  const now = new Date()
  const dayName = now.toLocaleDateString("en-US", { weekday: "long" })
  const dateFormatted = now.toLocaleDateString("en-US", { day: "numeric", month: "long", year: "numeric" })
  const dayOfYear = Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86400000)
  const hour = now.getHours()
  const edition = hour < 12 ? "Morning" : hour < 17 ? "Afternoon" : "Evening"
  const quote = QUOTES[dayOfYear % QUOTES.length]
  const regionObj = REGIONS.find((r) => r.id === region)
  const regionLabel = data?.regionLabel || regionObj?.label || region

  const ink = "#1A1A1A"
  const rule = "#C4B9A0"
  const secondary = "#4A4A3A"
  const paper = "#F5F0E8"
  const serif = "Georgia, 'Times New Roman', serif"
  const sans = "system-ui, -apple-system, sans-serif"

  return (
    <div style={{ background: paper, color: ink, fontFamily: serif, borderRadius: 12, overflow: "hidden" }} className="mb-6 animate-fade-in">
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "24px 28px 20px" }}>

        {/* ── MASTHEAD ── */}
        <div style={{ textAlign: "center", borderBottom: `3px double ${ink}`, paddingBottom: 10, marginBottom: 6 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <div style={{ fontSize: 10, fontFamily: sans, color: secondary, textTransform: "uppercase", letterSpacing: "0.1em" }}>
              <select value={region} onChange={(e) => setRegion(e.target.value)}
                style={{ background: "transparent", border: "none", fontFamily: sans, fontSize: 10, color: secondary, cursor: "pointer", textTransform: "uppercase", letterSpacing: "0.1em" }}>
                {REGIONS.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
              </select>
            </div>
            <div style={{ fontSize: 10, fontFamily: sans, color: secondary, textTransform: "uppercase", letterSpacing: "0.1em" }}>
              {edition} Edition
            </div>
          </div>
          <div style={{ fontSize: 10, letterSpacing: "0.3em", textTransform: "uppercase", color: secondary, fontFamily: sans }}>
            Est. 2026 &middot; DigitAlchemy&reg; Tech Limited
          </div>
          <h1 style={{ fontFamily: serif, fontSize: 38, fontWeight: "bold", color: ink, margin: "6px 0 4px", letterSpacing: "0.02em", lineHeight: 1.1 }}>
            The DigitAlchemy Gazette
          </h1>
          <div style={{ borderTop: `1px solid ${rule}`, borderBottom: `1px solid ${rule}`, padding: "3px 0", margin: "4px 0" }}>
            <span style={{ fontSize: 11, color: secondary, fontFamily: serif }}>
              {dayName}, {dateFormatted} &middot; {regionLabel} Edition &middot; Vol. 01 &middot; No. {dayOfYear}
            </span>
          </div>
        </div>

        {/* ── LOADING ── */}
        {loading && (
          <div style={{ textAlign: "center", padding: "48px 0" }}>
            <p style={{ fontStyle: "italic", color: secondary, fontSize: 15 }}>Composing today&rsquo;s edition&hellip;</p>
          </div>
        )}

        {/* ── CONTENT ── */}
        {!loading && data && (
          <>
            {/* Lead Story + Right Rail */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 20, marginBottom: 20 }} className="gazette-grid">
              {/* LEAD STORY */}
              <div>
                {data.wikipedia.length > 0 && (
                  <>
                    <h2 style={{ fontFamily: serif, fontSize: 24, fontWeight: "bold", lineHeight: 1.2, marginBottom: 6 }}>
                      Global Attention Turns to {data.wikipedia[0].name}{data.wikipedia[1] ? ` as ${data.wikipedia[1].name} Captures ${Number(data.wikipedia[1].views).toLocaleString()} Views` : ""}
                    </h2>
                    {data.wikipedia[2] && (
                      <p style={{ fontFamily: serif, fontSize: 14, fontStyle: "italic", color: secondary, marginBottom: 10, lineHeight: 1.4 }}>
                        Cultural momentum builds around {data.wikipedia[2].name}{data.wikipedia[3] ? ` and ${data.wikipedia[3].name}` : ""} as digital audiences shift focus
                      </p>
                    )}
                    <p style={{ fontSize: 14, lineHeight: 1.65, color: ink }}>
                      <strong style={{ fontFamily: sans, fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase" }}>{regionLabel.toUpperCase().replace("THE ", "")} &mdash; </strong>
                      The world&rsquo;s digital attention is currently centred on <strong>{data.wikipedia[0].name}</strong>, which drew {Number(data.wikipedia[0].views).toLocaleString()} Wikipedia views in the past 24 hours.
                      {data.wikipedia[1] && <> Also commanding significant attention: <strong>{data.wikipedia[1].name}</strong> ({Number(data.wikipedia[1].views).toLocaleString()} views)</>}
                      {data.wikipedia[2] && <> and <strong>{data.wikipedia[2].name}</strong> ({Number(data.wikipedia[2].views).toLocaleString()} views)</>}.
                      {data.wikipedia.slice(3, 7).length > 0 && <> Further down the cultural ledger: {data.wikipedia.slice(3, 7).map((w) => w.name).join(", ")}.</>}
                    </p>
                  </>
                )}
              </div>

              {/* RIGHT RAIL — Platform Watch */}
              <div style={{ borderLeft: `1px solid ${rule}`, paddingLeft: 16 }}>
                <div style={{ fontFamily: sans, fontSize: 10, fontWeight: 600, letterSpacing: "0.15em", textTransform: "uppercase", color: secondary, marginBottom: 4 }}>
                  Platform Watch
                </div>
                <div style={{ fontSize: 11, color: secondary, marginBottom: 10, fontFamily: serif, fontStyle: "italic" }}>
                  Trending on YouTube &middot; {regionLabel}
                </div>
                {data.youtube.slice(0, 4).map((v, i) => (
                  <div key={i} style={{ borderBottom: `1px solid ${rule}`, paddingBottom: 8, marginBottom: 8 }}>
                    {v.thumbnail && (
                      <img src={v.thumbnail} alt="" style={{ width: "100%", height: 72, objectFit: "cover", filter: "grayscale(40%) contrast(1.1)", marginBottom: 4, borderRadius: 2 }} />
                    )}
                    <div style={{ fontFamily: serif, fontSize: 12, fontWeight: "bold", lineHeight: 1.3 }}>{v.title}</div>
                    <div style={{ fontSize: 10, color: secondary, marginTop: 2 }}>{v.channel} &middot; {Number(v.views).toLocaleString()} views</div>
                  </div>
                ))}
              </div>
            </div>

            {/* REGIONAL NEWS WIRE */}
            {data.gdelt.length > 0 && (
              <div style={{ borderTop: `1px solid ${rule}`, paddingTop: 14, marginBottom: 16 }}>
                <div style={{ fontFamily: sans, fontSize: 10, fontWeight: 600, letterSpacing: "0.15em", textTransform: "uppercase", color: secondary, marginBottom: 10 }}>
                  Regional News Wire
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 0 }} className="gazette-news-grid">
                  {data.gdelt.slice(0, 6).map((a, i) => (
                    <div key={i} style={{ padding: "0 12px", borderRight: i % 3 !== 2 ? `1px solid ${rule}` : "none", marginBottom: 12 }}>
                      <div style={{ fontFamily: serif, fontSize: 13, fontWeight: "bold", lineHeight: 1.3, marginBottom: 3 }}>{a.title}</div>
                      <div style={{ fontSize: 10, color: secondary }}>&mdash; {a.domain}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* PULL QUOTE */}
            <div style={{ borderTop: `1px solid ${rule}`, borderBottom: `1px solid ${rule}`, padding: "16px 32px", textAlign: "center", margin: "8px 0 16px" }}>
              <p style={{ fontFamily: serif, fontSize: 17, fontStyle: "italic", lineHeight: 1.5, color: ink }}>
                &ldquo;{quote.text}&rdquo;
              </p>
              <p style={{ fontFamily: sans, fontSize: 10, color: secondary, marginTop: 6, textTransform: "uppercase", letterSpacing: "0.1em" }}>
                &mdash; {quote.by}
              </p>
            </div>

            {/* EDITOR'S NOTE */}
            <div style={{ textAlign: "center", paddingTop: 4 }}>
              <div style={{ fontFamily: sans, fontSize: 10, fontWeight: 600, letterSpacing: "0.15em", textTransform: "uppercase", color: secondary, marginBottom: 6 }}>
                Editor&rsquo;s Note
              </div>
              <p style={{ fontFamily: serif, fontSize: 14, color: secondary, fontStyle: "italic" }}>
                Ready to create? Select a platform below to begin your trend scan.
              </p>
            </div>
          </>
        )}
      </div>

      {/* Responsive override */}
      <style>{`
        @media (max-width: 768px) {
          .gazette-grid { grid-template-columns: 1fr !important; }
          .gazette-grid > div:last-child { border-left: none !important; padding-left: 0 !important; border-top: 1px solid ${rule}; padding-top: 14px; margin-top: 8px; }
          .gazette-news-grid { grid-template-columns: 1fr !important; }
          .gazette-news-grid > div { border-right: none !important; }
        }
        @media (max-width: 480px) {
          .gazette-news-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}
