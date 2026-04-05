"use client"
import { useState, useEffect } from "react"
import { useAuth } from "@/lib/AuthContext"

type WikiItem = { name: string; views: number }
type GdeltItem = { title: string; domain: string; url?: string }
type YoutubeItem = { title: string; channel: string; views: number; thumbnail: string }
type BriefingData = { wikipedia: WikiItem[]; gdelt: GdeltItem[]; youtube: YoutubeItem[]; regionLabel: string }
type TickerData = { tiktok: string[]; instagram: string[]; youtube: string[] }
type TrendingSound = { title: string; author: string; rank: number; rankDiff: number; rankDiffType: number; cover: string | null; albumArt: string | null; spotifyUrl: string | null }
type AudioData = { sounds: TrendingSound[] }

const QUOTES = [
  { text: "Attention is no longer just local \u2014 but local context still decides what spreads.", by: "The Editorial Desk" },
  { text: "The trend you catch today is the campaign your competitor posts tomorrow.", by: "The Editorial Desk" },
  { text: "Every viral moment is a cultural signal. The question is whether you read it in time.", by: "The Editorial Desk" },
]

const REGIONS = [
  { id: "AE", label: "the UAE" }, { id: "SA", label: "Saudi Arabia" }, { id: "KW", label: "Kuwait" },
  { id: "QA", label: "Qatar" }, { id: "US", label: "the United States" }, { id: "SG", label: "Singapore" },
]

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

function cleanWikipedia(items: WikiItem[]): WikiItem[] {
  return items.filter((w) => !w.name.includes(".") && !w.name.startsWith("XXX") && w.name.length > 2 && !w.name.startsWith("List of"))
}

function buildRegionalNarrative(articles: GdeltItem[], regionLabel: string): string {
  if (articles.length === 0) return ""
  const top = articles.slice(0, 4)
  const lead = top[0]
  let n = `Across ${regionLabel}, the day\u2019s dominant story centres on developments reported by ${lead.domain}: ${lead.title}.`
  if (top.length > 1) n += ` Meanwhile, ${top[1].title.toLowerCase().startsWith("the") ? "" : "reports indicate "}${top[1].title} (${top[1].domain}).`
  if (top.length > 2) { n += ` Also drawing attention: ${top[2].title}`; if (top.length > 3) n += `, alongside coverage of ${top[3].title}`; n += "." }
  return n
}

// ── Platform SVG icons ──
function PlatformIcon({ platform, size = 12, style }: { platform: string; size?: number; style?: React.CSSProperties }) {
  const s = { display: "inline-block", verticalAlign: "middle", marginRight: 3, opacity: 0.7, ...style }
  if (platform === "tiktok") return <svg width={size} height={size} viewBox="0 0 24 24" fill="#1C1A17" style={s}><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1 0-5.78c.27 0 .54.04.79.1v-3.5a6.37 6.37 0 0 0-.79-.05A6.34 6.34 0 0 0 3.15 15.3a6.34 6.34 0 0 0 6.34 5.13 6.34 6.34 0 0 0 6.34-6.34V8.73a8.19 8.19 0 0 0 4.76 1.52v-3.4a4.85 4.85 0 0 1-1-.16z" /></svg>
  if (platform === "instagram") return <svg width={size} height={size} viewBox="0 0 24 24" fill="#7A5230" style={s}><path d="M12 2.16c2.67 0 2.99.01 4.04.06 2.43.11 3.54 1.24 3.65 3.65.05 1.05.06 1.37.06 4.04s-.01 2.99-.06 4.04c-.11 2.41-1.22 3.54-3.65 3.65-1.05.05-1.37.06-4.04.06s-2.99-.01-4.04-.06c-2.43-.11-3.54-1.24-3.65-3.65C4.26 14.9 4.25 14.58 4.25 11.91s.01-2.99.06-4.04c.11-2.41 1.22-3.54 3.65-3.65C9.01 4.17 9.33 4.16 12 4.16zM12 2c-2.72 0-3.06.01-4.12.06C4.7 2.2 3.2 3.7 3.06 6.88 3.01 7.94 3 8.28 3 11s.01 3.06.06 4.12c.14 3.18 1.64 4.68 4.82 4.82C8.94 19.99 9.28 20 12 20s3.06-.01 4.12-.06c3.18-.14 4.68-1.64 4.82-4.82.05-1.06.06-1.4.06-4.12s-.01-3.06-.06-4.12C20.8 3.7 19.3 2.2 16.12 2.06 15.06 2.01 14.72 2 12 2zm0 4.86a5.14 5.14 0 1 0 0 10.28 5.14 5.14 0 0 0 0-10.28zM12 15a3 3 0 1 1 0-6 3 3 0 0 1 0 6zm5.84-9.16a1.2 1.2 0 1 0 0 2.4 1.2 1.2 0 0 0 0-2.4z" /></svg>
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="#8B0000" style={s}><path d="M23.5 6.19a3.02 3.02 0 0 0-2.12-2.14C19.54 3.5 12 3.5 12 3.5s-7.54 0-9.38.55A3.02 3.02 0 0 0 .5 6.19C0 8.04 0 12 0 12s0 3.96.5 5.81a3.02 3.02 0 0 0 2.12 2.14c1.84.55 9.38.55 9.38.55s7.54 0 9.38-.55a3.02 3.02 0 0 0 2.12-2.14C24 15.96 24 12 24 12s0-3.96-.5-5.81zM9.55 15.57V8.43L15.82 12l-6.27 3.57z" /></svg>
}

// ── Font stacks ──
const DISPLAY = "'Playfair Display', Georgia, 'Times New Roman', serif"
const BODY = "'Libre Baskerville', Georgia, 'Times New Roman', serif"
const TYPEWRITER = "'Special Elite', 'Courier New', monospace"
const LABEL = "'Franklin Gothic Medium', 'Arial Narrow', Arial, sans-serif"

// ── Colour palette ──
const INK = "#1A1A1A"
const RULE = "#C4B9A0"
const SEC = "#5D4E37"
const BROWN = "#3E2723"
const ACCENT = "#8B7355"
const PAPER_LIGHT = "#F4F1E4"
const PAPER_DARK = "#EBE5D4"

// ── Ornamental dividers ──
function ThickThinRule() { return <><div style={{ borderTop: `2.5px solid ${BROWN}` }} /><div style={{ borderTop: `0.5px solid ${BROWN}`, marginTop: 2 }} /></> }
function StarDivider() { return <div style={{ textAlign: "center", padding: "8px 0", color: RULE, fontSize: 11, letterSpacing: "0.5em" }}>{"\u2605 \u2605 \u2605"}</div> }
function DiamondDivider() { return <div style={{ textAlign: "center", padding: "6px 0" }}><span style={{ fontSize: 9, color: ACCENT, letterSpacing: "0.8em" }}>{"\u25C6 \u25C6 \u25C6"}</span></div> }
function WingRule() {
  return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, margin: "4px 0" }}>
    <div style={{ flex: 1, maxWidth: 180, borderTop: `0.5px solid ${RULE}` }} />
    <span style={{ fontSize: 9, color: ACCENT }}>{"\u2726"}</span>
    <div style={{ flex: 1, maxWidth: 180, borderTop: `0.5px solid ${RULE}` }} />
  </div>
}

// ── Post recommendation cards ──
function RecommendsSection({ posts, loading: isLoading }: {
  posts: { topic: string; caption: string; hashtags: string; audio: string; best_time: string; format: string }[]
  loading: boolean
  platform: string
}) {
  return (
    <div>
      {isLoading ? (
        <div style={{ fontFamily: BODY, fontStyle: "italic", fontSize: 13, color: ACCENT, padding: "16px 0" }}>
          Preparing your recommendations&hellip;
        </div>
      ) : posts.length === 0 ? (
        <div style={{ fontFamily: BODY, fontStyle: "italic", fontSize: 12, color: ACCENT, padding: "8px 0" }}>
          No recommendations available right now.
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14 }}>
          {posts.map((post, i) => (
            <div key={i} style={{ border: `1px solid ${RULE}`, padding: 14, backgroundColor: "#FDFCF8", position: "relative" }}>
              {/* Card number */}
              <div style={{ fontFamily: DISPLAY, fontWeight: 900, fontSize: 26, color: "#E8E0D0", position: "absolute", top: 6, right: 10, lineHeight: 1 }}>{i + 1}</div>

              {/* Topic */}
              <div style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 13, lineHeight: 1.3, color: INK, marginBottom: 6, paddingRight: 22 }}>{post.topic}</div>

              {/* Caption */}
              <div style={{ backgroundColor: PAPER_LIGHT, border: "1px solid #E8E0D0", padding: "7px 9px", marginBottom: 7, position: "relative" }}>
                <div style={{ fontFamily: BODY, fontSize: 11.5, lineHeight: 1.4, color: BROWN }}>{post.caption}</div>
                <button onClick={() => navigator.clipboard.writeText(post.caption)}
                  style={{ position: "absolute", top: 3, right: 3, fontFamily: LABEL, fontSize: 8, color: ACCENT, background: "none", border: "none", cursor: "pointer", padding: "1px 5px" }}>Copy</button>
              </div>

              {/* Hashtags */}
              <div style={{ marginBottom: 7 }}>
                <div style={{ fontFamily: LABEL, fontSize: 8, textTransform: "uppercase", letterSpacing: "0.1em", color: ACCENT, marginBottom: 3 }}>Hashtags</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
                  {(post.hashtags || "").split(/\s+/).filter(Boolean).map((tag, j) => (
                    <button key={j} onClick={() => navigator.clipboard.writeText(tag.startsWith("#") ? tag : `#${tag}`)}
                      style={{ fontFamily: BODY, fontSize: 10.5, color: BROWN, background: "none", border: `1px dotted ${RULE}`, padding: "1px 5px", cursor: "pointer" }}>
                      {tag.startsWith("#") ? tag : `#${tag}`}
                    </button>
                  ))}
                </div>
                <button onClick={() => navigator.clipboard.writeText(post.hashtags)}
                  style={{ fontFamily: LABEL, fontSize: 8, color: ACCENT, background: "none", border: "none", cursor: "pointer", marginTop: 3 }}>Copy all</button>
              </div>

              {/* Audio */}
              {post.audio && post.audio !== "Original audio" && (
                <div style={{ marginBottom: 5 }}>
                  <div style={{ fontFamily: LABEL, fontSize: 8, textTransform: "uppercase", letterSpacing: "0.1em", color: ACCENT, marginBottom: 2 }}>Audio</div>
                  <div style={{ fontFamily: BODY, fontSize: 10.5, color: BROWN }}>{"\u266B"} {post.audio}</div>
                </div>
              )}

              {/* Time + Format */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: `1px dotted ${RULE}`, paddingTop: 5, marginTop: 6 }}>
                <div style={{ fontFamily: TYPEWRITER, fontSize: 9, color: ACCENT }}>Post {post.best_time || "today"}</div>
                <div style={{ fontFamily: LABEL, fontSize: 8, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: BROWN, backgroundColor: "#E8E0D0", padding: "2px 7px" }}>{post.format || "Post"}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function MorningBriefing() {
  const { user, profile } = useAuth()
  const [mounted, setMounted] = useState(false)
  const [region, setRegion] = useState(profile?.defaultRegion || "AE")
  const [data, setData] = useState<BriefingData | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectorOpen, setSelectorOpen] = useState(false)
  const [tickerData, setTickerData] = useState<TickerData | null>(null)
  const [audioData, setAudioData] = useState<AudioData | null>(null)
  const [activeSection, setActiveSection] = useState<string>("briefing")
  const [hasContentDNA, setHasContentDNA] = useState(false)
  type RecPost = { topic: string; caption: string; hashtags: string; audio: string; best_time: string; format: string }
  const [genericRecs, setGenericRecs] = useState<RecPost[]>([])
  const [personalRecs, setPersonalRecs] = useState<RecPost[]>([])
  const [recsLoading, setRecsLoading] = useState(false)

  const firstName = profile?.name?.split(" ")[0] || ""

  useEffect(() => { setMounted(true) }, [])
  useEffect(() => {
    if (profile?.defaultRegion && region === "AE" && profile.defaultRegion !== "AE") {
      setRegion(profile.defaultRegion)
    }
  }, [profile]) // eslint-disable-line react-hooks/exhaustive-deps

  // Check if user has Content DNA
  useEffect(() => {
    if (!user?.uid) return
    fetch(`/api/content-dna/profile?uid=${user.uid}`)
      .then(r => r.json())
      .then(d => setHasContentDNA(!!d.profile && d.profile.sampleCount > 0))
      .catch(() => {})
  }, [user])

  // Fetch recommendations when platform section is active (generic + personalised)
  useEffect(() => {
    const platformSections = ["tiktok", "instagram", "youtube"]
    if (!platformSections.includes(activeSection)) { setGenericRecs([]); setPersonalRecs([]); return }
    setRecsLoading(true)

    const genericUrl = `/api/post-recommendations?region=${region}&platform=${activeSection}`
    const personalUrl = user?.uid ? `${genericUrl}&uid=${user.uid}` : null

    const fetches = [fetch(genericUrl).then(r => r.json())]
    if (personalUrl && hasContentDNA) fetches.push(fetch(personalUrl).then(r => r.json()))

    Promise.allSettled(fetches).then(([genRes, perRes]) => {
      setGenericRecs(genRes.status === "fulfilled" ? genRes.value.posts ?? [] : [])
      setPersonalRecs(perRes?.status === "fulfilled" ? perRes.value.posts ?? [] : [])
      setRecsLoading(false)
    })
  }, [activeSection, region, user?.uid, hasContentDNA])

  useEffect(() => {
    setLoading(true)
    Promise.allSettled([
      fetch(`/api/morning-briefing?region=${region}`).then(r => r.json()),
      fetch(`/api/trend-ticker?region=${region}`).then(r => r.json()),
      fetch(`/api/trending-audio?region=${region}`).then(r => r.json()),
    ]).then(([briefing, ticker, audio]) => {
      if (briefing.status === "fulfilled") setData(briefing.value)
      if (ticker.status === "fulfilled") setTickerData(ticker.value)
      if (audio.status === "fulfilled") setAudioData(audio.value)
      setLoading(false)
    })
  }, [region])

  const wiki = data ? cleanWikipedia(data.wikipedia) : []
  const gdelt = data ? deduplicateArticles(data.gdelt) : []

  if (!mounted) return null

  const now = new Date()
  const dayName = now.toLocaleDateString("en-US", { weekday: "long" })
  const dateFmt = now.toLocaleDateString("en-US", { day: "numeric", month: "long", year: "numeric" })
  const dayOfYear = Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86400000)
  const hour = now.getHours()
  const edition = hour < 12 ? "Morning" : hour < 17 ? "Afternoon" : "Evening"
  const quote = QUOTES[dayOfYear % QUOTES.length]
  const regionObj = REGIONS.find(r => r.id === region)
  const regionLabel = data?.regionLabel || regionObj?.label || region
  const editionTag = (regionObj?.label || region).toUpperCase().replace("THE ", "")
  const sounds = audioData?.sounds ?? []
  const ttTags = tickerData?.tiktok ?? []
  const igTags = tickerData?.instagram ?? []
  const hasTickerData = ttTags.length > 0 || igTags.length > 0
  const tickerLoaded = tickerData !== null

  // Drop cap: split first letter from narrative
  const narrative = gdelt.length > 0 ? buildRegionalNarrative(gdelt, regionLabel) : ""
  const dropLetter = narrative.charAt(0)
  const narrativeRest = narrative.slice(1)

  // Two-row recommendations: generic + personalised
  function TwoRowRecommends({ platform }: { platform: string }) {
    return (
      <>
        {/* Row 1: Follow the Trend (generic) */}
        <div style={{ marginTop: 20, borderTop: `2px solid ${BROWN}`, paddingTop: 14 }}>
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "#8B0000", marginBottom: 2 }}>
              Follow the Trend
            </div>
            <div style={{ fontFamily: BODY, fontStyle: "italic", fontSize: 12, color: ACCENT }}>
              What&rsquo;s working on {platform} right now &mdash; for any creator.
            </div>
          </div>
          <RecommendsSection posts={genericRecs} loading={recsLoading} platform={platform} />
        </div>

        {/* Row 2: Stay in Your Lane (personalised) or DNA prompt */}
        {hasContentDNA ? (
          <div style={{ marginTop: 16 }}>
            <DiamondDivider />
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: BROWN, marginBottom: 2 }}>
                Stay in Your Lane
              </div>
              <div style={{ fontFamily: BODY, fontStyle: "italic", fontSize: 12, color: ACCENT }}>
                Personalised to your content style.
              </div>
            </div>
            <RecommendsSection posts={personalRecs} loading={recsLoading} platform={platform} />
          </div>
        ) : (
          <div style={{ marginTop: 16 }}>
            <DiamondDivider />
            <div style={{ textAlign: "center", padding: "12px 0" }}>
              <div style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: BROWN, marginBottom: 4 }}>
                Stay in Your Lane
              </div>
              <p style={{ fontFamily: BODY, fontStyle: "italic", fontSize: 12, color: ACCENT, margin: "0 0 10px" }}>
                Upload 2&ndash;3 of your videos to unlock personalised recommendations.
              </p>
              <button onClick={() => { window.location.href = "/upload" }}
                style={{ padding: "7px 18px", backgroundColor: BROWN, color: "#F4F1E4", border: "none", cursor: "pointer", fontFamily: DISPLAY, fontWeight: 700, fontSize: 11 }}>
                Build my Content DNA
              </button>
            </div>
          </div>
        )}
      </>
    )
  }

  return (
    <>
      {/* Google Fonts for Gazette */}
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;0,900;1,400&family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&family=Special+Elite&display=swap');`}</style>

      <div
        className="animate-fade-in"
        style={{
          backgroundColor: PAPER_LIGHT,
          backgroundImage: `repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(62,39,35,0.012) 2px,rgba(62,39,35,0.012) 4px),repeating-linear-gradient(90deg,transparent,transparent 2px,rgba(62,39,35,0.012) 2px,rgba(62,39,35,0.012) 4px)`,
          color: INK, fontFamily: BODY, borderRadius: 0, overflow: "hidden", position: "relative",
          borderTop: `3px solid ${INK}`, borderBottom: `3px solid ${INK}`,
        }}
      >
        {/* Paper grain */}
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 1, mixBlendMode: "multiply" }}>
          <svg width="100%" height="100%" style={{ opacity: 0.055 }}>
            <filter id="gazetteGrain"><feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves={3} stitchTiles="stitch" /><feColorMatrix type="saturate" values="0" /></filter>
            <rect width="100%" height="100%" filter="url(#gazetteGrain)" />
          </svg>
        </div>
        {/* Ink unevenness */}
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 1, mixBlendMode: "multiply" }}>
          <svg width="100%" height="100%" style={{ opacity: 0.02 }}>
            <filter id="gazetteInk"><feTurbulence type="turbulence" baseFrequency="0.015" numOctaves={2} seed={42} /><feColorMatrix type="saturate" values="0" /></filter>
            <rect width="100%" height="100%" filter="url(#gazetteInk)" />
          </svg>
        </div>
        {/* Vignette */}
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 2, background: `radial-gradient(ellipse at center, transparent 60%, rgba(62,39,35,0.07) 100%)` }} />

        <div style={{ maxWidth: 920, margin: "0 auto", padding: "10px 20px 8px", position: "relative", zIndex: 3 }}>

          {/* ── SECTION NAV ── */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 2, padding: "6px 0", borderBottom: `2px solid ${BROWN}`, borderTop: `0.5px solid ${RULE}`, flexWrap: "wrap" }}>
            {([
              { id: "briefing", label: "Front Page" },
              { id: "tiktok", label: "TikTok", icon: "tiktok" as const },
              { id: "instagram", label: "Instagram", icon: "instagram" as const },
              { id: "youtube", label: "YouTube", icon: "youtube" as const },
              { id: "news", label: "News Wire" },
              { id: "culture", label: "Culture" },
              { id: "deepdive", label: "Deep Dive \u2192" },
            ] as const).map(sec => (
              <button key={sec.id}
                onClick={() => {
                  if (sec.id === "deepdive") { document.getElementById("scan-setup")?.scrollIntoView({ behavior: "smooth" }); return }
                  setActiveSection(sec.id)
                }}
                style={{
                  fontFamily: DISPLAY, fontSize: 10.5, fontWeight: activeSection === sec.id ? 700 : 400,
                  letterSpacing: "0.08em", textTransform: "uppercase",
                  color: activeSection === sec.id ? BROWN : ACCENT,
                  background: "none", border: "none",
                  borderBottom: activeSection === sec.id ? `2px solid ${BROWN}` : "2px solid transparent",
                  padding: "3px 10px", cursor: "pointer", transition: "all 0.15s",
                  display: "inline-flex", alignItems: "center", gap: 3,
                }}>
                {"icon" in sec && sec.icon && <PlatformIcon platform={sec.icon} size={11} style={{ opacity: activeSection === sec.id ? 0.9 : 0.5, marginRight: 0 }} />}
                {sec.label}
              </button>
            ))}
            <span style={{ marginLeft: "auto", fontFamily: LABEL, fontSize: 8, color: ACCENT, textTransform: "uppercase", letterSpacing: "0.1em" }}>{edition} &middot; {editionTag}</span>
          </div>

          {/* ── MASTHEAD ── */}
          <div style={{ textAlign: "center", padding: "8px 0 4px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              {/* Left ear */}
              <div style={{ position: "relative", textAlign: "left", minWidth: 120 }}>
                <div style={{ fontFamily: LABEL, fontSize: 8, letterSpacing: "0.2em", textTransform: "uppercase", color: ACCENT }}>{editionTag} Edition</div>
                <button onClick={() => setSelectorOpen(!selectorOpen)}
                  style={{ fontFamily: BODY, fontSize: 9, color: ACCENT, background: "none", border: "none", cursor: "pointer", padding: 0, textDecoration: "underline", textDecorationColor: RULE, textUnderlineOffset: 2 }}>
                  Change &#9662;
                </button>
                {selectorOpen && (
                  <div style={{ position: "absolute", top: "100%", left: 0, marginTop: 2, background: PAPER_LIGHT, border: `1px solid ${RULE}`, zIndex: 20, minWidth: 140, textAlign: "left" }}>
                    {REGIONS.map(r => (
                      <div key={r.id} onClick={() => { setRegion(r.id); setSelectorOpen(false) }}
                        style={{ fontFamily: BODY, fontSize: 10, padding: "3px 8px", cursor: "pointer", color: r.id === region ? INK : SEC, fontWeight: r.id === region ? "bold" : "normal", borderBottom: `0.5px solid ${RULE}` }}
                        onMouseEnter={e => { (e.target as HTMLElement).style.background = "#DDD7C8" }}
                        onMouseLeave={e => { (e.target as HTMLElement).style.background = "transparent" }}
                      >{r.label}</div>
                    ))}
                  </div>
                )}
              </div>

              {/* Nameplate */}
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, color: ACCENT, letterSpacing: "0.3em", margin: "0 0 2px" }}>{"\u2726 \u2726 \u2726"}</div>
                <div style={{ fontFamily: LABEL, fontSize: 8, letterSpacing: "0.35em", textTransform: "uppercase", color: ACCENT }}>Est. 2026 &middot; DigitAlchemy&reg; Tech Limited &middot; Abu Dhabi</div>
                <WingRule />
                <div style={{ margin: "2px 0" }}>
                  <span style={{ fontFamily: BODY, fontSize: 16, fontStyle: "italic", color: SEC, fontWeight: 400 }}>The</span>{" "}
                  <span style={{ fontFamily: DISPLAY, fontWeight: 900, fontSize: 46, color: INK, letterSpacing: "0.04em", textShadow: "0.3px 0.3px 0px rgba(62,39,35,0.15)" }}>DIGITALCHEMY</span>
                </div>
                <div style={{ fontFamily: DISPLAY, fontSize: 28, fontStyle: "italic", fontWeight: 400, color: BROWN, marginTop: -6, letterSpacing: "0.06em" }}>Gazette</div>
              </div>

              {/* Right ear */}
              <div style={{ textAlign: "right", minWidth: 120 }}>
                <div style={{ fontFamily: LABEL, fontSize: 8, letterSpacing: "0.15em", textTransform: "uppercase", color: ACCENT }}>Vol. I &middot; No. {dayOfYear}</div>
                <div style={{ fontFamily: BODY, fontSize: 9, color: SEC }}>{dayName}</div>
              </div>
            </div>
          </div>

          {/* ── FOLIO ── */}
          <div style={{ fontFamily: TYPEWRITER, fontSize: 11, color: SEC, letterSpacing: "0.05em", display: "flex", justifyContent: "space-between", padding: "3px 0", margin: "2px 0 0" }}>
            <span>{dateFmt}</span>
            <span>{regionLabel} Edition</span>
            <span>Digital Intelligence for the Built World</span>
          </div>
          {/* Thick-thin rule below folio */}
          <div style={{ marginBottom: firstName ? 6 : 10 }}><ThickThinRule /></div>
          {firstName && (
            <div style={{ fontFamily: BODY, fontStyle: "italic", fontSize: 13, color: SEC, textAlign: "center", marginBottom: 8 }}>
              Prepared for {firstName}
            </div>
          )}

          {loading && (
            <div style={{ textAlign: "center", padding: "28px 0" }}>
              <p style={{ fontStyle: "italic", color: SEC, fontSize: 13 }}>Composing today&rsquo;s edition&hellip;</p>
            </div>
          )}

          {/* ════ CONTENT AREA ════ */}
          {!loading && data && (
            <>
              {/* ── FRONT PAGE (default briefing) ── */}
              {activeSection === "briefing" && (<>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 210px", gap: 0 }} className="gazette-grid">
                {/* ── LEAD STORY ── */}
                <div style={{ paddingRight: 16, borderRight: `1px solid ${RULE}` }}>
                  {gdelt.length > 0 ? (
                    <>
                      <div style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 11, letterSpacing: "0.15em", textTransform: "uppercase", color: BROWN, marginBottom: 3 }}>
                        Top Story &middot; {regionLabel}
                      </div>

                      {/* Headline with ink bleed */}
                      <h2 style={{ fontFamily: DISPLAY, fontSize: 28, fontWeight: 900, lineHeight: 1.12, margin: "0 0 4px", letterSpacing: "-0.01em", color: INK, textShadow: "0.3px 0.3px 0px rgba(62,39,35,0.15)" }}>
                        {gdelt[0].title}
                      </h2>

                      {/* Deck */}
                      {gdelt.length > 1 && (
                        <p style={{ fontFamily: BODY, fontSize: 14, fontStyle: "italic", color: SEC, margin: "0 0 6px", lineHeight: 1.4 }}>
                          {gdelt.slice(1, 3).map(a => a.title).join("; ")}
                        </p>
                      )}

                      {/* Byline */}
                      <div style={{ fontFamily: TYPEWRITER, fontSize: 9, textTransform: "uppercase", letterSpacing: "0.08em", color: ACCENT, marginBottom: 5, borderBottom: `0.5px solid ${RULE}`, paddingBottom: 3 }}>
                        By The DigitAlchemy Editorial Desk &middot; {editionTag}, {dateFmt}
                      </div>

                      {/* Body with drop cap */}
                      <p style={{ fontFamily: BODY, fontSize: 13, lineHeight: 1.55, color: INK, margin: "0 0 6px", textAlign: "justify", hyphens: "auto" } as React.CSSProperties}>
                        <span style={{ float: "left", fontFamily: DISPLAY, fontSize: 56, fontWeight: 900, lineHeight: 0.78, paddingRight: 5, paddingTop: 3, color: BROWN }}>
                          {dropLetter.toUpperCase()}
                        </span>
                        {narrativeRest}
                      </p>

                      {/* Secondary lead */}
                      {gdelt.length > 3 && (
                        <div style={{ borderTop: `0.5px solid ${RULE}`, paddingTop: 5, marginTop: 2 }}>
                          <h3 style={{ fontFamily: DISPLAY, fontSize: 16, fontWeight: 700, lineHeight: 1.15, margin: "0 0 2px" }}>{gdelt[3].title}</h3>
                          <p style={{ fontFamily: BODY, fontSize: 11.5, lineHeight: 1.4, color: SEC, margin: 0 }}>
                            <span style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase" }}>{gdelt[3].domain} &mdash; </span>
                            {gdelt[4] ? `Related developments include ${gdelt[4].title.toLowerCase()}.` : "Full coverage continues inside."}
                          </p>
                        </div>
                      )}

                      {/* ── TREND TICKER ── */}
                      {(hasTickerData || tickerLoaded) && (
                        <div style={{ borderTop: `0.5px solid ${RULE}`, borderBottom: `0.5px solid ${RULE}`, padding: "5px 0", margin: "8px 0 0" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                            <span style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 9, letterSpacing: "0.2em", textTransform: "uppercase", color: "#8B0000" }}>
                              {"\u2726"} Trend Ticker {"\u2726"}
                            </span>
                            <span style={{ fontFamily: LABEL, fontSize: 7, color: ACCENT, display: "inline-flex", alignItems: "center", gap: 2 }}>
                              <PlatformIcon platform="tiktok" size={10} style={{ marginRight: 0, opacity: 0.5 }} /><span>TikTok</span>
                              <span style={{ marginLeft: 5 }} /><PlatformIcon platform="instagram" size={10} style={{ marginRight: 0, opacity: 0.5 }} /><span>Instagram</span>
                            </span>
                          </div>
                          {hasTickerData ? (
                            <div style={{ display: "flex", flexWrap: "wrap", gap: "3px 10px", fontFamily: BODY, fontSize: 10.5, lineHeight: 1.8 }}>
                              {ttTags.map((tag, i) => <span key={`tt-${i}`}><PlatformIcon platform="tiktok" />{tag}</span>)}
                              {igTags.map((tag, i) => <span key={`ig-${i}`}><PlatformIcon platform="instagram" />{tag}</span>)}
                            </div>
                          ) : (
                            <div style={{ fontFamily: BODY, fontSize: 10, fontStyle: "italic", color: ACCENT }}>Trend data loading&hellip;</div>
                          )}
                        </div>
                      )}

                      {/* ── GLOBAL CURIOSITY INDEX ── */}
                      {wiki.length > 0 && (
                        <div style={{ border: `3px double ${BROWN}`, padding: "10px 14px 8px", marginTop: 10, position: "relative" }}>
                          <div style={{ textAlign: "center", fontFamily: DISPLAY, fontWeight: 700, fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: BROWN, marginBottom: 6 }}>
                            {"\u2726"} Global Curiosity Index {"\u2726"}
                          </div>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1px 14px" }}>
                            {wiki.slice(0, 8).map((w, i) => (
                              <div key={i} style={{ fontFamily: BODY, fontSize: 11, lineHeight: 1.35, borderBottom: `1px dotted ${RULE}`, paddingBottom: 2, marginBottom: 2 }}>
                                <strong>{w.name}</strong>
                                <span style={{ color: ACCENT, fontSize: 10 }}> &mdash; {Number(w.views).toLocaleString()}</span>
                              </div>
                            ))}
                          </div>
                          <div style={{ fontFamily: TYPEWRITER, fontSize: 8, color: ACCENT, textAlign: "right", marginTop: 4 }}>
                            Wikipedia &middot; Most-viewed worldwide &middot; Past 24 h
                          </div>
                        </div>
                      )}

                      {/* ── SOUNDS OF THE MOMENT ── */}
                      {sounds.length > 0 && (
                        <div style={{ marginTop: 10 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 6 }}>
                            <PlatformIcon platform="tiktok" size={14} style={{ opacity: 0.8, marginRight: 0 }} />
                            <span style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 10, letterSpacing: "0.15em", textTransform: "uppercase", color: BROWN }}>Sounds of the Moment</span>
                          </div>
                          <div style={{ display: "flex", gap: 12, overflowX: "auto" }}>
                            {sounds.slice(0, 5).map((s, i) => (
                              <div key={i} style={{ flexShrink: 0, width: 76, textAlign: "center" }}>
                                {(s.albumArt || s.cover) && (
                                  <img src={s.albumArt || s.cover || ""} alt=""
                                    style={{ width: 68, height: 68, objectFit: "cover", filter: "grayscale(40%) contrast(1.1) sepia(25%)", border: `1px solid ${RULE}`, display: "block", margin: "0 auto" }} />
                                )}
                                {s.rank > 0 && (
                                  <div style={{ fontFamily: LABEL, fontSize: 8, fontWeight: 700, color: "#8B0000", marginTop: 2 }}>
                                    #{s.rank}{s.rankDiffType === 1 ? " \u25B2" : s.rankDiffType === 2 ? " \u25BC" : ""}
                                  </div>
                                )}
                                <div style={{ fontFamily: BODY, fontSize: 9, fontWeight: 700, lineHeight: 1.2, marginTop: s.rank > 0 ? 1 : 3, color: INK, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.title}</div>
                                <div style={{ fontFamily: BODY, fontSize: 8, color: ACCENT, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.author}</div>
                              </div>
                            ))}
                          </div>
                          <div style={{ fontFamily: TYPEWRITER, fontSize: 8, color: ACCENT, marginTop: 4 }}>
                            Trending sounds &middot; ScrapeCreators live &middot; Album art via Spotify
                          </div>
                        </div>
                      )}
                    </>
                  ) : wiki.length > 0 ? (
                    <>
                      <h2 style={{ fontFamily: DISPLAY, fontSize: 28, fontWeight: 900, lineHeight: 1.12, margin: "0 0 4px", textShadow: "0.3px 0.3px 0px rgba(62,39,35,0.15)" }}>Global Attention Turns to {wiki[0].name}</h2>
                      <p style={{ fontFamily: BODY, fontSize: 13, lineHeight: 1.55, color: INK, margin: 0, textAlign: "justify" }}>
                        <span style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase" }}>{regionLabel.toUpperCase().replace("THE ", "")} &mdash; </span>
                        The world&rsquo;s digital attention is centred on <strong>{wiki[0].name}</strong> ({Number(wiki[0].views).toLocaleString()} views).
                        {wiki.slice(1, 4).map(w => ` ${w.name} (${Number(w.views).toLocaleString()})`).join(",")}.
                      </p>
                    </>
                  ) : null}
                </div>

                {/* ── RIGHT RAIL ── */}
                <div style={{ paddingLeft: 16, fontSize: 10 }}>
                  <div style={{ marginBottom: 4 }}>
                    <svg style={{ width: 80, filter: "grayscale(60%) sepia(30%)", opacity: 0.8, display: "block" }} viewBox="0 0 90 20" xmlns="http://www.w3.org/2000/svg">
                      <path d="M27.97 3.12c-.31-1.16-1.22-2.07-2.38-2.38C23.44 0 14.43 0 14.43 0S5.42 0 3.27.74C2.11 1.05 1.2 1.96.89 3.12 0 5.27 0 9.68 0 9.68s0 4.41.89 6.56c.31 1.16 1.22 2.07 2.38 2.38 2.15.74 11.16.74 11.16.74s9.01 0 11.16-.74c1.16-.31 2.07-1.22 2.38-2.38.89-2.15.89-6.56.89-6.56s0-4.41-.89-6.56z" fill="#FF0000"/>
                      <path d="M11.5 13.77l7.44-4.09-7.44-4.09v8.18z" fill="#FFF"/>
                      <text x="32" y="14" fontFamily="system-ui" fontSize="11" fontWeight="bold" fill="#1A1A1A">YouTube</text>
                    </svg>
                    <div style={{ fontFamily: BODY, fontSize: 9, color: SEC, fontStyle: "italic", marginTop: 2 }}>
                      Trending &middot; {regionLabel}
                    </div>
                  </div>
                  {data.youtube.slice(0, 3).map((v, i) => (
                    <div key={i} style={{ borderBottom: `0.5px solid ${RULE}`, paddingBottom: 4, marginBottom: 4 }}>
                      {v.thumbnail && (
                        <div style={{ position: "relative", marginBottom: 2 }}>
                          <img src={v.thumbnail} alt=""
                            style={{ width: "100%", height: 52, objectFit: "cover", filter: "grayscale(60%) contrast(1.15) sepia(15%)", display: "block", border: `1px solid ${RULE}`, transition: "filter 0.3s ease" }}
                            onMouseEnter={e => { (e.target as HTMLImageElement).style.filter = "grayscale(0%) contrast(1.0) sepia(0%)" }}
                            onMouseLeave={e => { (e.target as HTMLImageElement).style.filter = "grayscale(60%) contrast(1.15) sepia(15%)" }}
                          />
                        </div>
                      )}
                      <div style={{ fontFamily: BODY, fontSize: 10.5, fontWeight: 700, lineHeight: 1.2 }}>{v.title}</div>
                      <div style={{ fontFamily: TYPEWRITER, fontSize: 8, color: ACCENT, marginTop: 1 }}>{v.channel} &middot; {Number(v.views).toLocaleString()} views</div>
                    </div>
                  ))}
                  {data.youtube.length > 3 && (
                    <div style={{ borderTop: `0.5px solid ${RULE}`, paddingTop: 3, marginTop: 2 }}>
                      <div style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 8, letterSpacing: "0.15em", textTransform: "uppercase", color: BROWN, marginBottom: 2 }}>Also Trending</div>
                      {data.youtube.slice(3, 5).map((v, i) => (
                        <div key={i} style={{ marginBottom: 2 }}>
                          <div style={{ fontFamily: BODY, fontSize: 9.5, fontWeight: 700, lineHeight: 1.2 }}>{v.title}</div>
                          <div style={{ fontFamily: TYPEWRITER, fontSize: 7.5, color: ACCENT }}>{v.channel}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* ════ BELOW THE FOLD ════ */}

              {/* Regional News Wire */}
              {gdelt.length > 4 && (
                <>
                  <div style={{ marginTop: 8 }}><ThickThinRule /></div>
                  <div style={{ paddingTop: 6 }}>
                    <div style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", color: BROWN, marginBottom: 5 }}>
                      Regional News Wire &middot; {regionLabel}
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 0 }}>
                      {gdelt.slice(5, 11).map((a, i) => (
                        <div key={i} style={{
                          padding: "0 12px 5px", marginBottom: 5,
                          borderRight: (i % 3 !== 2) ? `0.5px solid ${RULE}` : "none",
                          borderBottom: `0.5px solid ${RULE}`,
                        }}>
                          <div style={{ fontFamily: BODY, fontSize: 11, fontWeight: 700, lineHeight: 1.2, marginBottom: 1 }}>{a.title}</div>
                          <div style={{ fontFamily: TYPEWRITER, fontSize: 8, color: ACCENT }}>{a.domain}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              </>)}

              {/* ── TIKTOK SECTION ── */}
              {activeSection === "tiktok" && (
                <div>
                  <div style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "#8B0000", marginBottom: 4 }}>
                    TikTok Intelligence &middot; {regionLabel}
                  </div>
                  <h2 style={{ fontFamily: DISPLAY, fontSize: 26, fontWeight: 900, lineHeight: 1.15, color: INK, marginBottom: 12, textShadow: "0.3px 0.3px 0px rgba(62,39,35,0.15)" }}>
                    What TikTok Is Talking About in {regionLabel}
                  </h2>
                  {ttTags.length > 0 ? (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "6px 24px", marginBottom: 20 }}>
                      {ttTags.map((tag, i) => (
                        <div key={i} style={{ fontFamily: BODY, fontSize: 14, fontWeight: 700, borderBottom: `1px dotted ${RULE}`, paddingBottom: 4, marginBottom: 4, color: INK }}>
                          {tag}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p style={{ fontFamily: BODY, fontStyle: "italic", fontSize: 13, color: ACCENT }}>No TikTok hashtag data available for this region.</p>
                  )}
                  {sounds.length > 0 && (
                    <>
                      <div style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: BROWN, marginBottom: 8 }}>
                        Sounds Driving TikTok &middot; {regionLabel}
                      </div>
                      <div style={{ display: "flex", gap: 14, overflowX: "auto", paddingBottom: 8 }}>
                        {sounds.map((s, i) => (
                          <div key={i} style={{ flexShrink: 0, width: 86, textAlign: "center" }}>
                            {(s.albumArt || s.cover) && <img src={s.albumArt || s.cover || ""} alt="" style={{ width: 78, height: 78, objectFit: "cover", filter: "grayscale(40%) contrast(1.1) sepia(20%)", border: `1px solid ${RULE}`, display: "block", margin: "0 auto" }} />}
                            {s.rank > 0 && <div style={{ fontFamily: LABEL, fontSize: 8, fontWeight: 700, color: "#8B0000", marginTop: 2 }}>#{s.rank}{s.rankDiffType === 1 ? " \u25B2" : s.rankDiffType === 2 ? " \u25BC" : ""}</div>}
                            <div style={{ fontFamily: BODY, fontSize: 10, fontWeight: 700, lineHeight: 1.2, marginTop: 2, color: INK, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.title}</div>
                            <div style={{ fontFamily: BODY, fontSize: 9, color: ACCENT, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.author}</div>
                          </div>
                        ))}
                      </div>
                      <div style={{ fontFamily: TYPEWRITER, fontSize: 8, color: ACCENT, marginTop: 4 }}>
                        Trending sounds &middot; ScrapeCreators live &middot; Album art via Spotify
                      </div>
                    </>
                  )}
                  <TwoRowRecommends platform="TikTok" />
                </div>
              )}

              {/* ── INSTAGRAM SECTION ── */}
              {activeSection === "instagram" && (
                <div>
                  <div style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "#7A5230", marginBottom: 4 }}>
                    Instagram Intelligence &middot; {regionLabel}
                  </div>
                  <h2 style={{ fontFamily: DISPLAY, fontSize: 26, fontWeight: 900, lineHeight: 1.15, color: INK, marginBottom: 12, textShadow: "0.3px 0.3px 0px rgba(62,39,35,0.15)" }}>
                    What Instagram Is Watching in {regionLabel}
                  </h2>
                  {igTags.length > 0 ? (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "6px 24px", marginBottom: 20 }}>
                      {igTags.map((tag, i) => (
                        <div key={i} style={{ fontFamily: BODY, fontSize: 14, fontWeight: 700, borderBottom: `1px dotted ${RULE}`, paddingBottom: 4, marginBottom: 4, color: INK }}>
                          {tag}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p style={{ fontFamily: BODY, fontStyle: "italic", fontSize: 13, color: ACCENT }}>No Instagram hashtag data available for this region.</p>
                  )}
                  <TwoRowRecommends platform="Instagram" />
                </div>
              )}

              {/* ── YOUTUBE SECTION ── */}
              {activeSection === "youtube" && (
                <div>
                  <div style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "#8B0000", marginBottom: 4 }}>
                    YouTube Intelligence &middot; {regionLabel}
                  </div>
                  <h2 style={{ fontFamily: DISPLAY, fontSize: 26, fontWeight: 900, lineHeight: 1.15, color: INK, marginBottom: 16, textShadow: "0.3px 0.3px 0px rgba(62,39,35,0.15)" }}>
                    Trending on YouTube &middot; {regionLabel}
                  </h2>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
                    {(data.youtube || []).map((v, i) => (
                      <div key={i} style={{ borderBottom: `1px solid ${RULE}`, paddingBottom: 12 }}>
                        {v.thumbnail && <img src={v.thumbnail} alt="" style={{ width: "100%", height: 140, objectFit: "cover", filter: "grayscale(50%) contrast(1.15) sepia(15%)", border: `1px solid ${RULE}`, marginBottom: 6, display: "block" }} />}
                        <div style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 14, lineHeight: 1.3, color: INK, marginBottom: 2 }}>{v.title}</div>
                        <div style={{ fontFamily: BODY, fontSize: 11, color: ACCENT }}>{v.channel} &middot; {Number(v.views).toLocaleString()} views</div>
                      </div>
                    ))}
                  </div>
                  <TwoRowRecommends platform="YouTube" />
                </div>
              )}

              {/* ── NEWS WIRE SECTION ── */}
              {activeSection === "news" && (
                <div>
                  <div style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: BROWN, marginBottom: 4 }}>
                    Regional News Wire &middot; {regionLabel}
                  </div>
                  <h2 style={{ fontFamily: DISPLAY, fontSize: 26, fontWeight: 900, lineHeight: 1.15, color: INK, marginBottom: 16, textShadow: "0.3px 0.3px 0px rgba(62,39,35,0.15)" }}>
                    From the {regionLabel} Desk
                  </h2>
                  <div style={{ columnCount: 2, columnGap: 32, columnRule: `0.5px solid ${RULE}` }}>
                    {gdelt.map((a, i) => (
                      <div key={i} style={{ breakInside: "avoid", marginBottom: 16 } as React.CSSProperties}>
                        <div style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 16, lineHeight: 1.3, color: INK, marginBottom: 4 }}>{a.title}</div>
                        <div style={{ fontFamily: TYPEWRITER, fontSize: 10, color: ACCENT, textTransform: "uppercase", letterSpacing: "0.05em" }}>&mdash; {a.domain}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── CULTURE SECTION ── */}
              {activeSection === "culture" && (
                <div>
                  <div style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: BROWN, marginBottom: 4 }}>
                    Global Cultural Pulse
                  </div>
                  <h2 style={{ fontFamily: DISPLAY, fontSize: 26, fontWeight: 900, lineHeight: 1.15, color: INK, marginBottom: 16, textShadow: "0.3px 0.3px 0px rgba(62,39,35,0.15)" }}>
                    What the World Is Curious About
                  </h2>
                  <div style={{ columnCount: 2, columnGap: 32, columnRule: `0.5px solid ${RULE}` }}>
                    {wiki.map((w, i) => (
                      <div key={i} style={{ breakInside: "avoid", marginBottom: 16 } as React.CSSProperties}>
                        <div style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 16, lineHeight: 1.3, color: INK }}>{w.name}</div>
                        <div style={{ fontFamily: BODY, fontSize: 12, color: SEC, marginTop: 2 }}>{Number(w.views).toLocaleString()} readers worldwide in the past 24 hours</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ fontFamily: TYPEWRITER, fontSize: 8, color: ACCENT, marginTop: 12 }}>
                    Source: Wikipedia &middot; Most-viewed articles &middot; Past 24 hours
                  </div>
                </div>
              )}

              {/* Pull quote — always visible */}
              <DiamondDivider />
              <div style={{ position: "relative", maxWidth: "65%", margin: "0 auto", padding: "4px 0", textAlign: "center" }}>
                <span style={{ position: "absolute", top: -12, left: -24, fontFamily: DISPLAY, fontSize: 60, color: RULE, lineHeight: 1, userSelect: "none" }}>&ldquo;</span>
                <p style={{ fontFamily: BODY, fontStyle: "italic", fontSize: 15, lineHeight: 1.5, color: BROWN, margin: 0 }}>
                  {quote.text}
                </p>
                <span style={{ fontFamily: TYPEWRITER, fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", color: ACCENT }}>
                  &mdash; {quote.by}
                </span>
              </div>

              {/* Editor's Note */}
              <StarDivider />
              <div style={{ textAlign: "center", padding: "0 0 2px" }}>
                <div style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 9, letterSpacing: "0.18em", textTransform: "uppercase", color: BROWN, marginBottom: 4 }}>From the Desk</div>
                {!hasContentDNA ? (
                  <>
                    <p style={{ fontFamily: BODY, fontSize: 12, color: SEC, fontStyle: "italic", margin: "0 0 10px" }}>
                      Want personalised recommendations? Upload 2&ndash;3 of your best videos and we&rsquo;ll learn your content style.
                    </p>
                    <button onClick={() => { window.location.href = "/upload" }}
                      style={{ padding: "7px 18px", backgroundColor: BROWN, color: "#F4F1E4", border: "none", cursor: "pointer", fontFamily: DISPLAY, fontWeight: 700, fontSize: 11 }}>
                      Build my Content DNA
                    </button>
                  </>
                ) : (
                  <p style={{ fontFamily: BODY, fontSize: 11, color: SEC, fontStyle: "italic", margin: 0 }}>
                    Ready to create? Select a platform above or click Deep Dive to run a full trend scan.
                  </p>
                )}
              </div>

              {/* End of edition */}
              <div style={{ textAlign: "center", padding: "12px 0 20px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 14 }}>
                  <div style={{ flex: 1, maxWidth: 120, borderTop: `0.5px solid ${RULE}` }} />
                  <span style={{ fontFamily: TYPEWRITER, fontSize: 9, letterSpacing: "0.2em", textTransform: "uppercase", color: ACCENT }}>
                    End of {edition} Edition
                  </span>
                  <div style={{ flex: 1, maxWidth: 120, borderTop: `0.5px solid ${RULE}` }} />
                </div>
                <div style={{ fontSize: 10, color: RULE, marginTop: 4 }}>{"\u2726"}</div>
              </div>
            </>
          )}
        </div>

        <div style={{ height: 48 }} />

        <style>{`
          @media (max-width: 700px) {
            .gazette-grid { grid-template-columns: 1fr !important; }
            .gazette-grid > div:first-child { border-right: none !important; padding-right: 0 !important; }
            .gazette-grid > div:last-child { padding-left: 0 !important; border-top: 0.5px solid ${RULE}; padding-top: 8px; margin-top: 6px; }
          }
        `}</style>
      </div>
    </>
  )
}
