/**
 * DigitAlchemy® Gazette — Performance DNA analysis functions
 *
 * Pure computation functions that derive PerformanceField values from
 * an array of PerformancePost records. No I/O, no Firestore calls.
 *
 * Phase 2.3b of DA-GAZETTE-UNIFICATION.
 */

import type { PerformancePost, PerformanceField, PerformanceDNA, Platform } from "@/types/gazette";

// ── Confidence helpers ──────────────────────────────────────────────────

function confidence(
  count: number,
  thresholds: { high: number; medium: number; low: number },
): "high" | "medium" | "low" | "insufficient" {
  if (count >= thresholds.high) return "high";
  if (count >= thresholds.medium) return "medium";
  if (count >= thresholds.low) return "low";
  return "insufficient";
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

// ── Compute functions ───────────────────────────────────────────────────

export function computeOptimalLength(
  posts: PerformancePost[],
): PerformanceField<{ min: number; max: number; median: number }> {
  const withLength = posts.filter((p) => p.captionLength > 0 && p.engagementRate > 0);
  const count = withLength.length;
  const conf = confidence(count, { high: 8, medium: 5, low: 3 });

  if (count === 0) {
    return { value: { min: 0, max: 0, median: 0 }, confidence: "insufficient", basedOn: 0 };
  }

  // Sort by engagement rate, take top quartile
  const sorted = [...withLength].sort((a, b) => b.engagementRate - a.engagementRate);
  const topQuartile = sorted.slice(0, Math.max(1, Math.ceil(sorted.length / 4)));
  const lengths = topQuartile.map((p) => p.captionLength);

  return {
    value: {
      min: Math.min(...lengths),
      max: Math.max(...lengths),
      median: median(lengths),
    },
    confidence: conf,
    basedOn: count,
  };
}

export function computeHookPatterns(
  posts: PerformancePost[],
): PerformanceField<{ pattern: string; engagementLift: number }[]> {
  const withHook = posts.filter((p) => p.hookText.length > 0 && p.engagementRate > 0);
  const count = withHook.length;
  const conf = confidence(count, { high: 12, medium: 8, low: 5 });

  if (count === 0) {
    return { value: [], confidence: "insufficient", basedOn: 0 };
  }

  const avgEngagement = withHook.reduce((s, p) => s + p.engagementRate, 0) / count;

  // Classify hooks
  type HookType = "question" | "statistic" | "story" | "contrarian" | "other";
  function classifyHook(text: string): HookType {
    const lower = text.toLowerCase();
    if (text.endsWith("?")) return "question";
    if (/\d+%|\d+x|\d+ /.test(text)) return "statistic";
    if (/^(i |my |we |our )/i.test(text)) return "story";
    if (/\b(but|however|actually|wrong|myth|stop)\b/i.test(lower)) return "contrarian";
    return "other";
  }

  const buckets = new Map<HookType, number[]>();
  for (const p of withHook) {
    const type = classifyHook(p.hookText);
    if (!buckets.has(type)) buckets.set(type, []);
    buckets.get(type)!.push(p.engagementRate);
  }

  const patterns = [...buckets.entries()]
    .filter(([, rates]) => rates.length >= 2)
    .map(([pattern, rates]) => ({
      pattern,
      engagementLift: (rates.reduce((s, r) => s + r, 0) / rates.length - avgEngagement) / Math.max(avgEngagement, 0.001),
    }))
    .sort((a, b) => b.engagementLift - a.engagementLift);

  return { value: patterns, confidence: conf, basedOn: count };
}

export function computeHashtagEffectiveness(
  posts: PerformancePost[],
): PerformanceField<{ hashtag: string; effectivenessScore: number }[]> {
  const withEngagement = posts.filter((p) => p.engagementRate > 0);
  const count = withEngagement.length;
  const conf = confidence(count, { high: 20, medium: 12, low: 8 });

  if (count === 0) {
    return { value: [], confidence: "insufficient", basedOn: 0 };
  }

  const avgAll = withEngagement.reduce((s, p) => s + p.engagementRate, 0) / count;

  // Count hashtag occurrences
  const tagPosts = new Map<string, number[]>();
  for (const p of withEngagement) {
    for (const tag of p.hashtags) {
      const normalized = tag.toLowerCase().replace(/^#/, "");
      if (!tagPosts.has(normalized)) tagPosts.set(normalized, []);
      tagPosts.get(normalized)!.push(p.engagementRate);
    }
  }

  const effective = [...tagPosts.entries()]
    .filter(([, rates]) => rates.length >= 3)
    .map(([hashtag, rates]) => ({
      hashtag,
      effectivenessScore: (rates.reduce((s, r) => s + r, 0) / rates.length - avgAll) / Math.max(avgAll, 0.001),
    }))
    .sort((a, b) => b.effectivenessScore - a.effectivenessScore)
    .slice(0, 20);

  return { value: effective, confidence: conf, basedOn: count };
}

export function computeTimeOfDayCurves(
  posts: PerformancePost[],
): PerformanceField<{ hour: number; dayOfWeek: number; avgEngagement: number }[]> {
  const withTime = posts.filter((p) => p.publishedAt && p.engagementRate > 0);
  const count = withTime.length;
  const conf = confidence(count, { high: 30, medium: 20, low: 10 });

  if (count === 0) {
    return { value: [], confidence: "insufficient", basedOn: 0 };
  }

  const buckets = new Map<string, number[]>();
  for (const p of withTime) {
    const d = new Date(p.publishedAt);
    if (isNaN(d.getTime())) continue;
    const key = `${d.getUTCHours()}-${d.getUTCDay()}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(p.engagementRate);
  }

  const curves = [...buckets.entries()].map(([key, rates]) => {
    const [hour, day] = key.split("-").map(Number);
    return {
      hour,
      dayOfWeek: day,
      avgEngagement: rates.reduce((s, r) => s + r, 0) / rates.length,
    };
  });

  return { value: curves, confidence: conf, basedOn: count };
}

export function computeBestPerformingTopics(
  posts: PerformancePost[],
): PerformanceField<{ topic: string; avgEngagement: number; postCount: number }[]> {
  // Use hashtags as a proxy for topics (no LLM call)
  const withEngagement = posts.filter((p) => p.hashtags.length > 0 && p.engagementRate > 0);
  const count = withEngagement.length;
  const distinctTopics = new Set(withEngagement.flatMap((p) => p.hashtags.map((h) => h.toLowerCase().replace(/^#/, ""))));
  const conf = count >= 15 && distinctTopics.size >= 3 ? "high"
    : count >= 10 ? "medium"
    : count >= 5 ? "low"
    : "insufficient";

  if (count === 0) {
    return { value: [], confidence: "insufficient", basedOn: 0 };
  }

  const topicEngagement = new Map<string, number[]>();
  for (const p of withEngagement) {
    for (const tag of p.hashtags) {
      const t = tag.toLowerCase().replace(/^#/, "");
      if (!topicEngagement.has(t)) topicEngagement.set(t, []);
      topicEngagement.get(t)!.push(p.engagementRate);
    }
  }

  const topics = [...topicEngagement.entries()]
    .filter(([, rates]) => rates.length >= 2)
    .map(([topic, rates]) => ({
      topic,
      avgEngagement: rates.reduce((s, r) => s + r, 0) / rates.length,
      postCount: rates.length,
    }))
    .sort((a, b) => b.avgEngagement - a.avgEngagement)
    .slice(0, 10);

  return { value: topics, confidence: conf as "high" | "medium" | "low" | "insufficient", basedOn: count };
}

export function computeAudioContentFit(
  posts: PerformancePost[],
): PerformanceField<{ trendingAudioLift: number; originalAudioLift: number }> {
  const videoPosts = posts.filter((p) => p.format === "video" && p.engagementRate > 0);
  const count = videoPosts.length;
  const conf = confidence(count, { high: 10, medium: 6, low: 3 });

  if (count === 0) {
    return { value: { trendingAudioLift: 0, originalAudioLift: 0 }, confidence: "insufficient", basedOn: 0 };
  }

  const avgAll = videoPosts.reduce((s, p) => s + p.engagementRate, 0) / count;
  const trending = videoPosts.filter((p) => p.audioType === "trending");
  const original = videoPosts.filter((p) => p.audioType === "original");

  const trendingAvg = trending.length > 0 ? trending.reduce((s, p) => s + p.engagementRate, 0) / trending.length : avgAll;
  const originalAvg = original.length > 0 ? original.reduce((s, p) => s + p.engagementRate, 0) / original.length : avgAll;

  return {
    value: {
      trendingAudioLift: avgAll > 0 ? (trendingAvg - avgAll) / avgAll : 0,
      originalAudioLift: avgAll > 0 ? (originalAvg - avgAll) / avgAll : 0,
    },
    confidence: conf,
    basedOn: count,
  };
}

export function computeEngagementQualityRatio(
  posts: PerformancePost[],
): PerformanceField<{ commentToLikeRatio: number; shareToViewRatio: number }> {
  const withMetrics = posts.filter((p) => p.likes > 0 || p.views > 0);
  const count = withMetrics.length;
  const conf = confidence(count, { high: 15, medium: 8, low: 4 });

  if (count === 0) {
    return { value: { commentToLikeRatio: 0, shareToViewRatio: 0 }, confidence: "insufficient", basedOn: 0 };
  }

  const ctlRatios = withMetrics.filter((p) => p.likes > 0).map((p) => p.comments / p.likes);
  const stvRatios = withMetrics.filter((p) => p.views > 0).map((p) => p.shares / p.views);

  return {
    value: {
      commentToLikeRatio: median(ctlRatios),
      shareToViewRatio: median(stvRatios),
    },
    confidence: conf,
    basedOn: count,
  };
}

// ── Full rebuild ────────────────────────────────────────────────────────

export function buildPerformanceDNA(posts: PerformancePost[]): PerformanceDNA {
  const platforms = [...new Set(posts.map((p) => p.platform))] as Platform[];

  return {
    optimalLength: computeOptimalLength(posts),
    hookPatterns: computeHookPatterns(posts),
    hashtagEffectiveness: computeHashtagEffectiveness(posts),
    timeOfDayCurves: computeTimeOfDayCurves(posts),
    bestPerformingTopics: computeBestPerformingTopics(posts),
    audioContentFit: computeAudioContentFit(posts),
    engagementQualityRatio: computeEngagementQualityRatio(posts),
    totalPostsAnalyzed: posts.length,
    lastUpdated: new Date().toISOString(),
    platformsCovered: platforms,
    rawPostsRetained: posts.length,
  };
}
