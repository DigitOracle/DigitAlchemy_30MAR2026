/**
 * /api/knowledge/answer — Claude-generated structured answer
 * grounded in the same top-K cards /api/knowledge/query returns.
 *
 * Flow:
 *   1. Run the shared keyword query (lib/knowledge/query.ts) — same
 *      cards as /api/knowledge/query for the same q + limit.
 *   2. Build a citation-grounded prompt that asks Claude for a JSON
 *      object with `sections`, each one a { heading, body, citations }
 *      triple. Claude must keep [N] inline markers in the body in
 *      sync with the citations array.
 *   3. Call claude-haiku-4-5-20251001.
 *   4. Parse + validate Claude's response. If parsing fails (malformed
 *      JSON, missing fields, etc.), fall back to a single section
 *      containing the raw prose and set `parse_fallback: true` so the
 *      UI can flag it. We surface fallbacks rather than silently
 *      hiding them — repeated fallbacks mean the prompt needs tuning.
 *   5. Return { sections, cards, total, query, claude_ms, elapsed_ms,
 *      parse_fallback? }.
 *
 * If the keyword query returns no cards, Claude is skipped entirely —
 * we return `sections: []` with `cards: []`, and the UI renders its
 * own "no results" hint.
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
// Bumped from 800 — structured JSON adds keys/braces/whitespace overhead
// vs. free prose, and 4-5 sections of substance need headroom.
const MAX_TOKENS = 1200

const SYSTEM_PROMPT = `You are a knowledge guide for DigitAlchemy. The user is asking about a concept, standard, methodology, process, or tool. Using ONLY the provided source cards, structure your answer as a JSON object.

Respond with a JSON object matching this schema:
{
  "sections": [
    { "heading": "What it is", "body": "...", "citations": [1, 2] },
    { "heading": "What it's used for", "body": "...", "citations": [3] },
    { "heading": "How DigitAlchemy uses it", "body": "...", "citations": [4, 5] },
    { "heading": "Status", "body": "...", "citations": [6] }
  ]
}

Section count is flexible — between 2 and 5 sections, whichever fits the query.

Choose section headings appropriate to the query type:
- Concepts/standards: What it is / What it's used for / How DigitAlchemy uses it / Status
- Processes: What the process is / Steps / Inputs & outputs / Who's involved
- Tools: What it is / Capabilities / How DigitAlchemy uses it / Limitations

Cite source cards inline in the body using [N] markers AND list cited card numbers in the citations array.

If cards don't contain enough information for a section, omit that section — do not invent.

Output ONLY the JSON object, no preamble, no markdown fences.`

interface AnswerSection {
  heading: string
  body: string
  citations: number[]
}

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

// Strip a markdown code fence Claude sometimes wraps the JSON in despite
// being told not to. Tolerant of "```json" or bare "```" openers.
function stripFences(s: string): string {
  let out = s.trim()
  if (out.startsWith("```")) {
    out = out.replace(/^```(?:json)?\s*/i, "")
    out = out.replace(/\s*```$/, "")
  }
  return out.trim()
}

function extractCitations(body: string): number[] {
  const set = new Set<number>()
  const regex = /\[(\d+)\]/g
  let m: RegExpExecArray | null
  while ((m = regex.exec(body)) !== null) {
    const n = parseInt(m[1], 10)
    if (Number.isFinite(n)) set.add(n)
  }
  return Array.from(set).sort((a, b) => a - b)
}

// Returns validated sections or null if the parsed payload doesn't
// match the expected schema. Drops citations referencing cards that
// don't exist.
function validateSections(
  parsed: unknown,
  cardCount: number,
): AnswerSection[] | null {
  if (!parsed || typeof parsed !== "object") return null
  const obj = parsed as { sections?: unknown }
  if (!Array.isArray(obj.sections)) return null
  const out: AnswerSection[] = []
  for (const raw of obj.sections) {
    if (!raw || typeof raw !== "object") return null
    const s = raw as {
      heading?: unknown
      body?: unknown
      citations?: unknown
    }
    if (typeof s.heading !== "string" || typeof s.body !== "string") return null
    const heading = s.heading.trim()
    const body = s.body.trim()
    if (!heading || !body) return null
    let citations: number[] = []
    if (Array.isArray(s.citations)) {
      citations = s.citations
        .filter((c): c is number => typeof c === "number" && Number.isFinite(c))
        .filter((c) => c >= 1 && c <= cardCount)
    }
    out.push({ heading, body, citations })
  }
  if (out.length === 0) return null
  return out
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const startedAt = Date.now()
  const { searchParams } = new URL(req.url)
  const q = (searchParams.get("q") || "").trim()
  const limit = clampLimit(searchParams.get("limit"))

  if (!q) {
    return NextResponse.json(
      {
        sections: [],
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

  // No cards = no grounding = no Claude call.
  if (outcome.results.length === 0) {
    return NextResponse.json(
      {
        sections: [],
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
  let rawText: string
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
    rawText = response.content
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

  // 4. Parse + validate. On any failure, fall back to a single
  //    "Answer" section with the raw prose, and flag parse_fallback so
  //    the UI surfaces it.
  let sections: AnswerSection[] | null = null
  try {
    const parsed = JSON.parse(stripFences(rawText))
    sections = validateSections(parsed, outcome.results.length)
  } catch {
    sections = null
  }

  let parseFallback = false
  if (!sections) {
    parseFallback = true
    sections = [
      {
        heading: "Answer",
        body: rawText,
        citations: extractCitations(rawText),
      },
    ]
  }

  return NextResponse.json(
    {
      sections,
      cards: outcome.results,
      total: outcome.total,
      query: q,
      limit,
      claude_ms: claudeMs,
      elapsed_ms: Date.now() - startedAt,
      ...(parseFallback ? { parse_fallback: true } : {}),
    },
    { headers: { "Cache-Control": "no-store" } },
  )
}
