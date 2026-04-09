import { describe, it, expect } from "vitest";
import { dnaToFilterDefaults } from "../dnaToFilterDefaults";
import type { ContentProfile } from "@/lib/firestore/contentProfile";

function makeProfile(overrides: Partial<ContentProfile> = {}): ContentProfile {
  return {
    topics: ["construction", "BIM", "digital twins"],
    tone: "professional",
    visualStyle: "talking-head",
    audioPreference: "original-audio",
    captionStyle: "short-punchy",
    hashtagPatterns: ["#construction", "#BIM"],
    sampleCount: 30,
    lastAnalyzedAt: "2026-04-07T10:00:00Z",
    profileVersion: 3,
    confidence: "high",
    ...overrides,
  };
}

describe("dnaToFilterDefaults", () => {
  it("returns hard-coded defaults for null profile", () => {
    const result = dnaToFilterDefaults(null);
    expect(result.region).toBe("AE");
    expect(result.platform).toBe("all");
    expect(result.mode).toBe("react_now");
    expect(result.horizon).toBe("24h");
    expect(result.actorType).toBe("b2c");
  });

  it("returns hard-coded defaults for empty profile", () => {
    const result = dnaToFilterDefaults(makeProfile({ sampleCount: 0 }));
    expect(result.actorType).toBe("b2c");
  });

  it("infers b2b for construction/BIM topics", () => {
    const result = dnaToFilterDefaults(makeProfile({ topics: ["construction", "BIM"] }));
    expect(result.actorType).toBe("b2b");
  });

  it("infers b2c for consumer topics", () => {
    const result = dnaToFilterDefaults(makeProfile({ topics: ["fashion", "lifestyle", "travel"] }));
    expect(result.actorType).toBe("b2c");
  });

  it("infers b2b for saas/enterprise topics", () => {
    const result = dnaToFilterDefaults(makeProfile({ topics: ["saas", "enterprise", "fintech"] }));
    expect(result.actorType).toBe("b2b");
  });
});
