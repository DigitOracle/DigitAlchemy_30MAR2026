import { NextRequest, NextResponse } from "next/server"
import { analyzeTask } from "@/lib/analyzeTask"
import type { AnalyzeTaskRequest, AnalyzeTaskResponse } from "@/types"

export const runtime = "nodejs"
export const maxDuration = 60

export async function POST(req: NextRequest): Promise<NextResponse<AnalyzeTaskResponse>> {
  try {
    const body = (await req.json()) as AnalyzeTaskRequest

    if (!body.task || typeof body.task !== "string" || body.task.trim().length < 5) {
      return NextResponse.json({ success: false, error: "Task description is required (minimum 5 characters)." }, { status: 400 })
    }

    if (body.task.length > 5000) {
      return NextResponse.json({ success: false, error: "Task description is too long (maximum 5000 characters)." }, { status: 400 })
    }

    const result = await analyzeTask(
      body.task.trim(),
      body.workflowId ?? null,
      body.workflowLabel ?? null,
      body.isCompound ?? false,
      body.compoundBranches ?? []
    )
    return NextResponse.json({ success: true, result })
  } catch (err) {
    console.error("[analyze] error:", err)
    const message = err instanceof Error ? err.message : "Analysis failed"
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
