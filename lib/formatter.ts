import type { AnalyzeTaskResult } from "@/types"

export function validateResult(data: unknown): data is AnalyzeTaskResult {
  if (!data || typeof data !== "object") return false
  const d = data as Record<string, unknown>
  return (
    typeof d.taskSummary === "string" &&
    typeof d.workflowType === "string" &&
    Array.isArray(d.recommendedAgents) &&
    Array.isArray(d.recommendedMCPs) &&
    Array.isArray(d.executionOrder) &&
    Array.isArray(d.dependencies) &&
    Array.isArray(d.warnings) &&
    Array.isArray(d.nextActions)
  )
}

export function safeParseJSON(text: string): unknown {
  const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim()
  try {
    return JSON.parse(cleaned)
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/)
    if (match) {
      try { return JSON.parse(match[0]) } catch { return null }
    }
    return null
  }
}
