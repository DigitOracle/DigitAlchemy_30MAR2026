// Firestore provider — stubbed for MVP, ready for live integration
// Connect by setting FIRESTORE_PROJECT_ID, FIRESTORE_CLIENT_EMAIL, FIRESTORE_PRIVATE_KEY
import type { StandardsProvider } from "./standardsProvider"
import type { StandardsEntry } from "@/types"
import { LocalStandardsProvider } from "./localStandardsProvider"

export class FirestoreStandardsProvider implements StandardsProvider {
  private fallback = new LocalStandardsProvider()

  getCategories() {
    // TODO: fetch from Firestore `standards` collection metadata
    return this.fallback.getCategories()
  }

  async searchByKeywords(keywords: string[]): Promise<StandardsEntry[]> {
    // TODO: query Firestore standards corpus by keyword tags
    // Collection: standards, field: tags (array-contains-any)
    return this.fallback.searchByKeywords(keywords)
  }

  isStandardsRelevant(task: string): boolean {
    return this.fallback.isStandardsRelevant(task)
  }
}
