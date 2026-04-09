import { NextRequest, NextResponse } from "next/server"
import { getAuth } from "firebase-admin/auth"
import { loadContentProfile } from "@/lib/firestore/contentProfile"
import { getDb } from "@/lib/jobStore"

export const runtime = "nodejs"

export async function GET(req: NextRequest): Promise<NextResponse> {
  const uid = req.nextUrl.searchParams.get("uid")
  if (!uid) return NextResponse.json({ profile: null })

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

  // Non-admins can only read their own DNA
  if (callerUid !== uid) {
    const callerSnap = await db.doc(`users/${callerUid}`).get()
    const callerRole = (callerSnap.data() as { role?: string } | undefined)?.role
    if (callerRole !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
  }

  try {
    const profile = await loadContentProfile(uid)
    return NextResponse.json({ profile })
  } catch {
    return NextResponse.json({ profile: null })
  }
}
