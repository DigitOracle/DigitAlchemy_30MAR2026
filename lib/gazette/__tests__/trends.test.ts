import { describe, it, expect, vi, beforeEach } from "vitest";
import type { TrendScore, TrendSnapshot } from "@/lib/trendRadar/types";
import type { UserContext } from "@/types/gazette";
import {
  computeComposite,
  horizonToProductionLag,
  mapTrendRadarToScoredTrend,
  fetchTrendsForContext,
  TrendsFetchError,
  platformToTrendPlatforms,
} from "../trends";

// ── Mock TrendRadar modules ─────────────────────────────────────────────

vi.mock("@/lib/trendRadar/capture", () => ({
  getRecentSnapshots: vi.fn(),
}));

vi.mock("@/lib/trendRadar/score", () => ({
  computeScores: vi.fn(),
}));

vi.mock("@/lib/trendRadar/classify", () => ({
  classifyAndSort: vi.fn((scores: TrendScore[]) => {
    for (const s of scores) s.classification = "stable_opportunity";
    return scores;
  }),
}));

import { getRecentSnapshots } from "@/lib/trendRadar/capture";
import { computeScores } from "@/lib/trendRadar/score";

const mockedGetSnapshots = vi.mocked(getRecentSnapshots);
const mockedComputeScores = vi.mocked(computeScores);

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Test fixtures ───────────────────────────────────────────────────────

function makeTrendScore(overrides: Partial<TrendScore> = {}): TrendScore {
  return {
    id: "score-tiktok-abc123",
    platform: "tiktok",
    entity: "dubai",
    entityType: "hashtag",
    niche: null,
    firstSeen: "2026-04-06T10:00:00Z",
    lastSeen: "2026-04-07T10:00:00Z",
    seenCount: 5,
    snapshotsTotal: 10,
    rankHistory: [1, 2, 3],
    insufficientHistory: false,
    velocity_6h: 30,
    velocity_24h: 40,
    velocity_72h: 20,
    acceleration: 10,
    persistence: 60,
    novelty: 80,
    decay_risk: 25,
    estimated_half_life_hours: null,
    cross_platform_echo: 50,
    niche_fit: 50,
    confidenceTier: "tier_2_live_scraped",
    trendCause: "unknown",
    stillWorthMaking: "yes",
    whyStillMatters: "Confirmed trending.",
    production_lag_fit: { same_day: 80, "24h": 70, "48h": 60, "72h": 50, "1w": 40, "2w": 30, "4w": 20, "6m": 10, "12m": 5 },
    classification: "breakout_candidate",
    classificationConfidence: "high",
    trendOutlook: {
      direction: "rising",
      stillWorthMaking: "yes",
      forecastConfidence: "high",
      publishWindowFit: "24h",
      rationale: "Active trend.",
      forecastModelUsed: "rule_based_v1",
      futureForecastEligible: true,
      historyDepth: 10,
      recommendedNextStep: "make_now",
    },
    externalDemandScore: null,
    externalValidationSource: null,
    externalValidationStatus: null,
    updatedAt: "2026-04-07T14:00:00Z",
    ...overrides,
  };
}

function makeSnapshot(overrides: Partial<TrendSnapshot> = {}): TrendSnapshot {
  return {
    id: "snap-123-tiktok-platform_wide",
    platform: "tiktok",
    scope: "platform_wide",
    region: "AE",
    capturedAt: "2026-04-07T10:00:00Z",
    source: "scrape_creators_tiktok",
    sourceConfidence: "high",
    niche: null,
    entityCount: 5,
    entities: [],
    ...overrides,
  };
}

const validContext: UserContext = {
  region: "AE",
  platform: "tiktok",
  horizon: "24h",
};

// ── computeComposite ────────────────────────────────────────────────────

describe("computeComposite", () => {
  it("computes weighted sum correctly", () => {
    // 0.5*40 + 0.3*80 + 0.2*60 = 20 + 24 + 12 = 56
    expect(computeComposite(40, 80, 60)).toBe(56);
  });

  it("clamps negative velocity to 0", () => {
    // 0.5*0 + 0.3*50 + 0.2*50 = 0 + 15 + 10 = 25
    expect(computeComposite(-30, 50, 50)).toBe(25);
  });

  it("clamps velocity above 100", () => {
    // 0.5*100 + 0.3*100 + 0.2*100 = 50 + 30 + 20 = 100
    expect(computeComposite(150, 100, 100)).toBe(100);
  });

  it("returns 0 for all zeros", () => {
    expect(computeComposite(0, 0, 0)).toBe(0);
  });
});

// ── horizonToProductionLag ──────────────────────────────────────────────

describe("horizonToProductionLag", () => {
  it("maps 24h to 24h", () => expect(horizonToProductionLag("24h")).toBe("24h"));
  it("maps 7d to 1w", () => expect(horizonToProductionLag("7d")).toBe("1w"));
  it("maps 30d to 4w", () => expect(horizonToProductionLag("30d")).toBe("4w"));
  it("maps 6m to 6m", () => expect(horizonToProductionLag("6m")).toBe("6m"));
});

// ── platformToTrendPlatforms ────────────────────────────────────────────

describe("platformToTrendPlatforms", () => {
  it("returns [tiktok] for tiktok", () => {
    expect(platformToTrendPlatforms("tiktok")).toEqual(["tiktok"]);
  });
  it("returns all 3 for all", () => {
    expect(platformToTrendPlatforms("all")).toEqual(["tiktok", "instagram", "youtube"]);
  });
});

// ── mapTrendRadarToScoredTrend ──────────────────────────────────────────

describe("mapTrendRadarToScoredTrend", () => {
  it("maps a TrendScore to ScoredTrend correctly", () => {
    const raw = makeTrendScore();
    const result = mapTrendRadarToScoredTrend(raw, validContext, ["snap-1"]);

    expect(result.id).toBe("score-tiktok-abc123");
    expect(result.entity).toBe("dubai");
    expect(result.entityType).toBe("hashtag");
    expect(result.platform).toBe("tiktok");
    expect(result.region).toBe("AE");
    expect(result.velocity).toBe(40);
    expect(result.persistence).toBe(60);
    expect(result.novelty).toBe(80);
    expect(result.composite).toBe(56); // 0.5*40 + 0.3*80 + 0.2*60
    expect(result.lifecycle).toBe("breakout_candidate");
    expect(result.forecast.direction).toBe("rising");
    expect(result.forecast.confidence).toBe(0.9);
    expect(result.source).toBe("trendRadar");
    expect(result.snapshotIds).toEqual(["snap-1"]);
    expect(result.observedAt).toBe("2026-04-07T14:00:00Z");
  });

  it("maps forecast confidence levels correctly", () => {
    const medium = makeTrendScore({
      trendOutlook: { ...makeTrendScore().trendOutlook, forecastConfidence: "medium" },
    });
    expect(mapTrendRadarToScoredTrend(medium, validContext, []).forecast.confidence).toBe(0.6);

    const low = makeTrendScore({
      trendOutlook: { ...makeTrendScore().trendOutlook, forecastConfidence: "low" },
    });
    expect(mapTrendRadarToScoredTrend(low, validContext, []).forecast.confidence).toBe(0.3);
  });
});

// ── fetchTrendsForContext ───────────────────────────────────────────────

describe("fetchTrendsForContext", () => {
  it("returns correctly mapped and sorted ScoredTrend[] for valid context", async () => {
    const snapshots = [makeSnapshot()];
    const scores = [
      makeTrendScore({ velocity_24h: 20, novelty: 50, persistence: 40 }),
      makeTrendScore({ id: "score-2", entity: "fashion", velocity_24h: 60, novelty: 90, persistence: 80 }),
    ];

    mockedGetSnapshots.mockResolvedValue(snapshots);
    mockedComputeScores.mockReturnValue(scores);

    const result = await fetchTrendsForContext(validContext);

    expect(result.length).toBe(2);
    // Higher composite first
    expect(result[0].composite).toBeGreaterThanOrEqual(result[1].composite);
  });

  it("filters by platform when context.platform is tiktok", async () => {
    mockedGetSnapshots.mockResolvedValue([makeSnapshot()]);
    mockedComputeScores.mockReturnValue([makeTrendScore()]);

    await fetchTrendsForContext(validContext);

    // Should only call getRecentSnapshots for tiktok, not all platforms
    expect(mockedGetSnapshots).toHaveBeenCalledTimes(1);
    expect(mockedGetSnapshots).toHaveBeenCalledWith("tiktok", "platform_wide", null, 30);
  });

  it("fetches all platforms when context.platform is all", async () => {
    mockedGetSnapshots.mockResolvedValue([makeSnapshot()]);
    mockedComputeScores.mockReturnValue([makeTrendScore()]);

    await fetchTrendsForContext({ ...validContext, platform: "all" });

    expect(mockedGetSnapshots).toHaveBeenCalledTimes(3);
  });

  it("filters snapshots by region", async () => {
    mockedGetSnapshots.mockResolvedValue([
      makeSnapshot({ region: "AE" }),
      makeSnapshot({ region: "US" }),
    ]);
    mockedComputeScores.mockReturnValue([makeTrendScore()]);

    await fetchTrendsForContext(validContext);

    // computeScores should receive only AE snapshots
    const passedSnapshots = mockedComputeScores.mock.calls[0][0];
    expect(passedSnapshots.every((s: TrendSnapshot) => s.region === "AE")).toBe(true);
  });

  it("throws validation_failed on invalid context", async () => {
    const bad = { region: "", platform: "tiktok", horizon: "24h" } as UserContext;
    await expect(fetchTrendsForContext(bad)).rejects.toThrow(TrendsFetchError);
    await expect(fetchTrendsForContext(bad)).rejects.toMatchObject({ code: "validation_failed" });
  });

  it("throws trendradar_unavailable when getRecentSnapshots throws", async () => {
    mockedGetSnapshots.mockRejectedValue(new Error("Firestore down"));
    await expect(fetchTrendsForContext(validContext)).rejects.toThrow(TrendsFetchError);
    await expect(fetchTrendsForContext(validContext)).rejects.toMatchObject({ code: "trendradar_unavailable" });
  });

  it("throws no_trends when no snapshots match region", async () => {
    mockedGetSnapshots.mockResolvedValue([makeSnapshot({ region: "US" })]);
    await expect(fetchTrendsForContext(validContext)).rejects.toThrow(TrendsFetchError);
    await expect(fetchTrendsForContext(validContext)).rejects.toMatchObject({ code: "no_trends" });
  });

  it("throws no_trends when getRecentSnapshots returns empty", async () => {
    mockedGetSnapshots.mockResolvedValue([]);
    await expect(fetchTrendsForContext(validContext)).rejects.toThrow(TrendsFetchError);
    await expect(fetchTrendsForContext(validContext)).rejects.toMatchObject({ code: "no_trends" });
  });

  it("sorts results by composite score descending", async () => {
    mockedGetSnapshots.mockResolvedValue([makeSnapshot()]);
    mockedComputeScores.mockReturnValue([
      makeTrendScore({ id: "low", velocity_24h: 10, novelty: 10, persistence: 10 }),
      makeTrendScore({ id: "high", velocity_24h: 90, novelty: 90, persistence: 90 }),
      makeTrendScore({ id: "mid", velocity_24h: 50, novelty: 50, persistence: 50 }),
    ]);

    const result = await fetchTrendsForContext(validContext);

    for (let i = 1; i < result.length; i++) {
      expect(result[i - 1].composite).toBeGreaterThanOrEqual(result[i].composite);
    }
  });
});
