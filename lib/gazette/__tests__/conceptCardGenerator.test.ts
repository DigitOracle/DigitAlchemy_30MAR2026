import { describe, it, expect } from "vitest";
import type { ConceptCard } from "@/types/conceptCard";
import type { ScoredTrend } from "../trends";
import type { PerformanceDNA, PerformancePost, LikelyRange } from "@/types/gazette";
import {
  generateConceptCards,
  type CardGeneratorDeps,
  type GenerateConceptCardsInput,
} from "../conceptCardGenerator";
import type { RecPost } from "../adapters";

// ── Fixtures ────────────────────────────────────────────────────────────

const mockLikelyRange: LikelyRange = {
  p25: 500, median: 2000, p75: 8000, metric: "views",
  confidence: "medium", basis: "blended",
  reasoning: "Test prediction", basedOnUserPosts: 10, basedOnBaselinePosts: 30,
  shrinkageWeight: 0.3,
};

const successDeps: CardGeneratorDeps = {
  predict: () => mockLikelyRange,
  enrichWithClaude: async () => ({ hook: "Did you know?", body: "AI is changing construction in the UAE." }),
};

const failingPredictDeps: CardGeneratorDeps = {
  predict: () => { throw new Error("predict failed"); },
  enrichWithClaude: async () => ({ hook: "Hook", body: "Body" }),
};

const failingClaudeDeps: CardGeneratorDeps = {
  predict: () => mockLikelyRange,
  enrichWithClaude: async () => null,
};

function makeDNA(total = 20): PerformanceDNA {
  return {
    optimalLength: { value: { min: 30, max: 80, median: 50 }, confidence: "medium", basedOn: total },
    hookPatterns: { value: [], confidence: "low", basedOn: total },
    hashtagEffectiveness: { value: [], confidence: "low", basedOn: total },
    timeOfDayCurves: { value: [], confidence: "low", basedOn: total },
    bestPerformingTopics: { value: [], confidence: "low", basedOn: total },
    audioContentFit: { value: { trendingAudioLift: 0, originalAudioLift: 0 }, confidence: "low", basedOn: total },
    engagementQualityRatio: { value: { commentToLikeRatio: 0, shareToViewRatio: 0 }, confidence: "low", basedOn: total },
    totalPostsAnalyzed: total, lastUpdated: "2026-04-07T10:00:00Z",
    platformsCovered: ["tiktok"], rawPostsRetained: Math.min(total, 50),
  };
}

const sampleRec: RecPost = {
  topic: "Dubai AI", caption: "AI is here #dubai", hashtags: "#dubai #AI",
  audio: "trending", best_time: "7PM", format: "Video",
};

function makeTrend(overrides: Partial<ScoredTrend> = {}): ScoredTrend {
  return {
    id: "score-tiktok-abc", entity: "dubai", entityType: "hashtag",
    platform: "tiktok", region: "AE", velocity: 40, persistence: 60,
    novelty: 80, composite: 56, lifecycle: "breakout_candidate",
    forecast: { direction: "rising", confidence: 0.9 },
    source: "trendRadar", snapshotIds: ["snap-1"], observedAt: "2026-04-07T14:00:00Z",
    ...overrides,
  };
}

function baseInput(overrides: Partial<GenerateConceptCardsInput> = {}): GenerateConceptCardsInput {
  return {
    uid: "user-1", region: "AE", platform: "tiktok",
    contentDNA: null, performanceDNA: makeDNA(),
    recentPosts: [], baselinePosts: [], scoredTrends: [],
    ...overrides,
  };
}

// ── Tests ────────────────────────────────────────────────────────────────

describe("generateConceptCards", () => {
  it("generates cards from full input with all sources", async () => {
    const cards = await generateConceptCards(baseInput({
      scoredTrends: [makeTrend()],
      recPosts: { followTrend: [sampleRec], stayInLane: [sampleRec] },
    }), successDeps);

    expect(cards.length).toBe(3);
    expect(cards.some((c) => c.source === "trend")).toBe(true);
    expect(cards.some((c) => c.source === "style")).toBe(true);
  });

  it("returns empty array for empty input", async () => {
    const cards = await generateConceptCards(baseInput(), successDeps);
    expect(cards).toEqual([]);
  });

  it("populates likelyRange on each card", async () => {
    const cards = await generateConceptCards(baseInput({
      recPosts: { followTrend: [sampleRec], stayInLane: [] },
    }), successDeps);

    expect(cards[0].likelyRange).toEqual(mockLikelyRange);
  });

  it("sets likelyRange to null when prediction fails", async () => {
    const cards = await generateConceptCards(baseInput({
      recPosts: { followTrend: [sampleRec], stayInLane: [] },
    }), failingPredictDeps);

    expect(cards[0].likelyRange).toBeNull();
  });

  it("enriches skeleton cards with Claude", async () => {
    const cards = await generateConceptCards(baseInput({
      scoredTrends: [makeTrend()],
    }), successDeps);

    const trendCard = cards.find((c) => c.source === "trend");
    expect(trendCard?.hook).toBe("Did you know?");
    expect(trendCard?.body).toContain("AI is changing");
  });

  it("drops placeholder cards when Claude enrichment fails (quality filter)", async () => {
    const cards = await generateConceptCards(baseInput({
      scoredTrends: [makeTrend()],
    }), failingClaudeDeps);

    // Quality filter drops low-confidence placeholder cards
    const trendCard = cards.find((c) => c.source === "trend");
    expect(trendCard).toBeUndefined();
  });

  it("sorts by confidence then source", async () => {
    const cards = await generateConceptCards(baseInput({
      scoredTrends: [makeTrend()],
      recPosts: { followTrend: [sampleRec], stayInLane: [sampleRec] },
    }), successDeps);

    // Style card (high confidence from 20 user posts) should come before
    // or equal to trend cards (medium confidence)
    for (let i = 1; i < cards.length; i++) {
      const prev = cards[i - 1];
      const curr = cards[i];
      const prevConf = prev.confidence === "high" ? 0 : prev.confidence === "medium" ? 1 : 2;
      const currConf = curr.confidence === "high" ? 0 : curr.confidence === "medium" ? 1 : 2;
      expect(prevConf).toBeLessThanOrEqual(currConf);
    }
  });

  it("caps Claude enrichment at 8 skeleton cards", async () => {
    const trends = Array.from({ length: 12 }, (_, i) => makeTrend({ id: `t-${i}`, entity: `trend-${i}`, composite: 50 }));
    let enrichCount = 0;
    const countingDeps: CardGeneratorDeps = {
      predict: () => mockLikelyRange,
      enrichWithClaude: async () => { enrichCount++; return { hook: "H", body: "B" }; },
    };

    await generateConceptCards(baseInput({ scoredTrends: trends }), countingDeps);
    expect(enrichCount).toBe(8);
  });

  it("filters out low-composite trends via adapter", async () => {
    const cards = await generateConceptCards(baseInput({
      scoredTrends: [makeTrend({ composite: 5 })],
    }), successDeps);
    expect(cards.length).toBe(0);
  });
});
