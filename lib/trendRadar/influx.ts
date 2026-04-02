// lib/trendRadar/influx.ts — Optional InfluxDB Cloud write-through for trend snapshots
// Firestore remains primary. Influx is additive time-series storage only.
// If INFLUXDB_URL / INFLUXDB_TOKEN / INFLUXDB_ORG / INFLUXDB_BUCKET are missing, all writes are silently skipped.

import type { TrendSnapshot } from "./types"

const CONFIDENCE_MAP: Record<string, number> = { high: 3, medium: 2, low: 1 }

function isConfigured(): boolean {
  return !!(process.env.INFLUXDB_URL && process.env.INFLUXDB_TOKEN && process.env.INFLUXDB_ORG && process.env.INFLUXDB_BUCKET)
}

/** Escape InfluxDB line protocol tag values */
function escapeTag(v: string): string {
  return v.replace(/[, =\n\r\t]/g, "\\$&")
}

/** Escape InfluxDB line protocol field string values */
function escapeField(v: string): string {
  return v.replace(/["\\]/g, "\\$&")
}

/** Convert a TrendSnapshot into InfluxDB line protocol lines */
function toLineProtocol(snapshot: TrendSnapshot): string[] {
  const ts = new Date(snapshot.capturedAt).getTime() * 1_000_000 // nanoseconds

  return snapshot.entities.map((e) => {
    const tags = [
      `platform=${escapeTag(snapshot.platform)}`,
      `scope=${escapeTag(snapshot.scope)}`,
      `entityType=${escapeTag(e.entityType)}`,
      `entity=${escapeTag(e.entity)}`,
      `source=${escapeTag(snapshot.source)}`,
    ]
    if (snapshot.niche) tags.push(`niche=${escapeTag(snapshot.niche)}`)

    const fields: string[] = []
    if (e.rank !== null) fields.push(`rank=${e.rank}i`)
    if (e.providerRawRank !== null) fields.push(`providerRawRank=${e.providerRawRank}i`)
    if (e.providerScore !== null) fields.push(`providerScore=${e.providerScore}i`)
    fields.push(`sourceConfidence=${CONFIDENCE_MAP[snapshot.sourceConfidence] ?? 1}i`)
    fields.push(`entityCount=${snapshot.entityCount}i`)
    fields.push(`entityRaw="${escapeField(e.entityRaw)}"`)

    if (fields.length === 0) return ""
    return `trend_snapshot,${tags.join(",")} ${fields.join(",")} ${ts}`
  }).filter(Boolean)
}

/** Write a TrendSnapshot to InfluxDB Cloud. Safe to call even if Influx is not configured. */
export async function writeSnapshotToInflux(snapshot: TrendSnapshot): Promise<{ written: boolean; lineCount: number }> {
  if (!isConfigured()) {
    console.log("[influx] skipped — env vars not configured")
    return { written: false, lineCount: 0 }
  }

  const url = process.env.INFLUXDB_URL!
  const token = process.env.INFLUXDB_TOKEN!
  const org = encodeURIComponent(process.env.INFLUXDB_ORG!)
  const bucket = encodeURIComponent(process.env.INFLUXDB_BUCKET!)

  const lines = toLineProtocol(snapshot)
  if (lines.length === 0) return { written: false, lineCount: 0 }

  const body = lines.join("\n")

  try {
    const res = await fetch(`${url}/api/v2/write?org=${org}&bucket=${bucket}&precision=ns`, {
      method: "POST",
      headers: {
        Authorization: `Token ${token}`,
        "Content-Type": "text/plain; charset=utf-8",
      },
      body,
      signal: AbortSignal.timeout(10000),
    })

    if (!res.ok) {
      const errText = await res.text().catch(() => "")
      console.log(`[influx] write failed HTTP ${res.status}: ${errText.slice(0, 200)}`)
      return { written: false, lineCount: 0 }
    }

    console.log(`[influx] wrote ${lines.length} points for ${snapshot.platform}/${snapshot.scope}`)
    return { written: true, lineCount: lines.length }
  } catch (err) {
    console.log(`[influx] write error: ${(err as Error).message}`)
    return { written: false, lineCount: 0 }
  }
}

/** Health check: returns whether InfluxDB is configured, reachable, and authenticated */
export async function checkInfluxHealth(): Promise<{
  configured: boolean
  reachable: boolean | null
  authValid: boolean | null
  latencyMs: number | null
  error: string | null
}> {
  if (!isConfigured()) {
    return { configured: false, reachable: null, authValid: null, latencyMs: null, error: "INFLUXDB_URL/TOKEN/ORG/BUCKET not set" }
  }

  const start = Date.now()
  try {
    const res = await fetch(`${process.env.INFLUXDB_URL!}/health`, {
      signal: AbortSignal.timeout(5000),
    })
    const latencyMs = Date.now() - start
    if (!res.ok) {
      return { configured: true, reachable: true, authValid: false, latencyMs, error: `HTTP ${res.status}` }
    }
    return { configured: true, reachable: true, authValid: true, latencyMs, error: null }
  } catch (err) {
    return { configured: true, reachable: false, authValid: null, latencyMs: Date.now() - start, error: (err as Error).message }
  }
}
