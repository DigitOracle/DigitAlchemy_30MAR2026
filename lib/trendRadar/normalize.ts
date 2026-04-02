// lib/trendRadar/normalize.ts — Entity normalization and deduplication

import type { TrendEntity, TrendEntityType } from "./types"

/** Normalize a single entity string based on its type */
export function normalizeEntity(raw: string, type: TrendEntityType): string {
  let n = raw.trim()

  if (type === "hashtag") {
    n = n.replace(/^#+/, "").toLowerCase().replace(/[^\w\u00C0-\u024F]/g, "")
    return n
  }

  if (type === "song") {
    // "Song Title — Artist" or "Song Title - Artist"
    // Normalize dashes, collapse whitespace, lowercase for matching
    n = n.replace(/\s*[\u2014\u2013\-]+\s*/g, " \u2014 ").replace(/\s+/g, " ").trim()
    return n.toLowerCase()
  }

  if (type === "creator") {
    // Strip @ prefix, lowercase
    n = n.replace(/^@+/, "").toLowerCase().trim()
    return n
  }

  // format, theme — lowercase, trim, collapse whitespace
  n = n.toLowerCase().replace(/\s+/g, " ").replace(/[.!?,;:]+$/, "").trim()
  return n
}

/** Deduplicate a list of TrendEntity by normalized entity string */
export function dedupeEntities(entities: TrendEntity[]): TrendEntity[] {
  const seen = new Map<string, TrendEntity>()

  for (const e of entities) {
    const key = `${e.entityType}::${e.entity}`
    const existing = seen.get(key)

    if (!existing) {
      seen.set(key, e)
      continue
    }

    // Keep the one with better rank or provider data
    if (e.rank !== null && (existing.rank === null || e.rank < existing.rank)) {
      seen.set(key, { ...e, metadata: { ...existing.metadata, ...e.metadata } })
    } else if (e.providerScore !== null && existing.providerScore === null) {
      seen.set(key, { ...existing, providerScore: e.providerScore, providerRawRank: e.providerRawRank })
    }
  }

  return Array.from(seen.values())
}

/** Build a TrendEntity from raw data with normalization */
export function buildEntity(
  raw: string,
  type: TrendEntityType,
  rank: number | null,
  providerRawRank: number | null,
  providerScore: number | null,
  metadata: Record<string, unknown> = {},
  notes: string | null = null
): TrendEntity {
  return {
    entityType: type,
    entity: normalizeEntity(raw, type),
    entityRaw: raw.trim(),
    rank,
    providerRawRank,
    providerScore,
    metadata,
    notes,
  }
}
