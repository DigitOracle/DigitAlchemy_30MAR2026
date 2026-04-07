import { NextRequest, NextResponse } from "next/server"
import { getAuth } from "firebase-admin/auth"
import { getAyrshareConfig } from "@/lib/firestore/integrations"
import { getDb } from "@/lib/jobStore"

export const runtime = "nodejs"

export async function GET(req: NextRequest): Promise<NextResponse> {
  const uid = req.nextUrl.searchParams.get("uid")
  if (!uid) return NextResponse.json({ platforms: [] })

  // Require Firebase Auth
  const db = getDb()
  const authHeader = req.headers.get("authorization")
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 })
  }
  let callerUid: string
  try {
    const token = await getAuth().verifyIdToken(authHeader.slice(7))
    callerUid = token.uid
  } catch {
    return NextResponse.json({ error: "Invalid auth token" }, { status: 401 })
  }

  // Non-admins can only check their own accounts
  if (callerUid !== uid) {
    const callerSnap = await db.doc(`users/${callerUid}`).get()
    const callerRole = (callerSnap.data() as { role?: string } | undefined)?.role
    if (callerRole !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
  }

  const config = await getAyrshareConfig(uid)
  if (!config) return NextResponse.json({ platforms: [] })

  try {
    let platforms: string[] = []

    if (config.profileKey) {
      // Member: GET /api/user with Profile-Key can return stale data without activeSocialAccounts.
      // GET /api/profiles consistently includes activeSocialAccounts for all child profiles.
      const db = getDb()
      const integSnap = await db.doc(`users/${uid}/integrations/ayrshare`).get()
      const refId = integSnap.exists ? (integSnap.data()?.refId as string) : null

      const res = await fetch("https://app.ayrshare.com/api/profiles", {
        headers: { Authorization: `Bearer ${config.apiKey}` },
        signal: AbortSignal.timeout(10000),
      })
      if (res.ok) {
        const data = await res.json()
        const profiles = (data.profiles || []) as { activeSocialAccounts?: string[]; refId?: string }[]
        const match = profiles.find(p => p.refId === refId)
        if (match?.activeSocialAccounts) platforms = match.activeSocialAccounts
      }
    } else {
      // Admin: primary profile via GET /api/user (always has activeSocialAccounts)
      const res = await fetch("https://app.ayrshare.com/api/user", {
        headers: { Authorization: `Bearer ${config.apiKey}` },
        signal: AbortSignal.timeout(8000),
      })
      if (res.ok) {
        const data = await res.json()
        platforms = (data.activeSocialAccounts as string[]) || []
      }
    }

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
