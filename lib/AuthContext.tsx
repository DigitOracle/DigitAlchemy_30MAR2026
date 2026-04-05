"use client"
import { createContext, useContext, useEffect, useState, ReactNode } from "react"
import { auth, db } from "./firebase"
import { onAuthStateChanged, User } from "firebase/auth"
import { doc, getDoc, setDoc } from "firebase/firestore"

const ADMIN_EMAIL = "digitalabbot.io@gmail.com"

export interface UserProfile {
  uid: string
  name: string
  email: string
  defaultRegion: string
  role: "admin" | "member"
  hasConnectedAccounts: boolean
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
          let snap = await getDoc(doc(db, "users", firebaseUser.uid))

          // If doc not found, wait briefly for signup write to land, then retry
          if (!snap.exists()) {
            await new Promise(r => setTimeout(r, 2000))
            snap = await getDoc(doc(db, "users", firebaseUser.uid))
          }

          if (snap.exists()) {
            const data = snap.data() as UserProfile
            // Fix name if it looks like an email prefix
            if (data.name && data.name.includes("@") || (!data.name || data.name === "User" || data.name === data.email?.split("@")[0])) {
              const betterName = firebaseUser.displayName || data.name
              if (betterName && betterName !== data.name) {
                await setDoc(doc(db, "users", firebaseUser.uid), { name: betterName }, { merge: true })
                data.name = betterName
              }
            }
            // Ensure role exists (backfill for pre-multi-tenant docs)
            if (!data.role) {
              const role = (data.email || firebaseUser.email) === ADMIN_EMAIL ? "admin" : "member"
              const hasConnected = role === "admin"
              await setDoc(doc(db, "users", firebaseUser.uid), { role, hasConnectedAccounts: hasConnected }, { merge: true })
              data.role = role
              data.hasConnectedAccounts = hasConnected
            }
            setProfile(data)
          } else {
            // Truly missing — create with role
            const email = firebaseUser.email || ""
            const role = email === ADMIN_EMAIL ? "admin" : "member"
            const newProfile: UserProfile = {
              uid: firebaseUser.uid,
              name: firebaseUser.displayName || email.split("@")[0] || "User",
              email,
              defaultRegion: "AE",
              role,
              hasConnectedAccounts: role === "admin",
              createdAt: new Date().toISOString(),
              lastLogin: new Date().toISOString(),
            }
            try {
              await setDoc(doc(db, "users", firebaseUser.uid), newProfile)
              setProfile(newProfile)
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
