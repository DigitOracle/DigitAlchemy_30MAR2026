/**
 * /knowledge — public-mode keyword search UI.
 *
 * Single-input form, results as cards with title (linked to source_ref),
 * excerpt, and source_origin badge. URL preserves ?q=... for shareable
 * links. No auth gating — backed by /api/knowledge/query which
 * pre-filters Firestore on visibility=='public'.
 *
 * v1.4 plain-language placeholder ("What would you like DigitAlchemy
 * to help with?") per IMPLEMENTATION_PLAN_AMENDMENT_v1_4.md. Mode
 * dispatcher (Cards / Flowchart / Control Room) deferred — Days 8-12.
 */
"use client"

import { useState, useEffect, FormEvent, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"

interface KnowledgeResult {
  node_id: string
  title: string
  excerpt: string
  source_ref: string
  source_origin: string
}

interface QueryResponse {
  results: KnowledgeResult[]
  total: number
  query: string
  limit: number
  elapsed_ms: number
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

function KnowledgeBody() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialQ = searchParams.get("q") ?? ""

  const [query, setQuery] = useState(initialQ)
  const [results, setResults] = useState<KnowledgeResult[]>([])
  const [total, setTotal] = useState<number>(0)
  const [elapsedMs, setElapsedMs] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searched, setSearched] = useState<string>("")

  async function runQuery(q: string) {
    const trimmed = q.trim()
    if (!trimmed) {
      setResults([])
      setTotal(0)
      setElapsedMs(null)
      setSearched("")
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/knowledge/query?q=${encodeURIComponent(trimmed)}&limit=8`,
        { cache: "no-store" },
      )
      const data: QueryResponse = await res.json()
      if (!res.ok || data.error) {
        setError(data.detail ?? data.error ?? `API returned ${res.status}`)
        setResults([])
        setTotal(0)
        setElapsedMs(null)
      } else {
        setResults(data.results)
        setTotal(data.total)
        setElapsedMs(data.elapsed_ms)
      }
      setSearched(trimmed)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(msg)
      setResults([])
      setTotal(0)
      setElapsedMs(null)
    } finally {
      setLoading(false)
    }
  }

  // Run the query whenever the URL ?q= changes (covers initial load
  // with a deep link, plus subsequent submits via router.push).
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
    <main className="max-w-3xl mx-auto px-4 py-10">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
          DigitAlchemy Knowledge
        </h1>
        <p className="text-sm text-gray-600 mt-2 max-w-2xl">
          A searchable index of the standards, frameworks, and methodologies
          DigitAlchemy operates from.
        </p>
      </header>

      <form onSubmit={handleSubmit} className="flex gap-2 mb-6">
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
          {loading ? "Searching…" : "Search"}
        </button>
      </form>

      {error && (
        <div
          role="alert"
          className="mb-4 px-3 py-2 border border-red-200 bg-red-50 text-red-700 text-sm rounded-md"
        >
          {error}
        </div>
      )}

      {!loading && !error && searched && results.length === 0 && (
        <div className="text-sm text-gray-500">
          No results for &ldquo;{searched}&rdquo;.
        </div>
      )}

      {results.length > 0 && (
        <p className="text-xs text-gray-500 mb-3">
          {total.toLocaleString()} match{total === 1 ? "" : "es"}
          {typeof elapsedMs === "number" && (
            <span> · {elapsedMs} ms</span>
          )}
          {total > results.length && (
            <span> · showing top {results.length}</span>
          )}
        </p>
      )}

      <ul className="space-y-3">
        {results.map((r) => (
          <li
            key={r.node_id}
            className="border border-gray-200 rounded-md p-4 hover:border-gray-300 hover:shadow-sm transition-all"
          >
            <div className="flex items-start gap-3 mb-2">
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
        ))}
      </ul>
    </main>
  )
}

export default function KnowledgePage() {
  return (
    <Suspense fallback={<main className="max-w-3xl mx-auto px-4 py-10 text-sm text-gray-500">Loading…</main>}>
      <KnowledgeBody />
    </Suspense>
  )
}
