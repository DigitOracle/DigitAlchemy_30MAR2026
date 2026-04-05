import { NextRequest, NextResponse } from "next/server"
import { getAyrshareConfig } from "@/lib/firestore/integrations"

export const runtime = "nodejs"

export async function GET(req: NextRequest): Promise<NextResponse> {
  const uid = req.nextUrl.searchParams.get("uid")
  if (!uid) return NextResponse.json({ platforms: [] })

  const config = await getAyrshareConfig(uid)
  if (!config) return NextResponse.json({ platforms: [] })

  // Query Ayrshare for this user's actual connected platforms
  try {
    const headers: Record<string, string> = { Authorization: `Bearer ${config.apiKey}` }
    if (config.profileKey) headers["Profile-Key"] = config.profileKey

    const res = await fetch("https://app.ayrshare.com/api/user", {
      headers,
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return NextResponse.json({ platforms: [] })
    const data = await res.json()
    return NextResponse.json({ platforms: (data.activeSocialAccounts as string[]) || [] })
  } catch {
    return NextResponse.json({ platforms: [] })
  }
}
