import { NextRequest, NextResponse } from "next/server"
import { getAyrshareConfig } from "@/lib/firestore/integrations"
import { getDb } from "@/lib/jobStore"

export const runtime = "nodejs"

export async function GET(req: NextRequest): Promise<NextResponse> {
  const uid = req.nextUrl.searchParams.get("uid")
  if (!uid) return NextResponse.json({ platforms: [] })

  console.log("[STATUS] Checking platforms for uid:", uid)

  const config = await getAyrshareConfig(uid)
  console.log("[STATUS] Config:", config ? { apiKey: config.apiKey.slice(0, 8) + "...", profileKey: config.profileKey?.slice(0, 8) + "..." } : "null")

  if (!config) return NextResponse.json({ platforms: [] })

  try {
    const headers: Record<string, string> = { Authorization: `Bearer ${config.apiKey}` }
    if (config.profileKey) headers["Profile-Key"] = config.profileKey

    console.log("[STATUS] Querying Ayrshare with Profile-Key:", config.profileKey ? "yes" : "no")

    const res = await fetch("https://app.ayrshare.com/api/user", {
      headers,
      signal: AbortSignal.timeout(8000),
    })

    const body = await res.text()
    console.log("[STATUS] Ayrshare response:", res.status, body.slice(0, 200))

    if (!res.ok) return NextResponse.json({ platforms: [] })
    const data = JSON.parse(body)
    const platforms = (data.activeSocialAccounts as string[]) || []

    // Sync connected platforms back to Firestore
    if (platforms.length > 0) {
      const db = getDb()
      await db.doc(`users/${uid}`).update({ hasConnectedAccounts: true }).catch(() => {})
      await db.doc(`users/${uid}/integrations/ayrshare`).update({ platforms }).catch(() => {})
    }

    return NextResponse.json({ platforms })
  } catch (e) {
    console.log("[STATUS] Error:", e)
    return NextResponse.json({ platforms: [] })
  }
}
