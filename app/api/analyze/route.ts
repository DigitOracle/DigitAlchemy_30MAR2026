import { NextRequest, NextResponse } from "next/server"
import { createJob } from "@/lib/jobStore"

export const runtime = "nodejs"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { task, workflowId, workflowLabel, intakeContext } = body

    if (!task || typeof task !== "string" || task.trim().length < 5) {
      return NextResponse.json({ success: false, error: "Task description required." }, { status: 400 })
    }

    const job = createJob(
      task.trim(),
      workflowId ?? null,
      workflowLabel ?? null,
      intakeContext ?? {}
    )

    return NextResponse.json({ success: true, jobId: job.id })
  } catch (err) {
    console.error("[analyze] error:", err)
    return NextResponse.json({ success: false, error: "Failed to create job" }, { status: 500 })
  }
}
