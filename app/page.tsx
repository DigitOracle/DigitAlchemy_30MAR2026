"use client"
import { TaskInput } from "@/components/TaskInput"
import { useStream } from "@/lib/useStream"
import { IntakeSummaryCard } from "@/components/sections/IntakeSummaryCard"
import { ExecutionTimelineCard } from "@/components/sections/ExecutionTimelineCard"
import { ContentIntelligenceCard } from "@/components/sections/ContentIntelligenceCard"
import { TranscriptCard } from "@/components/sections/TranscriptCard"
import { TrendIntelligenceCard } from "@/components/sections/TrendIntelligenceCard"
import { PlatformPacksCard } from "@/components/sections/PlatformPacksCard"
import { AgentPlanCard } from "@/components/sections/AgentPlanCard"
import type { WorkflowDefinition, IntakeState, CompoundTaskPlan } from "@/types"

function SectionRenderer({ id, data }: { id: string; data: Record<string, unknown> }) {
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
  creating: "Creating job\u2026",
  streaming: "Analysis running\u2026",
  complete: "Complete",
  failed: "Failed",
}

export default function ConsolePage() {
  const { state, startStream, reset } = useStream()
  const loading = state.status === "streaming"

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
            {state.status !== "idle" && (
              <div className="flex items-center gap-2">
                {loading && <div className="w-2 h-2 rounded-full bg-[#b87333] animate-pulse" />}
                {state.status === "complete" && <div className="w-2 h-2 rounded-full bg-green-500" />}
                {state.status === "failed" && <div className="w-2 h-2 rounded-full bg-red-500" />}
                <span className="text-xs text-gray-500">{stageLabels[state.status]}</span>
                {state.currentProcessor && (
                  <span className="text-xs text-gray-400">{state.currentProcessor}</span>
                )}
              </div>
            )}
            {(state.status === "complete" || state.status === "failed") && (
              <button
                onClick={reset}
                className="text-xs text-gray-400 hover:text-[#190A46] border border-gray-200 px-3 py-1 rounded-lg"
              >
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
        {state.status === "idle" && (
          <div className="mb-6">
            <h1 className="text-xl font-semibold text-gray-900">Task analysis</h1>
            <p className="text-sm text-gray-500 mt-1">
              Describe a task. Command Desk classifies it, gathers context, and streams intelligence as it arrives.
            </p>
          </div>
        )}

        <div className="space-y-5">
          {state.status === "idle" && (
            <TaskInput onSubmit={handleSubmit} loading={false} />
          )}

          {loading && state.sections.length === 0 && (
            <div className="bg-white border border-gray-100 rounded-xl p-8 flex items-center justify-center gap-3">
              <div className="w-4 h-4 border-2 border-[#190A46] border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-gray-500">Initialising analysis pipeline&hellip;</p>
            </div>
          )}

          {/* Progressive section rendering */}
          {state.sections
            .filter((s) => s.status === "ready" && s.data && s.id !== "actions")
            .map((section) => (
              <div key={section.id} className="animate-fade-in">
                <SectionRenderer id={section.id} data={section.data!} />
              </div>
            ))}

          {state.status === "failed" && state.error && (
            <div className="bg-red-50 border border-red-100 rounded-xl p-5">
              <p className="text-sm font-medium text-red-800">Analysis failed</p>
              <p className="text-sm text-red-600 mt-1">{state.error}</p>
              <button onClick={reset} className="text-xs text-red-500 hover:underline mt-2">Try again</button>
            </div>
          )}

          {state.status === "complete" && (
            <div className="bg-green-50 border border-green-100 rounded-xl p-4 flex items-center justify-between">
              <p className="text-sm text-green-800">Analysis complete</p>
              <button onClick={reset} className="text-xs text-green-700 border border-green-200 px-3 py-1 rounded-lg hover:bg-green-100">
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
