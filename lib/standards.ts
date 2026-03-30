import { LocalStandardsProvider } from "./providers/localStandardsProvider"
import type { StandardsContext } from "@/types"

const provider = new LocalStandardsProvider()

export async function getStandardsContext(task: string): Promise<StandardsContext | undefined> {
  if (!provider.isStandardsRelevant(task)) return undefined
  const words = task.toLowerCase().split(/\s+/)
  const results = await provider.searchByKeywords(words)
  if (!results.length) return undefined
  const collections = [...new Set(results.map((r) => r.collection))]
  return {
    source: "local-cache",
    collectionsConsulted: collections,
    relevantStandards: results.slice(0, 6).map((r) => ({
      title: r.title,
      code: r.code,
      collection: r.collection,
      reason: `Matched task keywords against ${r.category} category`,
      confidence: "medium" as const,
    })),
    standardsActions: [
      "Review applicable standards before proceeding",
      "Confirm jurisdiction-specific requirements with Citation Guard (DA-11)",
      "Cross-reference with Firestore standards corpus for full detail",
    ],
  }
}
