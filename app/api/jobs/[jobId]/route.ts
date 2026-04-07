import { NextRequest, NextResponse } from "next/server"
import { getAuth } from "firebase-admin/auth"
import { getJobV2 } from "@/lib/firestore/jobs"
import { getDb } from "@/lib/jobStore"

export const runtime = "nodejs"

export async function GET(
  req: NextRequest,
  { params }: { params: { jobId: string } }
) {
  // Require Firebase Auth
  getDb()
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

  const job = await getJobV2(params.jobId)
  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 })
  }

  // Fail-closed ownership check: ownerUid missing = admin-only; ownerUid present = exact match or admin
  if (job.ownerUid !== callerUid) {
    const db = getDb()
    const callerSnap = await db.doc(`users/${callerUid}`).get()
    const callerRole = (callerSnap.data() as { role?: string } | undefined)?.role
    if (callerRole !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
  }

  return NextResponse.json({ ok: true, job })
}
