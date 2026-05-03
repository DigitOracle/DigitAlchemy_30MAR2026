/**
 * Vector-similarity retrieval over knowledge_nodes via Firestore findNearest.
 *
 * Embeds the query through Voyage's voyage-4-lite model (lib/knowledge/
 * embeddings.ts) and runs Firestore's native findNearest on the
 * `embedding` field, pre-filtered to visibility=='public'. Returns the
 * same KnowledgeQueryOutcome shape as runKeywordQuery so the API route
 * can swap them with no shape changes.
 *
 * Distance measure is DOT_PRODUCT — Voyage 4 returns L2-normalized
 * vectors (verified in Phase 6.1.5, vector[0] norm = 1.000000), and
 * Google's Firestore docs recommend DOT_PRODUCT over COSINE on unit
 * vectors as "mathematically equivalent with better performance". See
 * PHASE_2_BACKLOG.md Item 8 (dakg) for the full rationale.
 *
 * Pre-filter on visibility=='public' uses the composite vector index
 * (visibility ASC + embedding VECTOR(1024)). Without that index,
 * findNearest throws FAILED_PRECONDITION; the caller is expected to
 * fall back to keyword retrieval in that case.
 *
 * NOTE on `total`: vector search returns top-K only; `total =
 * results.length`, NOT a corpus-wide match count. UI footer "Generated
 * from X of Y" will read "X of X" on the vector path vs "X of Y" on
 * the keyword path. Acceptable trade — semantic search has no native
 * notion of "how many docs were eligible", and the second-round-trip
 * count() filter doesn't justify the latency.
 *
 * Throws:
 *   - "vector query: empty input" — empty query string
 *   - "vector query failed at embed stage: ..." — Voyage call failed
 *   - "vector index not ready: ..." — Firestore findNearest threw
 *     (typically index-not-built, transient at deploy time)
 *
 * Returns an empty results array (does NOT throw) when the index is
 * ready but yields zero matches above the implicit threshold.
 */
import { FieldValue } from "firebase-admin/firestore"
import { getDb } from "@/lib/jobStore"
import { embedQuery } from "@/lib/knowledge/embeddings"
import {
  COLLECTION,
  type KnowledgeResult,
  type KnowledgeQueryOutcome,
} from "@/lib/knowledge/query"

function makeExcerpt(d: FirebaseFirestore.DocumentData): string {
  const summary = (d.summary || "") as string
  if (summary.trim()) return summary
  const body = (d.body || "") as string
  if (body.trim()) return body.slice(0, 300)
  return (d.title || "") as string
}

export async function runVectorQuery(
  q: string,
  limit: number,
): Promise<KnowledgeQueryOutcome> {
  const startedAt = Date.now()
  const trimmed = q.trim()
  if (!trimmed) {
    throw new Error("vector query: empty input")
  }

  let queryVector: number[]
  try {
    queryVector = await embedQuery(trimmed)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    throw new Error(`vector query failed at embed stage: ${msg}`)
  }

  const db = getDb()
  const baseQuery = db
    .collection(COLLECTION)
    .where("visibility", "==", "public")

  let snap
  try {
    const vq = baseQuery.findNearest({
      vectorField: "embedding",
      queryVector: FieldValue.vector(queryVector),
      limit,
      distanceMeasure: "DOT_PRODUCT",
    })
    snap = await vq.get()
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    throw new Error(`vector index not ready: ${msg}`)
  }

  const results: KnowledgeResult[] = snap.docs.map((doc) => {
    const d = doc.data()
    return {
      node_id: (d.node_id || doc.id) as string,
      title: (d.title || "") as string,
      excerpt: makeExcerpt(d),
      source_ref: (d.source_ref || "") as string,
      source_origin: (d.source_origin || "") as string,
    }
  })

  return {
    results,
    total: results.length,
    elapsed_ms: Date.now() - startedAt,
  }
}
