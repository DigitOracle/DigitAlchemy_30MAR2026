"use client"
import { useState, useEffect } from "react"
import { useAuth } from "@/lib/AuthContext"
import { auth } from "@/lib/firebase"
import { useRouter } from "next/navigation"
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts"

const DISPLAY = "'Playfair Display', Georgia, serif"
const BODY = "'Libre Baskerville', Georgia, serif"
const TYPEWRITER = "'Special Elite', 'Courier New', monospace"

interface TimelineEntry { date: string; platform: string; engagement: number; views: number; text: string }
interface TopPost { platform: string; text: string; views: number; likes: number; comments: number; shares: number; engagement: number; date: string; postUrl: string }
interface DashStats { totalPosts: number; totalViews: number; totalLikes: number; totalComments: number; totalShares: number; totalEngagement: number; avgCompletion: number }
interface DashData { posts: number; stats: DashStats | null; timeline: TimelineEntry[]; topPosts: TopPost[] }

const PLATFORM_ICONS: Record<string, string> = { tiktok: "\u266B", linkedin: "in", youtube: "\u25B6" }
const PLATFORM_COLORS: Record<string, string> = { tiktok: "#1A1A1A", linkedin: "#0A66C2", youtube: "#FF0000" }

export default function DashboardPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [data, setData] = useState<DashData | null>(null)
  const [loading, setLoading] = useState(true)
  const [platformFilter, setPlatformFilter] = useState("all")
  const [rangeFilter, setRangeFilter] = useState("30")

  useEffect(() => {
    if (!user) { router.push("/auth"); return }
    setLoading(true)
    auth?.currentUser?.getIdToken().then(token => {
      fetch(`/api/dashboard?platform=${platformFilter}&range=${rangeFilter}&uid=${user?.uid || ""}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then(r => r.json())
        .then(d => { setData(d); setLoading(false) })
        .catch(() => setLoading(false))
    }).catch(() => setLoading(false))
  }, [user, router, platformFilter, rangeFilter])

  const chartData = data?.timeline ? (() => {
    const byDate = new Map<string, Record<string, number | string>>()
    for (const p of data.timeline) {
      if (!byDate.has(p.date)) byDate.set(p.date, { date: p.date, tiktok: 0, linkedin: 0, youtube: 0 })
      const entry = byDate.get(p.date)!
      entry[p.platform] = ((entry[p.platform] as number) || 0) + p.engagement
    }
    return [...byDate.values()].sort((a, b) => (a.date as string).localeCompare(b.date as string))
  })() : []

  return (
    <>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;0,900;1,400&family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&family=Special+Elite&display=swap');`}</style>
      <div style={{ minHeight: "100vh", backgroundColor: "#F4F1E4", padding: "36px 24px" }}>
        <div style={{ maxWidth: 880, margin: "0 auto" }}>
          <button onClick={() => router.push("/")} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: TYPEWRITER, fontSize: 11, color: "#8B7355" }}>&larr; Back to Gazette</button>
          <div style={{ fontFamily: DISPLAY, fontWeight: 900, fontSize: 26, color: "#1A1A1A", marginTop: 8 }}>Performance Dashboard</div>
          <div style={{ fontFamily: BODY, fontStyle: "italic", fontSize: 13, color: "#8B7355", marginBottom: 24 }}>Your social media performance across all linked platforms</div>

          {loading ? (
            <div style={{ textAlign: "center", padding: 40, fontFamily: BODY, fontStyle: "italic", color: "#8B7355" }}>Loading your performance data&hellip;</div>
          ) : !data?.stats ? (
            <div style={{ backgroundColor: "#FDFCF8", border: "1px solid #C4B9A0", padding: "36px 28px", textAlign: "center" }}>
              <div style={{ fontFamily: DISPLAY, fontSize: 18, color: "#3E2723", marginBottom: 6 }}>No data yet</div>
              <div style={{ fontFamily: BODY, fontStyle: "italic", fontSize: 13, color: "#8B7355", marginBottom: 14 }}>Link your social accounts and sync to see your performance</div>
              <button onClick={() => router.push("/accounts")} style={{ padding: "9px 22px", backgroundColor: "#3E2723", color: "#F4F1E4", border: "none", cursor: "pointer", fontFamily: DISPLAY, fontWeight: 700, fontSize: 13 }}>Link accounts</button>
            </div>
          ) : (
            <>
              {/* Stats cards */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12, marginBottom: 28 }}>
                {([
                  { label: "Total Posts", value: String(data.stats.totalPosts) },
                  { label: "Total Views", value: data.stats.totalViews.toLocaleString() },
                  { label: "Engagements", value: data.stats.totalEngagement.toLocaleString() },
                  { label: "Avg Completion", value: `${(data.stats.avgCompletion * 100).toFixed(0)}%` },
                ] as { label: string; value: string }[]).map((s, i) => (
                  <div key={i} style={{ backgroundColor: "#FDFCF8", border: "1px solid #C4B9A0", padding: "16px 12px", textAlign: "center" }}>
                    <div style={{ fontFamily: DISPLAY, fontWeight: 900, fontSize: 26, color: "#3E2723" }}>{s.value}</div>
                    <div style={{ fontFamily: TYPEWRITER, fontSize: 10, color: "#8B7355", textTransform: "uppercase", letterSpacing: "0.1em" }}>{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Filter subtitle */}
              <div style={{ fontFamily: TYPEWRITER, fontSize: 10, color: "#8B7355", textAlign: "center", marginBottom: 12 }}>
                Showing: {platformFilter === "all" ? "All platforms" : platformFilter} &middot; Last {rangeFilter === "365" ? "year" : `${rangeFilter} days`}
              </div>

              {/* Timeline chart */}
              <div style={{ backgroundColor: "#FDFCF8", border: "1px solid #C4B9A0", padding: "22px 18px", marginBottom: 28 }}>
                {/* Filter controls */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
                  <div style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 16, color: "#1A1A1A" }}>Performance Timeline</div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <div style={{ display: "flex", gap: 3 }}>
                      {(["all", "tiktok", "linkedin", "youtube"] as const).map(p => (
                        <button key={p} onClick={() => setPlatformFilter(p)}
                          style={{ padding: "3px 9px", fontFamily: TYPEWRITER, fontSize: 9, letterSpacing: "0.05em", textTransform: "uppercase", backgroundColor: platformFilter === p ? "#3E2723" : "transparent", color: platformFilter === p ? "#F4F1E4" : "#8B7355", border: `1px solid ${platformFilter === p ? "#3E2723" : "#C4B9A0"}`, cursor: "pointer" }}>
                          {p === "all" ? "All" : p}
                        </button>
                      ))}
                    </div>
                    <div style={{ display: "flex", gap: 3 }}>
                      {([["7", "7d"], ["14", "14d"], ["21", "21d"], ["30", "30d"], ["365", "1yr"]] as const).map(([id, label]) => (
                        <button key={id} onClick={() => setRangeFilter(id)}
                          style={{ padding: "3px 7px", fontFamily: TYPEWRITER, fontSize: 9, letterSpacing: "0.05em", backgroundColor: rangeFilter === id ? "#3E2723" : "transparent", color: rangeFilter === id ? "#F4F1E4" : "#8B7355", border: `1px solid ${rangeFilter === id ? "#3E2723" : "#C4B9A0"}`, cursor: "pointer" }}>
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={260}>
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E8E0D0" />
                      <XAxis dataKey="date" tick={{ fontFamily: "'Special Elite', cursive", fontSize: 10, fill: "#8B7355" }} />
                      <YAxis tick={{ fontFamily: "'Special Elite', cursive", fontSize: 10, fill: "#8B7355" }} />
                      <Tooltip contentStyle={{ backgroundColor: "#FDFCF8", border: "1px solid #C4B9A0", fontFamily: "'Libre Baskerville', serif", fontSize: 12 }} />
                      <Legend wrapperStyle={{ fontFamily: "'Special Elite', cursive", fontSize: 11 }} />
                      {(platformFilter === "all" || platformFilter === "tiktok") && <Line type="monotone" dataKey="tiktok" stroke="#1A1A1A" strokeWidth={2} name="TikTok" dot={{ r: 3 }} />}
                      {(platformFilter === "all" || platformFilter === "linkedin") && <Line type="monotone" dataKey="linkedin" stroke="#0A66C2" strokeWidth={2} name="LinkedIn" dot={{ r: 3 }} />}
                      {(platformFilter === "all" || platformFilter === "youtube") && <Line type="monotone" dataKey="youtube" stroke="#FF0000" strokeWidth={2} name="YouTube" dot={{ r: 3 }} />}
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div style={{ textAlign: "center", padding: "30px 0", fontFamily: BODY, fontStyle: "italic", fontSize: 13, color: "#8B7355" }}>
                    No posts in this time range.
                  </div>
                )}
              </div>

              {/* Top performers */}
              <div style={{ backgroundColor: "#FDFCF8", border: "1px solid #C4B9A0", padding: "22px 18px" }}>
                <div style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 16, color: "#1A1A1A", marginBottom: 14 }}>Top Performers</div>
                {data.topPosts.map((post, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderBottom: i < data.topPosts.length - 1 ? "1px dotted #C4B9A0" : "none" }}>
                    <div style={{ fontFamily: DISPLAY, fontWeight: 900, fontSize: 18, color: "#E8E0D0", width: 24, textAlign: "center", flexShrink: 0 }}>{i + 1}</div>
                    <div style={{ width: 26, height: 26, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "system-ui", fontWeight: 700, fontSize: 11, backgroundColor: PLATFORM_COLORS[post.platform] || "#888", color: "white", borderRadius: 3, flexShrink: 0 }}>
                      {PLATFORM_ICONS[post.platform] || "?"}
                    </div>
                    <div style={{ flex: 1, overflow: "hidden" }}>
                      <div style={{ fontFamily: BODY, fontSize: 12, color: "#1A1A1A", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{post.text || "Untitled post"}</div>
                      <div style={{ fontFamily: TYPEWRITER, fontSize: 9, color: "#8B7355", marginTop: 1 }}>{post.date}</div>
                    </div>
                    <div style={{ display: "flex", gap: 10, flexShrink: 0 }}>
                      {post.views > 0 && <div style={{ textAlign: "center" }}><div style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 12, color: "#3E2723" }}>{post.views.toLocaleString()}</div><div style={{ fontFamily: "system-ui", fontSize: 7, color: "#8B7355", textTransform: "uppercase" }}>views</div></div>}
                      <div style={{ textAlign: "center" }}><div style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 12, color: "#3E2723" }}>{post.likes}</div><div style={{ fontFamily: "system-ui", fontSize: 7, color: "#8B7355", textTransform: "uppercase" }}>likes</div></div>
                      <div style={{ textAlign: "center" }}><div style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 12, color: "#3E2723" }}>{post.comments}</div><div style={{ fontFamily: "system-ui", fontSize: 7, color: "#8B7355", textTransform: "uppercase" }}>comments</div></div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  )
}
