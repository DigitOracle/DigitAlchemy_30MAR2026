"use client"
import { useState, useEffect } from "react"

type WikiItem = { name: string; views: number }
type GdeltItem = { title: string; domain: string; url?: string }
type YoutubeItem = { title: string; channel: string; views: number; thumbnail: string }
type BriefingData = { wikipedia: WikiItem[]; gdelt: GdeltItem[]; youtube: YoutubeItem[]; regionLabel: string }

const QUOTES = [
  { text: "Attention is no longer just local \u2014 but local context still decides what spreads.", by: "The Editorial Desk" },
  { text: "The trend you catch today is the campaign your competitor posts tomorrow.", by: "The Editorial Desk" },
  { text: "Every viral moment is a cultural signal. The question is whether you read it in time.", by: "The Editorial Desk" },
]

const REGIONS = [
  { id: "AE", label: "the UAE" }, { id: "SA", label: "Saudi Arabia" }, { id: "KW", label: "Kuwait" },
  { id: "QA", label: "Qatar" }, { id: "US", label: "the United States" }, { id: "SG", label: "Singapore" },
]

// Deduplicate articles: if two titles share >80% words, keep only the first
function deduplicateArticles(articles: GdeltItem[]): GdeltItem[] {
  const result: GdeltItem[] = []
  for (const a of articles) {
    const words = new Set(a.title.toLowerCase().split(/\s+/))
    const isDupe = result.some((r) => {
      const rWords = r.title.toLowerCase().split(/\s+/)
      const overlap = rWords.filter((w) => words.has(w)).length
      return overlap / Math.max(rWords.length, words.size) > 0.8
    })
    if (!isDupe) result.push(a)
  }
  return result
}

// Filter out Wikipedia entries that look like artifacts
function cleanWikipedia(items: WikiItem[]): WikiItem[] {
  return items.filter((w) => !w.name.includes(".") && !w.name.startsWith("XXX") && w.name.length > 2 && !w.name.startsWith("List of"))
}

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

  const wiki = data ? cleanWikipedia(data.wikipedia) : []
  const gdelt = data ? deduplicateArticles(data.gdelt) : []

  const ink = "#1A1A1A"
  const rule = "#C4B9A0"
  const secondary = "#4A4A3A"
  const paper = "#F5F0E8"
  const serif = "Georgia, 'Times New Roman', serif"
  const sans = "system-ui, -apple-system, sans-serif"

  return (
    <div style={{ background: paper, color: ink, fontFamily: serif, borderRadius: 12, overflow: "hidden" }} className="mb-6 animate-fade-in">
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "20px 28px 16px" }}>

        {/* \u2500\u2500 MASTHEAD \u2500\u2500 */}
        <div style={{ textAlign: "center", borderBottom: `3px double ${ink}`, paddingBottom: 8, marginBottom: 4 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
            <select value={region} onChange={(e) => setRegion(e.target.value)}
              style={{ background: "transparent", border: `1px solid ${rule}`, borderRadius: 3, fontFamily: serif, fontSize: 11, color: secondary, cursor: "pointer", padding: "1px 4px" }}>
              {REGIONS.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
            </select>
            <span style={{ fontSize: 10, fontFamily: sans, color: secondary, textTransform: "uppercase", letterSpacing: "0.1em" }}>
              {edition} Edition
            </span>
          </div>
          <div style={{ fontSize: 9, letterSpacing: "0.3em", textTransform: "uppercase", color: secondary, fontFamily: sans }}>
            Est. 2026 &middot; DigitAlchemy&reg; Tech Limited
          </div>
          <div style={{ margin: "4px 0 2px" }}>
            <span style={{ fontFamily: serif, fontSize: 14, color: secondary, fontWeight: "normal" }}>The</span>{" "}
            <span style={{ fontFamily: sans, fontSize: 32, fontWeight: 800, color: ink, letterSpacing: "0.08em", textTransform: "uppercase" }}>DigitAlchemy</span>{" "}
            <span style={{ fontFamily: serif, fontSize: 28, fontStyle: "italic", color: ink }}>Gazette</span>
          </div>
          <div style={{ borderTop: `1px solid ${rule}`, borderBottom: `1px solid ${rule}`, padding: "2px 0", margin: "2px 0" }}>
            <span style={{ fontSize: 10, color: secondary, fontFamily: serif }}>
              {dayName}, {dateFormatted} &middot; {regionLabel} Edition &middot; Vol. 01 &middot; No. {dayOfYear}
            </span>
          </div>
        </div>

        {/* \u2500\u2500 LOADING \u2500\u2500 */}
        {loading && (
          <div style={{ textAlign: "center", padding: "40px 0" }}>
            <p style={{ fontStyle: "italic", color: secondary, fontSize: 15 }}>Composing today&rsquo;s edition&hellip;</p>
          </div>
        )}

        {/* \u2500\u2500 CONTENT \u2500\u2500 */}
        {!loading && data && (
          <>
            {/* Lead Story + Right Rail */}
            <div className="grid grid-cols-1 md:grid-cols-[1fr_260px] gap-4 mb-3" style={{ marginTop: 8 }}>
              {/* LEAD STORY */}
              <div>
                {wiki.length > 0 && (
                  <>
                    <h2 style={{ fontFamily: serif, fontSize: 22, fontWeight: "bold", lineHeight: 1.2, marginBottom: 4 }}>
                      Global Attention Turns to {wiki[0].name}{wiki[1] ? ` as ${wiki[1].name} Captures ${Number(wiki[1].views).toLocaleString()} Views` : ""}
                    </h2>
                    {wiki[2] && (
                      <p style={{ fontFamily: serif, fontSize: 13, fontStyle: "italic", color: secondary, marginBottom: 8, lineHeight: 1.4 }}>
                        Cultural momentum builds around {wiki[2].name}{wiki[3] ? ` and ${wiki[3].name}` : ""} as digital audiences shift focus
                      </p>
                    )}
                    <p style={{ fontSize: 13, lineHeight: 1.6, color: ink }}>
                      <strong style={{ fontFamily: sans, fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase" }}>{regionLabel.toUpperCase().replace("THE ", "")} &mdash; </strong>
                      The world&rsquo;s digital attention is currently centred on <strong>{wiki[0].name}</strong>, which drew {Number(wiki[0].views).toLocaleString()} Wikipedia views in the past 24 hours.
                      {wiki[1] && <> Also commanding significant attention: <strong>{wiki[1].name}</strong> ({Number(wiki[1].views).toLocaleString()} views)</>}
                      {wiki[2] && <> and <strong>{wiki[2].name}</strong> ({Number(wiki[2].views).toLocaleString()} views)</>}.
                      {wiki.slice(3, 7).length > 0 && <> Further down the cultural ledger: {wiki.slice(3, 7).map((w) => w.name).join(", ")}.</>}
                    </p>
                  </>
                )}
              </div>

              {/* RIGHT RAIL \u2014 Platform Watch */}
              <div className="md:border-l md:pl-3 border-t md:border-t-0 pt-2 md:pt-0 mt-1 md:mt-0" style={{ borderColor: rule }}>
                <div style={{ fontFamily: sans, fontSize: 9, fontWeight: 600, letterSpacing: "0.15em", textTransform: "uppercase", color: secondary, marginBottom: 3 }}>
                  Platform Watch
                </div>
                <div style={{ fontSize: 10, color: secondary, marginBottom: 6, fontFamily: serif, fontStyle: "italic" }}>
                  Trending on YouTube &middot; {regionLabel}
                </div>
                {data.youtube.slice(0, 4).map((v, i) => (
                  <div key={i} style={{ borderBottom: `1px solid ${rule}`, paddingBottom: 6, marginBottom: 6 }}>
                    {v.thumbnail && (
                      <img src={v.thumbnail} alt="" style={{ width: "100%", height: 64, objectFit: "cover", filter: "grayscale(60%) contrast(1.1)", marginBottom: 3, borderRadius: 1 }} />
                    )}
                    <div style={{ fontFamily: serif, fontSize: 11, fontWeight: "bold", lineHeight: 1.25 }}>{v.title}</div>
                    <div style={{ fontSize: 9, color: secondary, marginTop: 1 }}>{v.channel} &middot; {Number(v.views).toLocaleString()} views</div>
                  </div>
                ))}
              </div>
            </div>

            {/* REGIONAL NEWS WIRE */}
            {gdelt.length > 0 && (
              <div style={{ borderTop: `1px solid ${rule}`, paddingTop: 10, marginBottom: 10 }}>
                <div style={{ fontFamily: sans, fontSize: 9, fontWeight: 600, letterSpacing: "0.15em", textTransform: "uppercase", color: secondary, marginBottom: 8 }}>
                  Regional News Wire
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3">
                  {gdelt.slice(0, 6).map((a, i) => (
                    <div key={i} className="px-3 mb-2 md:border-r last:border-r-0" style={{ borderColor: i % 3 === 2 ? "transparent" : rule }}>
                      <div style={{ fontFamily: serif, fontSize: 12, fontWeight: "bold", lineHeight: 1.25, marginBottom: 2 }}>{a.title}</div>
                      <div style={{ fontSize: 9, color: secondary }}>&mdash; {a.domain}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* PULL QUOTE */}
            <div style={{ borderTop: `1px solid ${rule}`, borderBottom: `1px solid ${rule}`, padding: "12px 24px", textAlign: "center", margin: "4px 0 10px" }}>
              <p style={{ fontFamily: serif, fontSize: 15, fontStyle: "italic", lineHeight: 1.5, color: ink }}>
                &ldquo;{quote.text}&rdquo;
              </p>
              <p style={{ fontFamily: sans, fontSize: 9, color: secondary, marginTop: 4, textTransform: "uppercase", letterSpacing: "0.1em" }}>
                &mdash; {quote.by}
              </p>
            </div>

            {/* EDITOR\u2019S NOTE */}
            <div style={{ textAlign: "center", paddingTop: 2 }}>
              <div style={{ fontFamily: sans, fontSize: 9, fontWeight: 600, letterSpacing: "0.15em", textTransform: "uppercase", color: secondary, marginBottom: 4 }}>
                Editor&rsquo;s Note
              </div>
              <p style={{ fontFamily: serif, fontSize: 13, color: secondary, fontStyle: "italic" }}>
                Ready to create? Select a platform below to begin your trend scan.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
