"use client"
import { useState, useEffect } from "react"
import { PLATFORMS } from "@/config/platforms"

type PlatformStatus = Record<string, boolean>

export function OAuthStatusBanner() {
  const [status, setStatus] = useState<PlatformStatus | null>(null)

  useEffect(() => {
    fetch("/api/oauth/status")
      .then((r) => r.json())
      .then((data) => setStatus(data))
      .catch(() => {})
  }, [])

  if (!status) return null

  const connected = Object.entries(status).filter(([, v]) => v)
  if (connected.length === 0) return null

  return (
    <div className="bg-green-50 border border-green-100 rounded-lg px-4 py-2 flex items-center gap-3 flex-wrap">
      {connected.map(([platformId]) => {
        const config = PLATFORMS[platformId]
        return (
          <div key={platformId} className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-green-500" />
            <span className="text-xs text-green-700 font-medium">{config?.label ?? platformId} connected</span>
          </div>
        )
      })}
    </div>
  )
}
