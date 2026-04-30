/**
 * /api/knowledge/query — public-mode keyword search over knowledge_nodes.
 *
 * Query params:
 *   q     — search string (case-insensitive substring on title + body)
 *   limit — max results (1-8, defaults to 8)
 *
 * Response shape:
 *   {
 *     results: Array<{
 *       node_id: string,
 *       title: string,
 *       excerpt: string,        // summary if present, else body[:300], else title
 *       source_ref: string,
 *       source_origin: "desktop" | "drive" | "notebooklm" | string,
 *     }>,
 *     total: number,             // total matches (may exceed `limit`)
 *     query: string,             // echo of q
 *     limit: number,             // echo of resolved limit
 *     elapsed_ms: number,        // server-side query elapsed
 *   }
 *
 * No auth gating — public-mode only. Filters Firestore on
 * `visibility == "public"` server-side before any client-visible
 * substring match runs. The visibility filter is enforced by the
 * Firestore query itself; there is no client path to private content.
 *
 * This route is the v1.3 public route. The auth-gated `?include=all`
 * variant is deferred to v1.6 §A.2 + Day 8.
 */
import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/jobStore"

export const runtime = "nodejs"
export const maxDuration = 30

const COLLECTION = "knowledge_nodes"
const DEFAULT_LIMIT = 8
const MAX_LIMIT = 8

interface PublicResult {
  node_id: string
  title: string
  excerpt: string
  source_ref: string
  source_origin: string
}

function makeExcerpt(d: FirebaseFirestore.DocumentData): string {
  const summary = (d.summary || "") as string
  if (summary.trim()) return summary
  const body = (d.body || "") as string
  if (body.trim()) return body.slice(0, 300)
  return (d.title || "") as string
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const startedAt = Date.now()
  const { searchParams } = new URL(req.url)
  const q = (searchParams.get("q") || "").trim()
  const limitParam = searchParams.get("limit")
  let limit = DEFAULT_LIMIT
  if (limitParam) {
    const parsed = parseInt(limitParam, 10)
    if (Number.isFinite(parsed) && parsed > 0) {
      limit = Math.min(MAX_LIMIT, parsed)
    }
  }

  if (!q) {
    return NextResponse.json(
      {
        results: [],
        total: 0,
        query: "",
        limit,
        elapsed_ms: Date.now() - startedAt,
      },
      { headers: { "Cache-Control": "no-store" } },
    )
  }

  const queryLower = q.toLowerCase()

  let db: FirebaseFirestore.Firestore
  try {
    db = getDb()
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json(
      { error: "firebase_admin_init_failed", detail: msg },
      { status: 500 },
    )
  }

  // Pre-filter by visibility on the server (single-field index, free).
  // .select() limits payload to the fields we actually use — skips the
  // 1024-float embedding (~8 KB per doc once Phase 6.1 lands) and other
  // canonical fields irrelevant to keyword search.
  let snap: FirebaseFirestore.QuerySnapshot
  try {
    snap = await db
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
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json(
      { error: "firestore_query_failed", detail: msg },
      { status: 500 },
    )
  }

  // In-memory case-insensitive substring match on title + body.
  // Title-hit results are weighted above body-only hits; otherwise the
  // first match in iteration order wins. This is good enough for the
  // demo deploy; ranking can become embedding-based once Phase 6.1
  // populates vectors.
  const titleHits: PublicResult[] = []
  const bodyHits: PublicResult[] = []
  let totalMatches = 0

  for (const doc of snap.docs) {
    const d = doc.data()
    const title = ((d.title || "") as string).toLowerCase()
    const body = ((d.body || "") as string).toLowerCase()
    const titleMatch = title.includes(queryLower)
    const bodyMatch = !titleMatch && body.includes(queryLower)
    if (!titleMatch && !bodyMatch) continue
    totalMatches += 1
    const result: PublicResult = {
      node_id: (d.node_id || doc.id) as string,
      title: (d.title || "") as string,
      excerpt: makeExcerpt(d),
      source_ref: (d.source_ref || "") as string,
      source_origin: (d.source_origin || "") as string,
    }
    if (titleMatch) titleHits.push(result)
    else bodyHits.push(result)
    // Short-circuit once we have enough title-hits to fill the limit
    if (titleHits.length >= limit) break
  }

  const merged = titleHits.concat(bodyHits).slice(0, limit)

  return NextResponse.json(
    {
      results: merged,
      total: totalMatches,
      query: q,
      limit,
      elapsed_ms: Date.now() - startedAt,
    },
    { headers: { "Cache-Control": "no-store" } },
  )
}
