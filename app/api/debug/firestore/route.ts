import { NextResponse } from "next/server"
import { cert, getApps, initializeApp } from "firebase-admin/app"
import { getFirestore } from "firebase-admin/firestore"

export const runtime = "nodejs"

export async function GET() {
  const projectId = process.env.FIRESTORE_PROJECT_ID
  const clientEmail = process.env.FIRESTORE_CLIENT_EMAIL
  const rawKey = process.env.FIRESTORE_PRIVATE_KEY
  const privateKey = rawKey
    ?.replace(/\\n/g, "\n")           // Handle escaped \n
    ?.replace(/\\\\n/g, "\n")         // Handle double-escaped \\n
    ?.replace(/(\r\n|\r|\n)/g, "\n")  // Normalise line endings
    ?? ""

  const checks = {
    hasProjectId: !!projectId,
    hasClientEmail: !!clientEmail,
    hasPrivateKey: !!rawKey,
    keyLooksPem: !!privateKey?.includes("BEGIN PRIVATE KEY") || !!rawKey?.includes("BEGIN PRIVATE KEY"),
    appsAlreadyInit: getApps().length,
  }

  try {
    if (!getApps().length) {
      if (!projectId || !clientEmail || !privateKey) {
        throw new Error("Missing credentials: " + JSON.stringify(checks))
      }
      initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) })
    }

    const db = getFirestore()
    await db.collection("_health").doc("ping").set({ ts: new Date().toISOString() })

    return NextResponse.json({ ok: true, checks, firestoreWrite: true })
  } catch (err) {
    return NextResponse.json({
      ok: false,
      checks,
      error: err instanceof Error ? err.message : "Unknown"
    }, { status: 500 })
  }
}
