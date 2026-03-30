// lib/workflowDetector.ts
// Ranked multi-candidate workflow detection — replaces first-match routing

import workflowsData from "@/data/workflows.json"
import type { WorkflowDefinition, WorkflowCandidate, ConfidenceLevel, CompoundTaskPlan, WorkflowBranch } from "@/types"

const STRONG_KEYWORD_WEIGHT = 4
const KEYWORD_WEIGHT = 2
const PHRASE_BONUS = 3

function scoreWorkflow(workflow: WorkflowDefinition, lower: string): { score: number; matched: string[] } {
  let score = 0
  const matched: string[] = []

  for (const kw of workflow.triggers.keywords) {
    if (lower.includes(kw)) {
      score += KEYWORD_WEIGHT
      matched.push(kw)
    }
  }

  for (const kw of workflow.triggers.strongKeywords ?? []) {
    if (lower.includes(kw)) {
      score += STRONG_KEYWORD_WEIGHT
      if (!matched.includes(kw)) matched.push(kw)
    }
  }

  // Phrase-level bonus: check if multiple keywords appear close together
  if (matched.length >= 3) score += PHRASE_BONUS

  return { score, matched }
}

function scoreToConfidence(score: number, maxScore: number): ConfidenceLevel {
  const ratio = maxScore > 0 ? score / maxScore : 0
  if (ratio >= 0.7) return "high"
  if (ratio >= 0.35) return "medium"
  return "low"
}

export function detectWorkflowCandidates(
  task: string,
  topN = 3
): WorkflowCandidate[] {
  const lower = task.toLowerCase()
  const workflows = workflowsData as WorkflowDefinition[]

  const scored = workflows
    .map((workflow) => {
      const { score, matched } = scoreWorkflow(workflow, lower)
      return { workflow, score, matched }
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)

  const maxScore = scored[0]?.score ?? 1

  return scored.slice(0, topN).map(({ workflow, score, matched }) => ({
    workflow,
    score,
    matchedKeywords: matched,
    confidence: scoreToConfidence(score, maxScore),
    reason: `Matched: ${matched.slice(0, 3).join(", ")}${matched.length > 3 ? ` +${matched.length - 3} more` : ""}`,
  }))
}

export function detectPrimaryWorkflow(task: string): WorkflowDefinition | null {
  const candidates = detectWorkflowCandidates(task, 1)
  return candidates[0]?.workflow ?? null
}

export function detectCompoundTask(task: string, threshold = 2): CompoundTaskPlan | null {
  const candidates = detectWorkflowCandidates(task, 5)
  const qualifying = candidates.filter((c) => c.score >= threshold)

  if (qualifying.length < 2) return null

  // Check canCompound compatibility
  const primary = qualifying[0]
  const compatibleBranches = qualifying.filter((c, i) => {
    if (i === 0) return true
    const canCombine = primary.workflow.canCompound?.includes(c.workflow.id)
    return canCombine
  })

  if (compatibleBranches.length < 2) return null

  const totalScore = compatibleBranches.reduce((sum, c) => sum + c.score, 0)

  const branches: WorkflowBranch[] = compatibleBranches.map((c, i) => ({
    workflowId: c.workflow.id,
    workflowLabel: c.workflow.label,
    weight: c.score / totalScore,
    sequencePosition: i,
    dependsOn: i > 0 ? [compatibleBranches[i - 1].workflow.id] : undefined,
  }))

  return {
    isCompound: true,
    branches,
    executionMode: "sequential",
    mergeStrategy: "weighted",
    totalEstimatedMs: branches.length * 8000,
  }
}

export function getAllWorkflows(): WorkflowDefinition[] {
  return workflowsData as WorkflowDefinition[]
}

export function getWorkflowById(id: string): WorkflowDefinition | null {
  return (workflowsData as WorkflowDefinition[]).find((w) => w.id === id) ?? null
}
