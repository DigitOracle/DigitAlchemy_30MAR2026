/**
 * Voyage AI query embedder.
 *
 * Embeds a query string via voyage-4-lite (1024-dim). The companion
 * model voyage-4-large was used to embed every node in the
 * knowledge_nodes Firestore collection (Phase 6.1, full public
 * corpus). Both Voyage 4 models share an embedding space — query and
 * document vectors are directly comparable, no re-projection needed.
 *
 * Calls Voyage's REST API directly via native fetch (Node 18+) — no
 * SDK dependency. Voyage publishes a Python SDK only.
 *
 * Returned vectors are L2-normalized by Voyage. Downstream Firestore
 * `findNearest` calls should pass `distanceMeasure: "DOT_PRODUCT"` —
 * Google's docs explicitly recommend it over COSINE on unit-norm
 * vectors (mathematically equivalent, faster execution). See
 * PHASE_2_BACKLOG.md Item 8 in the dakg repo.
 *
 * Env: VOYAGE_API_KEY must be present at call time. Throws on auth,
 * transport, or response-shape failure; the caller decides fallback
 * strategy (Phase 7's API route falls back to keyword search).
 */

export const VOYAGE_QUERY_MODEL = "voyage-4-lite"
export const VOYAGE_QUERY_DIM = 1024
const VOYAGE_ENDPOINT = "https://api.voyageai.com/v1/embeddings"

interface VoyageEmbeddingResponse {
  data?: Array<{ embedding?: number[] }>
}

export async function embedQuery(text: string): Promise<number[]> {
  const apiKey = process.env.VOYAGE_API_KEY
  if (!apiKey) {
    throw new Error("VOYAGE_API_KEY is not set in the environment")
  }
  const trimmed = text.trim()
  if (!trimmed) {
    throw new Error("embedQuery: text is empty")
  }

  const res = await fetch(VOYAGE_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      input: [trimmed],
      model: VOYAGE_QUERY_MODEL,
      input_type: "query",
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(
      `voyage embed ${res.status}: ${body.slice(0, 500)}`,
    )
  }

  const json = (await res.json()) as VoyageEmbeddingResponse
  const emb = json.data?.[0]?.embedding
  if (!Array.isArray(emb) || emb.length !== VOYAGE_QUERY_DIM) {
    throw new Error(
      `voyage embed: unexpected response shape (got length ` +
        `${Array.isArray(emb) ? emb.length : typeof emb}, expected ${VOYAGE_QUERY_DIM})`,
    )
  }
  return emb
}
