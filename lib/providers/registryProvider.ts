import type { MCPServer } from "@/types"

export interface RegistryProvider {
  getServers(): Promise<MCPServer[]>
  getServerById(id: string): Promise<MCPServer | null>
}
