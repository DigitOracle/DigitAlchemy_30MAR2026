/**
 * /api/knowledge/query — public-mode keyword search over knowledge_nodes.
 *
 * Thin wrapper around `lib/knowledge/query.ts:runKeywordQuery`. The
 * shared module owns the actual Firestore + filtering logic; this
 * route just translates HTTP query params and shapes the JSON
 * response. The /api/knowledge/answer route reuses the same shared
 * function so both surfaces return identical card sets.
 *
 * Query params:
 *   q     — search string (case-insensitive substring on title + body)
 *   limit — max results (1-8, defaults to 8)
 *
 * Response shape:
 *   {
 *     results: KnowledgeResult[],
 *     total: number,             // total matches (may exceed `limit`)
 *     query: string,             // echo of q
 *     limit: number,             // resolved limit
 *     elapsed_ms: number,
 *   }
 *
 * No auth gating — visibility filter enforced server-side by the
 * shared lib's Firestore query.
 */
import { NextRequest, NextResponse } from "next/server"
import { runKeywordQuery, clampLimit } from "@/lib/knowledge/query"

export const runtime = "nodejs"
export const maxDuration = 30

export async function GET(req: NextRequest): Promise<NextResponse> {
  const startedAt = Date.now()
  const { searchParams } = new URL(req.url)
  const q = (searchParams.get("q") || "").trim()
  const limit = clampLimit(searchParams.get("limit"))

  try {
    const outcome = await runKeywordQuery(q, limit)
    return NextResponse.json(
      {
        results: outcome.results,
        total: outcome.total,
        query: q,
        limit,
        elapsed_ms: Date.now() - startedAt,
      },
      { headers: { "Cache-Control": "no-store" } },
    )
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json(
      { error: "knowledge_query_failed", detail: msg },
      { status: 500 },
    )
  }
}
