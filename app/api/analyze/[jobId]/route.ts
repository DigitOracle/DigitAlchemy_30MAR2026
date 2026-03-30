import { NextRequest, NextResponse } from "next/server"
import { getJob } from "@/lib/jobStore"

export async function GET(req: NextRequest, { params }: { params: { jobId: string } }) {
  const job = getJob(params.jobId)
  if (!job) {
    return NextResponse.json({ success: false, error: "Job not found" }, { status: 404 })
  }
  return NextResponse.json({ success: true, job })
}
