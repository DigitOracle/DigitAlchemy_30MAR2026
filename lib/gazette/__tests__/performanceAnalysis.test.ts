import { describe, it, expect } from "vitest";
import type { PerformancePost } from "@/types/gazette";
import {
  computeOptimalLength,
  computeHookPatterns,
  computeHashtagEffectiveness,
  computeTimeOfDayCurves,
  computeBestPerformingTopics,
  computeAudioContentFit,
  computeEngagementQualityRatio,
  buildPerformanceDNA,
} from "../performanceAnalysis";

function makePost(overrides: Partial<PerformancePost> = {}): PerformancePost {
  return {
    postId: "post-1",
    platform: "tiktok",
    publishedAt: "2026-04-05T14:00:00Z",
    caption: "Check out this trending content #dubai #realestate",
    hashtags: ["#dubai", "#realestate"],
    audioType: "trending",
    format: "video",
    views: 1000,
    likes: 100,
    comments: 20,
    shares: 10,
    engagementRate: 0.13,
    hookText: "Check out this trending content",
    captionLength: 50,
    ...overrides,
  };
}

function makePosts(count: number): PerformancePost[] {
  return Array.from({ length: count }, (_, i) =>
    makePost({
      postId: `post-${i}`,
      engagementRate: 0.05 + Math.random() * 0.15,
      captionLength: 30 + i * 5,
      publishedAt: `2026-04-0${(i % 7) + 1}T${(i % 24).toString().padStart(2, "0")}:00:00Z`,
    }),
  );
}

// ── computeOptimalLength ────────────────────────────────────────────────

describe("computeOptimalLength", () => {
  it("returns insufficient for empty array", () => {
    const result = computeOptimalLength([]);
    expect(result.confidence).toBe("insufficient");
    expect(result.basedOn).toBe(0);
  });

  it("computes from top quartile by engagement", () => {
    const posts = makePosts(10);
    const result = computeOptimalLength(posts);
    expect(result.confidence).toBe("high");
    expect(result.basedOn).toBe(10);
    expect(result.value.min).toBeLessThanOrEqual(result.value.median);
    expect(result.value.median).toBeLessThanOrEqual(result.value.max);
  });

  it("returns low confidence for 3 posts", () => {
    expect(computeOptimalLength(makePosts(3)).confidence).toBe("low");
  });
});

// ── computeHookPatterns ─────────────────────────────────────────────────

describe("computeHookPatterns", () => {
  it("returns insufficient for empty array", () => {
    expect(computeHookPatterns([]).confidence).toBe("insufficient");
  });

  it("classifies question hooks", () => {
    const posts = Array.from({ length: 12 }, (_, i) =>
      makePost({
        postId: `q-${i}`,
        hookText: i < 6 ? "Did you know this?" : "Here is a fact",
        engagementRate: i < 6 ? 0.2 : 0.05,
      }),
    );
    const result = computeHookPatterns(posts);
    expect(result.confidence).toBe("high");
    expect(result.value.some((p) => p.pattern === "question")).toBe(true);
  });
});

// ── computeHashtagEffectiveness ─────────────────────────────────────────

describe("computeHashtagEffectiveness", () => {
  it("returns insufficient for empty array", () => {
    expect(computeHashtagEffectiveness([]).confidence).toBe("insufficient");
  });

  it("identifies effective hashtags used 3+ times", () => {
    const posts = Array.from({ length: 20 }, (_, i) =>
      makePost({
        postId: `h-${i}`,
        hashtags: i < 10 ? ["#dubai", "#realestate"] : ["#other"],
        engagementRate: i < 10 ? 0.2 : 0.05,
      }),
    );
    const result = computeHashtagEffectiveness(posts);
    expect(result.confidence).toBe("high");
    expect(result.value.length).toBeGreaterThan(0);
  });
});

// ── computeTimeOfDayCurves ──────────────────────────────────────────────

describe("computeTimeOfDayCurves", () => {
  it("returns insufficient for empty array", () => {
    expect(computeTimeOfDayCurves([]).confidence).toBe("insufficient");
  });

  it("groups by hour and day of week", () => {
    const posts = makePosts(30);
    const result = computeTimeOfDayCurves(posts);
    expect(result.confidence).toBe("high");
    expect(result.value.length).toBeGreaterThan(0);
    for (const curve of result.value) {
      expect(curve.hour).toBeGreaterThanOrEqual(0);
      expect(curve.hour).toBeLessThan(24);
      expect(curve.dayOfWeek).toBeGreaterThanOrEqual(0);
      expect(curve.dayOfWeek).toBeLessThan(7);
    }
  });
});

// ── computeAudioContentFit ──────────────────────────────────────────────

describe("computeAudioContentFit", () => {
  it("returns insufficient for non-video posts", () => {
    const posts = [makePost({ format: "image" })];
    expect(computeAudioContentFit(posts).confidence).toBe("insufficient");
  });

  it("computes lift for video posts", () => {
    const posts = Array.from({ length: 10 }, (_, i) =>
      makePost({
        postId: `a-${i}`,
        audioType: i < 5 ? "trending" : "original",
        engagementRate: i < 5 ? 0.2 : 0.1,
      }),
    );
    const result = computeAudioContentFit(posts);
    expect(result.confidence).toBe("high");
    expect(result.value.trendingAudioLift).toBeGreaterThan(0);
  });
});

// ── computeEngagementQualityRatio ───────────────────────────────────────

describe("computeEngagementQualityRatio", () => {
  it("returns insufficient for empty array", () => {
    expect(computeEngagementQualityRatio([]).confidence).toBe("insufficient");
  });

  it("computes median ratios", () => {
    const posts = makePosts(15);
    const result = computeEngagementQualityRatio(posts);
    expect(result.confidence).toBe("high");
    expect(result.value.commentToLikeRatio).toBeGreaterThanOrEqual(0);
    expect(result.value.shareToViewRatio).toBeGreaterThanOrEqual(0);
  });
});

// ── buildPerformanceDNA ─────────────────────────────────────────────────

describe("buildPerformanceDNA", () => {
  it("builds a complete DNA from posts", () => {
    const posts = makePosts(20);
    const dna = buildPerformanceDNA(posts);
    expect(dna.totalPostsAnalyzed).toBe(20);
    expect(dna.rawPostsRetained).toBe(20);
    expect(dna.platformsCovered).toContain("tiktok");
    expect(dna.lastUpdated).toBeTruthy();
    expect(dna.optimalLength.basedOn).toBe(20);
  });

  it("handles empty posts array", () => {
    const dna = buildPerformanceDNA([]);
    expect(dna.totalPostsAnalyzed).toBe(0);
    expect(dna.optimalLength.confidence).toBe("insufficient");
  });
});
