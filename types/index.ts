export type WorkflowCategory =
  | "Social Video Intelligence"
  | "BIM / Model Review"
  | "GIS / Spatial Analysis"
  | "Compliance / Regulatory Mapping"
  | "IoT / Sensor Planning"
  | "Digital Twin"
  | "General Orchestration"

export type MCPPriority = "core" | "supporting" | "optional"
export type MCPSource = "registry" | "missing_but_recommended"
export type StandardsSource = "firestore" | "local-cache"

export type AgentProfile = {
  id: string
  displayName: string
  shortDescription: string
  category: string
  userVisible: boolean
}

export type MCPServer = {
  id: string
  name: string
  description: string
  category: string
  status: "connected" | "partial" | "failed" | "needs-auth"
  tools?: number
  source: "legacy" | "docker"
}

export type StandardsEntry = {
  title: string
  code: string
  collection: string
  category: string
  tags: string[]
}

export type StandardsContext = {
  source: StandardsSource
  collectionsConsulted: string[]
  relevantStandards: {
    title: string
    code: string
    collection: string
    reason: string
  }[]
  standardsActions: string[]
}

export type RecommendedAgent = {
  id: string
  displayName: string
  shortDescription: string
  category: string
}

export type RecommendedMCP = {
  name: string
  role: string
  priority: MCPPriority
  reason: string
  source: MCPSource
}

export type AnalyzeTaskResult = {
  taskSummary: string
  workflowType: WorkflowCategory | string
  recommendedAgents: RecommendedAgent[]
  recommendedMCPs: RecommendedMCP[]
  executionOrder: string[]
  dependencies: string[]
  warnings: string[]
  nextActions: string[]
  standardsContext?: StandardsContext
}

export type AnalyzeTaskRequest = { task: string }

export type AnalyzeTaskResponse =
  | { success: true; result: AnalyzeTaskResult }
  | { success: false; error: string }
