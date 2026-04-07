/**
 * DigitAlchemy® Gazette — TrendRadar adapter
 *
 * Thin adapter that wires TrendRadar's scoring engine into the Gazette
 * pipeline. Fetches snapshots from Firestore, computes scores, filters
 * by UserContext, and returns ScoredTrend[] for the concept-card generator.
 *
 * Phase 2.2 of DA-GAZETTE-UNIFICATION.
 */

import type { UserContext, Platform, Horizon } from "@/types/gazette";
import type {
  TrendScore,
  TrendPlatform,
  TrendEntityType,
  TrendClassification,
  TrendDirection,
  ProductionLag,
} from "@/lib/trendRadar/types";
import { getRecentSnapshots } from "@/lib/trendRadar/capture";
import { computeScores } from "@/lib/trendRadar/score";
import { classifyAndSort } from "@/lib/trendRadar/classify";
import { validateUserContext } from "@/lib/gazette/context";

// ============================================================================
// ScoredTrend — internal type for the Gazette pipeline
// ============================================================================

export interface ScoredTrend {
  id: string;
  entity: string;
  entityType: TrendEntityType;
  platform: TrendPlatform;
  region: string;
  velocity: number;
  persistence: number;
  novelty: number;
  /** Composite = 0.5 * velocity_norm + 0.3 * novelty_norm + 0.2 * persistence_norm (all 0–100) */
  composite: number;
  lifecycle: TrendClassification;
  forecast: {
    direction: TrendDirection;
    confidence: number;
  };
  source: "trendRadar";
  snapshotIds: string[];
  observedAt: string;
}

// ============================================================================
// TrendsFetchError
// ============================================================================

export type TrendsFetchErrorCode =
  | "trendradar_unavailable"
  | "no_trends"
  | "validation_failed"
  | "internal";

export class TrendsFetchError extends Error {
  constructor(
    message: string,
    public readonly code: TrendsFetchErrorCode,
  ) {
    super(message);
    this.name = "TrendsFetchError";
  }
}

// ============================================================================
// Helpers
// ============================================================================

/** Map Gazette Horizon to the closest TrendRadar ProductionLag */
export function horizonToProductionLag(horizon: Horizon): ProductionLag {
  const map: Record<Horizon, ProductionLag> = {
    "24h": "24h",
    "7d": "1w",
    "30d": "4w",
    "6m": "6m",
  };
  return map[horizon];
}

/** Map Gazette Platform to TrendRadar TrendPlatform(s). "all" returns the 3 main platforms. */
export function platformToTrendPlatforms(
  platform: Platform,
): TrendPlatform[] {
  if (platform === "all") return ["tiktok", "instagram", "youtube"];
  return [platform];
}

/**
 * Compute a composite score from TrendRadar's individual signals.
 * All inputs are 0–100 scale. Output is 0–100.
 * Formula: 0.5 * velocity_24h_clamped + 0.3 * novelty + 0.2 * persistence
 * velocity_24h can be negative (fading), so we clamp to [0, 100] for the composite.
 */
export function computeComposite(
  velocity24h: number,
  novelty: number,
  persistence: number,
): number {
  const vClamped = Math.max(0, Math.min(100, velocity24h));
  return Math.round(0.5 * vClamped + 0.3 * novelty + 0.2 * persistence);
}

/**
 * Map forecast confidence from TrendRadar's categorical labels to a 0–1 number.
 */
function forecastConfidenceToNumber(
  confidence: "high" | "medium" | "low",
): number {
  const map = { high: 0.9, medium: 0.6, low: 0.3 };
  return map[confidence];
}

// ============================================================================
// Mapper — TrendScore → ScoredTrend
// ============================================================================

export function mapTrendRadarToScoredTrend(
  raw: TrendScore,
  context: UserContext,
  snapshotIds: string[],
): ScoredTrend {
  return {
    id: raw.id,
    entity: raw.entity,
    entityType: raw.entityType,
    platform: raw.platform,
    region: context.region,
    velocity: raw.velocity_24h,
    persistence: raw.persistence,
    novelty: raw.novelty,
    composite: computeComposite(raw.velocity_24h, raw.novelty, raw.persistence),
    lifecycle: raw.classification,
    forecast: {
      direction: raw.trendOutlook.direction,
      confidence: forecastConfidenceToNumber(raw.trendOutlook.forecastConfidence),
    },
    source: "trendRadar",
    snapshotIds,
    observedAt: raw.updatedAt,
  };
}

// ============================================================================
// Main function
// ============================================================================

export async function fetchTrendsForContext(
  context: UserContext,
): Promise<ScoredTrend[]> {
  // 1. Validate context
  try {
    validateUserContext(context);
  } catch {
    throw new TrendsFetchError(
      "Invalid UserContext",
      "validation_failed",
    );
  }

  const platforms = platformToTrendPlatforms(context.platform);
  const productionLag = horizonToProductionLag(context.horizon);
  const allScored: ScoredTrend[] = [];

  for (const plat of platforms) {
    // 2. Fetch snapshots from Firestore via TrendRadar
    let snapshots;
    try {
      snapshots = await getRecentSnapshots(plat, "platform_wide", null, 30);
    } catch (err) {
      throw new TrendsFetchError(
        `TrendRadar unavailable for ${plat}: ${err instanceof Error ? err.message : "unknown"}`,
        "trendradar_unavailable",
      );
    }

    if (snapshots.length === 0) continue;

    // 3. Filter snapshots by region (TrendRadar doesn't filter by region)
    const regionFiltered = snapshots.filter(
      (s) => s.region.toUpperCase() === context.region.toUpperCase(),
    );
    if (regionFiltered.length === 0) continue;

    const snapshotIds = regionFiltered.map((s) => s.id);

    // 4. Compute scores
    let scores: TrendScore[];
    try {
      scores = computeScores(regionFiltered, plat, null, [], productionLag);
    } catch (err) {
      throw new TrendsFetchError(
        `Scoring failed for ${plat}: ${err instanceof Error ? err.message : "unknown"}`,
        "internal",
      );
    }

    // 5. Classify
    classifyAndSort(scores, productionLag);

    // 6. Map to ScoredTrend
    for (const score of scores) {
      allScored.push(mapTrendRadarToScoredTrend(score, context, snapshotIds));
    }
  }

  if (allScored.length === 0) {
    throw new TrendsFetchError(
      `No trends found for ${context.region}/${context.platform}/${context.horizon}`,
      "no_trends",
    );
  }

  // 7. Sort by composite score, descending
  allScored.sort((a, b) => b.composite - a.composite);

  return allScored;
}
