"use client"
import { useState } from "react"
import { useAuth } from "@/lib/AuthContext"
import { auth } from "@/lib/firebase"
import { useRouter } from "next/navigation"

const DISPLAY = "'Playfair Display', Georgia, serif"
const BODY = "'Libre Baskerville', Georgia, serif"
const TYPEWRITER = "'Special Elite', 'Courier New', monospace"

export default function UploadPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [dnaResult, setDnaResult] = useState<Record<string, unknown> | null>(null)
  const [error, setError] = useState("")
  const [stage, setStage] = useState<"upload" | "analyzing" | "review" | "saving" | "saved">("upload")

  const handleUpload = async () => {
    if (!file || !user) return
    setUploading(true)
    setError("")
    setStage("analyzing")

    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("platform", "tiktok")

      const res = await fetch("/api/content-dna/analyze", { method: "POST", body: formData })
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error((d as Record<string, string>).error || "Analysis failed") }

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
        <div style={{ maxWidth: 560, width: "100%", backgroundColor: "#FDFCF8", border: "1px solid #C4B9A0", padding: "28px 36px" }}>
          <div style={{ textAlign: "center", marginBottom: 20 }}>
            <div style={{ fontFamily: DISPLAY, fontWeight: 900, fontSize: 22, color: "#1A1A1A" }}>Content DNA Analysis</div>
            <div style={{ fontFamily: BODY, fontStyle: "italic", fontSize: 12, color: "#8B7355", marginTop: 4 }}>Upload a video and we&rsquo;ll learn your content style</div>
          </div>

          {/* Upload */}
          {stage === "upload" && (
            <div>
              <div
                onDragOver={e => { e.preventDefault(); e.stopPropagation() }}
                onDrop={e => { e.preventDefault(); e.stopPropagation(); const f = e.dataTransfer.files[0]; if (f) setFile(f) }}
                onClick={() => document.getElementById("dnaFileInput")?.click()}
                style={{ border: "2px dashed #C4B9A0", padding: "36px 20px", textAlign: "center", cursor: "pointer", marginBottom: 14, backgroundColor: file ? "#F0EDE4" : "transparent" }}
              >
                <input id="dnaFileInput" type="file" accept="video/*" style={{ display: "none" }} onChange={e => setFile(e.target.files?.[0] || null)} />
                {file ? (
                  <>
                    <div style={{ fontFamily: BODY, fontSize: 14, fontWeight: 700, color: "#3E2723" }}>{file.name}</div>
                    <div style={{ fontFamily: TYPEWRITER, fontSize: 10, color: "#8B7355", marginTop: 4 }}>{(file.size / (1024 * 1024)).toFixed(1)} MB</div>
                  </>
                ) : (
                  <>
                    <div style={{ fontFamily: BODY, fontSize: 14, color: "#5D4E37" }}>Drop a video here or click to browse</div>
                    <div style={{ fontFamily: TYPEWRITER, fontSize: 10, color: "#8B7355", marginTop: 6 }}>MP4, MOV, or WebM &middot; Up to 25 MB</div>
                  </>
                )}
              </div>
              {error && <div style={{ padding: "7px 10px", backgroundColor: "#FEF2F2", border: "1px solid #FECACA", fontFamily: BODY, fontSize: 12, color: "#991B1B", marginBottom: 10 }}>{error}</div>}
              <button onClick={handleUpload} disabled={!file || uploading}
                style={{ width: "100%", padding: 11, backgroundColor: file ? "#3E2723" : "#C4B9A0", color: "#F4F1E4", border: "none", cursor: file ? "pointer" : "not-allowed", fontFamily: DISPLAY, fontWeight: 700, fontSize: 13, letterSpacing: "0.05em" }}>
                {uploading ? "Uploading\u2026" : "Analyse My Content"}
              </button>
              <button onClick={() => router.push("/")} style={{ display: "block", width: "100%", textAlign: "center", marginTop: 10, background: "none", border: "none", fontFamily: TYPEWRITER, fontSize: 11, color: "#8B7355", cursor: "pointer" }}>&larr; Back to Gazette</button>
            </div>
          )}

          {/* Analyzing */}
          {stage === "analyzing" && (
            <div style={{ textAlign: "center", padding: "36px 0" }}>
              <div style={{ fontFamily: DISPLAY, fontSize: 18, color: "#3E2723", marginBottom: 6 }}>Analysing your content&hellip;</div>
              <div style={{ fontFamily: BODY, fontStyle: "italic", fontSize: 12, color: "#8B7355" }}>Transcribing audio and extracting your content DNA</div>
            </div>
          )}

          {/* Review */}
          {stage === "review" && dnaResult && (
            <div>
              <div style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 16, color: "#1A1A1A", marginBottom: 3, textAlign: "center" }}>Here&rsquo;s what we learned</div>
              <div style={{ fontFamily: BODY, fontStyle: "italic", fontSize: 12, color: "#8B7355", marginBottom: 16, textAlign: "center" }}>Does this look right?</div>
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
                  <div key={i} style={{ borderBottom: "1px dotted #C4B9A0", paddingBottom: 6 }}>
                    <div style={{ fontFamily: "system-ui", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8B7355", marginBottom: 2 }}>{label}</div>
                    <div style={{ fontFamily: BODY, fontSize: 13, color: "#1A1A1A" }}>{value || "Not detected"}</div>
                  </div>
                ))}
              </div>
              {error && <div style={{ padding: "7px 10px", backgroundColor: "#FEF2F2", border: "1px solid #FECACA", fontFamily: BODY, fontSize: 12, color: "#991B1B", marginTop: 10 }}>{error}</div>}
              <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
                <button onClick={handleSave} style={{ flex: 1, padding: 11, backgroundColor: "#3E2723", color: "#F4F1E4", border: "none", cursor: "pointer", fontFamily: DISPLAY, fontWeight: 700, fontSize: 13 }}>
                  &#10003; Save to my profile
                </button>
                <button onClick={() => { setStage("upload"); setFile(null); setDnaResult(null); setError("") }} style={{ flex: 1, padding: 11, backgroundColor: "transparent", color: "#3E2723", border: "1px solid #C4B9A0", cursor: "pointer", fontFamily: BODY, fontSize: 13 }}>
                  &#10007; Try another video
                </button>
              </div>
            </div>
          )}

          {/* Saving */}
          {stage === "saving" && (
            <div style={{ textAlign: "center", padding: "36px 0" }}>
              <div style={{ fontFamily: DISPLAY, fontSize: 18, color: "#3E2723" }}>Saving your profile&hellip;</div>
            </div>
          )}

          {/* Saved */}
          {stage === "saved" && (
            <div style={{ textAlign: "center", padding: "30px 0" }}>
              <div style={{ fontSize: 28, marginBottom: 10 }}>&#10003;</div>
              <div style={{ fontFamily: DISPLAY, fontSize: 18, color: "#3E2723", marginBottom: 6 }}>Content DNA saved</div>
              <div style={{ fontFamily: BODY, fontStyle: "italic", fontSize: 12, color: "#8B7355", marginBottom: 20 }}>Your recommendations will now reflect your content style. Upload more videos to improve accuracy.</div>
              <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
                <button onClick={() => { setStage("upload"); setFile(null); setDnaResult(null) }} style={{ padding: "9px 20px", backgroundColor: "#3E2723", color: "#F4F1E4", border: "none", cursor: "pointer", fontFamily: DISPLAY, fontWeight: 700, fontSize: 12 }}>Upload another</button>
                <button onClick={() => router.push("/")} style={{ padding: "9px 20px", backgroundColor: "transparent", color: "#3E2723", border: "1px solid #C4B9A0", cursor: "pointer", fontFamily: BODY, fontSize: 12 }}>Back to Gazette</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
