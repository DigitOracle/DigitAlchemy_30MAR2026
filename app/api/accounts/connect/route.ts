import { NextRequest, NextResponse } from "next/server"
import { getAuth } from "firebase-admin/auth"
import { getDb } from "@/lib/jobStore"

export const runtime = "nodejs"
export const maxDuration = 30

const AYRSHARE_API = "https://app.ayrshare.com/api"

export async function POST(req: NextRequest): Promise<NextResponse> {
  // Ensure Firebase Admin is initialized (getDb triggers init in jobStore.ts)
  const db = getDb()

  // Require Firebase ID token
  const authHeader = req.headers.get("authorization")
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 })
  }

  let uid: string
  try {
    const token = await getAuth().verifyIdToken(authHeader.slice(7))
    uid = token.uid
  } catch (err) {
    console.error("[ACCOUNTS] Token verification failed:", err)
    return NextResponse.json({ error: "Invalid auth token" }, { status: 401 })
  }

  const apiKey = process.env.AYRSHARE_API_KEY
  // Prefer base64 encoded key (avoids Vercel multiline env var issues), fall back to raw
  let privateKey: string | undefined
  if (process.env.AYRSHARE_PRIVATE_KEY_B64) {
    privateKey = Buffer.from(process.env.AYRSHARE_PRIVATE_KEY_B64, "base64").toString("utf-8")
  } else {
    privateKey = process.env.AYRSHARE_PRIVATE_KEY?.replace(/\\n/g, "\n").replace(/^["']|["']$/g, "").trim()
  }
  if (!apiKey) return NextResponse.json({ error: "Ayrshare not configured" }, { status: 500 })
  if (!privateKey) return NextResponse.json({ error: "Ayrshare private key not configured" }, { status: 500 })

  // Optional: specific platform to link
  let platform: string | null = null
  try {
    const body = await req.json().catch(() => ({}))
    platform = (body as Record<string, unknown>).platform as string || null
  } catch { /* no body is fine */ }

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

      const createBody = await createRes.text()
      console.log("[ACCOUNTS] Profile creation response:", createRes.status, createBody.slice(0, 300))

      const createData = JSON.parse(createBody)

      if (!createRes.ok) {
        // Handle duplicate profile (code 146) — retrieve existing profile key
        if (createData.code === 146) {
          console.log("[ACCOUNTS] Duplicate profile — fetching existing profiles to find key")
          const listRes = await fetch(`${AYRSHARE_API}/profiles`, {
            headers: { Authorization: `Bearer ${apiKey}` },
            signal: AbortSignal.timeout(10000),
          })
          if (listRes.ok) {
            const profiles = await listRes.json()
            const match = (Array.isArray(profiles) ? profiles : profiles.profiles || [])
              .find((p: Record<string, unknown>) => p.title === title)
            if (match?.profileKey) {
              profileKey = match.profileKey as string
              console.log("[ACCOUNTS] Found existing profile key:", profileKey.slice(0, 8) + "...")
            }
          }
          if (!profileKey) {
            return NextResponse.json({ error: "Duplicate profile exists but could not retrieve key" }, { status: 500 })
          }
        } else {
          return NextResponse.json({ error: "Failed to create social profile", details: createBody.slice(0, 200) }, { status: 500 })
        }
      } else {
        profileKey = createData.profileKey as string
      }

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

      console.log("[ACCOUNTS] Profile stored, key:", profileKey.slice(0, 8) + "...")
    }

    // Generate JWT link URL for social account linking
    console.log("[ACCOUNTS] Generating JWT URL for", uid)

    const jwtPayload: Record<string, unknown> = {
      domain: process.env.AYRSHARE_DOMAIN || "digitalchemy-console.vercel.app",
      privateKey,
      profileKey,
    }
    if (platform) jwtPayload.allowedSocial = [platform]

    console.log("[ACCOUNTS] JWT request — platform:", platform || "all", "profileKey:", profileKey?.slice(0, 8) + "...")

    const jwtRes = await fetch(`${AYRSHARE_API}/profiles/generateJWT`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(jwtPayload),
      signal: AbortSignal.timeout(10000),
    })

    const jwtBody = await jwtRes.text()
    console.log("[ACCOUNTS] JWT response:", jwtRes.status, jwtBody.slice(0, 300))
    if (!jwtRes.ok) {
      return NextResponse.json({ error: "Failed to generate linking URL", details: jwtBody.slice(0, 200) }, { status: 500 })
    }

    const jwtData = JSON.parse(jwtBody)
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
