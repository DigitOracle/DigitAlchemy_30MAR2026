import type { RegistryProvider } from "./registryProvider"
import type { MCPServer } from "@/types"
import registryData from "@/data/mcp_registry.json"

export class LocalRegistryProvider implements RegistryProvider {
  async getServers(): Promise<MCPServer[]> {
    return registryData.servers as MCPServer[]
  }
  async getServerById(id: string): Promise<MCPServer | null> {
    return (registryData.servers as MCPServer[]).find((s) => s.id === id) ?? null
  }
}
