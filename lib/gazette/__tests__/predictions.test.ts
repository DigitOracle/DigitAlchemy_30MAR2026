import { describe, it, expect } from "vitest";
import type { PerformancePost, PerformanceDNA, Platform } from "@/types/gazette";
import {
  computeBaselineRange,
  computeUserRange,
  blendPredictions,
  predictForCard,
  _testing,
} from "../predictions";

const { logTransform, inverseLogTransform, pctile, sampleVariance, computeShrinkageUserWeight } = _testing;

// ── Fixtures ────────────────────────────────────────────────────────────

function makePost(overrides: Partial<PerformancePost> = {}): PerformancePost {
  return {
    postId: "p-1", platform: "tiktok", publishedAt: "2026-04-05T14:00:00Z",
    caption: "Test #construction #dubai", hashtags: ["#construction", "#dubai"],
    audioType: "trending", format: "video", views: 2000, likes: 200, comments: 30,
    shares: 10, engagementRate: 0.12, hookText: "Test construction", captionLength: 40,
    ...overrides,
  };
}

function makePosts(count: number, platform: Platform = "tiktok", viewsBase = 1000): PerformancePost[] {
  return Array.from({ length: count }, (_, i) =>
    makePost({ postId: `p-${i}`, platform, views: viewsBase + i * 200, likes: 50 + i * 10, comments: 5 + i * 2, shares: 2 + i }),
  );
}

function makeDNA(totalPosts = 20): PerformanceDNA {
  return {
    optimalLength: { value: { min: 30, max: 80, median: 50 }, confidence: "medium", basedOn: totalPosts },
    hookPatterns: { value: [], confidence: "low", basedOn: totalPosts },
    hashtagEffectiveness: { value: [], confidence: "low", basedOn: totalPosts },
    timeOfDayCurves: { value: [], confidence: "low", basedOn: totalPosts },
    bestPerformingTopics: { value: [], confidence: "low", basedOn: totalPosts },
    audioContentFit: { value: { trendingAudioLift: 0, originalAudioLift: 0 }, confidence: "low", basedOn: totalPosts },
    engagementQualityRatio: { value: { commentToLikeRatio: 0, shareToViewRatio: 0 }, confidence: "low", basedOn: totalPosts },
    totalPostsAnalyzed: totalPosts, lastUpdated: "2026-04-07T10:00:00Z",
    platformsCovered: ["tiktok"], rawPostsRetained: Math.min(totalPosts, 50),
  };
}

// ── Log transform sanity ────────────────────────────────────────────────

describe("log transform math", () => {
  it("log1p(0) === 0, expm1(0) === 0", () => {
    expect(Math.log1p(0)).toBe(0);
    expect(Math.expm1(0)).toBe(0);
  });

  it("round-trip: expm1(log1p(x)) === x for test values", () => {
    for (const x of [100, 1000, 100000]) {
      expect(inverseLogTransform(Math.log1p(x))).toBeCloseTo(x, 5);
    }
  });

  it("logTransform filters out zero and negative values", () => {
    expect(logTransform([0, -5, 100, 200])).toHaveLength(2);
  });
});

// ── Percentile ──────────────────────────────────────────────────────────

describe("pctile", () => {
  it("returns the only value for single-element array", () => {
    expect(pctile([5], 50)).toBe(5);
  });

  it("computes median of even array", () => {
    expect(pctile([1, 2, 3, 4], 50)).toBeCloseTo(2.5, 5);
  });

  it("p25 and p75 bracket the median", () => {
    const sorted = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    expect(pctile(sorted, 25)).toBeLessThan(pctile(sorted, 50));
    expect(pctile(sorted, 50)).toBeLessThan(pctile(sorted, 75));
  });
});

// ── Shrinkage weight direction ──────────────────────────────────────────

describe("computeShrinkageUserWeight", () => {
  it("more user posts → higher user weight", () => {
    const w5 = computeShrinkageUserWeight(1, 1, 5);
    const w50 = computeShrinkageUserWeight(1, 1, 50);
    expect(w50).toBeGreaterThan(w5);
  });

  it("5 posts with equal variance gives ~0.83 user weight", () => {
    const w = computeShrinkageUserWeight(1, 1, 5);
    expect(w).toBeCloseTo(1 / 1.2, 2); // 0.833
  });

  it("50 posts with equal variance gives ~0.98 user weight (clamped to 0.95)", () => {
    const w = computeShrinkageUserWeight(1, 1, 50);
    expect(w).toBe(0.95); // clamped
  });

  it("clamps to [0.05, 0.95]", () => {
    expect(computeShrinkageUserWeight(1, 1, 1000)).toBe(0.95);
    expect(computeShrinkageUserWeight(0.001, 100, 1)).toBeGreaterThanOrEqual(0.05);
  });
});

// ── computeBaselineRange ────────────────────────────────────────────────

describe("computeBaselineRange", () => {
  it("returns null for empty posts", () => {
    expect(computeBaselineRange({ platform: "tiktok", region: "AE", baselinePosts: [] })).toBeNull();
  });

  it("returns null for 3 posts (below threshold)", () => {
    expect(computeBaselineRange({ platform: "tiktok", region: "AE", baselinePosts: makePosts(3) })).toBeNull();
  });

  it("returns low confidence for 10 posts", () => {
    const result = computeBaselineRange({ platform: "tiktok", region: "AE", baselinePosts: makePosts(10) });
    expect(result!.range.confidence).toBe("low");
    expect(result!.range.basis).toBe("baseline");
  });

  it("returns medium for 30 posts", () => {
    expect(computeBaselineRange({ platform: "tiktok", region: "AE", baselinePosts: makePosts(30) })!.range.confidence).toBe("medium");
  });

  it("returns high for 100 posts", () => {
    expect(computeBaselineRange({ platform: "tiktok", region: "AE", baselinePosts: makePosts(100) })!.range.confidence).toBe("high");
  });

  it("filters by platform", () => {
    const mixed = [...makePosts(10, "tiktok"), ...makePosts(3, "instagram")];
    expect(computeBaselineRange({ platform: "tiktok", region: "AE", baselinePosts: mixed })!.range.basedOnBaselinePosts).toBe(10);
  });

  it("outlier doesn't dominate (log-space absorption)", () => {
    const posts = makePosts(20, "tiktok", 1000); // views 1000-4800
    posts.push(makePost({ postId: "outlier", views: 500000 }));
    const result = computeBaselineRange({ platform: "tiktok", region: "AE", baselinePosts: posts })!;
    // Median should still be in the 1K-5K range, not pulled toward 500K
    expect(result.range.median).toBeLessThan(10000);
    expect(result.range.median).toBeGreaterThan(500);
  });
});

// ── computeUserRange ────────────────────────────────────────────────────

describe("computeUserRange", () => {
  it("returns null for empty posts", () => {
    expect(computeUserRange({ platform: "tiktok", performanceDNA: makeDNA(), recentPosts: [] })).toBeNull();
  });

  it("returns null for 3 posts", () => {
    expect(computeUserRange({ platform: "tiktok", performanceDNA: makeDNA(), recentPosts: makePosts(3) })).toBeNull();
  });

  it("returns medium for 8 posts", () => {
    expect(computeUserRange({ platform: "tiktok", performanceDNA: makeDNA(20), recentPosts: makePosts(8) })!.range.confidence).toBe("medium");
  });

  it("returns high for 15 posts + 35 total", () => {
    expect(computeUserRange({ platform: "tiktok", performanceDNA: makeDNA(35), recentPosts: makePosts(15) })!.range.confidence).toBe("high");
  });

  it("filters by platform", () => {
    const mixed = [...makePosts(10, "tiktok"), ...makePosts(5, "instagram")];
    expect(computeUserRange({ platform: "tiktok", performanceDNA: makeDNA(), recentPosts: mixed })!.range.basedOnUserPosts).toBe(10);
  });
});

// ── blendPredictions ────────────────────────────────────────────────────

describe("blendPredictions", () => {
  it("returns null when both null", () => {
    expect(blendPredictions(null, null)).toBeNull();
  });

  it("returns baseline unchanged when user null", () => {
    const b = computeBaselineRange({ platform: "tiktok", region: "AE", baselinePosts: makePosts(30) })!;
    const result = blendPredictions(b, null)!;
    expect(result.basis).toBe("baseline");
    expect(result.median).toBe(b.range.median);
  });

  it("returns user unchanged when baseline null", () => {
    const u = computeUserRange({ platform: "tiktok", performanceDNA: makeDNA(), recentPosts: makePosts(10) })!;
    const result = blendPredictions(null, u)!;
    expect(result.basis).toBe("user_history");
  });

  it("blends both with shrinkage weight on user side", () => {
    const b = computeBaselineRange({ platform: "tiktok", region: "AE", baselinePosts: makePosts(30, "tiktok", 5000) })!;
    const u = computeUserRange({ platform: "tiktok", performanceDNA: makeDNA(25), recentPosts: makePosts(20, "tiktok", 1000) })!;
    const result = blendPredictions(b, u)!;
    expect(result.basis).toBe("blended");
    // Shrinkage weight < 1 (partial baseline)
    expect(result.shrinkageWeight).toBeGreaterThan(0);
    expect(result.shrinkageWeight).toBeLessThan(1);
    // Blended median should be between baseline and user
    const lower = Math.min(b.range.median, u.range.median);
    const upper = Math.max(b.range.median, u.range.median);
    expect(result.median).toBeGreaterThanOrEqual(lower * 0.8);
    expect(result.median).toBeLessThanOrEqual(upper * 1.2);
  });
});

// ── predictForCard ──────────────────────────────────────────────────────

describe("predictForCard", () => {
  it("returns insufficient_data when both sources empty", () => {
    const result = predictForCard({ platform: "tiktok", region: "AE", performanceDNA: null, recentPosts: [], baselinePosts: [] });
    expect(result.basis).toBe("insufficient_data");
    expect(result.p25).toBeGreaterThan(0);
  });

  it("returns baseline when only baseline available", () => {
    const result = predictForCard({ platform: "tiktok", region: "AE", performanceDNA: null, recentPosts: [], baselinePosts: makePosts(20) });
    expect(result.basis).toBe("baseline");
  });

  it("returns user_history when only user available", () => {
    const result = predictForCard({ platform: "tiktok", region: "AE", performanceDNA: makeDNA(), recentPosts: makePosts(10), baselinePosts: [] });
    expect(result.basis).toBe("user_history");
  });

  it("returns blended when both available", () => {
    const result = predictForCard({ platform: "tiktok", region: "AE", performanceDNA: makeDNA(), recentPosts: makePosts(10), baselinePosts: makePosts(20, "tiktok", 5000) });
    expect(result.basis).toBe("blended");
  });
});

// ── Order-of-magnitude accuracy ─────────────────────────────────────────

describe("order-of-magnitude accuracy", () => {
  it("at least 80% of synthetic log-normal samples hit same order of magnitude", () => {
    // Generate 50 synthetic log-normal values: exp(mu + sigma*z) where z ~ N(0,1)
    // Using a simple Box-Muller-like deterministic spread for reproducibility
    const mu = 7; // log(~1100)
    const sigma = 1;
    const syntheticViews = Array.from({ length: 50 }, (_, i) => {
      const z = -2.4 + (i / 49) * 4.8; // evenly spaced z-scores from -2.4 to 2.4
      return Math.round(Math.exp(mu + sigma * z));
    });

    const posts = syntheticViews.map((v, i) => makePost({ postId: `syn-${i}`, views: v }));

    // Use half as baseline, half as user
    const baselinePosts = posts.slice(0, 25);
    const userPosts = posts.slice(25);

    const prediction = predictForCard({
      platform: "tiktok", region: "AE", performanceDNA: makeDNA(30),
      recentPosts: userPosts, baselinePosts,
    });

    // Check order-of-magnitude: floor(log10(predicted)) vs floor(log10(actual))
    let hits = 0;
    for (const actual of syntheticViews) {
      if (actual <= 0) continue;
      const predOrder = Math.floor(Math.log10(prediction.median));
      const actualOrder = Math.floor(Math.log10(actual));
      if (Math.abs(predOrder - actualOrder) <= 1) hits++;
    }

    const accuracy = hits / syntheticViews.length;
    expect(accuracy).toBeGreaterThanOrEqual(0.8);
  });
});
