// lib/orchestrationPlanner.ts
// Generates a deterministic execution plan before LLM reasoning

import { getWorkflowById } from "./workflowDetector"
import processorRegistry from "@/data/processor_registry.json"
import type { OrchestrationPlan, OrchestrationStep, WorkflowBranch, CompoundTaskPlan } from "@/types"

function getProcessor(id: string) {
  return processorRegistry.processors.find((p) => p.id === id)
}

function buildStepsForWorkflow(
  workflowId: string,
  intakeContext: Record<string, string | string[]>,
  startIndex = 0
): OrchestrationStep[] {
  const workflow = getWorkflowById(workflowId)
  if (!workflow) return []

  const steps: OrchestrationStep[] = []
  let prevStepId: string | null = null

  workflow.processorChain.forEach((processorId, i) => {
    const processor = getProcessor(processorId)
    if (!processor) return

    const stepId = `${workflowId}-${processorId}-${startIndex + i}`
    const step: OrchestrationStep = {
      stepId,
      processorId,
      processorLabel: processor.label,
      inputs: processor.requiredInputs,
      outputs: processor.produces,
      dependsOn: prevStepId ? [prevStepId] : [],
      estimatedMs: processor.timeoutMs,
      optional: false,
      status: "pending",
    }

    steps.push(step)
    prevStepId = stepId
  })

  return steps
}

export function generateOrchestrationPlan(
  workflowId: string,
  intakeContext: Record<string, string | string[]>,
  compoundPlan?: CompoundTaskPlan
): OrchestrationPlan {
  const planId = `plan-${Date.now()}`
  let steps: OrchestrationStep[] = []
  let totalMs = 0

  if (compoundPlan?.isCompound && compoundPlan.branches.length > 1) {
    // Build steps for each branch sequentially
    let offset = 0
    for (const branch of compoundPlan.branches) {
      const branchSteps = buildStepsForWorkflow(branch.workflowId, intakeContext, offset)
      steps = steps.concat(branchSteps)
      offset += branchSteps.length
    }
  } else {
    steps = buildStepsForWorkflow(workflowId, intakeContext)
  }

  // Always end with llm-analysis if not already present
  const hasAnalysis = steps.some((s) => s.processorId === "llm-analysis")
  if (!hasAnalysis) {
    const analysisProcessor = getProcessor("llm-analysis")
    if (analysisProcessor) {
      const lastStep = steps[steps.length - 1]
      steps.push({
        stepId: `final-llm-analysis`,
        processorId: "llm-analysis",
        processorLabel: analysisProcessor.label,
        inputs: ["task", "enriched-context"],
        outputs: analysisProcessor.produces,
        dependsOn: lastStep ? [lastStep.stepId] : [],
        estimatedMs: analysisProcessor.timeoutMs,
        optional: false,
        status: "pending",
      })
    }
  }

  totalMs = steps.reduce((sum, s) => sum + s.estimatedMs, 0)

  return {
    planId,
    workflowId,
    isCompound: compoundPlan?.isCompound ?? false,
    branches: compoundPlan?.branches,
    steps,
    totalEstimatedMs: totalMs,
    generatedAt: new Date().toISOString(),
  }
}

export function planToSystemPromptSummary(plan: OrchestrationPlan): string {
  const stepLines = plan.steps.map((s, i) =>
    `${i + 1}. ${s.processorLabel} → produces: ${s.outputs.join(", ")}`
  )
  return `Execution plan (${plan.steps.length} steps, est. ${Math.round(plan.totalEstimatedMs / 1000)}s):\n${stepLines.join("\n")}`
}
