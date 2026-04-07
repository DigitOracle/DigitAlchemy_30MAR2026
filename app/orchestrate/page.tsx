"use client"

import { useState, useMemo, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/AuthContext"
import Link from "next/link"
import agentProfilesData from "@/data/agent_profiles.json"
import mcpRegistryData from "@/data/mcp_registry.json"
import workflowsData from "@/data/workflows.json"

// ── Types ────────────────────────────────────────────────────────────────────

type Agent = {
  id: string
  displayName: string
  shortDescription: string
  category: string
  userVisible: boolean
}

type MCPServer = {
  id: string
  name: string
  description: string
  category: string
  status: string
  tools?: number
  source: string
}

type Workflow = {
  id: string
  label: string
  agents: string[]
  mcpTools: string[]
}

type AuditStatus = "ALIVE" | "DEGRADED" | "DEAD"

type AuditEntry = {
  status: AuditStatus
  testResult: string
  fixNeeded: string | null
  pipelineRole: string
}

// ── Phase 0 Audit Results (1 April 2026) ─────────────────────────────────────

const AUDIT: Record<string, AuditEntry> = {
  "revit-mcp":          { status: "ALIVE",    testResult: "3,740 elements, 42 categories, Revit running", fixNeeded: null, pipelineRole: "DA-02 BIM-QA — live Revit model control" },
  "autocad-mcp":        { status: "ALIVE",    testResult: "ezdxf backend v1.4.3, full capabilities", fixNeeded: null, pipelineRole: "DA-02 DWG operations" },
  "multicad-mcp":       { status: "ALIVE",    testResult: "Server responds, status disconnected", fixNeeded: null, pipelineRole: "DA-02 multi-format CAD fallback" },
  "autodesk-mcp":       { status: "DEGRADED", testResult: "Introspection works, doc search 404", fixNeeded: "search_aps_docs endpoint may have changed", pipelineRole: "DA-02 model metadata" },
  "heygen":             { status: "DEGRADED", testResult: "Server responds, needs OAuth browser flow", fixNeeded: "User must complete OAuth in browser", pipelineRole: "DA-09 AI avatar video" },
  "ayrshare":           { status: "ALIVE",    testResult: "10 doc results returned", fixNeeded: null, pipelineRole: "DA-09 social media publishing" },
  "xpoz":               { status: "ALIVE",    testResult: "Google OAuth key active, no expiration", fixNeeded: null, pipelineRole: "DA-09 social search" },
  "firebase-mcp":       { status: "ALIVE",    testResult: "digitalchemy-de4b7 ACTIVE", fixNeeded: null, pipelineRole: "DA-10 logging, job state, SSOT persistence" },
  "github-mcp":         { status: "ALIVE",    testResult: "Valid response from DigitOracle org", fixNeeded: null, pipelineRole: "DA-08 DevOps, version control" },
  "cesium-mcp":         { status: "DEAD",     testResult: "No browser connection", fixNeeded: "Open CesiumJS page with WebSocket before use", pipelineRole: "DA-03 GIS, 3D globe" },
  "notebooklm-mcp":     { status: "DEGRADED", testResult: "Server alive, authenticated=false", fixNeeded: "Run setup_auth to authenticate", pipelineRole: "DA-10 research, knowledge base" },
  "proxima":            { status: "DEAD",     testResult: "ECONNREFUSED port 19222", fixNeeded: "Launch Proxima desktop app", pipelineRole: "DA-01 multi-AI consensus" },
  "sequential-thinking":{ status: "ALIVE",    testResult: "Reasoning engine operational", fixNeeded: null, pipelineRole: "DA-01 Orchestrator core reasoning" },
  "deepseek-thinker":   { status: "DEAD",     testResult: "400 Model Not Exist (patched, needs restart)", fixNeeded: "Restart Claude Code session for fix to take effect", pipelineRole: "DA-11 deep standards reasoning" },
  "perplexity":         { status: "ALIVE",    testResult: "3 rich results on ISO 19650", fixNeeded: null, pipelineRole: "DA-04, DA-11 web-grounded research" },
  "context7":           { status: "ALIVE",    testResult: "IfcOpenShell: 719 snippets, High reputation", fixNeeded: null, pipelineRole: "DA-04 live documentation" },
  "google-docs":        { status: "ALIVE",    testResult: "77,330 chars from DA-OPS-001", fixNeeded: null, pipelineRole: "DA-10 Living Dossier, SSOT writes" },
  "youtube-transcript": { status: "DEAD",     testResult: "3/3 attempts failed", fixNeeded: "Package broken — check npm version", pipelineRole: "DA-09 video transcript extraction" },
  "chat-completions":   { status: "ALIVE",    testResult: "ALIVE LLaMA (Groq Llama 3.3 70B)", fixNeeded: null, pipelineRole: "DA-01 fast inference, DA-02 calcs" },
  "unrealEngine":       { status: "DEAD",     testResult: "ECONNREFUSED port 30010", fixNeeded: "Requires UE5 running with Remote Control", pipelineRole: "DA-05 UE Specialist" },
  "apify":              { status: "ALIVE",    testResult: "Search returned results, API token confirmed", fixNeeded: null, pipelineRole: "DA-09 web scraping, data extraction" },
  "docling":            { status: "ALIVE",    testResult: "Tools loaded via Docker gateway", fixNeeded: null, pipelineRole: "DA-10 document parsing (PDF, DOCX, PPTX)" },
  "qdrant":             { status: "ALIVE",    testResult: "Semantic memory tools loaded", fixNeeded: null, pipelineRole: "DA-01 semantic memory and retrieval" },
  // Docker MCPs
  "docker-github-official": { status: "ALIVE", testResult: "Docker gateway operational", fixNeeded: null, pipelineRole: "DA-08 GitHub via Docker" },
  "docker-playwright":  { status: "ALIVE",    testResult: "Docker gateway operational", fixNeeded: null, pipelineRole: "DA-09 browser automation" },
  "docker-brave":       { status: "ALIVE",    testResult: "Brave image search returned results", fixNeeded: null, pipelineRole: "DA-04, DA-11 web search" },
  "docker-grafana":     { status: "ALIVE",    testResult: "Docker gateway operational", fixNeeded: null, pipelineRole: "DA-08 monitoring dashboards" },
  "docker-neo4j":       { status: "ALIVE",    testResult: "Docker gateway operational", fixNeeded: null, pipelineRole: "DA-11 graph DB, standards crosswalks" },
  "docker-wikipedia":   { status: "ALIVE",    testResult: "Docker gateway operational", fixNeeded: null, pipelineRole: "DA-04 standards context" },
  "docker-markdownify": { status: "ALIVE",    testResult: "Docker gateway operational", fixNeeded: null, pipelineRole: "DA-10 document conversion" },
  "docker-markitdown":  { status: "ALIVE",    testResult: "Docker gateway operational", fixNeeded: null, pipelineRole: "DA-10 Office doc conversion" },
  "docker-postman":     { status: "ALIVE",    testResult: "Docker gateway operational", fixNeeded: null, pipelineRole: "DA-08 API validation" },
  "docker-elasticsearch":{ status: "ALIVE",   testResult: "Docker gateway operational", fixNeeded: null, pipelineRole: "DA-11 full-text standards search" },
  "docker-mongodb":     { status: "ALIVE",    testResult: "Docker gateway operational", fixNeeded: null, pipelineRole: "DA-03 geospatial data storage" },
  "docker-redis":       { status: "ALIVE",    testResult: "Docker gateway operational", fixNeeded: null, pipelineRole: "DA-07 sensor caching" },
  "docker-unreal":      { status: "ALIVE",    testResult: "Docker gateway operational", fixNeeded: null, pipelineRole: "DA-05 UE control via Docker" },
  "docker-timestream":  { status: "ALIVE",    testResult: "Docker gateway operational", fixNeeded: null, pipelineRole: "DA-07 VIPER sensor time-series" },
  "docker-sonarqube":   { status: "ALIVE",    testResult: "Docker gateway operational", fixNeeded: null, pipelineRole: "DA-08 code quality" },
  "docker-buildkite":   { status: "ALIVE",    testResult: "Docker gateway operational", fixNeeded: null, pipelineRole: "DA-08 CI/CD pipelines" },
  "docker-smartbear":   { status: "ALIVE",    testResult: "Docker gateway operational", fixNeeded: null, pipelineRole: "DA-08 API governance" },
  "docker-sequa":       { status: "ALIVE",    testResult: "Docker gateway operational", fixNeeded: null, pipelineRole: "DA-08 codebase context" },
}

// ── Data loading ─────────────────────────────────────────────────────────────

const agents = (agentProfilesData as Agent[]).filter(
  (a) => a.userVisible && a.id.startsWith("DA-")
)

const mcpServers = (mcpRegistryData as { servers: MCPServer[] }).servers
const mcpById = Object.fromEntries(mcpServers.map((s) => [s.id, s]))

const workflows = workflowsData as Workflow[]

// Build agent → MCP ID set via workflow cross-reference
function getMcpIdsForAgent(agentId: string): string[] {
  const toolIds = new Set<string>()
  for (const wf of workflows) {
    if (wf.agents.includes(agentId)) {
      for (const t of wf.mcpTools) toolIds.add(t)
    }
  }
  return Array.from(toolIds)
}

// ── Status indicator ─────────────────────────────────────────────────────────

function StatusDot({ status }: { status: AuditStatus }) {
  const color =
    status === "ALIVE" ? "bg-green-500" :
    status === "DEGRADED" ? "bg-amber-500" :
    "bg-red-500"
  return <span className={`inline-block w-2 h-2 rounded-full ${color}`} />
}

function StatusBadge({ status }: { status: AuditStatus }) {
  const styles =
    status === "ALIVE"
      ? "bg-green-50 text-green-700 border-green-200"
      : status === "DEGRADED"
      ? "bg-amber-50 text-amber-700 border-amber-200"
      : "bg-red-50 text-red-700 border-red-200"
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded border ${styles}`}>
      {status}
    </span>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function OrchestratePage() {
  const { user, profile, loading: authLoading } = useAuth()
  const router = useRouter()

  // Admin gate — redirect non-admins to Console home
  useEffect(() => {
    if (!authLoading && (!user || profile?.role !== "admin")) router.push("/")
  }, [user, profile, authLoading, router])

  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null)
  const [selectedMcpId, setSelectedMcpId] = useState<string | null>(null)

  const selectedAgent = agents.find((a) => a.id === selectedAgentId) ?? null

  // MCPs available for selected agent
  const agentMcps = useMemo(() => {
    if (!selectedAgentId) return []
    const ids = getMcpIdsForAgent(selectedAgentId)
    return ids
      .map((id) => mcpById[id])
      .filter(Boolean)
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [selectedAgentId])

  const selectedMcp = agentMcps.find((m) => m.id === selectedMcpId) ?? null
  const audit = selectedMcpId ? AUDIT[selectedMcpId] ?? null : null

  // Workflows that use the selected agent
  const agentWorkflows = useMemo(() => {
    if (!selectedAgentId) return []
    return workflows.filter((wf) => wf.agents.includes(selectedAgentId))
  }, [selectedAgentId])

  function handleAgentChange(id: string) {
    setSelectedAgentId(id || null)
    setSelectedMcpId(null)
  }

  function handleMcpChange(id: string) {
    setSelectedMcpId(id || null)
  }

  // Auth guards — block render for non-admins
  if (authLoading) return null
  if (!user || profile?.role !== "admin") return null

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-gray-100 sticky top-0 z-10 bg-white">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded bg-[#190A46] flex items-center justify-center">
              <span className="text-white text-xs font-bold">DA</span>
            </div>
            <span className="text-sm font-semibold text-gray-900">DigitAlchemy&reg;</span>
            <span className="text-sm text-gray-400">Orchestrate</span>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="text-xs text-gray-400 hover:text-[#190A46] border border-gray-200 px-3 py-1 rounded-lg transition-colors"
            >
              Social Console
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10">
        {/* Title */}
        <div className="mb-10">
          <h1 className="text-lg font-semibold text-gray-900">Agent Cascade</h1>
          <p className="text-sm text-gray-500 mt-1">
            Select an agent, explore its MCP tools, and inspect live status from the Phase 0 audit.
          </p>
        </div>

        {/* Cascade */}
        <div className="space-y-6">
          {/* Level 1: Agent */}
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
              1. Select Agent
            </label>
            <select
              value={selectedAgentId ?? ""}
              onChange={(e) => handleAgentChange(e.target.value)}
              className="w-full max-w-md border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#190A46]/20 focus:border-[#190A46] transition-colors"
            >
              <option value="">Choose an agent...</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.id} — {a.displayName}
                </option>
              ))}
            </select>

            {/* Agent detail */}
            {selectedAgent && (
              <div className="mt-3 bg-gray-50 border border-gray-100 rounded-lg px-4 py-3 max-w-md">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-[#190A46] bg-[#190A46]/5 px-1.5 py-0.5 rounded">
                    {selectedAgent.id}
                  </span>
                  <span className="text-xs text-gray-400">{selectedAgent.category}</span>
                </div>
                <p className="text-sm font-medium text-gray-900 mt-1">{selectedAgent.displayName}</p>
                <p className="text-sm text-gray-600 mt-0.5">{selectedAgent.shortDescription}</p>
                <div className="mt-2 flex items-center gap-1.5">
                  <span className="text-xs text-gray-400">Workflows:</span>
                  {agentWorkflows.map((wf) => (
                    <span
                      key={wf.id}
                      className="text-xs bg-white border border-gray-200 px-1.5 py-0.5 rounded text-gray-600"
                    >
                      {wf.label}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Level 2: MCP */}
          {selectedAgentId && (
            <div className="animate-[fadeIn_200ms_ease-in]">
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                2. Select MCP Tool
              </label>
              {agentMcps.length === 0 ? (
                <p className="text-sm text-gray-400">No MCP tools mapped for this agent.</p>
              ) : (
                <select
                  value={selectedMcpId ?? ""}
                  onChange={(e) => handleMcpChange(e.target.value)}
                  className="w-full max-w-md border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#190A46]/20 focus:border-[#190A46] transition-colors"
                >
                  <option value="">Choose an MCP ({agentMcps.length} available)...</option>
                  {agentMcps.map((m) => {
                    const a = AUDIT[m.id]
                    const dot = a
                      ? a.status === "ALIVE" ? "\u2705"
                      : a.status === "DEGRADED" ? "\u26A0\uFE0F"
                      : "\u274C"
                      : "\u2753"
                    return (
                      <option key={m.id} value={m.id}>
                        {dot} {m.name}
                      </option>
                    )
                  })}
                </select>
              )}
            </div>
          )}

          {/* Level 3: MCP Detail */}
          {selectedMcp && (
            <div className="animate-[fadeIn_200ms_ease-in]">
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                3. MCP Detail
              </label>
              <div className="border border-gray-200 rounded-xl overflow-hidden max-w-2xl">
                {/* Header */}
                <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#190A46]/5 flex items-center justify-center">
                      <span className="text-xs font-bold text-[#190A46]">
                        {selectedMcp.source === "docker" ? "D" : "M"}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{selectedMcp.name}</p>
                      <p className="text-xs text-gray-400">
                        {selectedMcp.id}
                        {selectedMcp.tools ? ` \u00B7 ${selectedMcp.tools} tools` : ""}
                        {" \u00B7 "}
                        {selectedMcp.source === "docker" ? "Docker Gateway" : "Standalone"}
                      </p>
                    </div>
                  </div>
                  {audit && <StatusBadge status={audit.status} />}
                </div>

                {/* Body */}
                <div className="px-5 py-4 space-y-4">
                  {/* Description */}
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                      What it does
                    </p>
                    <p className="text-sm text-gray-700">{selectedMcp.description}</p>
                  </div>

                  {/* Pipeline role */}
                  {audit && (
                    <div>
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                        Pipeline role
                      </p>
                      <p className="text-sm text-gray-700">{audit.pipelineRole}</p>
                    </div>
                  )}

                  {/* Audit result */}
                  {audit && (
                    <div>
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                        Phase 0 audit result
                      </p>
                      <div className="flex items-start gap-2">
                        <StatusDot status={audit.status} />
                        <p className="text-sm text-gray-600">{audit.testResult}</p>
                      </div>
                    </div>
                  )}

                  {/* Fix needed */}
                  {audit?.fixNeeded && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
                      <p className="text-xs font-medium text-amber-800 uppercase tracking-wide mb-1">
                        Fix needed
                      </p>
                      <p className="text-sm text-amber-700">{audit.fixNeeded}</p>
                    </div>
                  )}

                  {/* No audit data */}
                  {!audit && (
                    <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3">
                      <p className="text-xs text-gray-500">
                        No Phase 0 audit data for this MCP. Status unknown.
                      </p>
                    </div>
                  )}

                  {/* Category + tags */}
                  <div className="flex items-center gap-2 pt-1">
                    <span className="text-xs bg-[#190A46]/5 text-[#190A46] px-2 py-0.5 rounded">
                      {selectedMcp.category}
                    </span>
                    {selectedAgent && (
                      <span className="text-xs bg-[#b87333]/10 text-[#b87333] px-2 py-0.5 rounded">
                        {selectedAgent.displayName}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Summary strip */}
        {selectedAgentId && (
          <div className="mt-10 pt-6 border-t border-gray-100">
            <div className="flex items-center gap-6 text-xs text-gray-400">
              <span>
                Agent: <span className="text-gray-600">{selectedAgent?.displayName}</span>
              </span>
              <span>
                MCPs mapped: <span className="text-gray-600">{agentMcps.length}</span>
              </span>
              <span>
                Alive:{" "}
                <span className="text-green-600">
                  {agentMcps.filter((m) => AUDIT[m.id]?.status === "ALIVE").length}
                </span>
              </span>
              <span>
                Degraded:{" "}
                <span className="text-amber-600">
                  {agentMcps.filter((m) => AUDIT[m.id]?.status === "DEGRADED").length}
                </span>
              </span>
              <span>
                Dead:{" "}
                <span className="text-red-600">
                  {agentMcps.filter((m) => AUDIT[m.id]?.status === "DEAD").length}
                </span>
              </span>
            </div>
          </div>
        )}
      </main>

      <footer className="max-w-5xl mx-auto px-6 py-6 mt-8 border-t border-gray-100">
        <p className="text-xs text-gray-400">
          DigitAlchemy&reg; Tech Limited &middot; ADGM No. 35004 &middot; Sky Tower, Al Reem Island, Abu Dhabi, UAE
        </p>
      </footer>
    </div>
  )
}
