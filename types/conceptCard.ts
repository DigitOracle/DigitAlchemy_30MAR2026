/**
 * DigitAlchemy® Gazette — Canonical ConceptCard type
 *
 * Single unified card type that replaces the multiple ad-hoc card
 * vocabularies currently in production (Trend Ticker, Sounds of the
 * Moment, Stay in Your Lane, Follow the Trend, Global Curiosity Index).
 *
 * Phase 2.3d of DA-GAZETTE-UNIFICATION.
 *
 * Stories are explicitly excluded — they have 24-hour ephemeral lifecycles
 * and different metrics. If we ever recommend Stories, it'll be a separate type.
 */

import type { LikelyRange, PredictionMetric } from "@/types/gazette";
import type { Region, Industry } from "@/types/gazette";

// ============================================================================
// Platform × Format — discriminated union
// ============================================================================

export type ConceptCardFormat =
  | { platform: "instagram"; format: "reel" }
  | { platform: "instagram"; format: "feed_video" }
  | { platform: "instagram"; format: "image" }
  | { platform: "instagram"; format: "carousel" }
  | { platform: "tiktok"; format: "video" }
  | { platform: "youtube"; format: "short" }
  | { platform: "youtube"; format: "long" }
  | { platform: "linkedin"; format: "post" }
  | { platform: "linkedin"; format: "video" }
  | { platform: "linkedin"; format: "carousel" };

// ============================================================================
// ConceptCard — the canonical card type
// ============================================================================

export interface ConceptCard {
  /** Stable hash of source + content */
  id: string;
  platformFormat: ConceptCardFormat;
  /** Where the recommendation came from */
  source: "trend" | "style" | "blend";

  // Display
  title: string;
  hook: string;
  body: string;
  hashtags: string[];

  // Prediction (from Phase 2.3c)
  likelyRange: LikelyRange | null;

  // Provenance
  reasoning: string;
  confidence: "high" | "medium" | "low";
  basedOnTrendIds?: string[];
  basedOnUserPosts?: number;

  // Metadata
  createdAt: number;
  region: Region;
  industry?: Industry;
}
