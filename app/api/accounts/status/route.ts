import { NextRequest, NextResponse } from "next/server"
import { getAyrshareConfig } from "@/lib/firestore/integrations"
import { getDb } from "@/lib/jobStore"

export const runtime = "nodejs"

export async function GET(req: NextRequest): Promise<NextResponse> {
  const uid = req.nextUrl.searchParams.get("uid")
  if (!uid) return NextResponse.json({ platforms: [] })

  const config = await getAyrshareConfig(uid)
  if (!config) return NextResponse.json({ platforms: [] })

  try {
    let platforms: string[] = []

    if (config.profileKey) {
      // Member: query GET /api/profiles and find their profile by refId/title
      // (GET /api/user with Profile-Key doesn't return activeSocialAccounts for child profiles)
      const res = await fetch("https://app.ayrshare.com/api/profiles", {
        headers: { Authorization: `Bearer ${config.apiKey}` },
        signal: AbortSignal.timeout(8000),
      })
      if (res.ok) {
        const data = await res.json()
        const profiles = (data.profiles || data) as { activeSocialAccounts?: string[]; profileKey?: string; refId?: string }[]
        if (Array.isArray(profiles)) {
          // Match by checking Firestore for refId
          const db = getDb()
          const integSnap = await db.doc(`users/${uid}/integrations/ayrshare`).get()
          const refId = integSnap.exists ? (integSnap.data()?.refId as string) : null
          const match = profiles.find(p => p.refId === refId)
          if (match?.activeSocialAccounts) {
            platforms = match.activeSocialAccounts
          }
        }
      }
    } else {
      // Admin: query primary profile directly
      const res = await fetch("https://app.ayrshare.com/api/user", {
        headers: { Authorization: `Bearer ${config.apiKey}` },
        signal: AbortSignal.timeout(8000),
      })
      if (res.ok) {
        const data = await res.json()
        platforms = (data.activeSocialAccounts as string[]) || []
      }
    }

    // Sync connected platforms back to Firestore
    if (platforms.length > 0) {
      const db = getDb()
      await db.doc(`users/${uid}`).update({ hasConnectedAccounts: true }).catch(() => {})
      await db.doc(`users/${uid}/integrations/ayrshare`).update({ platforms }).catch(() => {})
    }

    return NextResponse.json({ platforms })
  } catch {
    return NextResponse.json({ platforms: [] })
  }
}
