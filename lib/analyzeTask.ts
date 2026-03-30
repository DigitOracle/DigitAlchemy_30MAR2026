import Anthropic from "@anthropic-ai/sdk"
import { getAllServers, serversToRegistryString } from "./registry"
import { agentsToProfileString } from "./agentProfiles"
import { getStandardsContext } from "./standards"
import { scoreMCPs } from "./scoring"
import { safeParseJSON, validateResult } from "./formatter"
import type { AnalyzeTaskResult } from "@/types"

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

function buildSystemPrompt(
  registryStr: string,
  agentStr: string,
  isCompound: boolean = false,
  compoundBranches: { workflowId: string; workflowLabel: string; weight: number }[] = []
): string {
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
- Document Analysis (PDF, reports, extraction, summarization)
- General Orchestration (multi-domain, mixed, unclear)

## PROVENANCE AND CONFIDENCE RULES
Every output field that is an AnnotatedValue must include:
- confidence: "high" | "medium" | "low"
- provenance: "observed" (from explicit task content) | "inferred" (from context) | "registry" (from MCP/agent registry) | "user-provided" (from intake form)
- reason: brief explanation

## COMPOUND TASK RULES
${isCompound && compoundBranches.length > 1
  ? `This is a compound task spanning: ${compoundBranches.map(b => b.workflowLabel).join(", ")}. Set isCompound: true and list compoundBranches in your response.`
  : "This is a single-workflow task. Set isCompound: false."}

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
  "taskSummary": { "value": "string", "confidence": "high|medium|low", "provenance": "observed|inferred|registry|user-provided", "reason": "string" },
  "workflowType": { "value": "string", "confidence": "high|medium|low", "provenance": "observed|inferred", "reason": "string" },
  "isCompound": false,
  "compoundBranches": [],
  "recommendedAgents": [{
    "id": "string", "displayName": "string", "shortDescription": "string", "category": "string",
    "confidence": "high|medium|low", "provenance": "registry|inferred"
  }],
  "recommendedMCPs": [{
    "name": "string", "role": "string", "priority": "core|supporting|optional",
    "reason": "string", "source": "registry|missing_but_recommended", "confidence": "high|medium|low"
  }],
  "executionOrder": ["string"],
  "dependencies": ["string"],
  "warnings": ["string"],
  "nextActions": ["string"]
}`
}

export async function analyzeTask(
  task: string,
  workflowId: string | null,
  workflowLabel: string | null,
  isCompound: boolean = false,
  compoundBranches: { workflowId: string; workflowLabel: string; weight: number }[] = []
): Promise<AnalyzeTaskResult> {
  const [servers, standardsContext] = await Promise.all([
    getAllServers(),
    getStandardsContext(task),
  ])

  const connectedServers = servers.filter((s) => s.status === "connected")
  const registryStr = serversToRegistryString(connectedServers)
  const agentStr = agentsToProfileString()
  const preScored = scoreMCPs(task, connectedServers)

  const workflowHint = workflowLabel
    ? `\nDetected workflow: ${workflowLabel} (${workflowId})`
    : ""

  const compoundHint = isCompound && compoundBranches.length > 1
    ? `\nCompound task spanning: ${compoundBranches.map(b => b.workflowLabel).join(", ")}`
    : ""

  const userPrompt = `Analyze this task and return the JSON execution plan.

TASK: ${task}${workflowHint}${compoundHint}

Pre-scored MCP candidates (use as hints, not constraints):
${preScored.map((m) => `- ${m.name}: ${m.priority} (${m.reason})`).join("\n")}

Return only valid JSON matching the schema. No prose.`

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2000,
    system: buildSystemPrompt(registryStr, agentStr, isCompound, compoundBranches),
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
