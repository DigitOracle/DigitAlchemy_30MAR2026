"use client"
import { useState, useEffect, useCallback } from "react"
import { TaskInput } from "@/components/TaskInput"
import { useStream } from "@/lib/useStream"
import { ProgressStrip } from "@/components/ProgressStrip"
import type { ProgressChip } from "@/components/ProgressStrip"
import { IngestionConfirmedStage } from "@/components/stages/IngestionConfirmedStage"
import { PlatformSelectionStage } from "@/components/stages/PlatformSelectionStage"
import { PlatformWorkspace } from "@/components/console/PlatformWorkspace"
import { BlockedCard } from "@/components/sections/BlockedCard"
import type { WorkflowDefinition, IntakeState, CompoundTaskPlan } from "@/types"
import type { JobV2 } from "@/types/jobs"

// Stage flow: intake → ingesting → ingestion_confirmed → platform_select → generating → complete
type Stage = "intake" | "ingesting" | "ingestion_confirmed" | "platform_select" | "generating" | "complete" | "error"

type CardState = Record<string, Record<string, Record<string, unknown> | null>>

export default function ConsolePage() {
  const { state, startStream, reset } = useStream()

  const [stage, setStage] = useState<Stage>("intake")
  const [jobIdV2, setJobIdV2] = useState<string | null>(null)
  const [taskSummary, setTaskSummary] = useState("")
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([])
  const [platformCards, setPlatformCards] = useState<CardState>({})
  const [error, setError] = useState<string | null>(null)

  // Track ingestion data for progress strip and display
  const ingestion = state.ingestion

  // Update stage based on stream state
  useEffect(() => {
    if (state.status === "streaming" && stage === "intake") {
      setStage("ingesting")
    }
    if (state.ingestion && stage === "ingesting") {
      setStage("ingestion_confirmed")
    }
    if (state.status === "failed") {
      setError(state.error)
    }
    if (state.jobIdV2) {
      setJobIdV2(state.jobIdV2)
    }
  }, [state.status, state.ingestion, state.jobIdV2, stage])

  // When Phase 1 SSE completes and we have ingestion, auto-advance to platform selection
  useEffect(() => {
    if (state.status === "complete" && stage === "ingesting") {
      // No ingestion data arrived but Phase 1 completed — show platform select anyway
      setStage("platform_select")
    }
    if (state.status === "complete" && stage === "ingestion_confirmed") {
      setStage("platform_select")
    }
  }, [state.status, stage])

  // Rehydrate from URL on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const jobId = params.get("jobId")
    if (!jobId) return

    fetch(`/api/jobs/${jobId}`)
      .then((r) => r.json())
      .then((data) => {
        if (!data.ok || !data.job) return
        const job = data.job as JobV2
        setJobIdV2(job.id)

        if (job.status === "complete" && job.cards) {
          setPlatformCards(
            Object.fromEntries(
              Object.entries(job.cards).map(([platform, cards]) => [
                platform,
                {
                  trending: (cards as Record<string, unknown>).trending as Record<string, unknown> | null,
                  audio: (cards as Record<string, unknown>).audio as Record<string, unknown> | null,
                  hooks: (cards as Record<string, unknown>).hooks as Record<string, unknown> | null,
                  captions: (cards as Record<string, unknown>).captions as Record<string, unknown> | null,
                  schedule: (cards as Record<string, unknown>).schedule as Record<string, unknown> | null,
                },
              ])
            )
          )
          setSelectedPlatforms(job.selectedPlatforms)
          setStage("complete")
        } else if (job.status === "generating") {
          setSelectedPlatforms(job.selectedPlatforms)
          startPhase2Stream(job.id)
        } else if (job.status === "platform_selection_pending" || job.status === "ingestion_complete") {
          setStage("platform_select")
        }
      })
      .catch(() => {})
  }, [])

  const startPhase2Stream = useCallback((jobId: string) => {
    setStage("generating")

    fetch(`/api/jobs/${jobId}`)
      .then((r) => r.json())
      .then((data) => {
        if (!data.ok) return
        const job = data.job as JobV2
        const initial: CardState = {}
        for (const p of job.selectedPlatforms) {
          initial[p] = { trending: null, audio: null, hooks: null, captions: null, schedule: null }
        }
        setPlatformCards(initial)
        setSelectedPlatforms(job.selectedPlatforms)
      })
      .catch(() => {})

    fetch(`/api/jobs/${jobId}/stream`)
      .then(async (response) => {
        if (!response.ok || !response.body) { setStage("error"); return }
        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ""
        let currentEvent = ""
        let currentData = ""

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split("\n")
          buffer = lines.pop() ?? ""

          for (const line of lines) {
            if (line.startsWith("event: ")) currentEvent = line.slice(7).trim()
            else if (line.startsWith("data: ")) currentData = line.slice(6).trim()
            else if (line === "" && currentEvent && currentData) {
              try {
                const payload = JSON.parse(currentData)
                if (currentEvent === "card") {
                  setPlatformCards((prev) => ({
                    ...prev,
                    [payload.platform]: { ...(prev[payload.platform] ?? {}), [payload.cardType]: payload.data },
                  }))
                } else if (currentEvent === "complete") {
                  setStage("complete")
                } else if (currentEvent === "error") {
                  setStage("error")
                  setError(payload.error)
                }
              } catch { /* ignore */ }
              currentEvent = ""
              currentData = ""
            }
          }
        }
      })
      .catch(() => setStage("error"))
  }, [])

  const handleSubmit = async (
    task: string,
    workflow: WorkflowDefinition | null,
    intakeState: IntakeState,
    _compoundPlan: CompoundTaskPlan | null
  ) => {
    setTaskSummary(task.slice(0, 60))
    const context: Record<string, string | string[]> = {}
    for (const [key, value] of Object.entries(intakeState)) {
      if (!value) continue
      if (typeof value === "object" && !Array.isArray(value) && "originalName" in value) continue
      if (Array.isArray(value)) context[key] = value as string[]
      else if (typeof value === "string") context[key] = value
    }
    await startStream(task, workflow?.id ?? null, workflow?.label ?? null, context)
  }

  const handlePlatformConfirm = async (platforms: string[]) => {
    if (!jobIdV2) return
    setSelectedPlatforms(platforms)
    const res = await fetch("/api/platform-selection", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId: jobIdV2, platforms }),
    })
    if (res.ok) {
      startPhase2Stream(jobIdV2)
    }
  }

  const handleUploadComplete = useCallback((_storagePath: string) => {}, [])

  const handleFullReset = () => {
    reset()
    setStage("intake")
    setJobIdV2(null)
    setTaskSummary("")
    setSelectedPlatforms([])
    setPlatformCards({})
    setError(null)
    window.history.replaceState({}, "", window.location.pathname)
  }

  // Build progress strip chips
  const chips: ProgressChip[] = []
  if (stage !== "intake") {
    chips.push({ id: "intake", label: "Intake", summary: taskSummary || "Task submitted", completed: true })
  }
  if (ingestion && (stage === "platform_select" || stage === "generating" || stage === "complete")) {
    chips.push({
      id: "ingestion",
      label: "Ingestion",
      summary: ingestion.title ?? "Video processed",
      completed: true,
    })
  }
  if (selectedPlatforms.length > 0 && (stage === "generating" || stage === "complete")) {
    chips.push({
      id: "platforms",
      label: "Platforms",
      summary: selectedPlatforms.join(", "),
      completed: true,
    })
  }

  const isLoading = stage === "ingesting" || stage === "generating"

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded bg-[#190A46] flex items-center justify-center">
              <span className="text-white text-xs font-bold">DA</span>
            </div>
            <span className="text-sm font-semibold text-gray-900">DigitAlchemy&reg;</span>
            <span className="text-sm text-gray-400">Console</span>
          </div>
          <div className="flex items-center gap-3">
            {isLoading && <div className="w-2 h-2 rounded-full bg-[#b87333] animate-pulse" />}
            {stage === "complete" && <div className="w-2 h-2 rounded-full bg-green-500" />}
            {stage === "error" && <div className="w-2 h-2 rounded-full bg-red-500" />}
            {stage === "ingesting" && <span className="text-xs text-gray-500">Analysing video&hellip;</span>}
            {stage === "generating" && <span className="text-xs text-gray-500">Generating content&hellip;</span>}
            {state.currentProcessor && <span className="text-xs text-gray-400">{state.currentProcessor}</span>}
            {(stage === "complete" || stage === "error") && (
              <button onClick={handleFullReset} className="text-xs text-gray-400 hover:text-[#190A46] border border-gray-200 px-3 py-1 rounded-lg">
                New task
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        {/* Progress strip — collapsed completed stages */}
        <ProgressStrip chips={chips} />

        <div className="space-y-5">
          {/* STAGE 1: Intake */}
          {stage === "intake" && (
            <>
              <div className="mb-2">
                <h1 className="text-xl font-semibold text-gray-900">Task analysis</h1>
                <p className="text-sm text-gray-500 mt-1">Describe a task. Submit a video URL or upload a file.</p>
              </div>
              <TaskInput onSubmit={handleSubmit} loading={false} />
            </>
          )}

          {/* STAGE 1.5: Loading spinner */}
          {stage === "ingesting" && !ingestion && (
            <div className="bg-white border border-gray-100 rounded-xl p-8 flex items-center justify-center gap-3">
              <div className="w-4 h-4 border-2 border-[#190A46] border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-gray-500">Analysing content&hellip;</p>
            </div>
          )}

          {/* STAGE 2: Ingestion confirmed */}
          {(stage === "ingestion_confirmed" || (stage === "ingesting" && ingestion)) && ingestion && (
            <IngestionConfirmedStage
              title={ingestion.title}
              duration={ingestion.duration}
              thumbnail={ingestion.thumbnail}
              transcriptSummary={null}
              provenance={ingestion.provenance as "observed" | "derived" | "inferred" | "unavailable"}
            />
          )}

          {/* STAGE 3: Platform selection */}
          {stage === "platform_select" && (
            <PlatformSelectionStage onConfirm={handlePlatformConfirm} />
          )}

          {/* Blocked content — show upload option */}
          {state.sections.some((s) => s.data?.blocked) && (
            <BlockedCard
              data={state.sections.find((s) => s.data?.blocked)?.data ?? { blocked: true }}
              jobId={jobIdV2 ?? undefined}
              onUploadComplete={handleUploadComplete}
            />
          )}

          {/* STAGE 4: Platform workspaces */}
          {(stage === "generating" || stage === "complete") && Object.entries(platformCards).map(([platform, cards]) => (
            <div key={platform} className="animate-fade-in">
              <PlatformWorkspace
                platform={platform}
                cards={{
                  trending: cards.trending ?? null,
                  audio: cards.audio ?? null,
                  hooks: cards.hooks ?? null,
                  captions: cards.captions ?? null,
                  schedule: cards.schedule ?? null,
                }}
              />
            </div>
          ))}

          {/* Error state */}
          {stage === "error" && (
            <div className="bg-red-50 border border-red-100 rounded-xl p-5">
              <p className="text-sm font-medium text-red-800">Analysis failed</p>
              {error && <p className="text-sm text-red-600 mt-1">{error}</p>}
              <button onClick={handleFullReset} className="text-xs text-red-500 hover:underline mt-2">Try again</button>
            </div>
          )}

          {/* Complete state */}
          {stage === "complete" && (
            <div className="bg-green-50 border border-green-100 rounded-xl p-4 flex items-center justify-between">
              <p className="text-sm text-green-800">Content generation complete</p>
              <button onClick={handleFullReset} className="text-xs text-green-700 border border-green-200 px-3 py-1 rounded-lg hover:bg-green-100">
                New task
              </button>
            </div>
          )}
        </div>
      </main>

      <footer className="max-w-5xl mx-auto px-6 py-6 mt-8 border-t border-gray-100">
        <p className="text-xs text-gray-400">
          DigitAlchemy&reg; Tech Limited &middot; ADGM No. 35004 &middot; Sky Tower, Al Reem Island, Abu Dhabi, UAE
        </p>
      </footer>
    </div>
  )
}
