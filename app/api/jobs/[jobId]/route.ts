import { NextRequest, NextResponse } from "next/server"
import { getJobV2 } from "@/lib/firestore/jobs"

export const runtime = "nodejs"

export async function GET(
  req: NextRequest,
  { params }: { params: { jobId: string } }
) {
  const job = await getJobV2(params.jobId)
  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 })
  }
  return NextResponse.json({ ok: true, job })
}
