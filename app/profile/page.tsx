"use client"
import { useState, useEffect } from "react"
import { useAuth } from "@/lib/AuthContext"
import { useRouter } from "next/navigation"

const DISPLAY = "'Playfair Display', Georgia, serif"
const BODY = "'Libre Baskerville', Georgia, serif"
const TYPEWRITER = "'Special Elite', 'Courier New', monospace"

interface ProfileData {
  topics: string[]
  tone: string
  visualStyle: string
  audioPreference: string
  captionStyle: string
  hashtagPatterns: string[]
  sampleCount: number
  confidence: "low" | "medium" | "high"
}

export default function ProfilePage() {
  const { user, profile } = useAuth()
  const router = useRouter()
  const [contentProfile, setContentProfile] = useState<ProfileData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) { router.push("/auth"); return }
    fetch(`/api/content-dna/profile?uid=${user.uid}`)
      .then(r => r.json())
      .then(d => { setContentProfile(d.profile); setLoading(false) })
      .catch(() => setLoading(false))
  }, [user, router])

  return (
    <>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;0,900;1,400&family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&family=Special+Elite&display=swap');`}</style>
      <div style={{ minHeight: "100vh", backgroundColor: "#F4F1E4", padding: "36px 24px" }}>
        <div style={{ maxWidth: 660, margin: "0 auto" }}>
          <button onClick={() => router.push("/")} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: TYPEWRITER, fontSize: 11, color: "#8B7355" }}>&larr; Back to Gazette</button>
          <div style={{ fontFamily: DISPLAY, fontWeight: 900, fontSize: 26, color: "#1A1A1A", marginTop: 8 }}>My Content DNA</div>
          <div style={{ fontFamily: BODY, fontStyle: "italic", fontSize: 13, color: "#8B7355", marginBottom: 24 }}>
            {profile?.name}&rsquo;s content profile &mdash; built from {contentProfile?.sampleCount || 0} videos
          </div>

          {loading ? (
            <div style={{ fontFamily: BODY, fontStyle: "italic", fontSize: 14, color: "#8B7355", textAlign: "center", padding: 40 }}>Loading your content profile&hellip;</div>
          ) : !contentProfile ? (
            <div style={{ backgroundColor: "#FDFCF8", border: "1px solid #C4B9A0", padding: "36px 28px", textAlign: "center" }}>
              <div style={{ fontFamily: DISPLAY, fontSize: 18, color: "#3E2723", marginBottom: 6 }}>No Content DNA yet</div>
              <div style={{ fontFamily: BODY, fontStyle: "italic", fontSize: 13, color: "#8B7355", marginBottom: 18 }}>Upload 2&ndash;3 of your videos and we&rsquo;ll build your content profile</div>
              <button onClick={() => router.push("/upload")} style={{ padding: "9px 22px", backgroundColor: "#3E2723", color: "#F4F1E4", border: "none", cursor: "pointer", fontFamily: DISPLAY, fontWeight: 700, fontSize: 13 }}>Upload your first video</button>
            </div>
          ) : (
            <div style={{ backgroundColor: "#FDFCF8", border: "1px solid #C4B9A0", padding: "22px 28px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
                <div style={{ fontFamily: "system-ui", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8B7355" }}>Profile confidence</div>
                <div style={{
                  fontFamily: "system-ui", fontSize: 10, fontWeight: 700, textTransform: "uppercase", padding: "3px 10px",
                  backgroundColor: contentProfile.confidence === "high" ? "#ECFDF5" : contentProfile.confidence === "medium" ? "#FFFBEB" : "#F3F4F6",
                  color: contentProfile.confidence === "high" ? "#065F46" : contentProfile.confidence === "medium" ? "#92400E" : "#4B5563",
                }}>{contentProfile.confidence} &mdash; {contentProfile.sampleCount} videos</div>
              </div>
              {([
                ["Topics you cover", contentProfile.topics?.join(", ")],
                ["Your tone", contentProfile.tone],
                ["Visual style", contentProfile.visualStyle],
                ["Audio preference", contentProfile.audioPreference],
                ["Caption style", contentProfile.captionStyle],
                ["Your hashtags", contentProfile.hashtagPatterns?.join(" ")],
              ] as [string, string | undefined][]).map(([label, value], i) => (
                <div key={i} style={{ borderBottom: "1px dotted #C4B9A0", paddingBottom: 10, marginBottom: 10 }}>
                  <div style={{ fontFamily: "system-ui", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8B7355", marginBottom: 3 }}>{label}</div>
                  <div style={{ fontFamily: BODY, fontSize: 14, color: "#1A1A1A" }}>{value || "Not enough data yet"}</div>
                </div>
              ))}
              <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
                <button onClick={() => router.push("/upload")} style={{ padding: "9px 18px", backgroundColor: "#3E2723", color: "#F4F1E4", border: "none", cursor: "pointer", fontFamily: DISPLAY, fontWeight: 700, fontSize: 12 }}>Upload another video</button>
                <button onClick={() => router.push("/")} style={{ padding: "9px 18px", backgroundColor: "transparent", color: "#3E2723", border: "1px solid #C4B9A0", cursor: "pointer", fontFamily: BODY, fontSize: 12 }}>Back to Gazette</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
