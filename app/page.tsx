"use client"
import { useState } from "react"
import { TaskInput } from "@/components/TaskInput"
import { ExecutionPlan } from "@/components/ExecutionPlan"
import type { AnalyzeTaskResult } from "@/types"

export default function ConsolePage() {
  const [result, setResult] = useState<AnalyzeTaskResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (task: string) => {
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task }),
      })
      const data = await res.json()
      if (data.success) {
        setResult(data.result)
      } else {
        setError(data.error ?? "Analysis failed")
      }
    } catch {
      setError("Failed to connect to analysis engine")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded bg-[#190A46] flex items-center justify-center">
              <span className="text-white text-xs font-bold">DA</span>
            </div>
            <div>
              <span className="text-sm font-semibold text-gray-900">DigitAlchemy{"\u00AE"}</span>
              <span className="text-sm text-gray-400 ml-2">Console</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-400" />
            <span className="text-xs text-gray-500">Orchestration layer connected</span>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-5xl mx-auto px-6 py-8">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-gray-900">Task analysis</h1>
          <p className="text-sm text-gray-500 mt-1">
            Describe a task or workflow. The system will identify the correct agents, MCPs, and execution path.
          </p>
        </div>

        <div className="space-y-6">
          <TaskInput onSubmit={handleSubmit} loading={loading} />

          {loading && (
            <div className="bg-white border border-gray-100 rounded-xl p-8 shadow-sm flex items-center justify-center gap-3">
              <div className="w-4 h-4 border-2 border-[#190A46] border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-gray-500">Analyzing task against MCP registry and agent profiles{"\u2026"}</p>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-100 rounded-xl p-5">
              <p className="text-sm font-medium text-red-800">Analysis failed</p>
              <p className="text-sm text-red-600 mt-1">{error}</p>
            </div>
          )}

          {result && <ExecutionPlan result={result} />}
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-5xl mx-auto px-6 py-6 mt-8 border-t border-gray-100">
        <p className="text-xs text-gray-400">
          DigitAlchemy{"\u00AE"} Tech Limited {"\u00B7"} ADGM No. 35004 {"\u00B7"} Sky Tower, Al Reem Island, Abu Dhabi, UAE
        </p>
      </footer>
    </div>
  )
}
