"use client"
import { useState, useRef } from "react"
import { TaskInput } from "@/components/TaskInput"
import { ExecutionPlan } from "@/components/ExecutionPlan"
import { OrchestrationStatus } from "@/components/OrchestrationStatus"
import type { AnalyzeTaskResult, WorkflowDefinition, IntakeState, CompoundTaskPlan, OrchestrationStage, ParsedFileContent } from "@/types"
import { parsedFileToContextString } from "@/lib/fileHandler"

export default function ConsolePage() {
  const [result, setResult] = useState<AnalyzeTaskResult | null>(null)
  const [stage, setStage] = useState<OrchestrationStage>("idle")
  const [currentStep, setCurrentStep] = useState<string | undefined>()
  const [elapsedMs, setElapsedMs] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startTimeRef = useRef<number>(0)

  const startTimer = () => {
    startTimeRef.current = Date.now()
    timerRef.current = setInterval(() => {
      setElapsedMs(Date.now() - startTimeRef.current)
    }, 100)
  }

  const stopTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current)
  }

  const buildIntakeContext = (state: IntakeState): { context: Record<string, string | string[]>; parsedFiles: ParsedFileContent[] } => {
    const context: Record<string, string | string[]> = {}
    const parsedFiles: ParsedFileContent[] = []

    for (const [key, value] of Object.entries(state)) {
      if (!value) continue
      if (value && typeof value === "object" && !Array.isArray(value) && "originalName" in value) {
        parsedFiles.push(value as ParsedFileContent)
      } else if (Array.isArray(value)) {
        context[key] = value as string[]
      } else if (typeof value === "string") {
        context[key] = value
      }
    }

    return { context, parsedFiles }
  }

  const handleSubmit = async (
    task: string,
    workflow: WorkflowDefinition | null,
    intakeState: IntakeState,
    compoundPlan: CompoundTaskPlan | null
  ) => {
    setResult(null)
    setError(null)
    setElapsedMs(0)
    startTimer()

    try {
      setStage("classifying")
      setCurrentStep("Classifying task type and identifying branches…")

      const { context, parsedFiles } = buildIntakeContext(intakeState)

      // Build enriched task with parsed file content
      const fileContextLines = parsedFiles.map(parsedFileToContextString)
      const contextLines = Object.entries(context).map(([k, v]) =>
        `${k}: ${Array.isArray(v) ? v.join(", ") : v}`
      )

      const enrichedTask = [
        task,
        contextLines.length ? `\nContext:\n${contextLines.join("\n")}` : "",
        fileContextLines.length ? `\nFiles:\n${fileContextLines.join("\n\n")}` : "",
      ].filter(Boolean).join("")

      setStage("gathering-context")
      setCurrentStep("Processing files and intake context…")

      await new Promise((r) => setTimeout(r, 200)) // allow UI to update

      setStage("building-plan")
      setCurrentStep("Building orchestration plan…")

      setStage("reasoning")
      setCurrentStep("Generating agent recommendations and execution path…")

      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task: enrichedTask,
          workflowId: workflow?.id ?? null,
          workflowLabel: workflow?.label ?? null,
          intakeContext: context,
          parsedFiles: parsedFiles.map((f) => ({
            originalName: f.originalName,
            contentType: f.contentType,
            metadata: f.metadata,
          })),
          isCompound: compoundPlan?.isCompound ?? false,
          compoundBranches: compoundPlan?.branches ?? [],
        }),
      })

      const data = await res.json()

      if (data.success) {
        setResult(data.result)
        setStage("complete")
      } else {
        setError(data.error ?? "Analysis failed")
        setStage("failed")
      }
    } catch {
      setError("Failed to connect to analysis engine")
      setStage("failed")
    } finally {
      stopTimer()
    }
  }

  const loading = stage !== "idle" && stage !== "complete" && stage !== "failed"

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded bg-[#190A46] flex items-center justify-center">
              <span className="text-white text-xs font-bold">DA</span>
            </div>
            <div>
              <span className="text-sm font-semibold text-gray-900">DigitAlchemy®</span>
              <span className="text-sm text-gray-400 ml-2">Console</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-400" />
            <span className="text-xs text-gray-500">Orchestration layer connected</span>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-gray-900">Task analysis</h1>
          <p className="text-sm text-gray-500 mt-1">
            Describe a task. Command Desk classifies it, gathers context, and generates the execution plan.
          </p>
        </div>

        <div className="space-y-5">
          <TaskInput onSubmit={handleSubmit} loading={loading} />

          {loading && (
            <OrchestrationStatus
              stage={stage}
              elapsedMs={elapsedMs}
              currentStep={currentStep}
            />
          )}

          {error && (
            <div className="bg-red-50 border border-red-100 rounded-xl p-5">
              <p className="text-sm font-medium text-red-800">Analysis failed</p>
              <p className="text-sm text-red-600 mt-1">{error}</p>
              <button
                onClick={() => { setError(null); setStage("idle") }}
                className="text-xs text-red-500 hover:underline mt-2"
              >
                Dismiss
              </button>
            </div>
          )}

          {result && <ExecutionPlan result={result} />}
        </div>
      </main>

      <footer className="max-w-5xl mx-auto px-6 py-6 mt-8 border-t border-gray-100">
        <p className="text-xs text-gray-400">
          DigitAlchemy® Tech Limited · ADGM No. 35004 · Sky Tower, Al Reem Island, Abu Dhabi, UAE
        </p>
      </footer>
    </div>
  )
}
