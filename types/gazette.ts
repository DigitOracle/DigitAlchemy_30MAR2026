/**
 * DigitAlchemy® Gazette — core type definitions
 *
 * Contract for the unified context → trends → concept cards pipeline.
 * See DA-HANDOVER-001.md and docs/DA-TEC-2026-003-gazette-refactor-recon.md
 * for background.
 *
 * Phase 1 + Phase 1.5 of DA-GAZETTE-UNIFICATION.
 */

// ============================================================================
// Region — 7 supported regions
// ============================================================================

export type Region = "AE" | "SA" | "KW" | "QA" | "US" | "SG" | "IN";

export const REGION_LABELS: Record<Region, string> = {
  AE: "United Arab Emirates",
  SA: "Saudi Arabia",
  KW: "Kuwait",
  QA: "Qatar",
  US: "United States",
  SG: "Singapore",
  IN: "India",
};

export const REGION_SHORT_LABELS: Record<Region, string> = {
  AE: "UAE",
  SA: "KSA",
  KW: "Kuwait",
  QA: "Qatar",
  US: "US",
  SG: "SG",
  IN: "India",
};

export const REGION_NARRATIVE_LABELS: Record<Region, string> = {
  AE: "the UAE",
  SA: "Saudi Arabia",
  KW: "Kuwait",
  QA: "Qatar",
  US: "the United States",
  SG: "Singapore",
  IN: "India",
};

export const REGION_FLAG_URLS: Record<Region, string> = {
  AE: "https://purecatamphetamine.github.io/country-flag-icons/3x2/AE.svg",
  SA: "https://purecatamphetamine.github.io/country-flag-icons/3x2/SA.svg",
  KW: "https://purecatamphetamine.github.io/country-flag-icons/3x2/KW.svg",
  QA: "https://purecatamphetamine.github.io/country-flag-icons/3x2/QA.svg",
  US: "https://purecatamphetamine.github.io/country-flag-icons/3x2/US.svg",
  SG: "https://purecatamphetamine.github.io/country-flag-icons/3x2/SG.svg",
  IN: "https://purecatamphetamine.github.io/country-flag-icons/3x2/IN.svg",
};

// ============================================================================
// Platform — 7 social platforms + "all" for Front Page rollup
// ============================================================================

export type Platform = "tiktok" | "instagram" | "youtube" | "linkedin" | "x" | "facebook" | "all";

export const PLATFORM_LABELS: Record<Platform, string> = {
  tiktok: "TikTok",
  instagram: "Instagram",
  youtube: "YouTube",
  linkedin: "LinkedIn",
  x: "X / Twitter",
  facebook: "Facebook",
  all: "All Platforms",
};

// ============================================================================
// Horizon — 9 production lag values
// ============================================================================

export type Horizon =
  | "same_day" | "24h" | "48h" | "72h"
  | "1w" | "2w" | "4w"
  | "6m" | "12m";

export const HORIZON_LABELS: Record<Horizon, string> = {
  same_day: "Same Day",
  "24h": "24 Hours",
  "48h": "48 Hours",
  "72h": "72 Hours",
  "1w": "1 Week",
  "2w": "2 Weeks",
  "4w": "4 Weeks",
  "6m": "6 Months",
  "12m": "12 Months",
};

export type Branch = "react_now" | "plan_ahead" | "analyse_history";

export function horizonToBranch(h: Horizon): Branch {
  switch (h) {
    case "same_day":
    case "24h":
    case "48h":
    case "72h":
      return "react_now";
    case "1w":
    case "2w":
    case "4w":
      return "plan_ahead";
    case "6m":
    case "12m":
      return "analyse_history";
  }
}

// ============================================================================
// Industry — 10 constrained values
// ============================================================================

export type Industry =
  | "real_estate" | "automotive" | "hospitality" | "food_beverage"
  | "fashion_beauty" | "fitness_wellness" | "ecommerce" | "education"
  | "healthcare" | "financial_services";

export const INDUSTRY_LABELS: Record<Industry, string> = {
  real_estate: "Real Estate",
  automotive: "Automotive",
  hospitality: "Hospitality",
  food_beverage: "Food & Beverage",
  fashion_beauty: "Fashion & Beauty",
  fitness_wellness: "Fitness & Wellness",
  ecommerce: "E-commerce",
  education: "Education",
  healthcare: "Healthcare",
  financial_services: "Finance",
};

// ============================================================================
// Audience — 5 constrained values
// ============================================================================

export type Audience = "gen_z" | "millennials" | "gen_x" | "boomers" | "all_ages";

export const AUDIENCE_LABELS: Record<Audience, string> = {
  gen_z: "Gen Z",
  millennials: "Millennials",
  gen_x: "Gen X",
  boomers: "Boomers",
  all_ages: "All Ages",
};

export const AUDIENCE_SUBTITLES: Record<Audience, string> = {
  gen_z: "18-24",
  millennials: "25-40",
  gen_x: "41-56",
  boomers: "57+",
  all_ages: "Broad",
};

// ============================================================================
// UserContext — describes who the user is and what they care about
// ============================================================================

export interface UserContext {
  /** Region code, e.g. "AE", "SG", "US", "IN" */
  region: Region;
  /** Platform scope. "all" covers the FRONT PAGE view. */
  platform: Platform;
  /** Time window for trend relevance. */
  horizon: Horizon;
  /** Industry vertical. Optional. */
  industry?: Industry;
  /** Audience segment. Optional. */
  audience?: Audience;
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
// PerformanceDNA — engagement-based user performance profile
// ============================================================================

export interface PerformanceField<T> {
  value: T;
  confidence: "high" | "medium" | "low" | "insufficient";
  basedOn: number;
}

export interface PerformanceDNA {
  optimalLength: PerformanceField<{ min: number; max: number; median: number }>;
  hookPatterns: PerformanceField<{ pattern: string; engagementLift: number }[]>;
  hashtagEffectiveness: PerformanceField<{ hashtag: string; effectivenessScore: number }[]>;
  timeOfDayCurves: PerformanceField<{ hour: number; dayOfWeek: number; avgEngagement: number }[]>;
  bestPerformingTopics: PerformanceField<{ topic: string; avgEngagement: number; postCount: number }[]>;
  audioContentFit: PerformanceField<{ trendingAudioLift: number; originalAudioLift: number }>;
  engagementQualityRatio: PerformanceField<{ commentToLikeRatio: number; shareToViewRatio: number }>;
  totalPostsAnalyzed: number;
  lastUpdated: string;
  platformsCovered: Platform[];
  rawPostsRetained: number;
}

export interface PerformancePost {
  postId: string;
  platform: Platform;
  publishedAt: string;
  caption: string;
  hashtags: string[];
  audioType: "trending" | "original" | "none" | "unknown";
  format: "video" | "image" | "carousel" | "text";
  views: number;
  likes: number;
  comments: number;
  shares: number;
  watchTime?: number;
  completionRate?: number;
  engagementRate: number;
  hookText: string;
  captionLength: number;
}

// ============================================================================
// Predictions — likely engagement ranges for concept cards
// See docs/DA-TEC-2026-008-prediction-math-decisions.md for rationale.
// ============================================================================

export type PredictionBasis = "baseline" | "user_history" | "blended" | "insufficient_data";

export type PredictionMetric = "views" | "engagement" | "reach";

export interface LikelyRange {
  /** 25th percentile — lower bound of "typical" range */
  p25: number;
  /** 50th percentile — most likely value */
  median: number;
  /** 75th percentile — upper bound of "typical" range */
  p75: number;
  metric: PredictionMetric;
  confidence: "high" | "medium" | "low";
  basis: PredictionBasis;
  /** One sentence explaining the data source */
  reasoning: string;
  /** Number of user's own posts used (0 if pure baseline) */
  basedOnUserPosts: number;
  /** Number of baseline posts used (0 if pure user_history) */
  basedOnBaselinePosts: number;
  /** 0.0 = pure user, 1.0 = pure baseline. UI can display this. */
  shrinkageWeight: number;
}

// ============================================================================
// Examples — one of each type, for copy-paste into tests
// ============================================================================

export const exampleUserContext: UserContext = {
  region: "AE",
  platform: "tiktok",
  horizon: "24h",
  industry: "real_estate",
  audience: "all_ages",
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
