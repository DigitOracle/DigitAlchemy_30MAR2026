import type { StandardsEntry } from "@/types"

export interface StandardsProvider {
  getCategories(): Promise<{ id: string; label: string; keywords: string[] }[]>
  searchByKeywords(keywords: string[]): Promise<StandardsEntry[]>
  isStandardsRelevant(task: string): boolean
}
