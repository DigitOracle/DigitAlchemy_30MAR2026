/**
 * /knowledge/control-room — Mode C C.1 (static agent topology).
 *
 * Renders the 14-agent v1 ecosystem (DA-01..DA-14) as a React Flow
 * org chart with manual cluster positioning. Edges derived from
 * data/workflows.json co-occurrence (every pair of DA-NN agents
 * sharing a workflow gets an undirected edge, deduplicated). The
 * social-video-optimization workflow is skipped — its agents are
 * SOCIAL-NN, not part of the DA-NN topology.
 *
 * Layout (4 rows, top-down):
 *   Row 1: GOVERNANCE (DA-01 + DA-13 stacked) ............. STANDARDS (DA-11)
 *   Row 2: GEOSPATIAL (DA-03)  QUALITY GATE (DA-02 + DA-04)  TWIN & VIZ (DA-05/06/09/14, 2x2)
 *   Row 3: DATA & ASSETS (DA-07 + DA-12) ................... DELIVERY (DA-10)
 *   ─── divider ─────────────────────────────────────────────────────────────
 *   Substrate: INFRA / PLATFORM (DA-08 alone, centered)
 *
 * DA-08 has zero edges — Code Guardian doesn't appear in any workflow's
 * agents array. Renders as a floating node by design (truthful to
 * workflows.json). Fix the data, not the diagram.
 *
 * DA-13 connects to every other DA-NN except DA-08 — it shadows every
 * regulatory workflow per RM3866 Fig 3 element 318. Visually appears
 * as a hub by accurate consequence; not a styling choice.
 *
 * Avatars routed exclusively through getAgentAvatarUrl (locked
 * discipline). C.1 is static — no events, no SSE, no interactivity
 * beyond pan/zoom. Drag, edge selection, and click handlers all
 * disabled.
 */
"use client"

import { useMemo } from "react"
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  type Node,
  type Edge,
  type NodeTypes,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import agentProfilesData from "@/data/agent_profiles.json"
import workflowsData from "@/data/workflows.json"
import { getAgentAvatarUrl } from "@/lib/agentProfiles"

interface AgentProfile {
  id: string
  displayName: string
  shortDescription: string
  category: string
  userVisible: boolean
}

interface Workflow {
  id: string
  agents: string[]
}

// Mirrors components/AgentCard.tsx — keep in sync. Governance and Media
// fall through to the gray default (parked follow-up: extend the accent
// map for DA-13/DA-14's new categories).
const CATEGORY_ACCENT: Record<string, string> = {
  Orchestration: "border-l-[#190A46]",
  BIM: "border-l-blue-500",
  GIS: "border-l-green-500",
  Regulatory: "border-l-amber-500",
  Visualisation: "border-l-purple-500",
  "Digital Twin": "border-l-cyan-500",
  IoT: "border-l-orange-500",
  DevOps: "border-l-gray-500",
  Documentation: "border-l-indigo-500",
  Standards: "border-l-red-500",
  "Asset Management": "border-l-teal-500",
  Social: "border-l-pink-500",
}

function accentForCategory(category: string): string {
  return CATEGORY_ACCENT[category] ?? "border-l-gray-300"
}

const NODE_POSITIONS: Record<string, { x: number; y: number }> = {
  // Row 1
  "DA-01": { x: 200, y: 60 },
  "DA-13": { x: 200, y: 290 },
  "DA-11": { x: 1040, y: 60 },
  // Row 2
  "DA-03": { x: 80, y: 570 },
  "DA-02": { x: 440, y: 570 },
  "DA-04": { x: 440, y: 800 },
  "DA-05": { x: 800, y: 570 },
  "DA-06": { x: 990, y: 570 },
  "DA-09": { x: 800, y: 800 },
  "DA-14": { x: 990, y: 800 },
  // Row 3
  "DA-07": { x: 200, y: 1080 },
  "DA-12": { x: 390, y: 1080 },
  "DA-10": { x: 1040, y: 1080 },
  // Substrate
  "DA-08": { x: 620, y: 1400 },
}

const CLUSTER_LABELS: Array<{ id: string; label: string; x: number; y: number; width: number }> = [
  { id: "label-governance", label: "GOVERNANCE",     x: 200,  y: 20,   width: 160 },
  { id: "label-standards",  label: "STANDARDS",      x: 1040, y: 20,   width: 160 },
  { id: "label-geospatial", label: "GEOSPATIAL",     x: 80,   y: 530,  width: 160 },
  { id: "label-quality",    label: "QUALITY GATE",   x: 440,  y: 530,  width: 160 },
  { id: "label-twin",       label: "TWIN & VIZ",     x: 800,  y: 530,  width: 350 },
  { id: "label-data",       label: "DATA & ASSETS",  x: 200,  y: 1040, width: 350 },
  { id: "label-delivery",   label: "DELIVERY",       x: 1040, y: 1040, width: 160 },
  { id: "label-infra",      label: "INFRA / PLATFORM", x: 620, y: 1360, width: 160 },
]

const DIVIDER_Y = 1340
const DIVIDER_X = 60
const DIVIDER_WIDTH = 1140

function AgentNode({ data }: { data: { agent: AgentProfile } }) {
  const a = data.agent
  return (
    <div
      className={`relative w-[160px] h-[200px] bg-white border border-gray-200 ${accentForCategory(a.category)} border-l-4 rounded-lg shadow-sm flex flex-col items-center pt-3 px-2 pb-2 group cursor-default`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={getAgentAvatarUrl(a.id, 80)}
        alt={`Avatar for ${a.displayName}`}
        width={80}
        height={80}
        className="rounded-md"
        draggable={false}
      />
      <div className="mt-2 text-sm font-semibold text-gray-900 text-center leading-tight">
        {a.displayName}
      </div>
      <div className="mt-1 text-[10px] uppercase tracking-wider text-gray-500">
        {a.category}
      </div>
      <div className="pointer-events-none absolute z-20 left-1/2 -translate-x-1/2 top-full mt-2 w-[300px] bg-gray-900 text-white text-xs rounded-md px-3 py-2 opacity-0 group-hover:opacity-100 transition-opacity duration-150 shadow-lg">
        <div className="leading-relaxed whitespace-pre-line">{a.shortDescription}</div>
        <div className="mt-2 font-mono text-[10px] text-gray-400">{a.id}</div>
      </div>
    </div>
  )
}

function ClusterLabelNode({ data }: { data: { label: string; width: number } }) {
  return (
    <div
      style={{ width: data.width }}
      className="text-[11px] uppercase tracking-[0.15em] font-medium text-gray-500 text-center select-none"
    >
      {data.label}
    </div>
  )
}

function DividerNode({ data }: { data: { width: number } }) {
  return (
    <div
      style={{ width: data.width }}
      className="border-t border-gray-200"
    />
  )
}

const nodeTypes: NodeTypes = {
  agent: AgentNode,
  clusterLabel: ClusterLabelNode,
  divider: DividerNode,
}

function buildNodes(agents: AgentProfile[]): Node[] {
  const agentNodes: Node[] = agents
    .filter((a) => NODE_POSITIONS[a.id])
    .map((a) => ({
      id: a.id,
      type: "agent",
      position: NODE_POSITIONS[a.id],
      data: { agent: a },
      draggable: false,
      selectable: false,
    }))
  const labelNodes: Node[] = CLUSTER_LABELS.map((l) => ({
    id: l.id,
    type: "clusterLabel",
    position: { x: l.x, y: l.y },
    data: { label: l.label, width: l.width },
    draggable: false,
    selectable: false,
  }))
  const divider: Node = {
    id: "divider-substrate",
    type: "divider",
    position: { x: DIVIDER_X, y: DIVIDER_Y },
    data: { width: DIVIDER_WIDTH },
    draggable: false,
    selectable: false,
  }
  return [...labelNodes, divider, ...agentNodes]
}

function buildEdges(workflows: Workflow[]): Edge[] {
  const seen = new Set<string>()
  const edges: Edge[] = []
  // Skip social-video-optimization — SOCIAL-NN agents not rendered.
  const tracks = workflows.filter((w) => w.id !== "social-video-optimization")
  for (const wf of tracks) {
    const ids = wf.agents.filter((id) => id.startsWith("DA-"))
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const [a, b] = [ids[i], ids[j]].sort()
        const key = `${a}--${b}`
        if (seen.has(key)) continue
        seen.add(key)
        edges.push({
          id: `edge-${key}`,
          source: a,
          target: b,
          style: { stroke: "#d1d5db", strokeWidth: 1 },
          selectable: false,
          focusable: false,
          interactionWidth: 0,
        })
      }
    }
  }
  return edges
}

export default function ControlRoomPage() {
  const agents = useMemo(
    () =>
      (agentProfilesData as AgentProfile[]).filter(
        (a) => a.userVisible && a.id.startsWith("DA-"),
      ),
    [],
  )
  const workflows = useMemo(() => workflowsData as Workflow[], [])
  const nodes = useMemo(() => buildNodes(agents), [agents])
  const edges = useMemo(() => buildEdges(workflows), [workflows])

  return (
    <main className="max-w-7xl mx-auto px-4 py-10">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
          Agent Control Room
        </h1>
        <p className="text-sm text-gray-600 mt-2 max-w-3xl">
          The DigitAlchemy team. Hover an agent to see how it contributes.
        </p>
      </header>

      <div className="w-full h-[800px] border border-gray-200 rounded-lg bg-white overflow-hidden">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.1 }}
          nodesDraggable={false}
          nodesConnectable={false}
          edgesFocusable={false}
          panOnDrag
          zoomOnScroll
          zoomOnPinch
          zoomOnDoubleClick={false}
        >
          <Background gap={24} size={1} color="#e5e7eb" />
          <Controls position="top-right" showInteractive={false} />
          <MiniMap
            position="bottom-right"
            nodeColor={(n) => (n.type === "agent" ? "#190A46" : "transparent")}
            maskColor="rgba(0, 0, 0, 0.05)"
            pannable={false}
            zoomable={false}
          />
        </ReactFlow>
      </div>
    </main>
  )
}
