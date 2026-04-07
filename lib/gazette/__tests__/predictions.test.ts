import { describe, it, expect } from "vitest";
import type { PerformancePost, PerformanceDNA, Platform } from "@/types/gazette";
import {
  computeBaselineRange,
  computeUserRange,
  blendPrediction,
  predictForCard,
} from "../predictions";

// ── Test fixtures ───────────────────────────────────────────────────────

function makePost(overrides: Partial<PerformancePost> = {}): PerformancePost {
  return {
    postId: "p-1",
    platform: "tiktok",
    publishedAt: "2026-04-05T14:00:00Z",
    caption: "Test post #construction #dubai",
    hashtags: ["#construction", "#dubai"],
    audioType: "trending",
    format: "video",
    views: 2000,
    likes: 200,
    comments: 30,
    shares: 10,
    engagementRate: 0.12,
    hookText: "Test post about construction",
    captionLength: 40,
    ...overrides,
  };
}

function makePosts(count: number, platform: Platform = "tiktok", viewsBase = 1000): PerformancePost[] {
  return Array.from({ length: count }, (_, i) =>
    makePost({
      postId: `p-${i}`,
      platform,
      views: viewsBase + i * 200,
      likes: 50 + i * 10,
      comments: 5 + i * 2,
      shares: 2 + i,
    }),
  );
}

function makeDNA(totalPosts = 20): PerformanceDNA {
  return {
    optimalLength: { value: { min: 30, max: 80, median: 50 }, confidence: "medium", basedOn: totalPosts },
    hookPatterns: { value: [], confidence: "low", basedOn: totalPosts },
    hashtagEffectiveness: { value: [], confidence: "low", basedOn: totalPosts },
    timeOfDayCurves: { value: [], confidence: "low", basedOn: totalPosts },
    bestPerformingTopics: { value: [], confidence: "low", basedOn: totalPosts },
    audioContentFit: { value: { trendingAudioLift: 0.1, originalAudioLift: -0.05 }, confidence: "low", basedOn: totalPosts },
    engagementQualityRatio: { value: { commentToLikeRatio: 0.15, shareToViewRatio: 0.005 }, confidence: "low", basedOn: totalPosts },
    totalPostsAnalyzed: totalPosts,
    lastUpdated: "2026-04-07T10:00:00Z",
    platformsCovered: ["tiktok"],
    rawPostsRetained: Math.min(totalPosts, 50),
  };
}

// ── computeBaselineRange ────────────────────────────────────────────────

describe("computeBaselineRange", () => {
  it("returns null for empty baseline posts", () => {
    expect(computeBaselineRange({ platform: "tiktok", region: "AE", baselinePosts: [] })).toBeNull();
  });

  it("returns null for 3 posts (below threshold)", () => {
    expect(computeBaselineRange({ platform: "tiktok", region: "AE", baselinePosts: makePosts(3) })).toBeNull();
  });

  it("returns low confidence for 10 posts", () => {
    const result = computeBaselineRange({ platform: "tiktok", region: "AE", baselinePosts: makePosts(10) });
    expect(result).not.toBeNull();
    expect(result!.confidence).toBe("low");
    expect(result!.basis).toBe("baseline");
    expect(result!.baselineSampleSize).toBe(10);
  });

  it("returns medium confidence for 30 posts", () => {
    const result = computeBaselineRange({ platform: "tiktok", region: "AE", baselinePosts: makePosts(30) });
    expect(result!.confidence).toBe("medium");
  });

  it("returns high confidence for 100 posts", () => {
    const result = computeBaselineRange({ platform: "tiktok", region: "AE", baselinePosts: makePosts(100) });
    expect(result!.confidence).toBe("high");
  });

  it("filters by platform", () => {
    const mixed = [...makePosts(10, "tiktok"), ...makePosts(3, "instagram")];
    const result = computeBaselineRange({ platform: "tiktok", region: "AE", baselinePosts: mixed });
    expect(result).not.toBeNull();
    expect(result!.baselineSampleSize).toBe(10);
  });

  it("filters by niche via hashtag overlap", () => {
    const posts = [
      ...makePosts(8).map((p) => ({ ...p, hashtags: ["#construction", "#dubai"] })),
      ...makePosts(5).map((p, i) => ({ ...p, postId: `other-${i}`, hashtags: ["#food", "#recipe"] })),
    ];
    const result = computeBaselineRange({ platform: "tiktok", region: "AE", niche: "construction", baselinePosts: posts });
    expect(result).not.toBeNull();
    expect(result!.baselineSampleSize).toBe(8);
  });

  it("computes correct IQR for known values", () => {
    const posts = Array.from({ length: 20 }, (_, i) =>
      makePost({ postId: `v-${i}`, views: (i + 1) * 100 }), // 100, 200, ..., 2000
    );
    const result = computeBaselineRange({ platform: "tiktok", region: "AE", baselinePosts: posts });
    expect(result).not.toBeNull();
    expect(result!.min).toBeLessThan(result!.median);
    expect(result!.median).toBeLessThan(result!.max);
    expect(result!.metric).toBe("views");
  });
});

// ── computeUserRange ────────────────────────────────────────────────────

describe("computeUserRange", () => {
  it("returns null for empty posts", () => {
    expect(computeUserRange({ platform: "tiktok", performanceDNA: makeDNA(), recentPosts: [] })).toBeNull();
  });

  it("returns null for 3 posts (below threshold)", () => {
    expect(computeUserRange({ platform: "tiktok", performanceDNA: makeDNA(), recentPosts: makePosts(3) })).toBeNull();
  });

  it("returns medium confidence for 8 posts with 20 total analyzed", () => {
    const result = computeUserRange({ platform: "tiktok", performanceDNA: makeDNA(20), recentPosts: makePosts(8) });
    expect(result!.confidence).toBe("medium");
    expect(result!.basis).toBe("user_history");
    expect(result!.basedOnPosts).toBe(8);
  });

  it("returns high confidence for 15 posts with 35 total analyzed", () => {
    const result = computeUserRange({ platform: "tiktok", performanceDNA: makeDNA(35), recentPosts: makePosts(15) });
    expect(result!.confidence).toBe("high");
  });

  it("filters by platform", () => {
    const mixed = [...makePosts(10, "tiktok"), ...makePosts(5, "instagram")];
    const result = computeUserRange({ platform: "tiktok", performanceDNA: makeDNA(), recentPosts: mixed });
    expect(result!.basedOnPosts).toBe(10);
  });

  it("filters by niche via hashtag overlap", () => {
    const posts = [
      ...makePosts(6).map((p) => ({ ...p, hashtags: ["#construction"] })),
      ...makePosts(6).map((p, i) => ({ ...p, postId: `other-${i}`, hashtags: ["#food"] })),
    ];
    const result = computeUserRange({ platform: "tiktok", niche: "construction", performanceDNA: makeDNA(), recentPosts: posts });
    expect(result!.basedOnPosts).toBe(6);
  });
});

// ── blendPrediction ─────────────────────────────────────────────────────

describe("blendPrediction", () => {
  const baselineRange = computeBaselineRange({ platform: "tiktok", region: "AE", baselinePosts: makePosts(30, "tiktok", 5000) })!;
  const userRange5 = computeUserRange({ platform: "tiktok", performanceDNA: makeDNA(10), recentPosts: makePosts(5, "tiktok", 1000) })!;
  const userRange20 = computeUserRange({ platform: "tiktok", performanceDNA: makeDNA(25), recentPosts: makePosts(20, "tiktok", 1000) })!;
  const userRange50 = computeUserRange({ platform: "tiktok", performanceDNA: makeDNA(60), recentPosts: makePosts(50, "tiktok", 1000) })!;

  it("returns null when both are null", () => {
    expect(blendPrediction(null, null)).toBeNull();
  });

  it("returns baseline unchanged when user is null", () => {
    const result = blendPrediction(baselineRange, null)!;
    expect(result.basis).toBe("baseline");
    expect(result.median).toBe(baselineRange.median);
  });

  it("returns user unchanged when baseline is null", () => {
    const result = blendPrediction(null, userRange5)!;
    expect(result.basis).toBe("user_history");
    expect(result.median).toBe(userRange5.median);
  });

  it("blends at 70/30 baseline for 5 user posts", () => {
    const result = blendPrediction(baselineRange, userRange5)!;
    expect(result.basis).toBe("blended");
    const expected = Math.round(baselineRange.median * 0.7 + userRange5.median * 0.3);
    expect(result.median).toBe(expected);
  });

  it("blends at 30/70 baseline for 20 user posts", () => {
    const result = blendPrediction(baselineRange, userRange20)!;
    expect(result.basis).toBe("blended");
    const expected = Math.round(baselineRange.median * 0.3 + userRange20.median * 0.7);
    expect(result.median).toBe(expected);
  });

  it("blends at 10/90 baseline for 50 user posts", () => {
    const result = blendPrediction(baselineRange, userRange50)!;
    const expected = Math.round(baselineRange.median * 0.1 + userRange50.median * 0.9);
    expect(result.median).toBe(expected);
  });

  it("uses the higher confidence level", () => {
    const result = blendPrediction(baselineRange, userRange20)!;
    expect(["medium", "high"]).toContain(result.confidence);
  });
});

// ── predictForCard ──────────────────────────────────────────────────────

describe("predictForCard", () => {
  it("returns insufficient_data when both sources empty", () => {
    const result = predictForCard({
      platform: "tiktok", region: "AE", performanceDNA: null, recentPosts: [], baselinePosts: [],
    });
    expect(result.basis).toBe("insufficient_data");
    expect(result.min).toBeGreaterThan(0);
    expect(result.max).toBeGreaterThan(result.min);
  });

  it("returns baseline-basis when only baseline posts available", () => {
    const result = predictForCard({
      platform: "tiktok", region: "AE", performanceDNA: null, recentPosts: [], baselinePosts: makePosts(20),
    });
    expect(result.basis).toBe("baseline");
  });

  it("returns user_history-basis when only user data available", () => {
    const result = predictForCard({
      platform: "tiktok", region: "AE", performanceDNA: makeDNA(), recentPosts: makePosts(10), baselinePosts: [],
    });
    expect(result.basis).toBe("user_history");
  });

  it("returns blended when both sources available", () => {
    const result = predictForCard({
      platform: "tiktok", region: "AE", performanceDNA: makeDNA(), recentPosts: makePosts(10), baselinePosts: makePosts(20, "tiktok", 5000),
    });
    expect(result.basis).toBe("blended");
  });
});
