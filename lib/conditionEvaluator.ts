// lib/conditionEvaluator.ts
// Safe, declarative condition evaluator — no eval, no new Function

import type { IntakeCondition, StepCondition, CompoundCondition, IntakeState, IntakeFieldValue } from "@/types"

function isCompound(c: IntakeCondition): c is CompoundCondition {
  return "logic" in c && "conditions" in c
}

function evaluateSimple(condition: StepCondition, state: IntakeState): boolean {
  const raw = state[condition.field]
  const fieldValue: IntakeFieldValue = raw !== undefined ? raw : null

  switch (condition.operator) {
    case "exists":
      return fieldValue !== null && fieldValue !== undefined && fieldValue !== ""

    case "not_exists":
      return fieldValue === null || fieldValue === undefined || fieldValue === ""

    case "eq":
      if (Array.isArray(fieldValue)) return false
      return String(fieldValue ?? "") === String(condition.value ?? "")

    case "neq":
      if (Array.isArray(fieldValue)) return false
      return String(fieldValue ?? "") !== String(condition.value ?? "")

    case "includes":
      if (Array.isArray(fieldValue)) {
        return fieldValue.includes(String(condition.value ?? ""))
      }
      return String(fieldValue ?? "").includes(String(condition.value ?? ""))

    case "not_includes":
      if (Array.isArray(fieldValue)) {
        return !fieldValue.includes(String(condition.value ?? ""))
      }
      return !String(fieldValue ?? "").includes(String(condition.value ?? ""))

    case "contains":
      if (Array.isArray(fieldValue)) {
        return Array.isArray(condition.value)
          ? condition.value.every((v) => fieldValue.includes(String(v)))
          : fieldValue.includes(String(condition.value ?? ""))
      }
      return String(fieldValue ?? "").toLowerCase().includes(String(condition.value ?? "").toLowerCase())

    case "gt":
      return Number(fieldValue) > Number(condition.value)

    case "lt":
      return Number(fieldValue) < Number(condition.value)

    default:
      return true
  }
}

export function evaluateCondition(condition: IntakeCondition, state: IntakeState): boolean {
  if (isCompound(condition)) {
    const results = condition.conditions.map((c) => evaluateCondition(c, state))
    return condition.logic === "and"
      ? results.every(Boolean)
      : results.some(Boolean)
  }
  return evaluateSimple(condition, state)
}

export function getVisibleSteps(
  steps: import("@/types").IntakeStep[],
  state: IntakeState
) {
  return steps.filter((step) => {
    if (!step.condition) return true
    return evaluateCondition(step.condition, state)
  })
}

export function validateIntakeState(
  steps: import("@/types").IntakeStep[],
  state: IntakeState
): import("@/types").IntakeValidationResult {
  const visibleSteps = getVisibleSteps(steps, state)
  const missingFields: { id: string; label: string }[] = []

  for (const step of visibleSteps) {
    if (step.required === false) continue
    const value = state[step.id]
    if (value === null || value === undefined || value === "") {
      missingFields.push({ id: step.id, label: step.label })
    } else if (Array.isArray(value) && value.length === 0) {
      missingFields.push({ id: step.id, label: step.label })
    }
  }

  return { valid: missingFields.length === 0, missingFields }
}
