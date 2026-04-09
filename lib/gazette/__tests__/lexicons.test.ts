import { describe, it, expect } from "vitest";
import { industryRelevance } from "../industryLexicon";
import { audienceRelevance } from "../audienceLexicon";

describe("industryRelevance", () => {
  it("matches real_estate for property listing text", () => {
    expect(industryRelevance("luxury apartment for sale in Dubai Marina with pool view", "real_estate")).toBeGreaterThan(0.05);
  });

  it("returns 0 for unrelated text", () => {
    expect(industryRelevance("Kanye West new album release", "real_estate")).toBe(0);
  });

  it("matches food_beverage for restaurant text", () => {
    expect(industryRelevance("best restaurants in DIFC brunch menu chef special", "food_beverage")).toBeGreaterThan(0.05);
  });

  it("matches healthcare for clinic text", () => {
    expect(industryRelevance("dental clinic appointment with specialist doctor", "healthcare")).toBeGreaterThan(0.05);
  });
});

describe("audienceRelevance", () => {
  it("matches gen_z for TikTok slang", () => {
    expect(audienceRelevance("slay queen iykyk this is bussin no cap", ["gen_z"])).toBeGreaterThan(0.05);
  });

  it("returns 0 for all_ages", () => {
    expect(audienceRelevance("anything goes here", ["all_ages"])).toBe(0);
  });

  it("returns 0 for empty audience array", () => {
    expect(audienceRelevance("some text", [])).toBe(0);
  });

  it("takes max across multiple audiences", () => {
    const text = "throwback nostalgia 90s brunch avocado toast";
    const single = audienceRelevance(text, ["millennials"]);
    const multi = audienceRelevance(text, ["millennials", "gen_z"]);
    expect(multi).toBeGreaterThanOrEqual(single);
  });
});
