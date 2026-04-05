"use client"
import { useState, useEffect } from "react"
import { auth, db } from "@/lib/firebase"
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth"
import { doc, setDoc, updateDoc } from "firebase/firestore"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/AuthContext"

const REGIONS = [
  { id: "AE", label: "UAE" }, { id: "SA", label: "Saudi Arabia" }, { id: "KW", label: "Kuwait" },
  { id: "QA", label: "Qatar" }, { id: "US", label: "United States" }, { id: "SG", label: "Singapore" },
]

const DISPLAY = "'Playfair Display', Georgia, serif"
const BODY = "'Libre Baskerville', Georgia, serif"
const TYPEWRITER = "'Special Elite', 'Courier New', monospace"

export default function AuthPage() {
  const [mode, setMode] = useState<"login" | "signup">("login")
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [region, setRegion] = useState("AE")
  const [error, setError] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const router = useRouter()
  const { user, loading } = useAuth()

  useEffect(() => {
    if (!loading && user) router.push("/")
  }, [user, loading, router])

  const hour = new Date().getHours()
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening"

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setSubmitting(true)
    try {
      if (!auth || !db) { setError("Authentication not configured"); setSubmitting(false); return }
      if (mode === "signup") {
        if (!name.trim()) { setError("Name is required"); setSubmitting(false); return }
        const cred = await createUserWithEmailAndPassword(auth, email, password)
        await setDoc(doc(db, "users", cred.user.uid), {
          uid: cred.user.uid,
          name: name.trim(),
          email,
          defaultRegion: region,
          createdAt: new Date().toISOString(),
          lastLogin: new Date().toISOString(),
        })
      } else {
        const cred = await signInWithEmailAndPassword(auth, email, password)
        await updateDoc(doc(db, "users", cred.user.uid), {
          lastLogin: new Date().toISOString(),
        }).catch(() => {})
      }
      router.push("/")
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message.replace("Firebase: ", "").replace(/\(auth\/.*\)/, "").trim() : "Something went wrong"
      setError(msg)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#F4F1E4" }}>
      <p style={{ fontFamily: BODY, fontSize: 16, color: "#5D4E37", fontStyle: "italic" }}>Loading&hellip;</p>
    </div>
  )
  if (user) return null

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "9px 11px", fontFamily: BODY, fontSize: 13,
    border: "1px solid #C4B9A0", background: "#FDFCF8", color: "#1A1A1A",
    outline: "none", boxSizing: "border-box",
  }
  const labelStyle: React.CSSProperties = {
    fontFamily: TYPEWRITER, fontSize: 10, textTransform: "uppercase",
    letterSpacing: "0.1em", color: "#8B7355", display: "block", marginBottom: 4,
  }

  return (
    <>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;0,900;1,400&family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&family=Special+Elite&display=swap');`}</style>
      <div style={{ minHeight: "100vh", backgroundColor: "#F4F1E4", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, position: "relative" }}>
        {/* Paper grain */}
        <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", opacity: 0.04, mixBlendMode: "multiply" }}>
          <filter id="authGrain"><feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves={3} stitchTiles="stitch" /><feColorMatrix type="saturate" values="0" /></filter>
          <rect width="100%" height="100%" filter="url(#authGrain)" />
        </svg>

        <div style={{ position: "relative", zIndex: 1, width: "100%", maxWidth: 400 }}>
          {/* Masthead */}
          <div style={{ textAlign: "center", marginBottom: 24 }}>
            <div style={{ fontSize: 12, color: "#8B7355", letterSpacing: "0.3em", marginBottom: 4 }}>{"\u2726 \u2726 \u2726"}</div>
            <div style={{ fontFamily: DISPLAY, fontWeight: 900, fontSize: 32, color: "#1A1A1A", letterSpacing: "0.04em" }}>DIGITALCHEMY</div>
            <div style={{ fontFamily: DISPLAY, fontSize: 18, fontStyle: "italic", color: "#3E2723", marginTop: -2 }}>Console</div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, margin: "8px 0" }}>
              <div style={{ flex: 1, maxWidth: 100, borderTop: "0.5px solid #C4B9A0" }} />
              <span style={{ fontSize: 8, color: "#8B7355" }}>{"\u2726"}</span>
              <div style={{ flex: 1, maxWidth: 100, borderTop: "0.5px solid #C4B9A0" }} />
            </div>
            <p style={{ fontFamily: BODY, fontStyle: "italic", fontSize: 14, color: "#5D4E37" }}>
              {greeting}.
            </p>
          </div>

          {/* Card */}
          <div style={{ background: "#FDFCF8", border: "1px solid #C4B9A0", padding: "28px 28px 24px" }}>
            <h2 style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 18, color: "#1A1A1A", marginBottom: 4, textAlign: "center" }}>
              {mode === "login" ? "Welcome back" : "Create your account"}
            </h2>
            <p style={{ fontFamily: BODY, fontSize: 12, color: "#8B7355", textAlign: "center", marginBottom: 20, fontStyle: "italic" }}>
              {mode === "login" ? "Sign in to your Console" : "Get your personalised daily briefing"}
            </p>

            {error && (
              <div style={{ fontFamily: BODY, fontSize: 12, color: "#8B0000", marginBottom: 14, textAlign: "center", padding: "8px 12px", border: "1px solid #dca0a0", background: "#fdf5f5" }}>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              {mode === "signup" && (
                <div style={{ marginBottom: 14 }}>
                  <label style={labelStyle}>Full Name</label>
                  <input type="text" value={name} onChange={e => setName(e.target.value)} required placeholder="Kendall Wilson" style={inputStyle} />
                </div>
              )}
              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>Email</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="you@company.com" style={inputStyle} />
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>Password</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6}
                  placeholder={mode === "signup" ? "Min 6 characters" : "Enter password"} style={inputStyle} />
              </div>
              {mode === "signup" && (
                <div style={{ marginBottom: 18 }}>
                  <label style={labelStyle}>Default Region</label>
                  <select value={region} onChange={e => setRegion(e.target.value)} style={inputStyle}>
                    {REGIONS.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
                  </select>
                </div>
              )}

              <button type="submit" disabled={submitting}
                style={{ width: "100%", padding: "11px 0", fontFamily: DISPLAY, fontWeight: 700, fontSize: 14, letterSpacing: "0.05em", color: "#FDFCF8", background: submitting ? "#8B7355" : "#3E2723", border: "none", cursor: submitting ? "default" : "pointer" }}>
                {submitting ? "Please wait\u2026" : mode === "login" ? "Sign In" : "Create Account"}
              </button>
            </form>

            <div style={{ textAlign: "center", marginTop: 16 }}>
              <button onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError("") }}
                style={{ fontFamily: BODY, fontSize: 12, color: "#8B7355", background: "none", border: "none", cursor: "pointer", textDecoration: "underline", textDecorationColor: "#C4B9A0", textUnderlineOffset: 3 }}>
                {mode === "login" ? "New here? Create an account" : "Already have an account? Sign in"}
              </button>
            </div>
          </div>

          <div style={{ textAlign: "center", marginTop: 16 }}>
            <span style={{ fontFamily: TYPEWRITER, fontSize: 9, color: "#8B7355", letterSpacing: "0.15em", textTransform: "uppercase" }}>
              DigitAlchemy&reg; Tech Limited &middot; Abu Dhabi
            </span>
          </div>
        </div>
      </div>
    </>
  )
}
