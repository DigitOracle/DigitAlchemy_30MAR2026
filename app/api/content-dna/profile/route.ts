import { NextRequest, NextResponse } from "next/server"
import { loadContentProfile } from "@/lib/firestore/contentProfile"

export const runtime = "nodejs"

export async function GET(req: NextRequest): Promise<NextResponse> {
  const uid = req.nextUrl.searchParams.get("uid")
  if (!uid) return NextResponse.json({ profile: null })

  try {
    const profile = await loadContentProfile(uid)
    return NextResponse.json({ profile })
  } catch {
    return NextResponse.json({ profile: null })
  }
}
