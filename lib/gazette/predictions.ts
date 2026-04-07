/**
 * DigitAlchemy® Gazette — Prediction module
 *
 * Pure functions that combine baseline data with user history (Performance DNA)
 * to produce likely engagement ranges for concept cards.
 *
 * Phase 2.3c of DA-GAZETTE-UNIFICATION.
 *
 * MATH DECISIONS (see docs/DA-TEC-2026-008-prediction-math-decisions.md):
 * 1. Engagement is log-normally distributed → all percentile math in log space
 * 2. Computes a prediction interval for a single new post, not a confidence interval
 * 3. James-Stein shrinkage estimator for blending, not threshold-based weights
 * 4. Order-of-magnitude accuracy metric for validation
 *
 * NOTE: TrendSnapshot does not contain raw engagement metrics. Baseline ranges
 * use PerformancePost[] as input (same type as user posts).
 */

import type {
  Platform,
  Region,
  Industry,
  LikelyRange,
  PredictionMetric,
  PerformanceDNA,
  PerformancePost,
} from "@/types/gazette";

// ============================================================================
// Internal math helpers (not exported except via _testing)
// ============================================================================

/** Transform values to log space using log1p (handles zero gracefully). */
function logTransform(values: number[]): number[] {
  return values
    .filter((v) => v > 0)
    .map((v) => Math.log1p(v))
    .filter((v) => isFinite(v));
}

/** Inverse of logTransform for a single value. */
function inverseLogTransform(value: number): number {
  return Math.expm1(value);
}

/**
 * Compute the pth percentile from a SORTED array using linear interpolation.
 * p is in [0, 100].
 */
function pctile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0];
  const idx = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(idx);
  const upper = Math.ceil(idx);
  if (lower === upper) return sorted[lower];
  const frac = idx - lower;
  return sorted[lower] * (1 - frac) + sorted[upper] * frac;
}

/** Sample variance with Bessel's correction (n-1 denominator). */
function sampleVariance(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const sumSq = values.reduce((s, v) => s + (v - mean) ** 2, 0);
  return sumSq / (values.length - 1);
}

/**
 * James-Stein-style shrinkage weight — returns weight on the USER estimate.
 *
 * Formula: w_user = baselineVariance / (baselineVariance + userVariance / nUserPosts)
 *
 * Direction verification:
 *   n=5, equal variance: w_user = V / (V + V/5) = 1/1.2 ≈ 0.833
 *   n=50, equal variance: w_user = V / (V + V/50) = 1/1.02 ≈ 0.980
 *   ✓ More user posts → higher user weight (shrinks toward user estimate)
 *
 * Clamped to [0.05, 0.95].
 */
function computeShrinkageUserWeight(
  baselineVariance: number,
  userVariance: number,
  nUserPosts: number,
): number {
  if (baselineVariance <= 0 || userVariance <= 0 || nUserPosts <= 0) return 0.5;
  const userVarOverN = userVariance / nUserPosts;
  const wUser = baselineVariance / (baselineVariance + userVarOverN);
  return Math.max(0.05, Math.min(0.95, wUser));
}

function primaryMetric(platform: Platform): PredictionMetric {
  switch (platform) {
    case "tiktok":
    case "youtube":
      return "views";
    case "instagram":
      return "reach";
    default:
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

/** Platform fallbacks — last-resort sentinels when both data sources are empty. */
const PLATFORM_FALLBACKS: Record<Platform, { p25: number; median: number; p75: number; metric: PredictionMetric }> = {
  tiktok: { p25: 500, median: 2000, p75: 8000, metric: "views" },
  instagram: { p25: 200, median: 800, p75: 3000, metric: "reach" },
  youtube: { p25: 100, median: 600, p75: 3000, metric: "views" },
  linkedin: { p25: 50, median: 200, p75: 800, metric: "engagement" },
  facebook: { p25: 50, median: 200, p75: 1500, metric: "engagement" },
  x: { p25: 30, median: 200, p75: 1500, metric: "engagement" },
  all: { p25: 100, median: 500, p75: 3000, metric: "engagement" },
};

// ============================================================================
// Input types
// ============================================================================

export interface BaselineInput {
  platform: Platform;
  region: Region;
  industry?: Industry;
  niche?: string;
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
  metric?: PredictionMetric;
}

// ============================================================================
// 1. computeBaselineRange — log-space percentiles from baseline posts
// ============================================================================

export function computeBaselineRange(
  input: BaselineInput,
): { range: LikelyRange; logValues: number[] } | null {
  const metric = primaryMetric(input.platform);

  let filtered = input.baselinePosts.filter(
    (p) => p.platform === input.platform || input.platform === "all",
  );

  if (input.niche) {
    const tokens = input.niche.toLowerCase().split(/\s+/);
    const nicheFiltered = filtered.filter((p) =>
      p.hashtags.some((h) => tokens.some((t) => h.toLowerCase().includes(t))),
    );
    if (nicheFiltered.length >= 5) filtered = nicheFiltered;
  }

  const rawValues = filtered.map((p) => metricValue(p, metric));
  const logValues = logTransform(rawValues);
  if (logValues.length < 5) return null;

  const sorted = [...logValues].sort((a, b) => a - b);
  const conf = sorted.length >= 50 ? "high" : sorted.length >= 20 ? "medium" : "low";
  const nicheStr = input.niche ? ` in the ${input.niche} niche` : "";

  return {
    range: {
      p25: Math.round(inverseLogTransform(pctile(sorted, 25))),
      median: Math.round(inverseLogTransform(pctile(sorted, 50))),
      p75: Math.round(inverseLogTransform(pctile(sorted, 75))),
      metric,
      confidence: conf,
      basis: "baseline",
      reasoning: `Based on ${sorted.length} typical ${input.platform} posts in ${input.region}${nicheStr}`,
      basedOnUserPosts: 0,
      basedOnBaselinePosts: sorted.length,
      shrinkageWeight: 1.0,
    },
    logValues: sorted,
  };
}

// ============================================================================
// 2. computeUserRange — log-space percentiles from user's own posts
// ============================================================================

export function computeUserRange(
  input: UserRangeInput,
): { range: LikelyRange; logValues: number[] } | null {
  const metric = primaryMetric(input.platform);

  let filtered = input.recentPosts.filter(
    (p) => p.platform === input.platform || input.platform === "all",
  );

  if (input.niche) {
    const tokens = input.niche.toLowerCase().split(/\s+/);
    const nicheFiltered = filtered.filter((p) =>
      p.hashtags.some((h) => tokens.some((t) => h.toLowerCase().includes(t))),
    );
    if (nicheFiltered.length >= 3) filtered = nicheFiltered;
  }

  const rawValues = filtered.map((p) => metricValue(p, metric));
  const logValues = logTransform(rawValues);
  if (logValues.length < 4) return null;

  const sorted = [...logValues].sort((a, b) => a - b);
  const total = input.performanceDNA.totalPostsAnalyzed;
  const conf =
    sorted.length >= 15 && total >= 30
      ? "high"
      : sorted.length >= 8 || (sorted.length >= 15 && total < 30)
        ? "medium"
        : "low";

  const nicheStr = input.niche ? ` about ${input.niche}` : "";

  return {
    range: {
      p25: Math.round(inverseLogTransform(pctile(sorted, 25))),
      median: Math.round(inverseLogTransform(pctile(sorted, 50))),
      p75: Math.round(inverseLogTransform(pctile(sorted, 75))),
      metric,
      confidence: conf,
      basis: "user_history",
      reasoning: `Based on your ${sorted.length} recent ${input.platform} posts${nicheStr}`,
      basedOnUserPosts: sorted.length,
      basedOnBaselinePosts: 0,
      shrinkageWeight: 0.0,
    },
    logValues: sorted,
  };
}

// ============================================================================
// 3. blendPredictions — James-Stein shrinkage in log space
// ============================================================================

export function blendPredictions(
  baseline: { range: LikelyRange; logValues: number[] } | null,
  userResult: { range: LikelyRange; logValues: number[] } | null,
): LikelyRange | null {
  if (!baseline && !userResult) return null;
  if (!baseline) return userResult!.range;
  if (!userResult) return baseline.range;

  const bVar = sampleVariance(baseline.logValues);
  const uVar = sampleVariance(userResult.logValues);
  const nUser = userResult.logValues.length;

  const wUser = computeShrinkageUserWeight(bVar, uVar, nUser);
  const wBaseline = 1 - wUser;

  function blendPercentile(baselineReal: number, userReal: number): number {
    const bLog = Math.log1p(baselineReal);
    const uLog = Math.log1p(userReal);
    return Math.round(Math.expm1(wBaseline * bLog + wUser * uLog));
  }

  const br = baseline.range;
  const ur = userResult.range;
  const confOrder = { high: 3, medium: 2, low: 1 };
  const higherConf = confOrder[br.confidence] >= confOrder[ur.confidence] ? br.confidence : ur.confidence;

  return {
    p25: blendPercentile(br.p25, ur.p25),
    median: blendPercentile(br.median, ur.median),
    p75: blendPercentile(br.p75, ur.p75),
    metric: ur.metric,
    confidence: higherConf,
    basis: "blended",
    reasoning: `Blended from ${br.reasoning} and ${ur.reasoning} (${Math.round(wUser * 100)}% your data)`,
    basedOnUserPosts: ur.basedOnUserPosts,
    basedOnBaselinePosts: br.basedOnBaselinePosts,
    shrinkageWeight: wBaseline,
  };
}

// ============================================================================
// 4. predictForCard — convenience function
// ============================================================================

export function predictForCard(input: PredictionInput): LikelyRange {
  const baseline = computeBaselineRange({
    platform: input.platform,
    region: input.region,
    industry: input.industry,
    niche: input.niche,
    baselinePosts: input.baselinePosts,
  });

  const userResult = input.performanceDNA
    ? computeUserRange({
        platform: input.platform,
        niche: input.niche,
        performanceDNA: input.performanceDNA,
        recentPosts: input.recentPosts,
      })
    : null;

  const blended = blendPredictions(baseline, userResult);
  if (blended) return blended;

  const fb = PLATFORM_FALLBACKS[input.platform];
  return {
    p25: fb.p25,
    median: fb.median,
    p75: fb.p75,
    metric: fb.metric,
    confidence: "low",
    basis: "insufficient_data",
    reasoning: "Not enough data yet \u2014 try again after publishing 10 posts",
    basedOnUserPosts: 0,
    basedOnBaselinePosts: 0,
    shrinkageWeight: 1.0,
  };
}

// ============================================================================
// Exported for testing only
// ============================================================================

export const _testing = {
  logTransform,
  inverseLogTransform,
  pctile,
  sampleVariance,
  computeShrinkageUserWeight,
};
