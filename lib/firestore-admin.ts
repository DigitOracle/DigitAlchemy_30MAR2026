/**
 * Firestore admin helper for the knowledge-graph surfaces.
 *
 * Uses the three-var Vercel pattern documented in
 * `CONSOLE_UPDATE_006_FIRESTORE_STREAM.md` lines 36-63:
 *
 *   FIRESTORE_PROJECT_ID    (or NEXT_PUBLIC_FIREBASE_PROJECT_ID, or fallback)
 *   FIRESTORE_CLIENT_EMAIL
 *   FIRESTORE_PRIVATE_KEY   (with literal "\n" escape sequences for Vercel)
 *
 * Distinct from `lib/jobStore.ts`'s `getDb()` which reads
 * `FIREBASE_SERVICE_ACCOUNT` (single JSON blob). Both initializations
 * coexist in the codebase — the knowledge-graph routes (introduced in
 * the Day 6 deploy track) use this helper; the older job-pipeline
 * routes still use jobStore. Either pattern can be unified later
 * without touching either surface in isolation.
 *
 * Auth resolution order:
 *   1. If FIRESTORE_PRIVATE_KEY + FIRESTORE_CLIENT_EMAIL both set, use
 *      cert credentials (production / Vercel path).
 *   2. Otherwise fall back to Application Default Credentials, which
 *      picks up GOOGLE_APPLICATION_CREDENTIALS for local dev.
 */
import type { Firestore } from "firebase-admin/firestore"

let db: Firestore | null = null

export async function getKnowledgeDb(): Promise<Firestore> {
  if (db) return db

  // Dynamic import so tree-shaking and edge-runtime checks don't
  // eagerly pull firebase-admin into bundles that might end up on Edge.
  const admin = await import("firebase-admin")

  if (!admin.default.apps.length) {
    const projectId =
      process.env.FIRESTORE_PROJECT_ID ||
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
      "digitalchemy-de4b7"

    if (process.env.FIRESTORE_PRIVATE_KEY && process.env.FIRESTORE_CLIENT_EMAIL) {
      admin.default.initializeApp({
        credential: admin.default.credential.cert({
          projectId,
          clientEmail: process.env.FIRESTORE_CLIENT_EMAIL,
          // Mirror the Ayrshare pattern in app/api/accounts/connect/route.ts:35
          // which is known-working in production. Three steps:
          //   1. Convert literal `\n` escape sequences → real newlines
          //   2. Strip wrapping quote characters (Vercel sometimes preserves
          //      "..." / '...' as literal chars when the value is pasted with quotes)
          //   3. Trim leading/trailing whitespace
          // The PEM parser fails with "Invalid PEM formatted message" if any
          // of those three are skipped — observed on the first preview deploy.
          privateKey: process.env.FIRESTORE_PRIVATE_KEY
            .replace(/\\n/g, "\n")
            .replace(/^["']|["']$/g, "")
            .trim(),
        }),
      })
    } else {
      // ADC fallback — local dev with GOOGLE_APPLICATION_CREDENTIALS,
      // or environments where the Cloud SDK provides default creds.
      admin.default.initializeApp({ projectId })
    }
  }

  db = admin.default.firestore()
  return db
}
