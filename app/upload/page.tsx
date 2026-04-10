"use client"
import { useState } from "react"
import { useAuth } from "@/lib/AuthContext"
import { app, auth } from "@/lib/firebase"
import { getStorage, ref, uploadBytes } from "firebase/storage"
import { useRouter } from "next/navigation"

const DISPLAY = "'Playfair Display', Georgia, serif"
const BODY = "'Libre Baskerville', Georgia, serif"
const TYPEWRITER = "'Special Elite', 'Courier New', monospace"
const BROWN = "#3E2723"
const ACCENT = "#8B7355"
const RULE = "#C4B9A0"

function isValidUrl(url: string): boolean {
  try {
    const u = new URL(url.trim())
    return u.protocol === "https:"
  } catch { return false }
}

export default function UploadPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [tab, setTab] = useState<"link" | "file">("link")
  const [url, setUrl] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [dnaResult, setDnaResult] = useState<Record<string, unknown> | null>(null)
  const [error, setError] = useState("")
  const [stage, setStage] = useState<"upload" | "analyzing" | "review" | "saving" | "saved">("upload")

  const urlValid = isValidUrl(url)

  // ── URL-based analysis ──
  const handleUrlAnalyze = async () => {
    if (!urlValid || !user) return
    setUploading(true)
    setError("")
    setStage("analyzing")
    try {
      const idToken = await auth?.currentUser?.getIdToken()
      const res = await fetch("/api/content-dna/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}) },
        body: JSON.stringify({ sourceUrl: url.trim() }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error((d as Record<string, string>).error || "Analysis failed. Check the URL and try again.")
      }
      const data = await res.json()
      setDnaResult(data.dna)
      setStage("review")
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong")
      setStage("upload")
    } finally {
      setUploading(false)
    }
  }

  // ── File-based analysis via Firebase Storage ──
  const handleFileUpload = async () => {
    if (!file || !user) return
    const MAX_BYTES = 200 * 1024 * 1024
    if (file.size > MAX_BYTES) {
      setError(`This file is ${(file.size / (1024 * 1024)).toFixed(1)} MB. Max 200 MB.`)
      return
    }
    setUploading(true)
    setError("")
    setStage("analyzing")
    try {
      // Wait for auth state to be ready
      await auth!.authStateReady()

      if (!auth!.currentUser) {
        setError("Please sign in to upload files")
        setStage("upload")
        setUploading(false)
        return
      }

      const storage = getStorage(app!)
      const storagePath = `dna-uploads/${user.uid}/${Date.now()}_${file.name}`
      const storageRef = ref(storage, storagePath)
      await uploadBytes(storageRef, file)

      const idToken = await auth?.currentUser?.getIdToken()
      const res = await fetch("/api/content-dna/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}) },
        body: JSON.stringify({ storagePath, platform: "tiktok" }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error((d as Record<string, string>).error || "Analysis failed.")
      }
      const data = await res.json()
      setDnaResult(data.dna)
      setStage("review")
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong")
      setStage("upload")
    } finally {
      setUploading(false)
    }
  }

  const handleSave = async () => {
    if (!dnaResult || !user) return
    setStage("saving")
    try {
      const idToken = await auth?.currentUser?.getIdToken()
      const res = await fetch("/api/content-dna/save", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}) },
        body: JSON.stringify({ uid: user.uid, dna: dnaResult, platform: "tiktok" }),
      })
      if (!res.ok) throw new Error("Save failed")
      setStage("saved")
    } catch {
      setError("Failed to save profile")
      setStage("review")
    }
  }

  return (
    <>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;0,900;1,400&family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&family=Special+Elite&display=swap');`}</style>
      <div style={{ minHeight: "100vh", backgroundColor: "#F4F1E4", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div style={{ maxWidth: 560, width: "100%", backgroundColor: "#FDFCF8", border: `1px solid ${RULE}`, padding: "28px 36px" }}>
          <div style={{ textAlign: "center", marginBottom: 16 }}>
            <div style={{ fontFamily: DISPLAY, fontWeight: 900, fontSize: 22, color: "#1A1A1A" }}>Content DNA Analysis</div>
            <div style={{ fontFamily: BODY, fontStyle: "italic", fontSize: 12, color: ACCENT, marginTop: 4 }}>Paste a link or upload a video &mdash; we&rsquo;ll learn your content style</div>
          </div>

          {stage === "upload" && (
            <div>
              {/* Tab switcher */}
              <div style={{ display: "flex", borderBottom: `2px solid ${BROWN}`, marginBottom: 16 }}>
                {(["link", "file"] as const).map(t => (
                  <button key={t} onClick={() => { setTab(t); setError("") }}
                    style={{
                      flex: 1, padding: "8px 0", fontFamily: DISPLAY, fontSize: 12, fontWeight: 700,
                      letterSpacing: "0.08em", textTransform: "uppercase", cursor: "pointer",
                      border: "none", borderBottom: tab === t ? `2px solid ${BROWN}` : "2px solid transparent",
                      backgroundColor: "transparent", color: tab === t ? BROWN : ACCENT,
                      marginBottom: -2,
                    }}>
                    {t === "link" ? "Paste Link" : "Upload File"}
                  </button>
                ))}
              </div>

              {/* Paste Link tab */}
              {tab === "link" && (
                <div>
                  <input
                    type="url"
                    value={url}
                    onChange={e => setUrl(e.target.value)}
                    placeholder="Paste YouTube, HeyGen, or direct video URL"
                    style={{
                      width: "100%", padding: "10px 12px", fontFamily: BODY, fontSize: 13,
                      border: `1px solid ${RULE}`, backgroundColor: "transparent", color: "#1A1A1A",
                      marginBottom: 10, boxSizing: "border-box",
                    }}
                  />
                  <div style={{ fontFamily: TYPEWRITER, fontSize: 9, color: ACCENT, marginBottom: 12 }}>
                    YouTube &middot; HeyGen &middot; Google Drive &middot; Direct .mp4/.mov/.webm links
                  </div>
                </div>
              )}

              {/* Upload File tab */}
              {tab === "file" && (
                <div>
                  <div
                    onDragOver={e => { e.preventDefault(); e.stopPropagation() }}
                    onDrop={e => { e.preventDefault(); e.stopPropagation(); const f = e.dataTransfer.files[0]; if (f) setFile(f) }}
                    onClick={() => document.getElementById("dnaFileInput")?.click()}
                    style={{ border: `2px dashed ${RULE}`, padding: "28px 20px", textAlign: "center", cursor: "pointer", marginBottom: 12, backgroundColor: file ? "#F0EDE4" : "transparent" }}
                  >
                    <input id="dnaFileInput" type="file" accept="video/*" style={{ display: "none" }} onChange={e => setFile(e.target.files?.[0] || null)} />
                    {file ? (
                      <>
                        <div style={{ fontFamily: BODY, fontSize: 13, fontWeight: 700, color: BROWN }}>{file.name}</div>
                        <div style={{ fontFamily: TYPEWRITER, fontSize: 10, color: ACCENT, marginTop: 4 }}>{(file.size / (1024 * 1024)).toFixed(1)} MB</div>
                      </>
                    ) : (
                      <>
                        <div style={{ fontFamily: BODY, fontSize: 13, color: "#5D4E37" }}>Drop a video here or click to browse</div>
                        <div style={{ fontFamily: TYPEWRITER, fontSize: 9, color: ACCENT, marginTop: 5 }}>MP4, MOV, or WebM &middot; Up to 200 MB</div>
                      </>
                    )}
                  </div>
                </div>
              )}

              {error && <div style={{ padding: "7px 10px", backgroundColor: "#FEF2F2", border: "1px solid #FECACA", fontFamily: BODY, fontSize: 12, color: "#991B1B", marginBottom: 10 }}>{error}</div>}

              <button
                onClick={tab === "link" ? handleUrlAnalyze : handleFileUpload}
                disabled={tab === "link" ? (!urlValid || uploading) : (!file || uploading)}
                style={{
                  width: "100%", padding: 11,
                  backgroundColor: (tab === "link" ? urlValid : !!file) ? BROWN : RULE,
                  color: "#F4F1E4", border: "none",
                  cursor: (tab === "link" ? urlValid : !!file) ? "pointer" : "not-allowed",
                  fontFamily: DISPLAY, fontWeight: 700, fontSize: 13, letterSpacing: "0.05em",
                }}>
                {uploading ? "Processing\u2026" : "Analyse My Content"}
              </button>
              <button onClick={() => router.push("/")} style={{ display: "block", width: "100%", textAlign: "center", marginTop: 10, background: "none", border: "none", fontFamily: TYPEWRITER, fontSize: 11, color: ACCENT, cursor: "pointer" }}>&larr; Back to Gazette</button>
            </div>
          )}

          {stage === "analyzing" && (
            <div style={{ textAlign: "center", padding: "36px 0" }}>
              <div style={{ fontFamily: DISPLAY, fontSize: 18, color: BROWN, marginBottom: 6 }}>Analysing your content&hellip;</div>
              <div style={{ fontFamily: BODY, fontStyle: "italic", fontSize: 12, color: ACCENT }}>Downloading, transcribing, and extracting your content DNA</div>
            </div>
          )}

          {stage === "review" && dnaResult && (
            <div>
              <div style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 16, color: "#1A1A1A", marginBottom: 3, textAlign: "center" }}>Here&rsquo;s what we learned</div>
              <div style={{ fontFamily: BODY, fontStyle: "italic", fontSize: 12, color: ACCENT, marginBottom: 16, textAlign: "center" }}>Does this look right?</div>
              <div style={{ display: "grid", gap: 10 }}>
                {([
                  ["Topics", (dnaResult.topics as string[])?.join(", ")],
                  ["Tone", dnaResult.tone as string],
                  ["Visual style", dnaResult.visualStyle as string],
                  ["Audio preference", dnaResult.audioPreference as string],
                  ["Caption style", dnaResult.captionStyle as string],
                  ["Hashtags", (dnaResult.hashtags as string[])?.join(" ")],
                  ["Summary", dnaResult.contentSummary as string],
                ] as [string, string | undefined][]).map(([label, value], i) => (
                  <div key={i} style={{ borderBottom: `1px dotted ${RULE}`, paddingBottom: 6 }}>
                    <div style={{ fontFamily: "system-ui", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.1em", color: ACCENT, marginBottom: 2 }}>{label}</div>
                    <div style={{ fontFamily: BODY, fontSize: 13, color: "#1A1A1A" }}>{value || "Not detected"}</div>
                  </div>
                ))}
              </div>
              {error && <div style={{ padding: "7px 10px", backgroundColor: "#FEF2F2", border: "1px solid #FECACA", fontFamily: BODY, fontSize: 12, color: "#991B1B", marginTop: 10 }}>{error}</div>}
              <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
                <button onClick={handleSave} style={{ flex: 1, padding: 11, backgroundColor: BROWN, color: "#F4F1E4", border: "none", cursor: "pointer", fontFamily: DISPLAY, fontWeight: 700, fontSize: 13 }}>&#10003; Save to my profile</button>
                <button onClick={() => { setStage("upload"); setFile(null); setUrl(""); setDnaResult(null); setError("") }} style={{ flex: 1, padding: 11, backgroundColor: "transparent", color: BROWN, border: `1px solid ${RULE}`, cursor: "pointer", fontFamily: BODY, fontSize: 13 }}>&#10007; Try another</button>
              </div>
            </div>
          )}

          {stage === "saving" && (
            <div style={{ textAlign: "center", padding: "36px 0" }}>
              <div style={{ fontFamily: DISPLAY, fontSize: 18, color: BROWN }}>Saving your profile&hellip;</div>
            </div>
          )}

          {stage === "saved" && (
            <div style={{ textAlign: "center", padding: "30px 0" }}>
              <div style={{ fontSize: 28, marginBottom: 10 }}>&#10003;</div>
              <div style={{ fontFamily: DISPLAY, fontSize: 18, color: BROWN, marginBottom: 6 }}>Content DNA saved</div>
              <div style={{ fontFamily: BODY, fontStyle: "italic", fontSize: 12, color: ACCENT, marginBottom: 20 }}>Your recommendations will now reflect your content style.</div>
              <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
                <button onClick={() => { setStage("upload"); setFile(null); setUrl(""); setDnaResult(null) }} style={{ padding: "9px 20px", backgroundColor: BROWN, color: "#F4F1E4", border: "none", cursor: "pointer", fontFamily: DISPLAY, fontWeight: 700, fontSize: 12 }}>Analyse another</button>
                <button onClick={() => router.push("/")} style={{ padding: "9px 20px", backgroundColor: "transparent", color: BROWN, border: `1px solid ${RULE}`, cursor: "pointer", fontFamily: BODY, fontSize: 12 }}>Back to Gazette</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
