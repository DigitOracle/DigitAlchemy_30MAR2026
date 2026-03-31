"use client"
import { useState, useEffect, useCallback } from "react"
import { useStream } from "@/lib/useStream"
import { ProgressStrip } from "@/components/ProgressStrip"
import type { ProgressChip } from "@/components/ProgressStrip"
import { SourceModeStage } from "@/components/stages/SourceModeStage"
import { SourceInputStage } from "@/components/stages/SourceInputStage"
import { IngestionConfirmedStage } from "@/components/stages/IngestionConfirmedStage"
import { PlatformSelectionStage } from "@/components/stages/PlatformSelectionStage"
import { PlatformWorkspace } from "@/components/console/PlatformWorkspace"
import { BlockedCard } from "@/components/sections/BlockedCard"
import type { JobV2 } from "@/types/jobs"

type Stage =
  | "source_mode"      // Step 1a: link or upload?
  | "source_input"     // Step 1b: URL field or file upload
  | "ingesting"        // Processing video
  | "ingestion_confirmed" // Transcript ready
  | "platform_select"  // Choose platforms
  | "generating"       // Phase 2 SSE
  | "complete"
  | "error"

type SourceMode = "link" | "upload"
type CardState = Record<string, Record<string, Record<string, unknown> | null>>

export default function ConsolePage() {
  const { state, startStream, reset } = useStream()

  const [stage, setStage] = useState<Stage>("source_mode")
  const [sourceMode, setSourceMode] = useState<SourceMode | null>(null)
  const [sourceLabel, setSourceLabel] = useState("")
  const [jobIdV2, setJobIdV2] = useState<string | null>(null)
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([])
  const [platformCards, setPlatformCards] = useState<CardState>({})
  const [error, setError] = useState<string | null>(null)

  const ingestion = state.ingestion

  // Track stream state transitions
  useEffect(() => {
    if (state.status === "streaming" && stage === "source_input") setStage("ingesting")
    if (state.ingestion && stage === "ingesting") setStage("ingestion_confirmed")
    if (state.status === "failed") setError(state.error)
    if (state.jobIdV2) setJobIdV2(state.jobIdV2)
  }, [state.status, state.ingestion, state.jobIdV2, stage])

  useEffect(() => {
    if (state.status === "complete" && (stage === "ingesting" || stage === "ingestion_confirmed")) {
      setStage("platform_select")
    }
  }, [state.status, stage])

  // Rehydrate from URL
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
              Object.entries(job.cards).map(([p, c]) => [p, {
                trending: (c as Record<string, unknown>).trending as Record<string, unknown> | null,
                audio: (c as Record<string, unknown>).audio as Record<string, unknown> | null,
                hooks: (c as Record<string, unknown>).hooks as Record<string, unknown> | null,
                captions: (c as Record<string, unknown>).captions as Record<string, unknown> | null,
                schedule: (c as Record<string, unknown>).schedule as Record<string, unknown> | null,
              }])
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
        for (const p of job.selectedPlatforms) initial[p] = { trending: null, audio: null, hooks: null, captions: null, schedule: null }
        setPlatformCards(initial)
        setSelectedPlatforms(job.selectedPlatforms)
      })
      .catch(() => {})

    fetch(`/api/jobs/${jobId}/stream`)
      .then(async (response) => {
        if (!response.ok || !response.body) { setStage("error"); return }
        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = "", currentEvent = "", currentData = ""
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
                if (currentEvent === "card") setPlatformCards((prev) => ({ ...prev, [payload.platform]: { ...(prev[payload.platform] ?? {}), [payload.cardType]: payload.data } }))
                else if (currentEvent === "complete") setStage("complete")
                else if (currentEvent === "error") { setStage("error"); setError(payload.error) }
              } catch { /* ignore */ }
              currentEvent = ""; currentData = ""
            }
          }
        }
      })
      .catch(() => setStage("error"))
  }, [])

  // Step 1a: Source mode selected
  const handleSourceMode = (mode: SourceMode) => {
    setSourceMode(mode)
    setStage("source_input")
  }

  // Step 1b: URL submitted
  const handleUrlSubmit = async (url: string, task: string) => {
    setSourceLabel(url.length > 50 ? url.slice(0, 47) + "\u2026" : url)
    await startStream(task, "social-video-optimization", "Social Video Intelligence", { videoUrl: url })
  }

  // Step 1b: Upload completed
  const handleUploadComplete = useCallback((storagePath: string, filename: string) => {
    setSourceLabel(filename)
    startStream(
      `Analyze uploaded video: ${filename}`,
      "social-video-optimization",
      "Social Video Intelligence",
      { storagePath }
    )
  }, [startStream])

  // Step 3: Platform selection confirmed
  const handlePlatformConfirm = async (platforms: string[]) => {
    if (!jobIdV2) return
    setSelectedPlatforms(platforms)
    const res = await fetch("/api/platform-selection", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId: jobIdV2, platforms }),
    })
    if (res.ok) startPhase2Stream(jobIdV2)
  }

  const handleFullReset = () => {
    reset()
    setStage("source_mode")
    setSourceMode(null)
    setSourceLabel("")
    setJobIdV2(null)
    setSelectedPlatforms([])
    setPlatformCards({})
    setError(null)
    window.history.replaceState({}, "", window.location.pathname)
  }

  // Build 4-chip progress strip
  const chips: ProgressChip[] = []
  if (sourceMode && stage !== "source_mode") {
    chips.push({ id: "source_mode", label: "Source", summary: sourceMode === "link" ? "Link" : "Upload", completed: true })
  }
  if (sourceLabel && stage !== "source_input" && stage !== "source_mode") {
    chips.push({ id: "source_input", label: "Input", summary: sourceLabel, completed: true })
  }
  if (ingestion && (stage === "platform_select" || stage === "generating" || stage === "complete")) {
    chips.push({ id: "ingestion", label: "Ingestion", summary: ingestion.title ?? "processed", completed: true })
  }
  if (selectedPlatforms.length > 0 && (stage === "generating" || stage === "complete")) {
    chips.push({ id: "platforms", label: "Platforms", summary: selectedPlatforms.join(", "), completed: true })
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
            {stage === "ingesting" && <span className="text-xs text-gray-500">Analysing&hellip;</span>}
            {stage === "generating" && <span className="text-xs text-gray-500">Generating&hellip;</span>}
            {state.currentProcessor && <span className="text-xs text-gray-400">{state.currentProcessor}</span>}
            {(stage === "complete" || stage === "error") && (
              <button onClick={handleFullReset} className="text-xs text-gray-400 hover:text-[#190A46] border border-gray-200 px-3 py-1 rounded-lg">New task</button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        <ProgressStrip chips={chips} />

        <div className="space-y-5">
          {/* STAGE 1a: Source mode */}
          {stage === "source_mode" && <SourceModeStage onSelect={handleSourceMode} />}

          {/* STAGE 1b: Source input */}
          {stage === "source_input" && sourceMode && (
            <SourceInputStage
              mode={sourceMode}
              onSubmitUrl={handleUrlSubmit}
              onUploadComplete={handleUploadComplete}
              jobId={jobIdV2}
              onBack={() => { setStage("source_mode"); setSourceMode(null) }}
            />
          )}

          {/* Loading */}
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
          {stage === "platform_select" && <PlatformSelectionStage onConfirm={handlePlatformConfirm} />}

          {/* Blocked content */}
          {state.sections.some((s) => s.data?.blocked) && (
            <BlockedCard
              data={state.sections.find((s) => s.data?.blocked)?.data ?? { blocked: true }}
              jobId={jobIdV2 ?? undefined}
              onUploadComplete={() => { setStage("source_input"); setSourceMode("upload") }}
            />
          )}

          {/* STAGE 4: Platform workspaces */}
          {(stage === "generating" || stage === "complete") && Object.entries(platformCards).map(([platform, cards]) => (
            <div key={platform} className="animate-fade-in">
              <PlatformWorkspace platform={platform} cards={{
                trending: cards.trending ?? null, audio: cards.audio ?? null,
                hooks: cards.hooks ?? null, captions: cards.captions ?? null,
                schedule: cards.schedule ?? null,
              }} />
            </div>
          ))}

          {/* Error */}
          {stage === "error" && (
            <div className="bg-red-50 border border-red-100 rounded-xl p-5">
              <p className="text-sm font-medium text-red-800">Analysis failed</p>
              {error && <p className="text-sm text-red-600 mt-1">{error}</p>}
              <button onClick={handleFullReset} className="text-xs text-red-500 hover:underline mt-2">Try again</button>
            </div>
          )}

          {/* Complete */}
          {stage === "complete" && (
            <div className="bg-green-50 border border-green-100 rounded-xl p-4 flex items-center justify-between">
              <p className="text-sm text-green-800">Content generation complete</p>
              <button onClick={handleFullReset} className="text-xs text-green-700 border border-green-200 px-3 py-1 rounded-lg hover:bg-green-100">New task</button>
            </div>
          )}
        </div>
      </main>

      <footer className="max-w-5xl mx-auto px-6 py-6 mt-8 border-t border-gray-100">
        <p className="text-xs text-gray-400">DigitAlchemy&reg; Tech Limited &middot; ADGM No. 35004 &middot; Sky Tower, Al Reem Island, Abu Dhabi, UAE</p>
      </footer>
    </div>
  )
}
