"use client"
import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/AuthContext"
import { GazetteHeader } from "@/components/gazette/GazetteHeader"
import { TimeBanner } from "@/components/gazette/TimeBanner"
import { ModeSelector } from "@/components/gazette/ModeSelector"
import { GazetteTabs } from "@/components/gazette/GazetteTabs"
import type { GazetteMode } from "@/types/gazette-ui"

export default function GazettePage() {
  const { user, profile, loading } = useAuth()
  const router = useRouter()
  const [mode, setMode] = useState<GazetteMode>("REACT_NOW")

  useEffect(() => {
    if (!loading && !user) router.push("/auth")
  }, [user, loading, router])

  const handleModeChange = useCallback((m: GazetteMode) => setMode(m), [])

  if (loading || !user) return (
    <div style={{ background: "#0B0718", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <p style={{ color: "rgba(245,240,255,0.5)", fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 14, fontStyle: "italic" }}>Loading&hellip;</p>
    </div>
  )

  const region = profile?.defaultRegion || "AE"

  return (
    <main style={{ background: "#0B0718", minHeight: "100vh" }}>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700;900&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap" />
      <GazetteHeader />
      <TimeBanner region={region} />
      <ModeSelector onChange={handleModeChange} />
      <GazetteTabs userId={user.uid} mode={mode} />
    </main>
  )
}
