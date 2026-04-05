"use client"
import { useState, useEffect } from "react"
import { useAuth } from "@/lib/AuthContext"
import { auth } from "@/lib/firebase"
import { useRouter } from "next/navigation"

const DISPLAY = "'Playfair Display', Georgia, serif"
const BODY = "'Libre Baskerville', Georgia, serif"
const TYPEWRITER = "'Special Elite', 'Courier New', monospace"

const ALL_PLATFORMS = [
  { id: "tiktok", name: "TikTok", icon: "\u266B", color: "#1A1A1A" },
  { id: "linkedin", name: "LinkedIn", icon: "in", color: "#0A66C2" },
  { id: "youtube", name: "YouTube", icon: "\u25B6", color: "#FF0000" },
  { id: "instagram", name: "Instagram", icon: "\uD83D\uDCF7", color: "#E4405F" },
  { id: "gmb", name: "Google Business", icon: "G", color: "#4285F4" },
]

interface SyncDNA { topics: string[]; tone: string; visualStyle: string; audioPreference: string; captionStyle: string; hashtags: string[]; contentSummary: string }
interface SyncResult { success: boolean; postsAnalyzed: number; platforms: string[]; dna: SyncDNA; confidence: string }

export default function AccountsPage() {
  const { user, profile } = useAuth()
  const router = useRouter()
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null)
  const [error, setError] = useState("")
  const [connectedPlatforms, setConnectedPlatforms] = useState<string[]>([])
  const [loadingPlatforms, setLoadingPlatforms] = useState(true)
  const [connecting, setConnecting] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  // Fetch actual connected platforms for this user
  useEffect(() => {
    if (!user) { setLoadingPlatforms(false); return }
    setLoadingPlatforms(true)
    fetch(`/api/accounts/status?uid=${user.uid}`)
      .then(r => r.json())
      .then(d => { setConnectedPlatforms(d.platforms || []); setLoadingPlatforms(false) })
      .catch(() => setLoadingPlatforms(false))
  }, [user, refreshKey])

  // Listen for window focus to refresh after returning from Ayrshare linking page
  useEffect(() => {
    const onFocus = () => setRefreshKey(k => k + 1)
    window.addEventListener("focus", onFocus)
    return () => window.removeEventListener("focus", onFocus)
  }, [])

  const handleConnect = async (platform?: string) => {
    if (!auth?.currentUser) { setError("Not signed in"); return }
    setConnecting(true)
    setError("")
    try {
      const idToken = await auth.currentUser.getIdToken(true)
      const res = await fetch("/api/accounts/connect", {
        method: "POST",
        headers: { Authorization: `Bearer ${idToken}`, "Content-Type": "application/json" },
        body: JSON.stringify(platform ? { platform } : {}),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      if (data.url) {
        window.open(data.url, "_blank")
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Connection failed")
    } finally {
      setConnecting(false)
    }
  }

  const handleSync = async () => {
    if (!user) return
    setSyncing(true)
    setError("")
    setSyncResult(null)
    try {
      const res = await fetch("/api/content-dna/auto-ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid: user.uid }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setSyncResult(data)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Sync failed")
    } finally {
      setSyncing(false)
    }
  }

  const hasAnyConnection = connectedPlatforms.length > 0

  return (
    <>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;0,900;1,400&family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&family=Special+Elite&display=swap');`}</style>
      <div style={{ minHeight: "100vh", backgroundColor: "#F4F1E4", padding: "36px 24px" }}>
        <div style={{ maxWidth: 660, margin: "0 auto" }}>
          <button onClick={() => router.push("/")} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: TYPEWRITER, fontSize: 11, color: "#8B7355" }}>&larr; Back to Gazette</button>
          <div style={{ fontFamily: DISPLAY, fontWeight: 900, fontSize: 26, color: "#1A1A1A", marginTop: 8, marginBottom: 4 }}>Linked Social Accounts</div>
          <div style={{ fontFamily: BODY, fontStyle: "italic", fontSize: 13, color: "#8B7355", marginBottom: 24 }}>
            {hasAnyConnection ? "Your connected accounts" : "Connect your accounts to auto-build your Content DNA from real post history"}
          </div>

          {/* Platform grid */}
          {loadingPlatforms ? (
            <div style={{ fontFamily: BODY, fontStyle: "italic", fontSize: 13, color: "#8B7355", textAlign: "center", padding: 24 }}>Checking connected accounts&hellip;</div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
              {ALL_PLATFORMS.map(p => {
                const isLinked = connectedPlatforms.includes(p.id)
                return (
                  <div key={p.id} onClick={() => !isLinked && !connecting && profile?.role !== "admin" && handleConnect(p.id)}
                    style={{ backgroundColor: "#FDFCF8", border: `1px solid ${isLinked ? "#3E2723" : "#C4B9A0"}`, padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: isLinked || profile?.role === "admin" ? "default" : "pointer", transition: "border-color 0.15s" }}
                    onMouseEnter={e => { if (!isLinked && profile?.role !== "admin") (e.currentTarget.style.borderColor = "#3E2723") }}
                    onMouseLeave={e => { if (!isLinked && profile?.role !== "admin") (e.currentTarget.style.borderColor = "#C4B9A0") }}>
                    <div>
                      <div style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 14, color: "#1A1A1A" }}>{p.name}</div>
                      <div style={{ fontFamily: "system-ui", fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: isLinked ? "#065F46" : "#8B7355", marginTop: 2 }}>
                        {isLinked ? "\u2713 Connected" : profile?.role === "admin" ? "Not connected" : "Click to connect"}
                      </div>
                    </div>
                    <div style={{ width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "system-ui", fontWeight: 700, fontSize: 16, color: isLinked ? p.color : "#C4B9A0", opacity: isLinked ? 1 : 0.4 }}>
                      {p.icon}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Sync button — only if user has connections */}
          {hasAnyConnection && (
            <>
              <button onClick={handleSync} disabled={syncing}
                style={{ width: "100%", padding: 13, backgroundColor: syncing ? "#8B7355" : "#3E2723", color: "#F4F1E4", border: "none", cursor: syncing ? "wait" : "pointer", fontFamily: DISPLAY, fontWeight: 700, fontSize: 15, letterSpacing: "0.03em" }}>
                {syncing ? "Analysing your posts\u2026" : "Sync & Build Content DNA"}
              </button>
              <div style={{ fontFamily: TYPEWRITER, fontSize: 10, color: "#8B7355", textAlign: "center", marginTop: 5 }}>
                Pulls your last posts from each linked platform and analyses them with AI
              </div>
            </>
          )}

          {/* Connect Accounts button — members only (admin uses primary profile) */}
          {profile?.role !== "admin" && (
            <>
              <button onClick={() => handleConnect()} disabled={connecting}
                style={{ width: "100%", padding: 13, backgroundColor: connecting ? "#8B7355" : hasAnyConnection ? "transparent" : "#3E2723", color: hasAnyConnection ? "#3E2723" : "#F4F1E4", border: hasAnyConnection ? "1px solid #C4B9A0" : "none", cursor: connecting ? "wait" : "pointer", fontFamily: DISPLAY, fontWeight: 700, fontSize: hasAnyConnection ? 13 : 15, letterSpacing: "0.03em", marginBottom: 4 }}>
                {connecting ? "Opening link page\u2026" : hasAnyConnection ? "Link more accounts" : "Connect Your Social Accounts"}
              </button>
              {!hasAnyConnection && (
                <div style={{ fontFamily: TYPEWRITER, fontSize: 10, color: "#8B7355", textAlign: "center", marginTop: 2, marginBottom: 12 }}>
                  Opens Ayrshare&rsquo;s secure linking page where you authenticate directly with each platform
                </div>
              )}
            </>
          )}

          {error && (
            <div style={{ marginTop: 12, padding: "9px 14px", backgroundColor: "#FEF2F2", border: "1px solid #FECACA", fontFamily: BODY, fontSize: 12, color: "#991B1B" }}>{error}</div>
          )}

          {syncResult && (
            <div style={{ marginTop: 16, backgroundColor: "#FDFCF8", border: "1px solid #C4B9A0", padding: "18px 22px" }}>
              <div style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 16, color: "#1A1A1A", marginBottom: 6 }}>{"\u2713"} Content DNA Updated</div>
              <div style={{ fontFamily: BODY, fontSize: 13, color: "#3E2723", lineHeight: 1.6 }}>
                Analysed <strong>{syncResult.postsAnalyzed}</strong> posts across <strong>{syncResult.platforms.join(", ")}</strong>.
                <br />Profile confidence: <strong>{syncResult.confidence}</strong>
              </div>
              {syncResult.dna && (
                <div style={{ marginTop: 12, display: "grid", gap: 7 }}>
                  {([
                    ["Topics", syncResult.dna.topics?.join(", ")],
                    ["Tone", syncResult.dna.tone],
                    ["Visual style", syncResult.dna.visualStyle],
                    ["Audio preference", syncResult.dna.audioPreference],
                    ["Caption style", syncResult.dna.captionStyle],
                    ["Hashtags", syncResult.dna.hashtags?.join(" ")],
                    ["Summary", syncResult.dna.contentSummary],
                  ] as [string, string | undefined][]).map(([label, value], i) => (
                    <div key={i} style={{ borderBottom: "1px dotted #C4B9A0", paddingBottom: 5 }}>
                      <div style={{ fontFamily: "system-ui", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8B7355", marginBottom: 1 }}>{label}</div>
                      <div style={{ fontFamily: BODY, fontSize: 12, color: "#1A1A1A" }}>{value || "\u2014"}</div>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
                <button onClick={() => router.push("/profile")} style={{ padding: "8px 18px", backgroundColor: "#3E2723", color: "#F4F1E4", border: "none", cursor: "pointer", fontFamily: DISPLAY, fontWeight: 700, fontSize: 12 }}>View my Content DNA</button>
                <button onClick={() => router.push("/")} style={{ padding: "8px 18px", backgroundColor: "transparent", color: "#3E2723", border: "1px solid #C4B9A0", cursor: "pointer", fontFamily: BODY, fontSize: 12 }}>Back to Gazette</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
