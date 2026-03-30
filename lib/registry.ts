import { LocalRegistryProvider } from "./providers/localRegistryProvider"
import type { MCPServer } from "@/types"

const provider = new LocalRegistryProvider()

export async function getAllServers(): Promise<MCPServer[]> {
  return provider.getServers()
}

export async function getConnectedServers(): Promise<MCPServer[]> {
  const all = await provider.getServers()
  return all.filter((s) => s.status === "connected")
}

export function serversToRegistryString(servers: MCPServer[]): string {
  return servers.map((s) => `- ${s.name} (${s.id}): ${s.description} [${s.category}] [${s.status}]${s.tools ? ` [${s.tools} tools]` : ""}`).join("\n")
}
