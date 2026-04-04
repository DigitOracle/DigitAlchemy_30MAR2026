"use client"
import { useState } from "react"
import { auth, db } from "@/lib/firebase"
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth"
import { doc, setDoc, updateDoc } from "firebase/firestore"
import { useRouter } from "next/navigation"

const REGIONS = [
  { id: "AE", label: "UAE", flag: "\ud83c\udde6\ud83c\uddea" },
  { id: "SA", label: "Saudi Arabia", flag: "\ud83c\uddf8\ud83c\udde6" },
  { id: "KW", label: "Kuwait", flag: "\ud83c\uddf0\ud83c\uddfc" },
  { id: "QA", label: "Qatar", flag: "\ud83c\uddf6\ud83c\udde6" },
  { id: "US", label: "United States", flag: "\ud83c\uddfa\ud83c\uddf8" },
  { id: "SG", label: "Singapore", flag: "\ud83c\uddf8\ud83c\uddec" },
]

export default function AuthPage() {
  const [mode, setMode] = useState<"login" | "signup">("login")
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [region, setRegion] = useState("AE")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      if (mode === "signup") {
        const cred = await createUserWithEmailAndPassword(auth, email, password)
        await setDoc(doc(db, "users", cred.user.uid), {
          uid: cred.user.uid,
          name,
          email,
          defaultRegion: region,
          createdAt: new Date().toISOString(),
          lastLogin: new Date().toISOString(),
        })
      } else {
        const cred = await signInWithEmailAndPassword(auth, email, password)
        await updateDoc(doc(db, "users", cred.user.uid), {
          lastLogin: new Date().toISOString(),
        }).catch(() => { /* profile may not exist yet */ })
      }
      router.push("/")
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message.replace("Firebase: ", "") : "Something went wrong"
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  const hour = new Date().getHours()
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening"

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-[#190A46] text-white flex items-center justify-center text-xs font-bold">DA</div>
            <span className="text-lg font-semibold text-gray-900">DigitAlchemy&reg; Console</span>
          </div>
          <p className="text-sm text-gray-500">{greeting}</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-gray-900 mb-1">
            {mode === "signup" ? "Create your account" : "Welcome back"}
          </h2>
          <p className="text-sm text-gray-500 mb-5">
            {mode === "signup" ? "Get your personalised daily briefing" : "Sign in to your Console"}
          </p>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-lg text-sm text-red-700">{error}</div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "signup" && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Full name</label>
                <input type="text" required value={name} onChange={e => setName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-300"
                  placeholder="Kendall Wilson" />
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
              <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-300"
                placeholder="you@company.com" />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Password</label>
              <input type="password" required minLength={8} value={password} onChange={e => setPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-300"
                placeholder={mode === "signup" ? "Min 8 characters" : "Enter password"} />
            </div>

            {mode === "signup" && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Default region</label>
                <select value={region} onChange={e => setRegion(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-300 bg-white">
                  {REGIONS.map(r => <option key={r.id} value={r.id}>{r.flag} {r.label}</option>)}
                </select>
              </div>
            )}

            <button type="submit" disabled={loading}
              className="w-full py-2.5 bg-[#190A46] text-white rounded-lg text-sm font-medium hover:bg-[#2a1566] transition-colors disabled:opacity-50">
              {loading ? "Please wait..." : mode === "signup" ? "Create account" : "Sign in"}
            </button>
          </form>

          <p className="text-xs text-gray-500 text-center mt-4">
            {mode === "signup" ? "Already have an account? " : "Don\u2019t have an account? "}
            <button onClick={() => { setMode(mode === "signup" ? "login" : "signup"); setError("") }}
              className="text-[#534AB7] hover:underline font-medium">
              {mode === "signup" ? "Sign in" : "Create one"}
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}
