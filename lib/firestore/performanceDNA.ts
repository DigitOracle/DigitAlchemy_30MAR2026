/**
 * DigitAlchemy® Gazette — Performance DNA Firestore CRUD
 *
 * Persists per-post engagement data and aggregated Performance DNA
 * under users/{uid}/performance_dna/.
 *
 * Phase 2.3b of DA-GAZETTE-UNIFICATION.
 */

import type { PerformanceDNA, PerformancePost } from "@/types/gazette";
import { getDb } from "@/lib/jobStore";
import { buildPerformanceDNA } from "@/lib/gazette/performanceAnalysis";

const MAX_POSTS = 50;

function dnaPath(uid: string) {
  return `users/${uid}/performance_dna/main`;
}

function postsCollection(uid: string) {
  return `users/${uid}/performance_dna/posts/items`;
}

// ── Read ────────────────────────────────────────────────────────────────

export async function getPerformanceDNA(uid: string): Promise<PerformanceDNA | null> {
  const db = getDb();
  const snap = await db.doc(dnaPath(uid)).get();
  return snap.exists ? (snap.data() as PerformanceDNA) : null;
}

export async function getPerformancePosts(uid: string): Promise<PerformancePost[]> {
  const db = getDb();
  const snap = await db
    .collection(postsCollection(uid))
    .orderBy("publishedAt", "desc")
    .limit(MAX_POSTS)
    .get();
  return snap.docs.map((d) => d.data() as PerformancePost);
}

// ── Write ───────────────────────────────────────────────────────────────

export async function savePerformancePost(
  uid: string,
  post: PerformancePost,
): Promise<void> {
  const db = getDb();
  await db.collection(postsCollection(uid)).doc(post.postId).set(post);
}

export async function savePerformancePosts(
  uid: string,
  posts: PerformancePost[],
): Promise<void> {
  const db = getDb();
  const coll = postsCollection(uid);

  // Write in batches of 500 (Firestore batch limit)
  for (let i = 0; i < posts.length; i += 500) {
    const batch = db.batch();
    for (const post of posts.slice(i, i + 500)) {
      batch.set(db.collection(coll).doc(post.postId), post);
    }
    await batch.commit();
  }
}

/**
 * Enforce the rolling window: keep only the most recent MAX_POSTS.
 * Deletes oldest posts (by publishedAt) when the count exceeds MAX_POSTS.
 */
export async function enforceRollingWindow(uid: string): Promise<number> {
  const db = getDb();
  const coll = postsCollection(uid);

  // Count all posts
  const allSnap = await db.collection(coll).orderBy("publishedAt", "asc").get();
  const total = allSnap.docs.length;

  if (total <= MAX_POSTS) return total;

  // Delete oldest to bring count to MAX_POSTS
  const toDelete = allSnap.docs.slice(0, total - MAX_POSTS);
  const batch = db.batch();
  for (const doc of toDelete) {
    batch.delete(doc.ref);
  }
  await batch.commit();

  return MAX_POSTS;
}

// ── Rebuild ─────────────────────────────────────────────────────────────

/**
 * Read all posts in the subcollection, compute the aggregated DNA,
 * and write it to the main document.
 */
export async function rebuildPerformanceDNA(uid: string): Promise<PerformanceDNA> {
  const posts = await getPerformancePosts(uid);
  const dna = buildPerformanceDNA(posts);

  const db = getDb();
  await db.doc(dnaPath(uid)).set(dna);

  return dna;
}
