"use client"
import { createContext, useContext, useEffect, useState, ReactNode } from "react"
import { auth, db } from "./firebase"
import { onAuthStateChanged, User } from "firebase/auth"
import { doc, getDoc, setDoc } from "firebase/firestore"

interface UserProfile {
  uid: string
  name: string
  email: string
  defaultRegion: string
  defaultIndustry?: string
  defaultAudience?: string
  createdAt: string
  lastLogin: string
}

interface AuthContextType {
  user: User | null
  profile: UserProfile | null
  loading: boolean
}

const AuthContext = createContext<AuthContextType>({ user: null, profile: null, loading: true })

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!auth) { setLoading(false); return }
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser)
      if (firebaseUser && db) {
        try {
          console.log("[AUTH CTX] Fetching profile for", firebaseUser.uid)
          let snap = await getDoc(doc(db, "users", firebaseUser.uid))

          // If doc not found, wait briefly for signup write to land, then retry
          if (!snap.exists()) {
            console.log("[AUTH CTX] Doc not found — waiting 2s for signup write...")
            await new Promise(r => setTimeout(r, 2000))
            snap = await getDoc(doc(db, "users", firebaseUser.uid))
          }

          if (snap.exists()) {
            const data = snap.data() as UserProfile
            // Fix name if it looks like an email prefix and displayName is available
            if (data.name && data.name.includes("@") || (!data.name || data.name === "User" || data.name === data.email?.split("@")[0])) {
              const betterName = firebaseUser.displayName || data.name
              if (betterName && betterName !== data.name) {
                console.log("[AUTH CTX] Fixing name from", data.name, "to", betterName)
                await setDoc(doc(db, "users", firebaseUser.uid), { ...data, name: betterName }, { merge: true })
                data.name = betterName
              }
            }
            console.log("[AUTH CTX] Profile found:", data.name)
            setProfile(data)
          } else {
            // Truly missing — create fallback
            console.log("[AUTH CTX] No profile doc after retry — creating for", firebaseUser.uid)
            const fallbackProfile: UserProfile = {
              uid: firebaseUser.uid,
              name: firebaseUser.displayName || firebaseUser.email?.split("@")[0] || "User",
              email: firebaseUser.email || "",
              defaultRegion: "AE",
              createdAt: new Date().toISOString(),
              lastLogin: new Date().toISOString(),
            }
            try {
              await setDoc(doc(db, "users", firebaseUser.uid), fallbackProfile)
              console.log("[AUTH CTX] Profile created:", fallbackProfile.name)
              setProfile(fallbackProfile)
            } catch (writeErr) {
              console.error("[AUTH CTX] Failed to create profile:", writeErr)
              setProfile(null)
            }
          }
        } catch (err) {
          console.error("[AUTH CTX] Profile fetch error:", err)
          setProfile(null)
        }
      } else {
        setProfile(null)
      }
      setLoading(false)
    })
    return () => unsub()
  }, [])

  return (
    <AuthContext.Provider value={{ user, profile, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
