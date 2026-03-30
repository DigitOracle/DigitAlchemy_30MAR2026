import type { RecommendedMCP, MCPServer } from "@/types"

export function scoreMCPs(task: string, servers: MCPServer[]): RecommendedMCP[] {
  const lower = task.toLowerCase()
  const scored: { server: MCPServer; score: number }[] = []

  const categoryKeywords: Record<string, string[]> = {
    BIM: ["bim", "revit", "ifc", "model", "autocad", "cobie", "uniclass"],
    Social: ["heygen", "video", "tiktok", "instagram", "hashtag", "social", "content", "trend", "post", "publish"],
    GIS: ["gis", "spatial", "map", "geospatial", "coordinates", "layer"],
    Regulatory: ["compliance", "standard", "iso", "regulation", "uae", "permit"],
    IoT: ["sensor", "iot", "viper", "telemetry", "time-series"],
    "Digital Twin": ["digital twin", "twin", "simulation", "real-time"],
    DevOps: ["deploy", "ci/cd", "code", "pipeline", "github", "build"],
    Research: ["research", "search", "find", "lookup", "wiki"],
    Ingestion: ["convert", "pdf", "document", "markdown", "office"],
    Data: ["database", "query", "store", "graph", "neo4j"],
  }

  for (const server of servers) {
    let score = 0
    const keywords = categoryKeywords[server.category] ?? []
    for (const kw of keywords) {
      if (lower.includes(kw)) score += 2
    }
    if (lower.includes(server.name.toLowerCase())) score += 5
    if (lower.includes(server.id.toLowerCase())) score += 3
    if (score > 0) scored.push({ server, score })
  }

  scored.sort((a, b) => b.score - a.score)
  const top = scored.slice(0, 8)

  return top.map(({ server, score }, i) => ({
    name: server.name,
    role: server.description,
    priority: i < 2 ? "core" : i < 5 ? "supporting" : "optional",
    reason: `Score ${score} — matched task keywords to ${server.category} category`,
    source: "registry",
    confidence: i < 2 ? "high" : i < 5 ? "medium" : "low",
  }))
}
