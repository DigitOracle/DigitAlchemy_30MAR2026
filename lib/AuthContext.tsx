"use client"
import { createContext, useContext, useEffect, useState, ReactNode } from "react"
import { auth, db } from "./firebase"
import { onAuthStateChanged, User } from "firebase/auth"
import { doc, getDoc } from "firebase/firestore"

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
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser)
      if (firebaseUser) {
        const snap = await getDoc(doc(db, "users", firebaseUser.uid))
        if (snap.exists()) setProfile(snap.data() as UserProfile)
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
