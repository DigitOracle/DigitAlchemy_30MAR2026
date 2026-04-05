import { NextRequest, NextResponse } from "next/server"
import { getAuth } from "firebase-admin/auth"
import { getDb } from "@/lib/jobStore"

export const runtime = "nodejs"

const AYRSHARE_API = "https://app.ayrshare.com/api"

export async function POST(req: NextRequest): Promise<NextResponse> {
  // Require Firebase ID token
  const authHeader = req.headers.get("authorization")
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 })
  }

  let uid: string
  try {
    const token = await getAuth().verifyIdToken(authHeader.slice(7))
    uid = token.uid
  } catch {
    return NextResponse.json({ error: "Invalid auth token" }, { status: 401 })
  }

  const apiKey = process.env.AYRSHARE_API_KEY
  const privateKey = process.env.AYRSHARE_PRIVATE_KEY
  if (!apiKey) return NextResponse.json({ error: "Ayrshare not configured" }, { status: 500 })
  if (!privateKey) return NextResponse.json({ error: "Ayrshare private key not configured" }, { status: 500 })

  const db = getDb()

  try {
    // Check if user already has a profile key
    const integSnap = await db.doc(`users/${uid}/integrations/ayrshare`).get()
    let profileKey: string | null = integSnap.exists ? (integSnap.data()?.profileKey as string) || null : null

    // If no profile key, create a new Ayrshare profile for this user
    if (!profileKey) {
      const userSnap = await db.doc(`users/${uid}`).get()
      const userData = userSnap.data() as { name?: string; email?: string } | undefined
      const title = userData?.name || userData?.email || uid

      console.log("[ACCOUNTS] Creating Ayrshare profile for", uid, "title:", title)

      const createRes = await fetch(`${AYRSHARE_API}/profiles`, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
        signal: AbortSignal.timeout(10000),
      })

      if (!createRes.ok) {
        const err = await createRes.json().catch(() => ({}))
        console.error("[ACCOUNTS] Profile creation failed:", createRes.status, err)
        return NextResponse.json({ error: "Failed to create social profile" }, { status: 500 })
      }

      const createData = await createRes.json()
      profileKey = createData.profileKey as string
      const refId = (createData.refId as string) || ""

      if (!profileKey) {
        return NextResponse.json({ error: "No profile key returned from Ayrshare" }, { status: 500 })
      }

      // Store in Firestore
      await db.doc(`users/${uid}/integrations/ayrshare`).set({
        profileKey,
        refId,
        connectedAt: new Date().toISOString(),
        platforms: [],
      })

      console.log("[ACCOUNTS] Profile created, key:", profileKey.slice(0, 8) + "...")
    }

    // Generate JWT link URL for social account linking
    console.log("[ACCOUNTS] Generating JWT URL for", uid)

    const jwtRes = await fetch(`${AYRSHARE_API}/profiles/generateJWT`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        domain: process.env.AYRSHARE_DOMAIN || "digitalchemy-console.vercel.app",
        privateKey,
        profileKey,
      }),
      signal: AbortSignal.timeout(10000),
    })

    if (!jwtRes.ok) {
      const err = await jwtRes.json().catch(() => ({}))
      console.error("[ACCOUNTS] JWT generation failed:", jwtRes.status, err)
      return NextResponse.json({ error: "Failed to generate linking URL" }, { status: 500 })
    }

    const jwtData = await jwtRes.json()
    const url = jwtData.url as string

    if (!url) {
      return NextResponse.json({ error: "No linking URL returned" }, { status: 500 })
    }

    console.log("[ACCOUNTS] JWT URL generated for", uid)

    return NextResponse.json({ url, profileKey })
  } catch (err) {
    console.error("[ACCOUNTS] Connect error:", err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
