"use client"
import { useState, useEffect } from "react"
import { auth, db } from "@/lib/firebase"
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile, GoogleAuthProvider, signInWithPopup } from "firebase/auth"
import { doc, setDoc, updateDoc } from "firebase/firestore"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/AuthContext"

const REGIONS = [
  { id: "AE", label: "UAE" }, { id: "SA", label: "Saudi Arabia" }, { id: "KW", label: "Kuwait" },
  { id: "QA", label: "Qatar" }, { id: "US", label: "United States" }, { id: "SG", label: "Singapore" },
  { id: "IN", label: "India" },
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

  async function handleGoogle() {
    setError("")
    setSubmitting(true)
    try {
      if (!auth || !db) { setError("Authentication not configured"); setSubmitting(false); return }
      const provider = new GoogleAuthProvider()
      const cred = await signInWithPopup(auth, provider)
      const email = cred.user.email || ""
      const isAdmin = email === "digitalabbot.io@gmail.com"
      const snap = await import("firebase/firestore").then(m => m.getDoc(doc(db!, "users", cred.user.uid)))
      if (!snap.exists()) {
        await setDoc(doc(db, "users", cred.user.uid), {
          uid: cred.user.uid,
          name: cred.user.displayName || email.split("@")[0] || "User",
          email,
          defaultRegion: "AE",
          role: isAdmin ? "admin" : "member",
          hasConnectedAccounts: isAdmin,
          createdAt: new Date().toISOString(),
          lastLogin: new Date().toISOString(),
        })
      } else {
        await updateDoc(doc(db, "users", cred.user.uid), { lastLogin: new Date().toISOString() }).catch(() => {})
      }
      router.push("/")
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : ""
      if (msg.includes("popup-closed")) { setSubmitting(false); return }
      setError(msg.replace("Firebase: ", "").replace(/\(auth\/.*\)/, "").trim() || "Google sign-in failed")
    } finally {
      setSubmitting(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setSubmitting(true)
    try {
      if (!auth || !db) { setError("Authentication not configured"); setSubmitting(false); return }
      if (mode === "signup") {
        if (!name.trim()) { setError("Name is required"); setSubmitting(false); return }
        const cred = await createUserWithEmailAndPassword(auth, email, password)
        await updateProfile(cred.user, { displayName: name.trim() })
        const isAdmin = email === "digitalabbot.io@gmail.com"
        await setDoc(doc(db, "users", cred.user.uid), {
          uid: cred.user.uid,
          name: name.trim(),
          email,
          defaultRegion: region,
          role: isAdmin ? "admin" : "member",
          hasConnectedAccounts: isAdmin,
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
      const raw = err instanceof Error ? err.message : ""
      const code = raw.match(/\(auth\/([^)]+)\)/)?.[1] || ""
      const friendly: Record<string, string> = {
        "user-not-found": "No account found with this email. Please create an account.",
        "wrong-password": "Incorrect password. Please try again.",
        "invalid-credential": "Invalid credentials. Please check your email and password.",
        "too-many-requests": "Too many attempts. Please try again later.",
        "email-already-in-use": "An account with this email already exists. Please sign in.",
        "weak-password": "Password is too weak. Please use at least 6 characters.",
        "invalid-email": "Please enter a valid email address.",
      }
      setError(friendly[code] || raw.replace("Firebase: ", "").replace(/\(auth\/.*\)/, "").trim() || "Something went wrong")
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
                  <input type="text" value={name} onChange={e => setName(e.target.value)} required placeholder="Your full name" style={inputStyle} />
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

            <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "18px 0 14px" }}>
              <div style={{ flex: 1, borderTop: "0.5px solid #C4B9A0" }} />
              <span style={{ fontFamily: TYPEWRITER, fontSize: 9, color: "#8B7355", letterSpacing: "0.1em" }}>OR</span>
              <div style={{ flex: 1, borderTop: "0.5px solid #C4B9A0" }} />
            </div>

            <button onClick={handleGoogle} disabled={submitting}
              style={{ width: "100%", padding: "10px 0", fontFamily: BODY, fontSize: 13, fontWeight: 700, color: "#3E2723", background: "#FDFCF8", border: "1px solid #C4B9A0", cursor: submitting ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59A14.5 14.5 0 0 1 9.5 24c0-1.59.28-3.14.76-4.59l-7.98-6.19A23.9 23.9 0 0 0 0 24c0 3.77.9 7.34 2.56 10.52l7.97-5.93z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 5.93C6.51 42.62 14.62 48 24 48z"/></svg>
              Continue with Google
            </button>

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
