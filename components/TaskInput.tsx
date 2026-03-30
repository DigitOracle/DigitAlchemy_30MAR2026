"use client"
import { useState } from "react"

const EXAMPLE_PROMPTS = [
  "Analyze this HeyGen video and recommend trending hashtags and music for TikTok and Instagram",
  "Review this IFC model and identify classification issues and missing COBie data",
  "Map this ISO 19650 handover process to the correct agents and toolchain",
  "Plan the sensor deployment strategy for a 50,000 sqm mixed-use development in Abu Dhabi",
  "Analyze a digital twin governance workflow for a smart city district",
]

interface TaskInputProps {
  onSubmit: (task: string) => void
  loading: boolean
}

export function TaskInput({ onSubmit, loading }: TaskInputProps) {
  const [task, setTask] = useState("")

  const handleSubmit = () => {
    if (task.trim().length >= 5 && !loading) {
      onSubmit(task.trim())
    }
  }

  return (
    <div className="bg-white border border-gray-100 rounded-xl p-6 shadow-sm">
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Describe your task or workflow
      </label>
      <textarea
        value={task}
        onChange={(e) => setTask(e.target.value)}
        placeholder="e.g. Analyze a HeyGen video and recommend hashtags, or review an IFC model for classification issues..."
        rows={4}
        className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#190A46] focus:border-transparent resize-none"
        onKeyDown={(e) => { if (e.key === "Enter" && e.metaKey) handleSubmit() }}
      />
      <div className="mt-3 flex items-center justify-between gap-4">
        <div className="flex flex-wrap gap-2">
          {EXAMPLE_PROMPTS.slice(0, 3).map((p, i) => (
            <button
              key={i}
              onClick={() => setTask(p)}
              className="text-xs text-gray-500 hover:text-[#190A46] border border-gray-200 hover:border-[#190A46] rounded px-2 py-1 transition-colors"
            >
              {p.slice(0, 40)}{"\u2026"}
            </button>
          ))}
        </div>
        <button
          onClick={handleSubmit}
          disabled={task.trim().length < 5 || loading}
          className="shrink-0 bg-[#190A46] text-white text-sm font-medium px-6 py-2 rounded-lg hover:bg-[#2a1560] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? "Analyzing\u2026" : "Analyze"}
        </button>
      </div>
      <p className="text-xs text-gray-400 mt-2">{"\u2318"} + Enter to submit</p>
    </div>
  )
}
