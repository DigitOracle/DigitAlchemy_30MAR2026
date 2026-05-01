/**
 * /knowledge — public-mode search UI.
 *
 * Hits /api/knowledge/answer on submit. The endpoint returns a
 * Claude-generated structured response: { sections, cards, ... } where
 * each section has a heading, body (with inline [N] markers), and a
 * citations array. Sections render as a 2-column card grid; the source
 * cards render below as a single-column list (same visual style).
 *
 * Layout (max-w-5xl wrapper, consistent across answer grid + sources):
 *   1. Header + search input.
 *   2. Loading hint (Claude takes ~3-5s).
 *   3. Section card grid: 1 col mobile, 2 cols desktop. Each card has
 *      heading, body with [N] inline links, and a citation chip row at
 *      the bottom — both link to #card-N below.
 *   4. (answer formatting fallback) hint when parse_fallback is true.
 *   5. Timing footer.
 *   6. Sources list — each card has id="card-N" so inline links and
 *      chips both scroll-anchor here.
 *
 * URL preserves ?q=<term> for shareable links.
 *
 * /api/knowledge/query stays live and unchanged — both routes coexist;
 * this page only consumes /answer.
 */
"use client"

import { useState, useEffect, FormEvent, Suspense, ReactNode } from "react"
import { useRouter, useSearchParams } from "next/navigation"

interface KnowledgeResult {
  node_id: string
  title: string
  excerpt: string
  source_ref: string
  source_origin: string
}

interface AnswerSection {
  heading: string
  body: string
  citations: number[]
}

interface AnswerResponse {
  sections: AnswerSection[]
  cards: KnowledgeResult[]
  total: number
  query: string
  limit: number
  elapsed_ms: number
  claude_ms?: number
  parse_fallback?: boolean
  error?: string
  detail?: string
}

function originBadgeStyle(origin: string): string {
  switch (origin) {
    case "drive":
      return "bg-blue-100 text-blue-800"
    case "notebooklm":
      return "bg-purple-100 text-purple-800"
    case "desktop":
      return "bg-amber-100 text-amber-800"
    default:
      return "bg-gray-100 text-gray-700"
  }
}

function originBadgeLabel(origin: string): string {
  if (origin === "desktop") return "mpf"
  return origin || "unknown"
}

/**
 * Split text on `[N]` citation tokens and render them as anchor links
 * to `#card-N`. Used for inline body citations. Citation chips at the
 * bottom of each section card use the same #card-N anchor convention
 * but go through a simpler chip renderer below.
 */
function renderWithCitations(body: string, maxCardN: number): ReactNode[] {
  const parts: ReactNode[] = []
  const regex = /\[(\d+)\]/g
  let lastIndex = 0
  let match: RegExpExecArray | null
  let key = 0
  while ((match = regex.exec(body)) !== null) {
    if (match.index > lastIndex) {
      parts.push(body.slice(lastIndex, match.index))
    }
    const n = parseInt(match[1], 10)
    if (n >= 1 && n <= maxCardN) {
      parts.push(
        <a
          key={`cite-${key++}`}
          href={`#card-${n}`}
          className="inline-block text-indigo-700 hover:text-indigo-900 hover:underline font-mono text-xs align-baseline"
          aria-label={`Jump to card ${n}`}
        >
          [{n}]
        </a>,
      )
    } else {
      // Citation references a card that doesn't exist — leave as plain text.
      parts.push(match[0])
    }
    lastIndex = match.index + match[0].length
  }
  if (lastIndex < body.length) {
    parts.push(body.slice(lastIndex))
  }
  return parts
}

function KnowledgeBody() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialQ = searchParams.get("q") ?? ""

  const [query, setQuery] = useState(initialQ)
  const [sections, setSections] = useState<AnswerSection[]>([])
  const [cards, setCards] = useState<KnowledgeResult[]>([])
  const [total, setTotal] = useState<number>(0)
  const [elapsedMs, setElapsedMs] = useState<number | null>(null)
  const [claudeMs, setClaudeMs] = useState<number | null>(null)
  const [parseFallback, setParseFallback] = useState<boolean>(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searched, setSearched] = useState<string>("")

  async function runQuery(q: string) {
    const trimmed = q.trim()
    if (!trimmed) {
      setSections([])
      setCards([])
      setTotal(0)
      setElapsedMs(null)
      setClaudeMs(null)
      setParseFallback(false)
      setSearched("")
      return
    }
    setLoading(true)
    setError(null)
    setSections([])
    setCards([])
    setParseFallback(false)
    try {
      const res = await fetch(
        `/api/knowledge/answer?q=${encodeURIComponent(trimmed)}`,
        { cache: "no-store" },
      )
      const data: AnswerResponse = await res.json()
      if (!res.ok || data.error) {
        setError(data.detail ?? data.error ?? `API returned ${res.status}`)
        setSections([])
        setCards([])
        setTotal(0)
        setElapsedMs(null)
        setClaudeMs(null)
        setParseFallback(false)
      } else {
        setSections(data.sections)
        setCards(data.cards)
        setTotal(data.total)
        setElapsedMs(data.elapsed_ms)
        setClaudeMs(typeof data.claude_ms === "number" ? data.claude_ms : null)
        setParseFallback(Boolean(data.parse_fallback))
      }
      setSearched(trimmed)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(msg)
      setSections([])
      setCards([])
      setTotal(0)
      setElapsedMs(null)
      setClaudeMs(null)
      setParseFallback(false)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    runQuery(initialQ)
    setQuery(initialQ)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQ])

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const q = query.trim()
    router.push(q ? `/knowledge?q=${encodeURIComponent(q)}` : "/knowledge")
  }

  return (
    <main className="max-w-5xl mx-auto px-4 py-10">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
          DigitAlchemy Knowledge
        </h1>
        <p className="text-sm text-gray-600 mt-2 max-w-2xl">
          A searchable index of the standards, frameworks, and methodologies
          DigitAlchemy operates from.
        </p>
      </header>

      <form onSubmit={handleSubmit} className="flex gap-2 mb-6 max-w-2xl">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="What would you like DigitAlchemy to help with?"
          aria-label="Search the knowledge index"
          className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          autoFocus
        />
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Thinking…" : "Search"}
        </button>
      </form>

      {loading && (
        <div className="mb-4 text-sm text-gray-500 flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
          Reading the corpus and composing an answer (a few seconds)…
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="mb-4 px-3 py-2 border border-red-200 bg-red-50 text-red-700 text-sm rounded-md"
        >
          {error}
        </div>
      )}

      {!loading && !error && searched && cards.length === 0 && (
        <div className="text-sm text-gray-500">
          No results for &ldquo;{searched}&rdquo;.
        </div>
      )}

      {!loading && sections.length > 0 && cards.length > 0 && (
        <section aria-label="Answer" className="mb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {sections.map((s, i) => (
              <article
                key={`section-${i}`}
                className="border border-gray-200 rounded-md p-4 bg-white flex flex-col"
              >
                <h3 className="text-sm font-semibold text-gray-900 mb-2">
                  {s.heading}
                </h3>
                <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-line flex-1">
                  {renderWithCitations(s.body, cards.length)}
                </div>
                {s.citations.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-3 pt-3 border-t border-gray-100">
                    {s.citations.map((n) => (
                      <a
                        key={`chip-${n}`}
                        href={`#card-${n}`}
                        className="text-xs px-2 py-0.5 rounded font-mono bg-gray-100 text-gray-700 hover:bg-indigo-100 hover:text-indigo-700 transition-colors"
                        aria-label={`Jump to card ${n}`}
                      >
                        [{n}]
                      </a>
                    ))}
                  </div>
                )}
              </article>
            ))}
          </div>

          {parseFallback && (
            <p className="mt-3 text-xs text-amber-700">
              (answer formatting fallback)
            </p>
          )}

          <p className="mt-4 text-xs text-gray-500">
            Generated from {cards.length} of {total.toLocaleString()} matched card
            {total === 1 ? "" : "s"}
            {typeof claudeMs === "number" && (
              <span> · Claude {claudeMs} ms</span>
            )}
            {typeof elapsedMs === "number" && (
              <span> · total {elapsedMs} ms</span>
            )}
          </p>
        </section>
      )}

      {cards.length > 0 && (
        <h2 className="text-xs font-medium tracking-wide uppercase text-gray-500 mb-3">
          Sources
        </h2>
      )}

      <ul className="space-y-3">
        {cards.map((r, idx) => {
          const cardN = idx + 1
          return (
            <li
              key={r.node_id}
              id={`card-${cardN}`}
              className="border border-gray-200 rounded-md p-4 hover:border-gray-300 hover:shadow-sm transition-all scroll-mt-4"
            >
              <div className="flex items-start gap-3 mb-2">
                <span
                  className="shrink-0 text-xs font-mono text-gray-500 mt-0.5"
                  aria-label={`Card ${cardN}`}
                >
                  [{cardN}]
                </span>
                {r.source_ref ? (
                  <a
                    href={r.source_ref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 font-medium text-indigo-700 hover:text-indigo-900 hover:underline break-words"
                  >
                    {r.title || "(untitled)"}
                  </a>
                ) : (
                  <span className="flex-1 font-medium text-gray-900">
                    {r.title || "(untitled)"}
                  </span>
                )}
                <span
                  className={`shrink-0 text-xs px-2 py-0.5 rounded font-mono ${originBadgeStyle(
                    r.source_origin,
                  )}`}
                >
                  {originBadgeLabel(r.source_origin)}
                </span>
              </div>
              <p className="text-sm text-gray-700 whitespace-pre-line line-clamp-4">
                {r.excerpt || "—"}
              </p>
            </li>
          )
        })}
      </ul>
    </main>
  )
}

export default function KnowledgePage() {
  return (
    <Suspense
      fallback={
        <main className="max-w-5xl mx-auto px-4 py-10 text-sm text-gray-500">
          Loading…
        </main>
      }
    >
      <KnowledgeBody />
    </Suspense>
  )
}
