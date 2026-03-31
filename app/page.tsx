"use client"
import { useState, useEffect, useCallback } from "react"
import { TaskInput } from "@/components/TaskInput"
import { useStream } from "@/lib/useStream"
import { IntakeSummaryCard } from "@/components/sections/IntakeSummaryCard"
import { ExecutionTimelineCard } from "@/components/sections/ExecutionTimelineCard"
import { ContentIntelligenceCard } from "@/components/sections/ContentIntelligenceCard"
import { TranscriptCard } from "@/components/sections/TranscriptCard"
import { TrendIntelligenceCard } from "@/components/sections/TrendIntelligenceCard"
import { PlatformPacksCard } from "@/components/sections/PlatformPacksCard"
import { AgentPlanCard } from "@/components/sections/AgentPlanCard"
import { BlockedCard } from "@/components/sections/BlockedCard"
import { OAuthRequiredCard } from "@/components/sections/OAuthRequiredCard"
import { IngestionConfirmedCard } from "@/components/sections/IngestionConfirmedCard"
import { PlatformSelectionCard } from "@/components/sections/PlatformSelectionCard"
import { PlatformWorkspace } from "@/components/console/PlatformWorkspace"
import { OAuthStatusBanner } from "@/components/console/OAuthStatusBanner"
import type { WorkflowDefinition, IntakeState, CompoundTaskPlan } from "@/types"
import type { JobV2 } from "@/types/jobs"

function SectionRenderer({ id, data }: { id: string; data: Record<string, unknown> }) {
  if (data.blocked) return <BlockedCard data={data} />
  switch (id) {
    case "intake-summary": return <IntakeSummaryCard data={data} />
    case "execution-timeline": return <ExecutionTimelineCard data={data} />
    case "content-intelligence": return <ContentIntelligenceCard data={data} />
    case "transcript": return <TranscriptCard data={data} />
    case "trend-intelligence": return <TrendIntelligenceCard data={data} />
    case "platform-packs": return <PlatformPacksCard data={data} />
    case "agent-plan": return <AgentPlanCard data={data} />
    default: return null
  }
}

const stageLabels: Record<string, string> = {
  idle: "",
  streaming: "Analysis running\u2026",
  complete: "Complete",
  failed: "Failed",
}

type CardState = Record<string, Record<string, Record<string, unknown> | null>>

export default function ConsolePage() {
  const { state, startStream, reset } = useStream()
  const loading = state.status === "streaming"
  const [phase2JobId, setPhase2JobId] = useState<string | null>(null)
  const [phase2Status, setPhase2Status] = useState<"idle" | "generating" | "complete" | "error">("idle")
  const [platformCards, setPlatformCards] = useState<CardState>({})
  const [rehydratedJob, setRehydratedJob] = useState<JobV2 | null>(null)
  const [oauthToast, setOauthToast] = useState<string | null>(null)

  // Handle OAuth success redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const oauth = params.get("oauth")
    const platform = params.get("platform")
    if (oauth === "success" && platform) {
      setOauthToast(`${platform} connected successfully`)
      setTimeout(() => setOauthToast(null), 5000)
      params.delete("oauth")
      params.delete("platform")
      const newUrl = params.toString()
        ? `${window.location.pathname}?${params.toString()}`
        : window.location.pathname
      window.history.replaceState({}, "", newUrl)
    }
  }, [])

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
        setRehydratedJob(job)

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
          setPhase2Status("complete")
        } else if (job.status === "generating") {
          setPhase2JobId(job.id)
          startPhase2Stream(job.id)
        }
      })
      .catch(() => { /* ignore rehydration errors */ })
  }, [])

  const startPhase2Stream = useCallback((jobId: string) => {
    setPhase2Status("generating")

    // Init skeleton cards for selected platforms
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
      })
      .catch(() => {})

    fetch(`/api/jobs/${jobId}/stream`)
      .then(async (response) => {
        if (!response.ok || !response.body) {
          setPhase2Status("error")
          return
        }
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
                    [payload.platform]: {
                      ...(prev[payload.platform] ?? {}),
                      [payload.cardType]: payload.data,
                    },
                  }))
                } else if (currentEvent === "complete") {
                  setPhase2Status("complete")
                } else if (currentEvent === "error") {
                  setPhase2Status("error")
                }
              } catch { /* ignore */ }
              currentEvent = ""
              currentData = ""
            }
          }
        }
        if (phase2Status === "generating") setPhase2Status("complete")
      })
      .catch(() => setPhase2Status("error"))
  }, [])

  const handlePlatformConfirm = async (platforms: string[]) => {
    if (!phase2JobId) return
    const res = await fetch("/api/platform-selection", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId: phase2JobId, platforms }),
    })
    if (res.ok) {
      startPhase2Stream(phase2JobId)
    }
  }

  const handleSubmit = async (
    task: string,
    workflow: WorkflowDefinition | null,
    intakeState: IntakeState,
    _compoundPlan: CompoundTaskPlan | null
  ) => {
    const context: Record<string, string | string[]> = {}
    for (const [key, value] of Object.entries(intakeState)) {
      if (!value) continue
      if (typeof value === "object" && !Array.isArray(value) && "originalName" in value) continue
      if (Array.isArray(value)) context[key] = value as string[]
      else if (typeof value === "string") context[key] = value
    }

    await startStream(task, workflow?.id ?? null, workflow?.label ?? null, context)
  }

  const handleFullReset = () => {
    reset()
    setPhase2JobId(null)
    setPhase2Status("idle")
    setPlatformCards({})
    setRehydratedJob(null)
    window.history.replaceState({}, "", window.location.pathname)
  }

  const showPhase1 = state.status !== "idle" || rehydratedJob !== null
  const showPhase2 = phase2Status !== "idle"

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded bg-[#190A46] flex items-center justify-center">
              <span className="text-white text-xs font-bold">DA</span>
            </div>
            <div>
              <span className="text-sm font-semibold text-gray-900">DigitAlchemy&reg;</span>
              <span className="text-sm text-gray-400 ml-2">Console</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {showPhase1 && (
              <div className="flex items-center gap-2">
                {loading && <div className="w-2 h-2 rounded-full bg-[#b87333] animate-pulse" />}
                {(state.status === "complete" || phase2Status === "complete") && <div className="w-2 h-2 rounded-full bg-green-500" />}
                {state.status === "failed" && <div className="w-2 h-2 rounded-full bg-red-500" />}
                <span className="text-xs text-gray-500">
                  {phase2Status === "generating" ? "Generating content\u2026" : stageLabels[state.status] ?? ""}
                </span>
                {state.currentProcessor && <span className="text-xs text-gray-400">{state.currentProcessor}</span>}
              </div>
            )}
            {(state.status === "complete" || state.status === "failed" || phase2Status === "complete") && (
              <button onClick={handleFullReset} className="text-xs text-gray-400 hover:text-[#190A46] border border-gray-200 px-3 py-1 rounded-lg">
                New task
              </button>
            )}
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-green-400" />
              <span className="text-xs text-gray-500">Connected</span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        {oauthToast && (
          <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-2.5 mb-4 flex items-center gap-2 animate-fade-in">
            <span className="w-2 h-2 rounded-full bg-green-500" />
            <span className="text-sm text-green-700">{oauthToast}</span>
          </div>
        )}

        <OAuthStatusBanner />

        {state.status === "idle" && !rehydratedJob && (
          <div className="mb-6 mt-4">
            <h1 className="text-xl font-semibold text-gray-900">Task analysis</h1>
            <p className="text-sm text-gray-500 mt-1">
              Describe a task. Command Desk classifies it, gathers context, and streams intelligence as it arrives.
            </p>
          </div>
        )}

        <div className="space-y-5">
          {state.status === "idle" && !rehydratedJob && (
            <TaskInput onSubmit={handleSubmit} loading={false} />
          )}

          {loading && state.sections.length === 0 && (
            <div className="bg-white border border-gray-100 rounded-xl p-8 flex items-center justify-center gap-3">
              <div className="w-4 h-4 border-2 border-[#190A46] border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-gray-500">Initialising analysis pipeline&hellip;</p>
            </div>
          )}

          {/* Phase 1 — Progressive section rendering */}
          {state.sections
            .filter((s) => s.status === "ready" && s.data && s.id !== "actions")
            .map((section) => (
              <div key={section.id} className="animate-fade-in">
                <SectionRenderer id={section.id} data={section.data!} />
              </div>
            ))}

          {state.status === "failed" && state.oauthPrompt && (
            <div className="animate-fade-in">
              <OAuthRequiredCard
                platform={state.oauthPrompt.platform}
                connectUrl={state.oauthPrompt.connectUrl}
                expired={state.oauthPrompt.type === "expired"}
              />
            </div>
          )}

          {state.status === "failed" && state.error && !state.oauthPrompt && (
            <div className="bg-red-50 border border-red-100 rounded-xl p-5">
              <p className="text-sm font-medium text-red-800">Analysis failed</p>
              <p className="text-sm text-red-600 mt-1">{state.error}</p>
              <button onClick={handleFullReset} className="text-xs text-red-500 hover:underline mt-2">Try again</button>
            </div>
          )}

          {/* Phase 2 — Platform workspaces */}
          {showPhase2 && Object.entries(platformCards).map(([platform, cards]) => (
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

          {(state.status === "complete" || phase2Status === "complete") && (
            <div className="bg-green-50 border border-green-100 rounded-xl p-4 flex items-center justify-between">
              <p className="text-sm text-green-800">
                {phase2Status === "complete" ? "Content generation complete" : "Analysis complete"}
              </p>
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
