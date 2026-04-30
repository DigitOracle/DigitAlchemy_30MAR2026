/**
 * Shared keyword-search logic for the /knowledge surfaces.
 *
 * Both `/api/knowledge/query` (returns ranked cards) and
 * `/api/knowledge/answer` (returns a Claude-generated natural-language
 * answer + the same cards as citations) call this function. Single
 * source of truth for the keyword search — no duplication.
 *
 * Pre-filters Firestore on `visibility=='public'` server-side, then
 * runs case-insensitive substring match on title + body across the
 * fetched docs. Title hits rank above body-only hits; iteration order
 * within each bucket. Short-circuits as soon as `limit` title-hits
 * are accumulated.
 *
 * `.select()` limits payload to fields the keyword scan + result
 * shape need — skips the embedding (1024 floats per doc when Phase 6.1
 * lands) and other canonical fields irrelevant to keyword search.
 */
import { getDb } from "@/lib/jobStore"

export const COLLECTION = "knowledge_nodes"
export const DEFAULT_LIMIT = 8
export const MAX_LIMIT = 8

export interface KnowledgeResult {
  node_id: string
  title: string
  excerpt: string
  source_ref: string
  source_origin: string
}

export interface KnowledgeQueryOutcome {
  results: KnowledgeResult[]
  total: number          // total matches discovered (may exceed results.length)
  elapsed_ms: number     // server-side keyword-scan elapsed
}

function makeExcerpt(d: FirebaseFirestore.DocumentData): string {
  const summary = (d.summary || "") as string
  if (summary.trim()) return summary
  const body = (d.body || "") as string
  if (body.trim()) return body.slice(0, 300)
  return (d.title || "") as string
}

export function clampLimit(raw: string | number | null | undefined): number {
  let limit = DEFAULT_LIMIT
  if (raw !== null && raw !== undefined && raw !== "") {
    const parsed = typeof raw === "number" ? raw : parseInt(raw, 10)
    if (Number.isFinite(parsed) && parsed > 0) {
      limit = Math.min(MAX_LIMIT, parsed)
    }
  }
  return limit
}

/**
 * Run a keyword query against `knowledge_nodes`. Returns the matched
 * cards plus the total count. Empty/whitespace-only `q` returns an
 * empty outcome immediately without a Firestore round-trip.
 */
export async function runKeywordQuery(
  q: string,
  limit: number = DEFAULT_LIMIT,
): Promise<KnowledgeQueryOutcome> {
  const startedAt = Date.now()
  const trimmed = q.trim()
  if (!trimmed) {
    return { results: [], total: 0, elapsed_ms: Date.now() - startedAt }
  }
  const queryLower = trimmed.toLowerCase()

  const db = getDb()
  const snap = await db
    .collection(COLLECTION)
    .where("visibility", "==", "public")
    .select(
      "node_id",
      "node_type",
      "title",
      "summary",
      "body",
      "source_ref",
      "source_origin",
    )
    .get()

  const titleHits: KnowledgeResult[] = []
  const bodyHits: KnowledgeResult[] = []
  let totalMatches = 0

  for (const doc of snap.docs) {
    const d = doc.data()
    const title = ((d.title || "") as string).toLowerCase()
    const body = ((d.body || "") as string).toLowerCase()
    const titleMatch = title.includes(queryLower)
    const bodyMatch = !titleMatch && body.includes(queryLower)
    if (!titleMatch && !bodyMatch) continue
    totalMatches += 1
    const result: KnowledgeResult = {
      node_id: (d.node_id || doc.id) as string,
      title: (d.title || "") as string,
      excerpt: makeExcerpt(d),
      source_ref: (d.source_ref || "") as string,
      source_origin: (d.source_origin || "") as string,
    }
    if (titleMatch) titleHits.push(result)
    else bodyHits.push(result)
    if (titleHits.length >= limit) break
  }

  return {
    results: titleHits.concat(bodyHits).slice(0, limit),
    total: totalMatches,
    elapsed_ms: Date.now() - startedAt,
  }
}
