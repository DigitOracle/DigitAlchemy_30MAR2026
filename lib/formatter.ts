import type { AnalyzeTaskResult, AnnotatedValue } from "@/types"

function isAnnotatedString(v: unknown): v is AnnotatedValue<string> {
  return typeof v === "object" && v !== null && typeof (v as Record<string, unknown>).value === "string"
}

function wrapAnnotated(v: unknown): AnnotatedValue<string> | null {
  if (isAnnotatedString(v)) return v
  if (typeof v === "string") return { value: v, confidence: "medium", provenance: "inferred" }
  return null
}

export function validateResult(data: unknown): data is AnalyzeTaskResult {
  if (!data || typeof data !== "object") return false
  const d = data as Record<string, unknown>

  // Normalize flat strings → AnnotatedValue before validation
  const ts = wrapAnnotated(d.taskSummary)
  const wt = wrapAnnotated(d.workflowType)
  if (!ts || !wt) return false
  d.taskSummary = ts
  d.workflowType = wt

  return (
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
