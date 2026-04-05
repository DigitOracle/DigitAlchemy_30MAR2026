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
    const headers: Record<string, string> = { Authorization: `Bearer ${config.apiKey}` }
    if (config.profileKey) headers["Profile-Key"] = config.profileKey

    const res = await fetch("https://app.ayrshare.com/api/user", {
      headers,
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return NextResponse.json({ platforms: [] })
    const data = await res.json()
    const platforms = (data.activeSocialAccounts as string[]) || []

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
