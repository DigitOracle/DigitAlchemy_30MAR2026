/**
 * /api/knowledge/answer — Claude-generated natural-language answer
 * grounded in the same top-K cards /api/knowledge/query returns.
 *
 * Flow:
 *   1. Run the shared keyword query (lib/knowledge/query.ts) — same
 *      cards as /api/knowledge/query for the same q + limit.
 *   2. Build a citation-grounded prompt: cards numbered [1]..[N],
 *      Claude must cite them inline and refuse to invent if cards
 *      don't carry the answer.
 *   3. Call claude-haiku-4-5-20251001 (cheap, fast, sufficient).
 *   4. Return { answer, cards, query, total, limit, elapsed_ms }.
 *
 * If the keyword query returns no cards, Claude is skipped entirely —
 * we return an empty answer with a hint that nothing matched. Saves a
 * Haiku call when there's nothing to ground on.
 *
 * Streaming deferred — non-streaming Haiku at ~800 tokens completes
 * in ~3-5 s, acceptable for v1.
 *
 * No auth gating — public-mode only, same as /api/knowledge/query.
 */
import { NextRequest, NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import {
  runKeywordQuery,
  clampLimit,
  type KnowledgeResult,
} from "@/lib/knowledge/query"

export const runtime = "nodejs"
export const maxDuration = 30

const ANTHROPIC_MODEL = "claude-haiku-4-5-20251001"
const MAX_TOKENS = 800

const SYSTEM_PROMPT =
  "You are a knowledge guide for DigitAlchemy. The user is asking " +
  "about a concept, standard, or methodology. Using ONLY the provided " +
  "source cards, explain what they're asking about: what it is, what " +
  "it's used for, and how DigitAlchemy uses it. Cite cards inline as " +
  "[1], [2] etc. matching the order provided. If the cards don't " +
  "contain enough information to answer, say so plainly — do not invent."

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

function buildUserPrompt(q: string, cards: KnowledgeResult[]): string {
  const cardLines = cards.map((c, i) => {
    const n = i + 1
    const title = c.title || "(untitled)"
    const excerpt = c.excerpt || "—"
    return `[${n}] ${title}\n${excerpt}`
  }).join("\n\n")
  return `Question: ${q}\n\nSource cards:\n${cardLines}`
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const startedAt = Date.now()
  const { searchParams } = new URL(req.url)
  const q = (searchParams.get("q") || "").trim()
  const limit = clampLimit(searchParams.get("limit"))

  if (!q) {
    return NextResponse.json(
      {
        answer: "",
        cards: [],
        total: 0,
        query: "",
        limit,
        elapsed_ms: Date.now() - startedAt,
      },
      { headers: { "Cache-Control": "no-store" } },
    )
  }

  // 1. Cards via the shared keyword search.
  let outcome
  try {
    outcome = await runKeywordQuery(q, limit)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json(
      { error: "knowledge_query_failed", detail: msg },
      { status: 500 },
    )
  }

  // No cards = no grounding = no Claude call. Return early with a hint.
  if (outcome.results.length === 0) {
    return NextResponse.json(
      {
        answer:
          `No cards in the public knowledge corpus matched "${q}". ` +
          `Try a different term or broader phrasing.`,
        cards: [],
        total: 0,
        query: q,
        limit,
        elapsed_ms: Date.now() - startedAt,
      },
      { headers: { "Cache-Control": "no-store" } },
    )
  }

  // 2-3. Build prompt + call Claude.
  const userPrompt = buildUserPrompt(q, outcome.results)
  let answer: string
  let claudeMs: number
  try {
    const t0 = Date.now()
    const response = await client.messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: MAX_TOKENS,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    })
    claudeMs = Date.now() - t0
    answer = response.content
      .filter((block) => block.type === "text")
      .map((block) => (block as { text: string }).text)
      .join("")
      .trim()
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json(
      { error: "claude_call_failed", detail: msg },
      { status: 500 },
    )
  }

  return NextResponse.json(
    {
      answer,
      cards: outcome.results,
      total: outcome.total,
      query: q,
      limit,
      claude_ms: claudeMs,
      elapsed_ms: Date.now() - startedAt,
    },
    { headers: { "Cache-Control": "no-store" } },
  )
}
