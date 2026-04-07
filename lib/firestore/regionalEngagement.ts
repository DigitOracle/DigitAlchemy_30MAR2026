/**
 * DigitAlchemy® Gazette — Regional Engagement Samples CRUD
 *
 * Persists per-post engagement data from public ScrapeCreators captures
 * for use as prediction baselines. Cross-user data — not per-user.
 *
 * Phase 2.3c.1 of DA-GAZETTE-UNIFICATION.
 */

import type { RegionalEngagementSample, Platform, Region, Industry } from "@/types/gazette";
import { getDb } from "@/lib/jobStore";

const COLLECTION = "regional_engagement_samples";

// ── Write ───────────────────────────────────────────────────────────────

export async function saveRegionalEngagementSample(
  sample: RegionalEngagementSample,
): Promise<void> {
  const db = getDb();
  await db.collection(COLLECTION).doc(sample.sampleId).set(sample);
}

export async function saveRegionalEngagementSamples(
  samples: RegionalEngagementSample[],
): Promise<void> {
  if (samples.length === 0) return;
  const db = getDb();
  for (let i = 0; i < samples.length; i += 500) {
    const batch = db.batch();
    for (const sample of samples.slice(i, i + 500)) {
      batch.set(db.collection(COLLECTION).doc(sample.sampleId), sample);
    }
    await batch.commit();
  }
}

// ── Read ────────────────────────────────────────────────────────────────

export async function getRegionalEngagementSamples(filter: {
  platform: Platform;
  region: Region;
  industry?: Industry;
  niche?: string[];
  limit?: number;
}): Promise<RegionalEngagementSample[]> {
  const db = getDb();
  let query = db
    .collection(COLLECTION)
    .where("platform", "==", filter.platform)
    .where("region", "==", filter.region)
    .orderBy("capturedAt", "desc")
    .limit(filter.limit ?? 200);

  if (filter.industry) {
    query = db
      .collection(COLLECTION)
      .where("platform", "==", filter.platform)
      .where("region", "==", filter.region)
      .where("industry", "==", filter.industry)
      .orderBy("capturedAt", "desc")
      .limit(filter.limit ?? 200);
  }

  const snap = await query.get();
  let samples = snap.docs.map((d) => d.data() as RegionalEngagementSample);

  // Client-side niche filtering via hashtag overlap (Firestore can't do array-contains-any with arbitrary keywords)
  if (filter.niche && filter.niche.length > 0) {
    const nicheTokens = filter.niche.map((n) => n.toLowerCase());
    samples = samples.filter((s) =>
      s.hashtags.some((h) =>
        nicheTokens.some((t) => h.toLowerCase().includes(t)),
      ),
    );
  }

  return samples;
}

// ── Cleanup ─────────────────────────────────────────────────────────────

/**
 * Delete samples older than the specified number of days.
 * Returns the count of deleted documents.
 */
export async function deleteOldRegionalEngagementSamples(
  olderThanDays: number,
): Promise<number> {
  const db = getDb();
  const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000).toISOString();

  const oldDocs = await db
    .collection(COLLECTION)
    .where("capturedAt", "<", cutoff)
    .limit(500)
    .get();

  if (oldDocs.empty) return 0;

  const batch = db.batch();
  for (const doc of oldDocs.docs) {
    batch.delete(doc.ref);
  }
  await batch.commit();

  return oldDocs.docs.length;
}
