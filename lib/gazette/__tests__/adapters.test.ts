import { describe, it, expect } from "vitest";
import type { ScoredTrend } from "../trends";
import {
  adaptFollowTheTrendToConceptCard,
  adaptStayInYourLaneToConceptCard,
  adaptScoredTrendToConceptCard,
  type RecPost,
  type AdapterContext,
} from "../adapters";

const baseCtx: AdapterContext = { region: "AE", platform: "tiktok" };

const sampleRec: RecPost = {
  topic: "Dubai construction AI",
  caption: "AI is transforming how we build in the UAE #construction #AI",
  hashtags: "#construction #AI #dubai",
  audio: "trending-sound-123",
  best_time: "7-9 PM",
  format: "Reel",
};

function makeScoredTrend(overrides: Partial<ScoredTrend> = {}): ScoredTrend {
  return {
    id: "score-tiktok-abc", entity: "dubai", entityType: "hashtag",
    platform: "tiktok", region: "AE", velocity: 40, persistence: 60,
    novelty: 80, composite: 56, lifecycle: "breakout_candidate",
    forecast: { direction: "rising", confidence: 0.9 },
    source: "trendRadar", snapshotIds: ["snap-1", "snap-2"], observedAt: "2026-04-07T14:00:00Z",
    ...overrides,
  };
}

// ── Follow the Trend ────────────────────────────────────────────────────

describe("adaptFollowTheTrendToConceptCard", () => {
  it("converts a full RecPost to ConceptCard", () => {
    const card = adaptFollowTheTrendToConceptCard(sampleRec, baseCtx);
    expect(card.source).toBe("trend");
    expect(card.title).toBe("Dubai construction AI");
    expect(card.body).toBe(sampleRec.caption);
    expect(card.hashtags).toEqual(["#construction", "#AI", "#dubai"]);
    expect(card.confidence).toBe("medium");
    expect(card.region).toBe("AE");
  });

  it("infers TikTok video format", () => {
    const card = adaptFollowTheTrendToConceptCard(sampleRec, { ...baseCtx, platform: "tiktok" });
    expect(card.platformFormat).toEqual({ platform: "tiktok", format: "video" });
  });

  it("infers Instagram reel from format hint", () => {
    const card = adaptFollowTheTrendToConceptCard(sampleRec, { ...baseCtx, platform: "instagram" });
    expect(card.platformFormat).toEqual({ platform: "instagram", format: "reel" });
  });

  it("generates a stable id for same input", () => {
    const a = adaptFollowTheTrendToConceptCard(sampleRec, baseCtx);
    const b = adaptFollowTheTrendToConceptCard(sampleRec, baseCtx);
    expect(a.id).toBe(b.id);
  });

  it("handles minimal RecPost", () => {
    const minimal: RecPost = { topic: "Test", caption: "Cap", hashtags: "", audio: "", best_time: "", format: "" };
    const card = adaptFollowTheTrendToConceptCard(minimal, baseCtx);
    expect(card.title).toBe("Test");
    expect(card.hashtags).toEqual([]);
  });
});

// ── Stay in Your Lane ───────────────────────────────────────────────────

describe("adaptStayInYourLaneToConceptCard", () => {
  it("converts with correct source and confidence", () => {
    const card = adaptStayInYourLaneToConceptCard(sampleRec, baseCtx, 20);
    expect(card.source).toBe("style");
    expect(card.confidence).toBe("high");
    expect(card.basedOnUserPosts).toBe(20);
  });

  it("medium confidence for 8 posts", () => {
    const card = adaptStayInYourLaneToConceptCard(sampleRec, baseCtx, 8);
    expect(card.confidence).toBe("medium");
  });

  it("low confidence for 3 posts", () => {
    const card = adaptStayInYourLaneToConceptCard(sampleRec, baseCtx, 3);
    expect(card.confidence).toBe("low");
  });
});

// ── ScoredTrend ─────────────────────────────────────────────────────────

describe("adaptScoredTrendToConceptCard", () => {
  it("converts a trend with sufficient composite", () => {
    const card = adaptScoredTrendToConceptCard(makeScoredTrend(), baseCtx);
    expect(card).not.toBeNull();
    expect(card!.source).toBe("trend");
    expect(card!.title).toContain("dubai");
    expect(card!.basedOnTrendIds).toEqual(["snap-1", "snap-2"]);
  });

  it("returns null for very low composite", () => {
    const card = adaptScoredTrendToConceptCard(makeScoredTrend({ composite: 5 }), baseCtx);
    expect(card).toBeNull();
  });

  it("high confidence for high forecast confidence", () => {
    const card = adaptScoredTrendToConceptCard(makeScoredTrend({ forecast: { direction: "rising", confidence: 0.9 } }), baseCtx);
    expect(card!.confidence).toBe("high");
  });

  it("low confidence for low forecast confidence", () => {
    const card = adaptScoredTrendToConceptCard(makeScoredTrend({ forecast: { direction: "unclear", confidence: 0.2 } }), baseCtx);
    expect(card!.confidence).toBe("low");
  });

  it("sets hashtag for hashtag entities", () => {
    const card = adaptScoredTrendToConceptCard(makeScoredTrend({ entityType: "hashtag", entity: "construction" }), baseCtx);
    expect(card!.hashtags).toEqual(["#construction"]);
  });

  it("empty body and hook (to be populated by Phase 2.3f)", () => {
    const card = adaptScoredTrendToConceptCard(makeScoredTrend(), baseCtx);
    expect(card!.hook).toBe("");
    expect(card!.body).toBe("");
  });
});
