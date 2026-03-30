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
