import { NextResponse } from "next/server"
import { cert, getApps, initializeApp } from "firebase-admin/app"
import { getFirestore } from "firebase-admin/firestore"

export const runtime = "nodejs"

export async function GET() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT

  const checks = {
    hasServiceAccount: !!raw,
    appsAlreadyInit: getApps().length,
  }

  try {
    if (!getApps().length) {
      if (!raw) {
        throw new Error("FIREBASE_SERVICE_ACCOUNT env var is missing")
      }
      const sa = JSON.parse(raw)
      initializeApp({
        credential: cert({
          projectId: sa.project_id,
          clientEmail: sa.client_email,
          privateKey: sa.private_key,
        })
      })
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
