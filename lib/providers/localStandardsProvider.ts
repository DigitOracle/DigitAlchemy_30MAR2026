import type { StandardsProvider } from "./standardsProvider"
import type { StandardsEntry } from "@/types"
import standardsData from "@/data/standards_index.json"

export class LocalStandardsProvider implements StandardsProvider {
  getCategories() {
    return Promise.resolve(standardsData.categories)
  }

  async searchByKeywords(keywords: string[]): Promise<StandardsEntry[]> {
    const lower = keywords.map((k) => k.toLowerCase())
    const results: StandardsEntry[] = []
    for (const cat of standardsData.categories) {
      const match = cat.keywords.some((kw) => lower.some((l) => l.includes(kw) || kw.includes(l)))
      if (match) {
        for (const col of cat.collections) {
          results.push({ title: col, code: col.replace(/\s/g, "-"), collection: cat.label, category: cat.id, tags: cat.keywords })
        }
      }
    }
    return results
  }

  isStandardsRelevant(task: string): boolean {
    const lower = task.toLowerCase()
    const triggers = ["standard", "iso", "bim", "ifc", "compliance", "regulation", "handover", "cobie", "uniclass", "uae", "digital twin", "smart city", "iot", "sensor", "gis", "spatial", "riba", "construction"]
    return triggers.some((t) => lower.includes(t))
  }
}
