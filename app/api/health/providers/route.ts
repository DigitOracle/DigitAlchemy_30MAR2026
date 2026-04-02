import { NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type ProviderStatus = {
  provider: string
  configured: boolean
  checkType: "live_ping" | "config_only"
  reachable: boolean | null
  authValid: boolean | null
  latencyMs: number | null
  lastError: string | null
  degraded: boolean
}

async function probe(
  name: string,
  fn: () => Promise<void>,
  timeoutMs = 5000
): Promise<Omit<ProviderStatus, "provider" | "configured">> {
  const start = Date.now()
  try {
    await Promise.race([
      fn(),
      new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), timeoutMs)),
    ])
    return { checkType: "live_ping" as const, reachable: true, authValid: true, latencyMs: Date.now() - start, lastError: null, degraded: false }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown"
    return { checkType: "live_ping" as const, reachable: false, authValid: null, latencyMs: Date.now() - start, lastError: msg, degraded: true }
  }
}

function configOnly(provider: string, envVar: string): ProviderStatus {
  const configured = !!process.env[envVar]
  return {
    provider,
    configured,
    checkType: "config_only",
    reachable: null,
    authValid: null,
    latencyMs: null,
    lastError: configured ? null : `${envVar} not set`,
    degraded: !configured,
  }
}

export async function GET() {
  const results: ProviderStatus[] = []

  // 1. Claude — live ping (cheap messages.create with 1 token)
  const claudeKey = process.env.ANTHROPIC_API_KEY
  if (claudeKey) {
    const p = await probe("claude", async () => {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": claudeKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({ model: "claude-haiku-4-5-20251001", max_tokens: 1, messages: [{ role: "user", content: "ping" }] }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
    }, 8000)
    results.push({ provider: "claude", configured: true, ...p })
  } else {
    results.push(configOnly("claude", "ANTHROPIC_API_KEY"))
  }

  // 2. Groq / Whisper — config check + lightweight ping
  const groqKey = process.env.GROQ_API_KEY
  if (groqKey) {
    const p = await probe("groq_whisper", async () => {
      const res = await fetch("https://api.groq.com/openai/v1/models", {
        headers: { Authorization: `Bearer ${groqKey}` },
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
    }, 5000)
    results.push({ provider: "groq_whisper", configured: true, ...p })
  } else {
    results.push(configOnly("groq_whisper", "GROQ_API_KEY"))
  }

  // 3. Firebase / Firestore — live probe
  const fbSa = process.env.FIREBASE_SERVICE_ACCOUNT
  if (fbSa) {
    const p = await probe("firebase_firestore", async () => {
      const { getDb } = await import("@/lib/jobStore")
      const db = getDb()
      await db.collection("console_jobs_v2").limit(1).get()
    }, 5000)
    results.push({ provider: "firebase_firestore", configured: true, ...p })
  } else {
    results.push(configOnly("firebase_firestore", "FIREBASE_SERVICE_ACCOUNT"))
  }

  // 4. Storage bucket — live probe
  if (fbSa) {
    const p = await probe("storage_bucket", async () => {
      const { getStorageBucket } = await import("@/lib/jobStore")
      const bucket = getStorageBucket()
      await bucket.getMetadata()
    }, 5000)
    results.push({ provider: "storage_bucket", configured: true, ...p })
  } else {
    results.push(configOnly("storage_bucket", "FIREBASE_SERVICE_ACCOUNT"))
  }

  // 5. xpoz — config check only (Streamable HTTP MCP)
  results.push(configOnly("xpoz", "XPOZ_MCP_URL"))

  // 6. Apify — config check only
  results.push(configOnly("apify", "APIFY_API_KEY"))

  // 7. Perplexity — live ping (cheap REST call)
  const pplxKey = process.env.PERPLEXITY_API_KEY
  if (pplxKey) {
    const p = await probe("perplexity", async () => {
      const res = await fetch("https://api.perplexity.ai/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${pplxKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: "sonar", messages: [{ role: "user", content: "ping" }], max_tokens: 1 }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
    }, 8000)
    results.push({ provider: "perplexity", configured: true, ...p })
  } else {
    results.push(configOnly("perplexity", "PERPLEXITY_API_KEY"))
  }

  // 8. Supadata — config check only
  results.push(configOnly("supadata", "SUPADATA_API_KEY"))

  // 9. HeyGen — config check only
  results.push(configOnly("heygen", "HEYGEN_API_KEY"))

  // 10. ScrapeCreators — live ping (credit balance endpoint)
  const scKey = process.env.SCRAPECREATORS_API_KEY
  if (scKey) {
    const p = await probe("scrape_creators", async () => {
      const res = await fetch("https://api.scrapecreators.com/v1/credit-balance", {
        headers: { "x-api-key": scKey },
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
    }, 5000)
    results.push({ provider: "scrape_creators", configured: true, ...p })
  } else {
    results.push(configOnly("scrape_creators", "SCRAPECREATORS_API_KEY"))
  }

  // 11. InfluxDB Cloud — optional, live ping via /health
  const influxUrl = process.env.INFLUXDB_URL
  if (influxUrl && process.env.INFLUXDB_TOKEN) {
    const p = await probe("influxdb", async () => {
      const res = await fetch(`${influxUrl}/health`, { signal: AbortSignal.timeout(5000) })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
    }, 5000)
    results.push({ provider: "influxdb", configured: true, ...p })
  } else {
    results.push(configOnly("influxdb", "INFLUXDB_URL"))
  }

  const allHealthy = results.every((r) => !r.degraded)
  return NextResponse.json({
    status: allHealthy ? "healthy" : "degraded",
    timestamp: new Date().toISOString(),
    providers: results,
  })
}
