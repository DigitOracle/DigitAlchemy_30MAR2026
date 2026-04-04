"use client"
import { useState, useEffect, useCallback } from "react"
import { useStream } from "@/lib/useStream"
import { ProgressStrip } from "@/components/ProgressStrip"
import type { ProgressChip } from "@/components/ProgressStrip"
import { ModeSelectStage } from "@/components/stages/ModeSelectStage"
import { SourceInputStage } from "@/components/stages/SourceInputStage"
import { IngestionConfirmedStage } from "@/components/stages/IngestionConfirmedStage"
import { PlatformSelectionStage } from "@/components/stages/PlatformSelectionStage"
import { ReverseEngineerSetupStage } from "@/components/stages/ReverseEngineerSetupStage"
import { ContentFocusConfirmStage } from "@/components/stages/ContentFocusConfirmStage"
import { PlatformWorkspace } from "@/components/console/PlatformWorkspace"
import { BlockedCard } from "@/components/sections/BlockedCard"
import type { JobV2 } from "@/types/jobs"

type AppMode = "optimize" | "reverse_engineer" | null

type Stage =
  | "mode_select"
  | "source_input"
  | "ingesting"
  | "ingestion_confirmed"
  | "content_focus_confirm"
  | "platform_select"
  | "re_setup"          // reverse-engineer: choose platform + niche
  | "generating"
  | "complete"
  | "error"

type SourceMode = "link" | "upload"
type CardState = Record<string, Record<string, Record<string, unknown> | null>>

function DevDebugPanel({ mode, stage, platform, niche, lag, trendRadarData }: {
  mode: AppMode; stage: string; platform: string | null; niche: string; lag: string
  trendRadarData: Record<string, unknown> | null
}) {
  const [open, setOpen] = useState(false)
  const snapshotCount = (trendRadarData?.snapshotCount as number) ?? 0
  const insufficientHistory = (trendRadarData?.insufficientHistory as boolean) ?? true
  const trendCount = ((trendRadarData?.trends as unknown[]) ?? []).length
  const influxConfigured = typeof window !== "undefined" // can't check server env from client — show N/A

  return (
    <div className="max-w-5xl mx-auto px-6 mt-4">
      <button onClick={() => setOpen((o) => !o)} className="text-[10px] text-gray-400 hover:text-gray-600">
        {open ? "\u25BC" : "\u25B6"} dev debug
      </button>
      {open && (
        <div className="mt-1 bg-gray-900 text-gray-300 rounded-lg p-3 text-[11px] font-mono space-y-0.5">
          <div>mode: <span className="text-white">{mode ?? "null"}</span></div>
          <div>stage: <span className="text-white">{stage}</span></div>
          <div>platform: <span className="text-white">{platform ?? "none"}</span></div>
          <div>niche: <span className="text-white">{niche || "none"}</span></div>
          <div>lag: <span className="text-white">{lag}</span></div>
          <div>trend_radar.snapshotCount: <span className="text-white">{snapshotCount}</span></div>
          <div>trend_radar.trendCount: <span className="text-white">{trendCount}</span></div>
          <div>trend_radar.insufficientHistory: <span className={insufficientHistory ? "text-amber-400" : "text-green-400"}>{String(insufficientHistory)}</span></div>
          <div>influx_configured: <span className="text-gray-500">check /api/health/providers</span></div>
        </div>
      )}
    </div>
  )
}

export default function ConsolePage() {
  const { state, startStream, reset } = useStream()

  const [appMode, setAppMode] = useState<AppMode>(null)
  const [stage, setStage] = useState<Stage>("mode_select")
  const [sourceMode, setSourceMode] = useState<SourceMode | null>("upload")
  const [sourceLabel, setSourceLabel] = useState("")
  const [jobIdV2, setJobIdV2] = useState<string | null>(null)
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([])
  const [platformCards, setPlatformCards] = useState<CardState>({})
  const [error, setError] = useState<string | null>(null)
  const [reNiche, setReNiche] = useState("")
  const [reLag, setReLag] = useState<string>("same_day")
  const [reRegion, setReRegion] = useState<string>("AE")
  const [reIndustry, setReIndustry] = useState<string | null>(null)
  const [reAudience, setReAudience] = useState<string | null>(null)
  const [confirmedFocus, setConfirmedFocus] = useState<{ topic: string; summary: string; keywords: string[]; editedByUser: boolean } | null>(null)

  const ingestion = state.ingestion

  // Extract content intelligence for display
  const contentIntel = state.sections.find((s) => s.id === "content-intelligence")?.data
  const transcriptSection = state.sections.find((s) => s.id === "transcript")?.data
  const detectedLanguage = (contentIntel?.language as { value?: string })?.value ?? null
  // Prefer real summary from transcript or content intelligence, never use status strings
  const transcriptSummary = (transcriptSection?.summary as { value?: string })?.value
    ?? (contentIntel?.summary as { value?: string })?.value
    ?? null
  const transcriptExcerpt = (transcriptSection?.transcriptExcerpt as { value?: string })?.value ?? null
  // Topic priority: transcript-derived (Pass 2) > content-intel (Pass 1) > summary-derived > null
  // Never use filename as detected topic — that's handled as a last-resort fallback in the UI
  const rawCITopic = (contentIntel?.topic as { value?: string })?.value ?? null
  const rawTranscriptTopic = (transcriptSection?.topic as { value?: string })?.value ?? null
  const isFilenamelike = (v: string | null) => !v || /\.\w{2,4}$/.test(v) || v.length < 5
  // If both pass topics are filename-like but we have a real summary, derive a short topic from it
  const summaryDerivedTopic = transcriptSummary && transcriptSummary.length > 20
    ? transcriptSummary.split(/[.!?]/)[0]?.trim().slice(0, 80) || null
    : null
  const detectedTopic = (!isFilenamelike(rawTranscriptTopic) ? rawTranscriptTopic
    : !isFilenamelike(rawCITopic) ? rawCITopic
    : !isFilenamelike(summaryDerivedTopic) ? summaryDerivedTopic
    : null)
  // Detect weak intelligence: no real topic found from any source
  const isWeakIntelligence = !detectedTopic

  // ── Optimize mode: stream state transitions ──
  useEffect(() => {
    if (appMode !== "optimize") return
    if (state.status === "streaming" && stage === "source_input") setStage("ingesting")
    if (state.ingestion && stage === "ingesting") setStage("ingestion_confirmed")
    if (state.status === "failed") setError(state.error)
    if (state.jobIdV2) setJobIdV2(state.jobIdV2)
  }, [appMode, state.status, state.ingestion, state.jobIdV2, stage])

  useEffect(() => {
    if (appMode !== "optimize") return
    if (state.status === "complete" && stage === "ingestion_confirmed") {
      const t = setTimeout(() => setStage("content_focus_confirm"), 1500)
      return () => clearTimeout(t)
    }
    if (state.status === "complete" && stage === "ingesting") {
      setStage("content_focus_confirm")
    }
  }, [appMode, state.status, stage])

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
        setAppMode("optimize")
        setJobIdV2(job.id)
        if (job.confirmedFocus) setConfirmedFocus(job.confirmedFocus)
        if (job.status === "complete" && job.cards) {
          setPlatformCards(
            Object.fromEntries(
              Object.entries(job.cards).map(([p, c]) => {
                const cd = c as Record<string, unknown>
                return [p, {
                  platformTrends: cd.platformTrends as Record<string, unknown> | null,
                  topicTrends: cd.topicTrends as Record<string, unknown> | null,
                  trendingAudio: cd.trendingAudio as Record<string, unknown> | null,
                  commercialAudio: cd.commercialAudio as Record<string, unknown> | null,
                  vibeSuggestions: cd.vibeSuggestions as Record<string, unknown> | null,
                  hooks: cd.hooks as Record<string, unknown> | null,
                  captions: cd.captions as Record<string, unknown> | null,
                  schedule: cd.schedule as Record<string, unknown> | null,
                }]
              })
            )
          )
          setSelectedPlatforms(job.selectedPlatforms)
          setStage("complete")
        } else if (job.status === "generating") {
          setSelectedPlatforms(job.selectedPlatforms)
          startPhase2Stream(job.id)
        } else if (job.status === "platform_selection_pending" || job.status === "ingestion_complete") {
          setStage(job.confirmedFocus ? "platform_select" : "content_focus_confirm")
        }
      })
      .catch(() => {})
  }, [])

  // ── Optimize: Phase 2 stream ──
  const startPhase2Stream = useCallback(async (jobId: string) => {
    setStage("generating")
    try {
      const res = await fetch(`/api/jobs/${jobId}`)
      const data = await res.json()
      if (data.ok) {
        const job = data.job as JobV2
        const initial: CardState = {}
        for (const p of job.selectedPlatforms) initial[p] = { platformTrends: null, topicTrends: null, trendingAudio: null, commercialAudio: null, vibeSuggestions: null, hooks: null, captions: null, schedule: null }
        setPlatformCards(initial)
        setSelectedPlatforms(job.selectedPlatforms)
      }
    } catch { /* proceed */ }

    try {
      const response = await fetch(`/api/jobs/${jobId}/stream`)
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
              if (currentEvent === "card") {
                setPlatformCards((prev) => ({
                  ...prev,
                  [payload.platform]: {
                    ...(prev[payload.platform] ?? {}),
                    [payload.cardType]: payload.data,
                  },
                }))
              } else if (currentEvent === "complete") setStage("complete")
              else if (currentEvent === "error") { setStage("error"); setError(payload.error) }
            } catch { /* ignore */ }
            currentEvent = ""; currentData = ""
          }
        }
      }
      setStage((s) => s === "generating" ? "complete" : s)
    } catch { setStage("error") }
  }, [])

  // ── Reverse-engineer: SSE stream + Trend Radar ──
  const startReverseEngineerStream = useCallback(async (platform: string, niche: string, lag: string, region: string, industry: string | null, audience: string | null, quickPulse?: string) => {
    setStage("generating")
    setSelectedPlatforms([platform])
    setReNiche(niche)
    setReLag(lag)
    const initial: CardState = { [platform]: {} }
    setPlatformCards(initial)

    try {
      // Step 1: SSE stream for trend scan + content ideas
      const response = await fetch("/api/reverse-engineer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform, niche, region, lag, industry, audience, quickPulse }),
      })
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
              if (currentEvent === "card") {
                setPlatformCards((prev) => ({
                  ...prev,
                  [payload.platform]: {
                    ...(prev[payload.platform] ?? {}),
                    [payload.cardType]: payload.data,
                  },
                }))
              } else if (currentEvent === "complete") { /* handled below */ }
              else if (currentEvent === "error") { setStage("error"); setError(payload.error) }
            } catch { /* ignore */ }
            currentEvent = ""; currentData = ""
          }
        }
      }

      // Step 2: Trigger Trend Radar capture (fire-and-forget, non-blocking for first run)
      try {
        await fetch("/api/trend-radar/capture", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ platform, scope: "platform_wide", region }),
        })
        if (niche) {
          await fetch("/api/trend-radar/capture", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ platform, scope: "topic_aligned", niche, region }),
          })
        }
      } catch { /* non-critical */ }

      // Step 3: Fetch Trend Radar scores
      try {
        const nicheParam = niche ? `&niche=${encodeURIComponent(niche)}` : ""
        const scoresRes = await fetch(`/api/trend-radar/scores?platform=${platform}&lag=${lag}${nicheParam}&limit=50`)
        if (scoresRes.ok) {
          const scoresData = await scoresRes.json()
          if (scoresData.ok && scoresData.trends) {
            const allTrends = scoresData.trends as Record<string, unknown>[]

            // Full radar
            setPlatformCards((prev) => ({
              ...prev,
              [platform]: {
                ...(prev[platform] ?? {}),
                trendRadar: { trends: allTrends, insufficientHistory: scoresData.insufficientHistory, snapshotCount: scoresData.snapshotCount, productionLag: lag },
                trendOutlook: { trends: allTrends, insufficientHistory: scoresData.insufficientHistory, snapshotCount: scoresData.snapshotCount, productionLag: lag },
              },
            }))

            // Safe to produce: classification !== fading_fast AND lag fitness >= 50
            const safe = allTrends.filter((t) => {
              const cls = t.classification as string
              const fit = (t.production_lag_fit as Record<string, number>)?.[lag] ?? 0
              return cls !== "fading_fast" && fit >= 50
            })
            setPlatformCards((prev) => ({
              ...prev,
              [platform]: {
                ...(prev[platform] ?? {}),
                safeToProduceNow: { trends: safe, insufficientHistory: scoresData.insufficientHistory, snapshotCount: scoresData.snapshotCount, productionLag: lag },
              },
            }))

            // Why still matters (all trends with explanations)
            setPlatformCards((prev) => ({
              ...prev,
              [platform]: {
                ...(prev[platform] ?? {}),
                whyStillMatters: { trends: allTrends, insufficientHistory: scoresData.insufficientHistory, snapshotCount: scoresData.snapshotCount, productionLag: lag },
              },
            }))

            // Too late / fading
            const tooLate = allTrends.filter((t) => {
              const cls = t.classification as string
              const fit = (t.production_lag_fit as Record<string, number>)?.[lag] ?? 0
              return cls === "fading_fast" || fit <= 30
            })
            setPlatformCards((prev) => ({
              ...prev,
              [platform]: {
                ...(prev[platform] ?? {}),
                tooLate: { trends: tooLate, insufficientHistory: scoresData.insufficientHistory, snapshotCount: scoresData.snapshotCount, productionLag: lag },
              },
            }))
          }
        }
      } catch { /* non-critical — Trend Radar is additive */ }

      setStage("complete")
    } catch { setStage("error") }
  }, [])

  // ── Optimize: handlers ──
  const handleUrlSubmit = async (url: string, task: string) => {
    setSourceLabel(url.length > 50 ? url.slice(0, 47) + "\u2026" : url)
    await startStream(task, "social-video-optimization", "Social Video Intelligence", { videoUrl: url })
  }

  const handleUploadComplete = useCallback((storagePath: string, filename: string) => {
    setSourceLabel(filename)
    startStream(
      `Analyze uploaded video: ${filename}`,
      "social-video-optimization",
      "Social Video Intelligence",
      { storagePath }
    )
  }, [startStream])

  const handleContentFocusConfirm = async (focus: { topic: string; summary: string; keywords: string[]; editedByUser: boolean }) => {
    setConfirmedFocus(focus)
    if (jobIdV2) {
      await fetch("/api/platform-selection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: jobIdV2, confirmedFocus: focus }),
      })
    }
    setStage("platform_select")
  }

  const handlePlatformConfirm = async (platforms: string[]) => {
    if (!jobIdV2) return
    setSelectedPlatforms(platforms)
    const res = await fetch("/api/platform-selection", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId: jobIdV2, platforms, confirmedFocus }),
    })
    if (res.ok) startPhase2Stream(jobIdV2)
  }

  // ── Mode selection ──
  const handleModeSelect = (mode: "optimize" | "reverse_engineer") => {
    setAppMode(mode)
    setStage(mode === "optimize" ? "source_input" : "re_setup")
  }

  // ── Reverse-engineer: confirm ──
  const handleReConfirm = (platform: string, niche: string, lag: string, region: string, industry: string | null, audience: string | null, quickPulse?: string) => {
    setReRegion(region)
    setReIndustry(industry)
    setReAudience(audience)
    startReverseEngineerStream(platform, niche, lag, region, industry, audience, quickPulse)
  }

  // ── Full reset ──
  const handleFullReset = () => {
    reset()
    setAppMode(null)
    setStage("mode_select")
    setSourceMode("upload")
    setSourceLabel("")
    setJobIdV2(null)
    setSelectedPlatforms([])
    setPlatformCards({})
    setError(null)
    setReNiche("")
    setReLag("same_day")
    setReRegion("AE")
    setReIndustry(null)
    setReAudience(null)
    setConfirmedFocus(null)
    window.history.replaceState({}, "", window.location.pathname)
  }

  // ── Switch from reverse-engineer to optimize ──
  const handleSwitchToOptimize = () => {
    setAppMode("optimize")
    setStage("source_input")
    setPlatformCards({})
    setSelectedPlatforms([])
  }

  // ── Progress strip ──
  const chips: ProgressChip[] = []

  if (appMode && stage !== "mode_select") {
    chips.push({
      id: "mode",
      label: "Mode",
      summary: appMode === "optimize" ? "Optimize" : "Spot Trends",
      completed: true,
    })
  }

  if (appMode === "optimize") {
    if (sourceMode && stage !== "source_input" && stage !== "mode_select") {
      chips.push({ id: "source_mode", label: "Source", summary: "Upload", completed: true })
    }
    if (sourceLabel && stage !== "source_input" && stage !== "mode_select") {
      chips.push({ id: "source_input", label: "Input", summary: sourceLabel, completed: true })
    }
    if (ingestion && (stage === "content_focus_confirm" || stage === "platform_select" || stage === "generating" || stage === "complete")) {
      const ingestionSummary = detectedTopic
        ? `${detectedTopic}${transcriptSummary ? ", transcript ready" : ""}`
        : ingestion.title ?? "processed"
      chips.push({ id: "ingestion", label: "Ingestion", summary: ingestionSummary, completed: true })
    }
    if (confirmedFocus && (stage === "platform_select" || stage === "generating" || stage === "complete")) {
      const focusLabel = confirmedFocus.editedByUser ? `${confirmedFocus.topic} (edited)` : confirmedFocus.topic
      chips.push({ id: "focus", label: "Focus", summary: focusLabel, completed: true })
    }
    if (selectedPlatforms.length > 0 && (stage === "generating" || stage === "complete")) {
      chips.push({ id: "platforms", label: "Platforms", summary: selectedPlatforms.join(", "), completed: true })
    }
  }

  if (appMode === "reverse_engineer") {
    const regionLabels: Record<string, string> = { AE: "UAE", SA: "KSA", KW: "Kuwait", QA: "Qatar", US: "US", SG: "SG" }
    if (selectedPlatforms.length > 0 && stage !== "re_setup") {
      chips.push({ id: "re_region", label: "Region", summary: regionLabels[reRegion] ?? reRegion, completed: true })
      chips.push({ id: "re_platform", label: "Platform", summary: selectedPlatforms[0], completed: true })
      if (reIndustry) {
        const industryLabels: Record<string, string> = { real_estate: "Real Estate", automotive: "Automotive", hospitality: "Hospitality", food_beverage: "Food & Beverage", fashion_beauty: "Fashion & Beauty", fitness_wellness: "Fitness & Wellness", ecommerce: "E-commerce", education: "Education", healthcare: "Healthcare", financial_services: "Finance" }
        chips.push({ id: "re_industry", label: "Industry", summary: industryLabels[reIndustry] ?? reIndustry, completed: true })
      }
      if (reAudience) {
        const audienceLabels: Record<string, string> = { gen_z: "Gen Z", millennials: "Millennials", gen_x: "Gen X", boomers: "Boomers", all_ages: "All Ages" }
        chips.push({ id: "re_audience", label: "Audience", summary: audienceLabels[reAudience] ?? reAudience, completed: true })
      }
    }
    if ((stage === "generating" || stage === "complete")) {
      chips.push({ id: "re_scope", label: "Scope", summary: reNiche || "Broad Trends", completed: true })
      const lagChipLabels: Record<string, string> = { same_day: "Same Day", "24h": "24h", "48h": "48h", "72h": "72h", "1w": "1 Week", "2w": "2 Weeks", "4w": "4 Weeks", "6m": "6 Months", "12m": "12 Months" }
      chips.push({ id: "re_lag", label: "Publish In", summary: lagChipLabels[reLag] ?? reLag, completed: true })
    }
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
            {(stage === "complete" || stage === "error" || (appMode && stage !== "mode_select")) && (
              <button onClick={handleFullReset} className="text-xs text-gray-400 hover:text-[#190A46] border border-gray-200 px-3 py-1 rounded-lg">New task</button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        <ProgressStrip chips={chips} />

        <div className="space-y-5">
          {/* MODE SELECT */}
          {stage === "mode_select" && <ModeSelectStage onSelect={handleModeSelect} />}

          {/* ══ OPTIMIZE FLOW ══ */}

          {appMode === "optimize" && stage === "source_input" && sourceMode && (
            <SourceInputStage
              mode={sourceMode}
              onSubmitUrl={handleUrlSubmit}
              onUploadComplete={handleUploadComplete}
              onBack={() => {}}
            />
          )}

          {appMode === "optimize" && stage === "ingesting" && !ingestion && (
            <div className="bg-white border border-gray-100 rounded-xl p-8 flex items-center justify-center gap-3">
              <div className="w-4 h-4 border-2 border-[#190A46] border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-gray-500">Analysing content&hellip;</p>
            </div>
          )}

          {appMode === "optimize" && (stage === "ingestion_confirmed" || (stage === "ingesting" && ingestion)) && ingestion && (
            <IngestionConfirmedStage
              title={ingestion.title}
              duration={ingestion.duration}
              thumbnail={ingestion.thumbnail}
              transcriptSummary={transcriptSummary ?? null}
              topic={detectedTopic}
              language={detectedLanguage}
              provenance={ingestion.provenance as "observed" | "derived" | "inferred" | "unavailable"}
            />
          )}

          {appMode === "optimize" && stage === "content_focus_confirm" && (
            <ContentFocusConfirmStage
              topic={detectedTopic ?? ingestion?.title ?? null}
              summary={transcriptSummary ?? null}
              language={detectedLanguage}
              transcriptPreview={transcriptExcerpt}
              weakIntelligence={isWeakIntelligence}
              onConfirm={handleContentFocusConfirm}
            />
          )}

          {appMode === "optimize" && stage === "platform_select" && <PlatformSelectionStage onConfirm={handlePlatformConfirm} />}

          {appMode === "optimize" && state.sections.some((s) => s.data?.blocked) && (
            <BlockedCard
              data={state.sections.find((s) => s.data?.blocked)?.data ?? { blocked: true }}
              jobId={jobIdV2 ?? undefined}
              onUploadComplete={() => { setStage("source_input"); setSourceMode("upload") }}
            />
          )}

          {/* ══ REVERSE ENGINEER FLOW ══ */}

          {appMode === "reverse_engineer" && stage === "re_setup" && (
            <ReverseEngineerSetupStage onConfirm={handleReConfirm} />
          )}

          {appMode === "reverse_engineer" && stage === "generating" && Object.values(platformCards).every((c) => Object.values(c).every((v) => v === null)) && (
            <div className="bg-white border border-gray-100 rounded-xl p-8 flex items-center justify-center gap-3">
              <div className="w-4 h-4 border-2 border-[#b87333] border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-gray-500">Scanning platform trends&hellip;</p>
            </div>
          )}

          {/* ══ SHARED: Platform workspaces ══ */}

          {(stage === "generating" || stage === "complete") && Object.entries(platformCards).map(([platform, cards]) => (
            <div key={platform} className="animate-fade-in">
              <PlatformWorkspace platform={platform} mode={appMode ?? "optimize"} cards={cards} />
            </div>
          ))}

          {/* Error */}
          {stage === "error" && (
            <div className="bg-red-50 border border-red-100 rounded-xl p-5">
              <p className="text-sm font-medium text-red-800">
                {appMode === "reverse_engineer" ? "Trend scan didn\u2019t complete" : "Analysis failed"}
              </p>
              {error && <p className="text-sm text-red-600 mt-1">{error}</p>}
              <button onClick={handleFullReset} className="text-xs text-red-500 hover:underline mt-2">Try again</button>
            </div>
          )}

          {/* Complete */}
          {stage === "complete" && (
            <div className="bg-green-50 border border-green-100 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-green-800">
                  {appMode === "reverse_engineer" ? "Trend scan done" : "Content generation complete"}
                </p>
                <button onClick={handleFullReset} className="text-xs text-green-700 border border-green-200 px-3 py-1 rounded-lg hover:bg-green-100">New task</button>
              </div>
              {appMode === "reverse_engineer" && (
                <button
                  onClick={handleSwitchToOptimize}
                  className="mt-2 text-xs text-[#190A46] border border-[#190A46]/20 px-3 py-1 rounded-lg hover:bg-[#190A46]/5 transition-colors"
                >
                  Create content from these trends &rarr;
                </button>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Dev debug panel — only in development */}
      {process.env.NODE_ENV === "development" && typeof DevDebugPanel === "function" && (
        <DevDebugPanel
          mode={appMode}
          stage={stage}
          platform={selectedPlatforms[0] ?? null}
          niche={reNiche}
          lag={reLag}
          trendRadarData={platformCards[selectedPlatforms[0] ?? ""]?.trendRadar ?? null}
        />
      )}

      <footer className="max-w-5xl mx-auto px-6 py-6 mt-8 border-t border-gray-100">
        <p className="text-xs text-gray-400">DigitAlchemy&reg; Tech Limited &middot; ADGM No. 35004 &middot; Sky Tower, Al Reem Island, Abu Dhabi, UAE</p>
      </footer>
    </div>
  )
}
