You are building the DigitAlchemy® Console — a production-ready Next.js 14 application.

Build the complete codebase in the current directory. No stubs. No placeholders. No pseudo-code. Every file complete and working.

---

## STACK
- Next.js 14 App Router
- TypeScript (strict)
- Tailwind CSS
- Claude API (claude-sonnet-4-6) via Anthropic SDK
- Vercel deployment target

## VISUAL DIRECTION
- Clean white background
- Executive, minimal, restrained
- No gradients, no glassmorphism, no animations
- Font: Geist (next/font/google) for headings, system sans for body
- Accent color: #190A46 (DigitAlchemy navy)
- Secondary accent: #b87333 (copper)
- Status colors: green #16a34a, amber #d97706, red #dc2626
- All UI text in sentence case
- Dropdowns, clean inputs, no bloat

---

## WHAT THIS SYSTEM DOES

DigitAlchemy® Console is a task-intake and orchestration interface.
User enters a task → system analyzes it → returns:
- workflow type classification
- recommended agents (friendly names, not DA-XX codes)
- recommended MCPs (core / supporting / optional)
- execution order
- dependencies
- warnings
- next actions
- optional standards context from Firestore

This sits in front of a real orchestration layer with:
- 27 connected MCP servers
- Firestore-backed tool registry (65 tools)
- Firestore standards corpus (768 standards, 69 countries)
- Docker MCP Toolkit (19 servers via gateway)
- Live agent workforce (DA-01 through DA-12)

---

## BUILD ORDER — commit after each stage

### STAGE 1 — Project scaffold
Create these files:

**package.json**
```json
{
  "name": "digitalchemy-console",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "type-check": "tsc --noEmit"
  },
  "dependencies": {
    "@anthropic-ai/sdk": "^0.39.0",
    "next": "14.2.0",
    "react": "^18",
    "react-dom": "^18"
  },
  "devDependencies": {
    "@types/node": "^20",
    "@types/react": "^18",
    "@types/react-dom": "^18",
    "autoprefixer": "^10.0.1",
    "eslint": "^8",
    "eslint-config-next": "14.2.0",
    "postcss": "^8",
    "tailwindcss": "^3.3.0",
    "typescript": "^5"
  }
}
```

**next.config.ts**
```ts
import type { NextConfig } from "next"
const nextConfig: NextConfig = {
  reactStrictMode: true,
}
export default nextConfig
```

**tsconfig.json**
```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

**tailwind.config.ts**
```ts
import type { Config } from "tailwindcss"
const config: Config = {
  content: ["./pages/**/*.{js,ts,jsx,tsx,mdx}", "./components/**/*.{js,ts,jsx,tsx,mdx}", "./app/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        navy: "#190A46",
        copper: "#b87333",
        "copper-light": "#d4956a",
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "monospace"],
      },
    },
  },
  plugins: [],
}
export default config
```

**postcss.config.js**
```js
module.exports = { plugins: { tailwindcss: {}, autoprefixer: {} } }
```

**.env.example**
```
ANTHROPIC_API_KEY=
NEXT_PUBLIC_APP_NAME=DigitAlchemy Console
NEXT_PUBLIC_APP_VERSION=1.0.0
FIRESTORE_PROJECT_ID=
FIRESTORE_CLIENT_EMAIL=
FIRESTORE_PRIVATE_KEY=
```

**.env.local** — create this but do NOT commit it. Use real ANTHROPIC_API_KEY from environment.

**vercel.json**
```json
{
  "framework": "nextjs",
  "buildCommand": "npm run build",
  "devCommand": "npm run dev",
  "installCommand": "npm install"
}
```

**.gitignore**
```
.env.local
.env
node_modules/
.next/
out/
```

Commit: "chore: project scaffold"

---

### STAGE 2 — Types

**types/index.ts** — Complete TypeScript types:

```ts
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
```

Commit: "feat: type definitions"

---

### STAGE 3 — Data layer

**data/agent_profiles.json**
```json
[
  { "id": "DA-01", "displayName": "Command Desk", "shortDescription": "Routes the task, builds the execution path, and coordinates the agent workforce.", "category": "Orchestration", "userVisible": true },
  { "id": "DA-02", "displayName": "Model Surgeon", "shortDescription": "Inspects model health, classification readiness, and remediation paths.", "category": "BIM", "userVisible": true },
  { "id": "DA-03", "displayName": "Spatial Analyst", "shortDescription": "Processes GIS layers, spatial queries, and geographic data pipelines.", "category": "GIS", "userVisible": true },
  { "id": "DA-04", "displayName": "Compliance Advisor", "shortDescription": "Maps tasks to regulatory frameworks, standards, and compliance requirements.", "category": "Regulatory", "userVisible": true },
  { "id": "DA-05", "displayName": "Scene Porter", "shortDescription": "Manages Revit to Unreal Engine pipeline and visualisation exports.", "category": "Visualisation", "userVisible": true },
  { "id": "DA-06", "displayName": "Digital Twin Engineer", "shortDescription": "Builds and maintains digital twin state, telemetry, and simulation layers.", "category": "Digital Twin", "userVisible": true },
  { "id": "DA-07", "displayName": "Sensor Alchemist", "shortDescription": "Derives sensor logic, VIPER outputs, and IoT placement strategies.", "category": "IoT", "userVisible": true },
  { "id": "DA-08", "displayName": "Code Guardian", "shortDescription": "Manages DevOps pipelines, CI/CD, code quality, and deployment governance.", "category": "DevOps", "userVisible": true },
  { "id": "DA-09", "displayName": "Render Pilot", "shortDescription": "Handles visualisation QA, render pipeline monitoring, and asset delivery.", "category": "Visualisation", "userVisible": true },
  { "id": "DA-10", "displayName": "Dossier Keeper", "shortDescription": "Maintains living project dossiers, client records, and engagement history.", "category": "Documentation", "userVisible": true },
  { "id": "DA-11", "displayName": "Citation Guard", "shortDescription": "Searches, validates, and applies standards citations across the corpus.", "category": "Standards", "userVisible": true },
  { "id": "DA-12", "displayName": "Asset Librarian", "shortDescription": "Manages asset registers, COBie records, and classification schemas.", "category": "Asset Management", "userVisible": true },
  { "id": "SOCIAL-01", "displayName": "Content Analyst", "shortDescription": "Understands video content, extracts topics, tone, audience, and key hooks.", "category": "Social", "userVisible": true },
  { "id": "SOCIAL-02", "displayName": "Trend Scout", "shortDescription": "Identifies trending hashtags, audio, and creator patterns across platforms.", "category": "Social", "userVisible": true },
  { "id": "SOCIAL-03", "displayName": "Hashtag Strategist", "shortDescription": "Builds ranked hashtag sets, caption options, and keyword clusters.", "category": "Social", "userVisible": true },
  { "id": "SOCIAL-04", "displayName": "Platform Router", "shortDescription": "Adapts content recommendations per platform — LinkedIn, TikTok, Instagram, X.", "category": "Social", "userVisible": true }
]
```

**data/mcp_registry.json**
```json
{
  "version": "session-004-30MAR2026",
  "source": "local-cache",
  "servers": [
    { "id": "revit-mcp", "name": "Revit MCP", "description": "Revit model operations and BIM data extraction", "category": "BIM", "status": "connected", "tools": 26, "source": "legacy" },
    { "id": "autocad-mcp", "name": "AutoCAD MCP", "description": "AutoCAD drawing operations", "category": "BIM", "status": "connected", "tools": 8, "source": "legacy" },
    { "id": "multicad-mcp", "name": "MultiCAD MCP", "description": "Multi-CAD format support", "category": "BIM", "status": "connected", "tools": 7, "source": "legacy" },
    { "id": "autodesk-mcp", "name": "Autodesk MCP", "description": "Autodesk platform integration", "category": "BIM", "status": "connected", "source": "legacy" },
    { "id": "heygen", "name": "HeyGen MCP", "description": "AI video generation and avatar creation", "category": "Social", "status": "needs-auth", "tools": 11, "source": "legacy" },
    { "id": "ayrshare", "name": "Ayrshare MCP", "description": "Social media publishing and scheduling", "category": "Social", "status": "connected", "source": "legacy" },
    { "id": "xpoz", "name": "Xpoz MCP", "description": "Social search — Twitter, Instagram, Reddit", "category": "Social", "status": "connected", "tools": 29, "source": "legacy" },
    { "id": "firebase-mcp", "name": "Firebase MCP", "description": "Firestore and Firebase operations", "category": "Data", "status": "connected", "source": "legacy" },
    { "id": "github-mcp", "name": "GitHub MCP", "description": "GitHub repository management", "category": "DevOps", "status": "connected", "source": "legacy" },
    { "id": "cesium-mcp", "name": "Cesium MCP", "description": "3D geospatial and terrain visualisation", "category": "GIS", "status": "connected", "source": "legacy" },
    { "id": "notebooklm-mcp", "name": "NotebookLM MCP", "description": "AI research and document analysis", "category": "Research", "status": "connected", "tools": 27, "source": "legacy" },
    { "id": "proxima", "name": "Proxima MCP", "description": "Extended tool operations", "category": "General", "status": "connected", "tools": 44, "source": "legacy" },
    { "id": "sequential-thinking", "name": "Sequential Thinking MCP", "description": "Structured reasoning chains", "category": "Reasoning", "status": "connected", "source": "legacy" },
    { "id": "deepseek-thinker", "name": "DeepSeek Thinker MCP", "description": "Deep reasoning for compliance and standards", "category": "Reasoning", "status": "connected", "source": "legacy" },
    { "id": "perplexity", "name": "Perplexity MCP", "description": "Real-time web research", "category": "Research", "status": "connected", "source": "legacy" },
    { "id": "context7", "name": "Context7 MCP", "description": "Up-to-date code documentation", "category": "DevOps", "status": "connected", "source": "legacy" },
    { "id": "google-docs", "name": "Google Docs MCP", "description": "Google Docs read and write operations", "category": "Documentation", "status": "connected", "source": "legacy" },
    { "id": "youtube-transcript", "name": "YouTube Transcript MCP", "description": "Extract transcripts from YouTube videos", "category": "Social", "status": "connected", "source": "legacy" },
    { "id": "chat-completions", "name": "Chat Completions MCP", "description": "Groq Llama inference for sub-tasks", "category": "AI", "status": "connected", "source": "legacy" },
    { "id": "unrealEngine", "name": "Unreal Engine MCP", "description": "Unreal Engine 5 scene and asset control", "category": "Visualisation", "status": "connected", "tools": 4, "source": "legacy" },
    { "id": "docker-github-official", "name": "GitHub (Docker)", "description": "Official GitHub MCP server via Docker", "category": "DevOps", "status": "connected", "source": "docker" },
    { "id": "docker-playwright", "name": "Playwright (Docker)", "description": "Browser automation and web scraping", "category": "Automation", "status": "connected", "source": "docker" },
    { "id": "docker-brave", "name": "Brave Search (Docker)", "description": "Web search via Brave API", "category": "Research", "status": "connected", "source": "docker" },
    { "id": "docker-grafana", "name": "Grafana (Docker)", "description": "Operations monitoring and dashboards", "category": "Monitoring", "status": "connected", "source": "docker" },
    { "id": "docker-neo4j", "name": "Neo4j (Docker)", "description": "Graph database — TTM registry and standards crosswalks", "category": "Data", "status": "connected", "source": "docker" },
    { "id": "docker-wikipedia", "name": "Wikipedia (Docker)", "description": "Standards context and regulatory background", "category": "Research", "status": "connected", "source": "docker" },
    { "id": "docker-markdownify", "name": "Markdownify (Docker)", "description": "Convert PDFs, HTML, Office docs to Markdown", "category": "Ingestion", "status": "connected", "source": "docker" },
    { "id": "docker-markitdown", "name": "MarkItDown (Docker)", "description": "Microsoft Office document conversion", "category": "Ingestion", "status": "connected", "source": "docker" },
    { "id": "docker-postman", "name": "Postman (Docker)", "description": "API validation and collection testing", "category": "DevOps", "status": "connected", "source": "docker" },
    { "id": "docker-elasticsearch", "name": "Elasticsearch (Docker)", "description": "Full-text standards and rules search", "category": "Search", "status": "connected", "source": "docker" },
    { "id": "docker-mongodb", "name": "MongoDB (Docker)", "description": "Geospatial and asset data storage", "category": "Data", "status": "connected", "source": "docker" },
    { "id": "docker-redis", "name": "Redis (Docker)", "description": "High-speed caching for sensor and lookup data", "category": "Data", "status": "connected", "source": "docker" },
    { "id": "docker-unreal", "name": "Unreal Engine (Docker)", "description": "Unreal Engine control via Docker MCP", "category": "Visualisation", "status": "connected", "source": "docker" },
    { "id": "docker-timestream", "name": "Timestream/InfluxDB (Docker)", "description": "VIPER sensor time-series data", "category": "IoT", "status": "connected", "source": "docker" },
    { "id": "docker-sonarqube", "name": "SonarQube (Docker)", "description": "Code quality analysis", "category": "DevOps", "status": "connected", "source": "docker" },
    { "id": "docker-buildkite", "name": "Buildkite (Docker)", "description": "CI/CD pipeline management", "category": "DevOps", "status": "connected", "source": "docker" },
    { "id": "docker-smartbear", "name": "SmartBear (Docker)", "description": "API governance and quality", "category": "DevOps", "status": "connected", "source": "docker" },
    { "id": "docker-sequa", "name": "Sequa (Docker)", "description": "Full codebase context for AI tools", "category": "DevOps", "status": "connected", "source": "docker" }
  ]
}
```

**data/standards_index.json**
```json
{
  "version": "mpf-v15.8-30MAR2026",
  "source": "local-cache",
  "meta": {
    "total_standards": 768,
    "countries": 69,
    "corpus_files": 213,
    "collections": ["ISO", "BSI", "ASHRAE", "IEC", "AISC", "UAE_Local", "GCC", "RIBA", "BIM_Standards", "Smart_City"]
  },
  "categories": [
    { "id": "bim", "label": "BIM & Digital Delivery", "collections": ["ISO 19650", "BS 1192", "PAS 1192", "COBie", "IFC", "Uniclass 2015"], "keywords": ["bim", "ifc", "revit", "model", "cde", "handover", "cobie", "uniclass", "level of information"] },
    { "id": "smart_city", "label": "Smart City & IoT", "collections": ["ISO 37100", "ISO 37120", "ISO 37122", "ITU-T Y.4000"], "keywords": ["smart city", "iot", "sensor", "telemetry", "viper", "digital twin", "infrastructure"] },
    { "id": "digital_twin", "label": "Digital Twin", "collections": ["ISO 23247", "IEC 63278", "DTDL"], "keywords": ["digital twin", "simulation", "twin", "asset model", "real-time"] },
    { "id": "compliance", "label": "Regulatory & Compliance", "collections": ["UAE_Local", "GCC", "ADDC", "DDA", "MOCCAE", "CBUAE"], "keywords": ["compliance", "regulatory", "uae", "abu dhabi", "addc", "permit", "approval", "authority"] },
    { "id": "gis", "label": "GIS & Spatial", "collections": ["ISO 19100", "OGC", "EPSG"], "keywords": ["gis", "spatial", "geospatial", "mapping", "coordinates", "projection", "vector", "raster"] },
    { "id": "construction", "label": "Construction & Project Delivery", "collections": ["RIBA Plan of Work", "NEC", "FIDIC", "ISO 21500"], "keywords": ["construction", "riba", "project delivery", "stage", "gateway", "procurement"] }
  ]
}
```

Commit: "feat: data layer — agent profiles, MCP registry, standards index"

---

### STAGE 4 — Providers and lib

**lib/providers/registryProvider.ts**
```ts
import type { MCPServer } from "@/types"

export interface RegistryProvider {
  getServers(): Promise<MCPServer[]>
  getServerById(id: string): Promise<MCPServer | null>
}
```

**lib/providers/localRegistryProvider.ts**
```ts
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
```

**lib/providers/standardsProvider.ts**
```ts
import type { StandardsEntry } from "@/types"

export interface StandardsProvider {
  getCategories(): Promise<{ id: string; label: string; keywords: string[] }[]>
  searchByKeywords(keywords: string[]): Promise<StandardsEntry[]>
  isStandardsRelevant(task: string): boolean
}
```

**lib/providers/localStandardsProvider.ts**
```ts
import type { StandardsProvider } from "./standardsProvider"
import type { StandardsEntry } from "@/types"
import standardsData from "@/data/standards_index.json"

export class LocalStandardsProvider implements StandardsProvider {
  getCategories() {
    return Promise.resolve(standardsData.categories)
  }

  async searchByKeywords(keywords: string[]): Promise<StandardsEntry[]> {
    const lower = keywords.map((k) => k.toLowerCase())
    const results: StandardsEntry[] = []
    for (const cat of standardsData.categories) {
      const match = cat.keywords.some((kw) => lower.some((l) => l.includes(kw) || kw.includes(l)))
      if (match) {
        for (const col of cat.collections) {
          results.push({ title: col, code: col.replace(/\s/g, "-"), collection: cat.label, category: cat.id, tags: cat.keywords })
        }
      }
    }
    return results
  }

  isStandardsRelevant(task: string): boolean {
    const lower = task.toLowerCase()
    const triggers = ["standard", "iso", "bim", "ifc", "compliance", "regulation", "handover", "cobie", "uniclass", "uae", "digital twin", "smart city", "iot", "sensor", "gis", "spatial", "riba", "construction"]
    return triggers.some((t) => lower.includes(t))
  }
}
```

**lib/providers/firestoreStandardsProvider.ts**
```ts
// Firestore provider — stubbed for MVP, ready for live integration
// Connect by setting FIRESTORE_PROJECT_ID, FIRESTORE_CLIENT_EMAIL, FIRESTORE_PRIVATE_KEY
import type { StandardsProvider } from "./standardsProvider"
import type { StandardsEntry } from "@/types"
import { LocalStandardsProvider } from "./localStandardsProvider"

export class FirestoreStandardsProvider implements StandardsProvider {
  private fallback = new LocalStandardsProvider()

  getCategories() {
    // TODO: fetch from Firestore `standards` collection metadata
    return this.fallback.getCategories()
  }

  async searchByKeywords(keywords: string[]): Promise<StandardsEntry[]> {
    // TODO: query Firestore standards corpus by keyword tags
    // Collection: standards, field: tags (array-contains-any)
    return this.fallback.searchByKeywords(keywords)
  }

  isStandardsRelevant(task: string): boolean {
    return this.fallback.isStandardsRelevant(task)
  }
}
```

**lib/registry.ts**
```ts
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
```

**lib/agentProfiles.ts**
```ts
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
```

**lib/standards.ts**
```ts
import { LocalStandardsProvider } from "./providers/localStandardsProvider"
import type { StandardsContext } from "@/types"

const provider = new LocalStandardsProvider()

export async function getStandardsContext(task: string): Promise<StandardsContext | undefined> {
  if (!provider.isStandardsRelevant(task)) return undefined
  const words = task.toLowerCase().split(/\s+/)
  const results = await provider.searchByKeywords(words)
  if (!results.length) return undefined
  const collections = [...new Set(results.map((r) => r.collection))]
  return {
    source: "local-cache",
    collectionsConsulted: collections,
    relevantStandards: results.slice(0, 6).map((r) => ({
      title: r.title,
      code: r.code,
      collection: r.collection,
      reason: `Matched task keywords against ${r.category} category`,
    })),
    standardsActions: [
      "Review applicable standards before proceeding",
      "Confirm jurisdiction-specific requirements with Citation Guard (DA-11)",
      "Cross-reference with Firestore standards corpus for full detail",
    ],
  }
}
```

**lib/scoring.ts**
```ts
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
  }))
}
```

**lib/formatter.ts**
```ts
import type { AnalyzeTaskResult } from "@/types"

export function validateResult(data: unknown): data is AnalyzeTaskResult {
  if (!data || typeof data !== "object") return false
  const d = data as Record<string, unknown>
  return (
    typeof d.taskSummary === "string" &&
    typeof d.workflowType === "string" &&
    Array.isArray(d.recommendedAgents) &&
    Array.isArray(d.recommendedMCPs) &&
    Array.isArray(d.executionOrder) &&
    Array.isArray(d.dependencies) &&
    Array.isArray(d.warnings) &&
    Array.isArray(d.nextActions)
  )
}

export function safeParseJSON(text: string): unknown {
  const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim()
  try {
    return JSON.parse(cleaned)
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/)
    if (match) {
      try { return JSON.parse(match[0]) } catch { return null }
    }
    return null
  }
}
```

**lib/analyzeTask.ts**
```ts
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
```

Commit: "feat: providers, lib layer, analysis engine"

---

### STAGE 5 — API route

**app/api/analyze/route.ts**
```ts
import { NextRequest, NextResponse } from "next/server"
import { analyzeTask } from "@/lib/analyzeTask"
import type { AnalyzeTaskRequest, AnalyzeTaskResponse } from "@/types"

export const runtime = "nodejs"
export const maxDuration = 30

export async function POST(req: NextRequest): Promise<NextResponse<AnalyzeTaskResponse>> {
  try {
    const body = (await req.json()) as AnalyzeTaskRequest

    if (!body.task || typeof body.task !== "string" || body.task.trim().length < 5) {
      return NextResponse.json({ success: false, error: "Task description is required (minimum 5 characters)." }, { status: 400 })
    }

    if (body.task.length > 2000) {
      return NextResponse.json({ success: false, error: "Task description is too long (maximum 2000 characters)." }, { status: 400 })
    }

    const result = await analyzeTask(body.task.trim())
    return NextResponse.json({ success: true, result })
  } catch (err) {
    console.error("[analyze] error:", err)
    const message = err instanceof Error ? err.message : "Analysis failed"
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
```

Commit: "feat: API route"

---

### STAGE 6 — Components

**components/WorkflowTypeTag.tsx**
```tsx
const categoryColors: Record<string, { bg: string; text: string; border: string }> = {
  "Social Video Intelligence": { bg: "bg-pink-50", text: "text-pink-800", border: "border-pink-200" },
  "BIM / Model Review": { bg: "bg-blue-50", text: "text-blue-800", border: "border-blue-200" },
  "GIS / Spatial Analysis": { bg: "bg-green-50", text: "text-green-800", border: "border-green-200" },
  "Compliance / Regulatory Mapping": { bg: "bg-amber-50", text: "text-amber-800", border: "border-amber-200" },
  "IoT / Sensor Planning": { bg: "bg-purple-50", text: "text-purple-800", border: "border-purple-200" },
  "Digital Twin": { bg: "bg-cyan-50", text: "text-cyan-800", border: "border-cyan-200" },
  "General Orchestration": { bg: "bg-gray-50", text: "text-gray-700", border: "border-gray-200" },
}

export function WorkflowTypeTag({ type }: { type: string }) {
  const colors = categoryColors[type] ?? categoryColors["General Orchestration"]
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${colors.bg} ${colors.text} ${colors.border}`}>
      {type}
    </span>
  )
}
```

**components/MCPBadge.tsx**
```tsx
import type { RecommendedMCP } from "@/types"

const priorityConfig = {
  core: { label: "Core", className: "bg-[#190A46] text-white" },
  supporting: { label: "Supporting", className: "bg-gray-100 text-gray-700 border border-gray-200" },
  optional: { label: "Optional", className: "bg-white text-gray-500 border border-gray-200" },
}

export function MCPBadge({ mcp }: { mcp: RecommendedMCP }) {
  const config = priorityConfig[mcp.priority]
  return (
    <div className="flex items-start gap-2 py-2 border-b border-gray-50 last:border-0">
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium shrink-0 mt-0.5 ${config.className}`}>
        {config.label}
      </span>
      <div className="min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{mcp.name}</p>
        <p className="text-xs text-gray-500 truncate">{mcp.role}</p>
        {mcp.source === "missing_but_recommended" && (
          <p className="text-xs text-amber-600 mt-0.5">⚠ Not currently connected</p>
        )}
      </div>
    </div>
  )
}
```

**components/AgentCard.tsx**
```tsx
import type { RecommendedAgent } from "@/types"

const categoryAccent: Record<string, string> = {
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

export function AgentCard({ agent }: { agent: RecommendedAgent }) {
  const accent = categoryAccent[agent.category] ?? "border-l-gray-300"
  return (
    <div className={`bg-white border border-gray-100 border-l-4 ${accent} rounded-lg p-4 shadow-sm`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-gray-900">{agent.displayName}</p>
          <p className="text-xs text-gray-500 mt-0.5">{agent.shortDescription}</p>
        </div>
        <span className="text-xs text-gray-400 shrink-0 mt-0.5 bg-gray-50 px-2 py-0.5 rounded">
          {agent.category}
        </span>
      </div>
    </div>
  )
}
```

**components/DependencyAlert.tsx**
```tsx
export function DependencyAlert({ items, type }: { items: string[]; type: "dependency" | "warning" }) {
  if (!items.length) return null
  const isWarning = type === "warning"
  return (
    <div className={`rounded-lg p-4 ${isWarning ? "bg-amber-50 border border-amber-100" : "bg-gray-50 border border-gray-100"}`}>
      <p className={`text-xs font-semibold uppercase tracking-wide mb-2 ${isWarning ? "text-amber-700" : "text-gray-500"}`}>
        {isWarning ? "Warnings" : "Dependencies"}
      </p>
      <ul className="space-y-1">
        {items.map((item, i) => (
          <li key={i} className={`text-sm flex items-start gap-2 ${isWarning ? "text-amber-800" : "text-gray-700"}`}>
            <span className="shrink-0 mt-0.5">{isWarning ? "⚠" : "→"}</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
```

**components/StandardsContextPanel.tsx**
```tsx
import type { StandardsContext } from "@/types"

export function StandardsContextPanel({ context }: { context: StandardsContext }) {
  return (
    <div className="bg-white border border-gray-100 rounded-lg p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <span className="w-2 h-2 rounded-full bg-[#b87333]" />
        <h3 className="text-sm font-semibold text-gray-900">Standards context</h3>
        <span className="ml-auto text-xs text-gray-400 bg-gray-50 px-2 py-0.5 rounded">
          {context.source}
        </span>
      </div>
      {context.collectionsConsulted.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Collections consulted</p>
          <div className="flex flex-wrap gap-1.5">
            {context.collectionsConsulted.map((c, i) => (
              <span key={i} className="text-xs bg-gray-50 border border-gray-100 text-gray-600 px-2 py-0.5 rounded">
                {c}
              </span>
            ))}
          </div>
        </div>
      )}
      {context.relevantStandards.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Relevant standards</p>
          <div className="space-y-2">
            {context.relevantStandards.map((s, i) => (
              <div key={i} className="flex items-start gap-3 py-2 border-b border-gray-50 last:border-0">
                <span className="text-xs font-mono text-[#190A46] bg-blue-50 px-1.5 py-0.5 rounded shrink-0">
                  {s.code}
                </span>
                <div>
                  <p className="text-sm text-gray-800">{s.title}</p>
                  <p className="text-xs text-gray-400">{s.reason}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {context.standardsActions.length > 0 && (
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Recommended actions</p>
          <ul className="space-y-1">
            {context.standardsActions.map((a, i) => (
              <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                <span className="text-[#b87333] shrink-0">→</span>
                <span>{a}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
```

**components/TaskInput.tsx**
```tsx
"use client"
import { useState } from "react"

const EXAMPLE_PROMPTS = [
  "Analyze this HeyGen video and recommend trending hashtags and music for TikTok and Instagram",
  "Review this IFC model and identify classification issues and missing COBie data",
  "Map this ISO 19650 handover process to the correct agents and toolchain",
  "Plan the sensor deployment strategy for a 50,000 sqm mixed-use development in Abu Dhabi",
  "Analyze a digital twin governance workflow for a smart city district",
]

interface TaskInputProps {
  onSubmit: (task: string) => void
  loading: boolean
}

export function TaskInput({ onSubmit, loading }: TaskInputProps) {
  const [task, setTask] = useState("")

  const handleSubmit = () => {
    if (task.trim().length >= 5 && !loading) {
      onSubmit(task.trim())
    }
  }

  return (
    <div className="bg-white border border-gray-100 rounded-xl p-6 shadow-sm">
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Describe your task or workflow
      </label>
      <textarea
        value={task}
        onChange={(e) => setTask(e.target.value)}
        placeholder="e.g. Analyze a HeyGen video and recommend hashtags, or review an IFC model for classification issues..."
        rows={4}
        className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#190A46] focus:border-transparent resize-none"
        onKeyDown={(e) => { if (e.key === "Enter" && e.metaKey) handleSubmit() }}
      />
      <div className="mt-3 flex items-center justify-between gap-4">
        <div className="flex flex-wrap gap-2">
          {EXAMPLE_PROMPTS.slice(0, 3).map((p, i) => (
            <button
              key={i}
              onClick={() => setTask(p)}
              className="text-xs text-gray-500 hover:text-[#190A46] border border-gray-200 hover:border-[#190A46] rounded px-2 py-1 transition-colors"
            >
              {p.slice(0, 40)}…
            </button>
          ))}
        </div>
        <button
          onClick={handleSubmit}
          disabled={task.trim().length < 5 || loading}
          className="shrink-0 bg-[#190A46] text-white text-sm font-medium px-6 py-2 rounded-lg hover:bg-[#2a1560] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? "Analyzing…" : "Analyze"}
        </button>
      </div>
      <p className="text-xs text-gray-400 mt-2">⌘ + Enter to submit</p>
    </div>
  )
}
```

**components/ExecutionPlan.tsx**
```tsx
import type { AnalyzeTaskResult } from "@/types"
import { WorkflowTypeTag } from "./WorkflowTypeTag"
import { AgentCard } from "./AgentCard"
import { MCPBadge } from "./MCPBadge"
import { DependencyAlert } from "./DependencyAlert"
import { StandardsContextPanel } from "./StandardsContextPanel"

export function ExecutionPlan({ result }: { result: AnalyzeTaskResult }) {
  const coreMCPs = result.recommendedMCPs.filter((m) => m.priority === "core")
  const supportingMCPs = result.recommendedMCPs.filter((m) => m.priority === "supporting")
  const optionalMCPs = result.recommendedMCPs.filter((m) => m.priority === "optional")

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-white border border-gray-100 rounded-xl p-6 shadow-sm">
        <div className="flex items-start gap-3 mb-3">
          <WorkflowTypeTag type={result.workflowType} />
        </div>
        <p className="text-base text-gray-800 leading-relaxed">{result.taskSummary}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Agents */}
        <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Recommended agents
          </h3>
          <div className="space-y-3">
            {result.recommendedAgents.map((agent) => (
              <AgentCard key={agent.id} agent={agent} />
            ))}
          </div>
        </div>

        {/* MCPs */}
        <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            MCP tools
          </h3>
          {coreMCPs.length > 0 && (
            <div className="mb-3">
              <p className="text-xs text-gray-400 mb-1">Core</p>
              {coreMCPs.map((m, i) => <MCPBadge key={i} mcp={m} />)}
            </div>
          )}
          {supportingMCPs.length > 0 && (
            <div className="mb-3">
              <p className="text-xs text-gray-400 mb-1">Supporting</p>
              {supportingMCPs.map((m, i) => <MCPBadge key={i} mcp={m} />)}
            </div>
          )}
          {optionalMCPs.length > 0 && (
            <div>
              <p className="text-xs text-gray-400 mb-1">Optional</p>
              {optionalMCPs.map((m, i) => <MCPBadge key={i} mcp={m} />)}
            </div>
          )}
        </div>
      </div>

      {/* Execution order */}
      <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Execution order
        </h3>
        <ol className="space-y-2">
          {result.executionOrder.map((step, i) => (
            <li key={i} className="flex items-start gap-3 text-sm text-gray-800">
              <span className="shrink-0 w-6 h-6 rounded-full bg-[#190A46] text-white text-xs flex items-center justify-center font-medium">
                {i + 1}
              </span>
              <span className="mt-0.5">{step}</span>
            </li>
          ))}
        </ol>
      </div>

      {/* Dependencies + warnings */}
      {(result.dependencies.length > 0 || result.warnings.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {result.dependencies.length > 0 && <DependencyAlert items={result.dependencies} type="dependency" />}
          {result.warnings.length > 0 && <DependencyAlert items={result.warnings} type="warning" />}
        </div>
      )}

      {/* Next actions */}
      {result.nextActions.length > 0 && (
        <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Next actions
          </h3>
          <ul className="space-y-2">
            {result.nextActions.map((a, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-800">
                <span className="text-[#b87333] shrink-0 mt-0.5">→</span>
                <span>{a}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Standards context */}
      {result.standardsContext && <StandardsContextPanel context={result.standardsContext} />}
    </div>
  )
}
```

Commit: "feat: all UI components"

---

### STAGE 7 — App shell

**app/globals.css**
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

* { box-sizing: border-box; }
html { -webkit-font-smoothing: antialiased; }
```

**app/layout.tsx**
```tsx
import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import "./globals.css"

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] })
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] })

export const metadata: Metadata = {
  title: "DigitAlchemy® Console",
  description: "Task intake and MCP orchestration interface — DigitAlchemy® Tech Limited",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} bg-gray-50 min-h-screen`}>
        {children}
      </body>
    </html>
  )
}
```

**app/page.tsx**
```tsx
"use client"
import { useState } from "react"
import { TaskInput } from "@/components/TaskInput"
import { ExecutionPlan } from "@/components/ExecutionPlan"
import type { AnalyzeTaskResult } from "@/types"

export default function ConsolePage() {
  const [result, setResult] = useState<AnalyzeTaskResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (task: string) => {
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task }),
      })
      const data = await res.json()
      if (data.success) {
        setResult(data.result)
      } else {
        setError(data.error ?? "Analysis failed")
      }
    } catch {
      setError("Failed to connect to analysis engine")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded bg-[#190A46] flex items-center justify-center">
              <span className="text-white text-xs font-bold">DA</span>
            </div>
            <div>
              <span className="text-sm font-semibold text-gray-900">DigitAlchemy®</span>
              <span className="text-sm text-gray-400 ml-2">Console</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-400" />
            <span className="text-xs text-gray-500">Orchestration layer connected</span>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-5xl mx-auto px-6 py-8">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-gray-900">Task analysis</h1>
          <p className="text-sm text-gray-500 mt-1">
            Describe a task or workflow. The system will identify the correct agents, MCPs, and execution path.
          </p>
        </div>

        <div className="space-y-6">
          <TaskInput onSubmit={handleSubmit} loading={loading} />

          {loading && (
            <div className="bg-white border border-gray-100 rounded-xl p-8 shadow-sm flex items-center justify-center gap-3">
              <div className="w-4 h-4 border-2 border-[#190A46] border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-gray-500">Analyzing task against MCP registry and agent profiles…</p>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-100 rounded-xl p-5">
              <p className="text-sm font-medium text-red-800">Analysis failed</p>
              <p className="text-sm text-red-600 mt-1">{error}</p>
            </div>
          )}

          {result && <ExecutionPlan result={result} />}
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-5xl mx-auto px-6 py-6 mt-8 border-t border-gray-100">
        <p className="text-xs text-gray-400">
          DigitAlchemy® Tech Limited · ADGM No. 35004 · Sky Tower, Al Reem Island, Abu Dhabi, UAE
        </p>
      </footer>
    </div>
  )
}
```

Commit: "feat: app shell — layout and main page"

---

### STAGE 8 — Install, build check, push

```bash
npm install
npm run type-check
npm run build
git remote add origin https://github.com/DigitOracle/DigitAlchemy_30MAR2026.git
git push -u origin main
```

If build passes, confirm done.
If build fails, fix TypeScript errors before pushing.

Do not stop until pushed to GitHub successfully.
