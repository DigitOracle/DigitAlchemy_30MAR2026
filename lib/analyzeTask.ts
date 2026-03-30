import Anthropic from "@anthropic-ai/sdk"
import { getAllServers, serversToRegistryString } from "./registry"
import { agentsToProfileString } from "./agentProfiles"
import { getStandardsContext } from "./standards"
import { scoreMCPs } from "./scoring"
import { safeParseJSON, validateResult } from "./formatter"
import type { AnalyzeTaskResult } from "@/types"

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

function buildSystemPrompt(registryStr: string, agentStr: string): string {
  return `You are the DigitAlchemy® task analysis engine.

DigitAlchemy® is a UAE-based AI-driven digital transformation company. It operates a governed multi-agent workforce for BIM, GIS, IoT, compliance, digital twin, social content, and standards work.

Your job: analyze a task, identify the correct workflow type, agents, MCPs, execution order, dependencies, warnings, and next actions.

## AGENT WORKFORCE
${agentStr}

## MCP REGISTRY (connected servers)
${registryStr}

## WORKFLOW CATEGORIES
- Social Video Intelligence (HeyGen, content, hashtags, trends, social publishing)
- BIM / Model Review (Revit, IFC, AutoCAD, COBie, classification)
- GIS / Spatial Analysis (mapping, geospatial, coordinates, layers)
- Compliance / Regulatory Mapping (ISO, UAE, ADDC, standards, permits)
- IoT / Sensor Planning (VIPER, sensors, time-series, telemetry)
- Digital Twin (simulation, twin state, real-time, asset model)
- General Orchestration (multi-domain, mixed, unclear)

## CRITICAL RULES
1. Return ONLY valid JSON — no prose, no markdown, no explanation
2. Only recommend MCPs from the provided registry unless marked missing_but_recommended
3. Agent displayName must match the provided profiles exactly
4. Never expose internal DA-XX IDs in user-facing fields
5. executionOrder must be numbered plain-English steps
6. For social tasks: ScrapeCreators handles TikTok trends. Xpoz handles Instagram/Twitter search. HeyGen is the video source. Ayrshare is the publishing output.

## RESPONSE SCHEMA
Return exactly this JSON structure:
{
  "taskSummary": "string",
  "workflowType": "string",
  "recommendedAgents": [{ "id": "string", "displayName": "string", "shortDescription": "string", "category": "string" }],
  "recommendedMCPs": [{ "name": "string", "role": "string", "priority": "core|supporting|optional", "reason": "string", "source": "registry|missing_but_recommended" }],
  "executionOrder": ["string"],
  "dependencies": ["string"],
  "warnings": ["string"],
  "nextActions": ["string"]
}`
}

export async function analyzeTask(task: string): Promise<AnalyzeTaskResult> {
  const [servers, standardsContext] = await Promise.all([
    getAllServers(),
    getStandardsContext(task),
  ])

  const connectedServers = servers.filter((s) => s.status === "connected")
  const registryStr = serversToRegistryString(connectedServers)
  const agentStr = agentsToProfileString()
  const preScored = scoreMCPs(task, connectedServers)

  const userPrompt = `Analyze this task and return the JSON execution plan.

TASK: ${task}

Pre-scored MCP candidates (use as hints, not constraints):
${preScored.map((m) => `- ${m.name}: ${m.priority} (${m.reason})`).join("\n")}

Return only valid JSON matching the schema. No prose.`

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2000,
    system: buildSystemPrompt(registryStr, agentStr),
    messages: [{ role: "user", content: userPrompt }],
  })

  const text = response.content[0].type === "text" ? response.content[0].text : ""
  const parsed = safeParseJSON(text)

  if (!validateResult(parsed)) {
    throw new Error("Invalid response structure from analysis engine")
  }

  if (standardsContext) {
    parsed.standardsContext = standardsContext
  }

  return parsed as AnalyzeTaskResult
}
