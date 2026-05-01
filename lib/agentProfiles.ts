import agentData from "@/data/agent_profiles.json"
import type { AgentProfile } from "@/types"

export function getAllAgents(): AgentProfile[] {
  return agentData as AgentProfile[]
}

export function getAgentById(id: string): AgentProfile | undefined {
  return (agentData as AgentProfile[]).find((a) => a.id === id)
}

export function agentsToProfileString(): string {
  return (agentData as AgentProfile[]).map((a) => `- ${a.id} | ${a.displayName} | ${a.category} | ${a.shortDescription}`).join("\n")
}

/**
 * Canonical DiceBear avatar URL for a DigitAlchemy agent.
 *
 * Locked discipline: same face for an agent everywhere it's referenced.
 * - seed = agent ID (DA-01, DA-07, etc.) — NEVER displayName
 * - backgroundColor = 190A46 (brand navy) — fixed
 * - radius = 12 (rounded square) — fixed
 * - bottts style — fixed
 *
 * Surgical usage only: topology canvas, event log, audit trail,
 * citation chips. NOT chrome, brand pages, /knowledge, or as
 * decoration. Inline DiceBear URLs anywhere else are violations.
 */
export function getAgentAvatarUrl(agentId: string, size: number = 64): string {
  return `https://api.dicebear.com/9.x/bottts/svg?seed=${agentId}&backgroundColor=190A46&radius=12&size=${size}`
}
