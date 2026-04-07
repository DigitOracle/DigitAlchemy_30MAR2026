/**
 * DigitAlchemy® Gazette — core type definitions
 *
 * Contract for the unified context → trends → concept cards pipeline.
 * See DA-HANDOVER-001.md and docs/DA-TEC-2026-003-gazette-refactor-recon.md
 * for background.
 *
 * Phase 1 of DA-GAZETTE-UNIFICATION. No runtime code. No dependencies.
 */

// ============================================================================
// UserContext — describes who the user is and what they care about
// ============================================================================

export type Platform = "tiktok" | "instagram" | "youtube" | "all";

export type Horizon = "24h" | "7d" | "30d" | "6m";

export interface UserContext {
  /** ISO country code or region identifier, e.g. "UAE", "SG", "US" */
  region: string;
  /** Platform scope. "all" covers the FRONT PAGE view. */
  platform: Platform;
  /** Time window for trend relevance. */
  horizon: Horizon;
  /** Free-form industry, e.g. "construction", "real-estate". Optional. */
  industry?: string;
  /** Audience tags, e.g. ["all-ages"], ["professionals", "students"]. Optional. */
  audience?: string[];
}

// ============================================================================
// ConceptCardCategory — the seven categories from DA-UC-001
// ============================================================================

export type ConceptCardCategory =
  | "AUDIO_VIRAL"
  | "TREND_ALERT"
  | "BRAND_SIGNAL"
  | "CULTURAL_MOMENT"
  | "CREATOR_SPOTLIGHT"
  | "REGIONAL_PULSE"
  | "TECH_INNOVATION";

// ============================================================================
// ConceptCard — a single piece of actionable intelligence
// ============================================================================

export interface ConceptCardEvidence {
  /** Provider or data source, e.g. "scrapeCreators", "wikipedia", "apify" */
  source: string;
  /** The supporting data point — a count, a string, a stat */
  value: string | number;
  /** Optional link back to the original source */
  url?: string;
}

export interface ConceptCardWindow {
  /** ISO 8601 timestamp — when the insight becomes actionable */
  start: string;
  /** ISO 8601 timestamp — when the insight expires */
  end: string;
}

export type ConceptCardEffort = "low" | "medium" | "high";

export interface ConceptCard {
  /** Stable ID within a single GazetteResponse (UUID or short hash) */
  id: string;
  category: ConceptCardCategory;
  /** Headline, target ~80 chars (enforced in the generator, not the type) */
  title: string;
  /** 2–3 sentence synthesis */
  description: string;
  /** Supporting data points with provenance — enables fact-checking */
  evidence: ConceptCardEvidence[];
  /** Specific next step the user can take */
  action: string;
  /** Calibration score from TrendRadar, 0.0 to 1.0 */
  confidence: number;
  /** Time bounds for when this insight is actionable */
  window: ConceptCardWindow;
  /** How much work to act on it */
  effort: ConceptCardEffort;
}

// ============================================================================
// GazetteResponse — wraps a set of concept cards with metadata
// ============================================================================

export interface GazetteResponse {
  /** Echoes back the requested context */
  context: UserContext;
  cards: ConceptCard[];
  /** ISO 8601 timestamp */
  generated_at: string;
  /** Firestore document IDs from trend_snapshots that fed this response */
  source_snapshots: string[];
  /** Semver of the pipeline; bump when classification rules change materially */
  version: string;
}

// ============================================================================
// Examples — one of each type, for copy-paste into tests
// ============================================================================

export const exampleUserContext: UserContext = {
  region: "UAE",
  platform: "tiktok",
  horizon: "24h",
  industry: "real-estate",
  audience: ["all-ages"],
};

export const exampleConceptCard: ConceptCard = {
  id: "cc_01h8p2q3",
  category: "TREND_ALERT",
  title: "Dubai Marina drone footage spiking 340% on TikTok UAE",
  description:
    "Aerial content of Dubai Marina is showing breakout velocity across UAE TikTok, driven by a cluster of creators posting at golden hour. Real-estate accounts are underrepresented in the trend cluster — a clear white-space opportunity.",
  evidence: [
    { source: "scrapeCreators", value: 340, url: "https://example.com/trend/123" },
    { source: "trendRadar", value: "breakout" },
  ],
  action:
    "Post a 30-second Dubai Marina aerial today between 7–9 PM UAE, captioned with a short market insight and 3 hashtags from the current cluster.",
  confidence: 0.82,
  window: {
    start: "2026-04-07T15:00:00Z",
    end: "2026-04-10T15:00:00Z",
  },
  effort: "low",
};

export const exampleGazetteResponse: GazetteResponse = {
  context: exampleUserContext,
  cards: [exampleConceptCard],
  generated_at: "2026-04-07T14:30:00Z",
  source_snapshots: ["trend_snapshot_2026-04-07_uae_tiktok"],
  version: "1.0.0",
};
