import { describe, it, expect } from "vitest";
import type { ConceptCard } from "@/types/conceptCard";
import {
  isReel,
  isVideoFormat,
  getDefaultMetric,
  getCardTitle,
  getCardConfidenceLabel,
} from "../conceptCard";

function makeCard(overrides: Partial<ConceptCard> = {}): ConceptCard {
  return {
    id: "card-1",
    platformFormat: { platform: "tiktok", format: "video" },
    source: "trend",
    title: "AI in construction",
    hook: "Did you know AI is changing how we build?",
    body: "Full script outline here...",
    hashtags: ["#construction", "#AI"],
    likelyRange: null,
    reasoning: "Based on trending data",
    confidence: "medium",
    createdAt: Date.now(),
    region: "AE",
    ...overrides,
  };
}

describe("isReel", () => {
  it("returns true for Instagram Reel", () => {
    expect(isReel(makeCard({ platformFormat: { platform: "instagram", format: "reel" } }))).toBe(true);
  });

  it("returns false for Instagram carousel", () => {
    expect(isReel(makeCard({ platformFormat: { platform: "instagram", format: "carousel" } }))).toBe(false);
  });

  it("returns false for TikTok video", () => {
    expect(isReel(makeCard({ platformFormat: { platform: "tiktok", format: "video" } }))).toBe(false);
  });
});

describe("isVideoFormat", () => {
  it("returns true for TikTok video", () => {
    expect(isVideoFormat(makeCard({ platformFormat: { platform: "tiktok", format: "video" } }))).toBe(true);
  });

  it("returns true for YouTube short", () => {
    expect(isVideoFormat(makeCard({ platformFormat: { platform: "youtube", format: "short" } }))).toBe(true);
  });

  it("returns true for Instagram reel", () => {
    expect(isVideoFormat(makeCard({ platformFormat: { platform: "instagram", format: "reel" } }))).toBe(true);
  });

  it("returns false for Instagram image", () => {
    expect(isVideoFormat(makeCard({ platformFormat: { platform: "instagram", format: "image" } }))).toBe(false);
  });

  it("returns false for LinkedIn carousel", () => {
    expect(isVideoFormat(makeCard({ platformFormat: { platform: "linkedin", format: "carousel" } }))).toBe(false);
  });
});

describe("getDefaultMetric", () => {
  it("returns views for video formats", () => {
    expect(getDefaultMetric(makeCard({ platformFormat: { platform: "tiktok", format: "video" } }))).toBe("views");
    expect(getDefaultMetric(makeCard({ platformFormat: { platform: "youtube", format: "long" } }))).toBe("views");
  });

  it("returns engagement for non-video formats", () => {
    expect(getDefaultMetric(makeCard({ platformFormat: { platform: "instagram", format: "carousel" } }))).toBe("engagement");
    expect(getDefaultMetric(makeCard({ platformFormat: { platform: "linkedin", format: "post" } }))).toBe("engagement");
  });
});

describe("getCardTitle", () => {
  it("prefixes with platform name", () => {
    expect(getCardTitle(makeCard({ title: "Test" }))).toBe("TikTok: Test");
    expect(getCardTitle(makeCard({ title: "Test", platformFormat: { platform: "instagram", format: "reel" } }))).toBe("Instagram: Test");
  });
});

describe("getCardConfidenceLabel", () => {
  it("returns correct labels", () => {
    expect(getCardConfidenceLabel(makeCard({ confidence: "high" }))).toBe("High confidence");
    expect(getCardConfidenceLabel(makeCard({ confidence: "medium" }))).toBe("Medium confidence");
    expect(getCardConfidenceLabel(makeCard({ confidence: "low" }))).toContain("needs more data");
  });
});
