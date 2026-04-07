/**
 * DigitAlchemy® Gazette — Prediction module
 *
 * Pure functions that combine baseline data (from trend snapshots) with
 * user history (from Performance DNA) to produce expected engagement ranges
 * for concept cards.
 *
 * Phase 2.3c of DA-GAZETTE-UNIFICATION.
 *
 * NOTE: TrendSnapshot does not contain raw engagement metrics (views, likes).
 * Baseline ranges use PerformancePost[] from ALL users in the region as
 * the baseline proxy, plus hardcoded platform-typical ranges scaled by
 * composite score when user data is sparse.
 */

import type {
  Platform,
  Region,
  Industry,
  ExpectedRange,
  PredictionBasis,
  PredictionMetric,
  PerformanceDNA,
  PerformancePost,
} from "@/types/gazette";

// ============================================================================
// Helpers
// ============================================================================

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(idx);
  const upper = Math.ceil(idx);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (idx - lower);
}

function primaryMetric(platform: Platform): PredictionMetric {
  switch (platform) {
    case "tiktok":
    case "youtube":
      return "views";
    case "instagram":
      return "reach";
    case "linkedin":
    case "facebook":
    case "x":
    case "all":
      return "engagement";
  }
}

function metricValue(post: PerformancePost, metric: PredictionMetric): number {
  switch (metric) {
    case "views":
      return post.views;
    case "engagement":
      return post.likes + post.comments + post.shares;
    case "reach":
      return post.views > 0 ? post.views : post.likes + post.comments + post.shares;
  }
}

/** Hardcoded platform-typical engagement ranges for when we have no data at all */
const PLATFORM_FALLBACKS: Record<Platform, { min: number; median: number; max: number; metric: PredictionMetric }> = {
  tiktok: { min: 500, median: 2500, max: 10000, metric: "views" },
  instagram: { min: 200, median: 1000, max: 5000, metric: "reach" },
  youtube: { min: 100, median: 800, max: 5000, metric: "views" },
  linkedin: { min: 50, median: 300, max: 2000, metric: "engagement" },
  facebook: { min: 50, median: 200, max: 1500, metric: "engagement" },
  x: { min: 30, median: 200, max: 1500, metric: "engagement" },
  all: { min: 100, median: 500, max: 3000, metric: "engagement" },
};

// ============================================================================
// Input types (not exported from types/gazette.ts — internal to this module)
// ============================================================================

export interface BaselineInput {
  platform: Platform;
  region: Region;
  industry?: Industry;
  niche?: string;
  /** Baseline posts from the region/platform (not the user's own posts) */
  baselinePosts: PerformancePost[];
}

export interface UserRangeInput {
  platform: Platform;
  niche?: string;
  performanceDNA: PerformanceDNA;
  recentPosts: PerformancePost[];
}

export interface PredictionInput {
  platform: Platform;
  region: Region;
  industry?: Industry;
  niche?: string;
  performanceDNA: PerformanceDNA | null;
  recentPosts: PerformancePost[];
  baselinePosts: PerformancePost[];
}

// ============================================================================
// 1. computeBaselineRange
// ============================================================================

export function computeBaselineRange(input: BaselineInput): ExpectedRange | null {
  const metric = primaryMetric(input.platform);

  // Filter baseline posts by platform
  let filtered = input.baselinePosts.filter(
    (p) => p.platform === input.platform || input.platform === "all",
  );

  // Further filter by niche if specified (hashtag overlap)
  if (input.niche) {
    const nicheTokens = input.niche.toLowerCase().split(/\s+/);
    filtered = filtered.filter((p) =>
      p.hashtags.some((h) =>
        nicheTokens.some((t) => h.toLowerCase().includes(t)),
      ),
    );
  }

  if (filtered.length < 5) return null;

  const values = filtered.map((p) => metricValue(p, metric)).filter((v) => v > 0);
  if (values.length < 5) return null;

  const conf =
    values.length >= 50 ? "high" : values.length >= 20 ? "medium" : "low";

  const nicheStr = input.niche ? ` in the ${input.niche} niche` : "";
  const industryStr = input.industry ? ` (${input.industry})` : "";

  return {
    min: Math.round(percentile(values, 25)),
    max: Math.round(percentile(values, 75)),
    median: Math.round(median(values)),
    metric,
    confidence: conf,
    basis: "baseline",
    reasoning: `Based on ${values.length} typical ${input.platform} posts in ${input.region}${industryStr}${nicheStr}`,
    basedOnPosts: 0,
    baselineSampleSize: values.length,
  };
}

// ============================================================================
// 2. computeUserRange
// ============================================================================

export function computeUserRange(input: UserRangeInput): ExpectedRange | null {
  const metric = primaryMetric(input.platform);

  // Filter user's posts by platform
  let filtered = input.recentPosts.filter(
    (p) => p.platform === input.platform || input.platform === "all",
  );

  // Further filter by niche if specified
  if (input.niche) {
    const nicheTokens = input.niche.toLowerCase().split(/\s+/);
    const nicheFiltered = filtered.filter((p) =>
      p.hashtags.some((h) =>
        nicheTokens.some((t) => h.toLowerCase().includes(t)),
      ),
    );
    // Only apply niche filter if it doesn't eliminate too many posts
    if (nicheFiltered.length >= 3) filtered = nicheFiltered;
  }

  if (filtered.length < 4) return null;

  const values = filtered.map((p) => metricValue(p, metric)).filter((v) => v > 0);
  if (values.length < 4) return null;

  const totalAnalyzed = input.performanceDNA.totalPostsAnalyzed;
  const conf =
    values.length >= 15 && totalAnalyzed >= 30
      ? "high"
      : values.length >= 8 || (values.length >= 15 && totalAnalyzed < 30)
        ? "medium"
        : "low";

  const nicheStr = input.niche ? ` about ${input.niche}` : "";

  return {
    min: Math.round(percentile(values, 25)),
    max: Math.round(percentile(values, 75)),
    median: Math.round(median(values)),
    metric,
    confidence: conf,
    basis: "user_history",
    reasoning: `Based on your ${values.length} recent ${input.platform} posts${nicheStr}`,
    basedOnPosts: values.length,
    baselineSampleSize: 0,
  };
}

// ============================================================================
// 3. blendPrediction
// ============================================================================

export function blendPrediction(
  baseline: ExpectedRange | null,
  userRange: ExpectedRange | null,
): ExpectedRange | null {
  if (!baseline && !userRange) return null;
  if (!baseline) return userRange!;
  if (!userRange) return baseline;

  // Determine blend weights based on user post count
  const userPosts = userRange.basedOnPosts;
  let baselineWeight: number;
  if (userPosts >= 30) baselineWeight = 0.1;
  else if (userPosts >= 15) baselineWeight = 0.3;
  else if (userPosts >= 8) baselineWeight = 0.5;
  else baselineWeight = 0.7;
  const userWeight = 1 - baselineWeight;

  // Weighted blend of min, median, max
  const blendedMin = Math.round(baseline.min * baselineWeight + userRange.min * userWeight);
  const blendedMax = Math.round(baseline.max * baselineWeight + userRange.max * userWeight);
  const blendedMedian = Math.round(baseline.median * baselineWeight + userRange.median * userWeight);

  // Use the higher confidence level (more data = more confident)
  const confOrder = { high: 3, medium: 2, low: 1 };
  const higherConf = confOrder[baseline.confidence] >= confOrder[userRange.confidence]
    ? baseline.confidence
    : userRange.confidence;

  return {
    min: blendedMin,
    max: blendedMax,
    median: blendedMedian,
    metric: userRange.metric, // prefer user's metric (same platform)
    confidence: higherConf,
    basis: "blended",
    reasoning: `Blended from ${baseline.reasoning} and ${userRange.reasoning}`,
    basedOnPosts: userRange.basedOnPosts,
    baselineSampleSize: baseline.baselineSampleSize,
  };
}

// ============================================================================
// 4. predictForCard — convenience function
// ============================================================================

export function predictForCard(input: PredictionInput): ExpectedRange {
  const baseline = computeBaselineRange({
    platform: input.platform,
    region: input.region,
    industry: input.industry,
    niche: input.niche,
    baselinePosts: input.baselinePosts,
  });

  const userRange = input.performanceDNA
    ? computeUserRange({
        platform: input.platform,
        niche: input.niche,
        performanceDNA: input.performanceDNA,
        recentPosts: input.recentPosts,
      })
    : null;

  const blended = blendPrediction(baseline, userRange);
  if (blended) return blended;

  // Sentinel: insufficient data — use platform fallback
  const fallback = PLATFORM_FALLBACKS[input.platform];
  return {
    min: fallback.min,
    max: fallback.max,
    median: fallback.median,
    metric: fallback.metric,
    confidence: "low",
    basis: "insufficient_data",
    reasoning: "Not enough data yet — try again after publishing 10 posts",
    basedOnPosts: 0,
    baselineSampleSize: 0,
  };
}
