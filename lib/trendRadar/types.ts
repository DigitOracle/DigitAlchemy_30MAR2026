// lib/trendRadar/types.ts — Trend Radar data model

export type TrendPlatform = "tiktok" | "instagram" | "youtube" | "linkedin" | "x" | "facebook"

export type TrendEntityType = "hashtag" | "song" | "creator" | "format" | "theme"

export type TrendScope = "platform_wide" | "topic_aligned"

export type SourceConfidence = "high" | "medium" | "low"

export type ConfidenceTier =
  | "tier_1_official"         // platform-native / official source
  | "tier_2_live_scraped"     // ScrapeCreators / Apify
  | "tier_3_context_enriched" // Perplexity / xpoz context signal
  | "tier_4_inferred"         // Claude fallback

export type TrendCause =
  | "calendar_event"
  | "creator_spillover"
  | "search_demand"
  | "cross_platform_migration"
  | "platform_feature_push"
  | "evergreen_topic"
  | "unknown"

export type StillWorthMaking = "yes" | "maybe" | "no"

export type TrendDirection = "rising" | "stable" | "peaking" | "fading" | "unclear"

export type ForecastConfidence = "high" | "medium" | "low"

export type RecommendedNextStep = "make_now" | "monitor" | "wait_for_confirmation" | "skip"

export type TrendOutlook = {
  direction: TrendDirection
  stillWorthMaking: StillWorthMaking
  forecastConfidence: ForecastConfidence
  publishWindowFit: ProductionLag | "poor_fit"
  rationale: string
  // Forecast-ready placeholders
  forecastModelUsed: string          // "rule_based_v1" for now
  futureForecastEligible: boolean    // true when historyDepth >= 10
  historyDepth: number               // number of snapshots for this entity
  recommendedNextStep: RecommendedNextStep
}

export type TrendClassification =
  | "breakout_candidate"
  | "stable_opportunity"
  | "fading_fast"
  | "recurring_pattern"
  | "niche_advantage"

export type ProductionLag = "same_day" | "24h" | "48h" | "72h" | "1w" | "2w" | "4w" | "6m" | "12m"

// ── Snapshot (raw capture) ──

export type TrendEntity = {
  entityType: TrendEntityType
  entity: string
  entityRaw: string
  rank: number | null
  providerRawRank: number | null
  providerScore: number | null
  metadata: Record<string, unknown>
  notes: string | null
}

export type TrendSnapshot = {
  id: string
  platform: TrendPlatform
  scope: TrendScope
  region: string
  capturedAt: string
  source: string
  sourceConfidence: SourceConfidence
  niche: string | null
  entityCount: number
  entities: TrendEntity[]
}

// ── Derived score ──

export type TrendScore = {
  id: string
  platform: TrendPlatform
  entity: string
  entityType: TrendEntityType
  niche: string | null

  // History
  firstSeen: string
  lastSeen: string
  seenCount: number
  snapshotsTotal: number
  rankHistory: (number | null)[]
  insufficientHistory: boolean

  // Derived metrics (0-100)
  velocity_6h: number
  velocity_24h: number
  velocity_72h: number
  acceleration: number
  persistence: number
  novelty: number
  decay_risk: number
  estimated_half_life_hours: number | null
  cross_platform_echo: number
  niche_fit: number

  // Confidence + trust
  confidenceTier: ConfidenceTier
  trendCause: TrendCause
  stillWorthMaking: StillWorthMaking
  whyStillMatters: string  // plain-English explanation

  // Production lag fitness
  production_lag_fit: Record<ProductionLag, number>

  // Classification
  classification: TrendClassification
  classificationConfidence: "high" | "low"

  // Trend Outlook (forecast-ready, rule-based v1)
  trendOutlook: TrendOutlook

  // External validation placeholders (for future Google Trends / Reddit)
  externalDemandScore: number | null
  externalValidationSource: string | null
  externalValidationStatus: "pending" | "validated" | "unvalidated" | null

  updatedAt: string
}

// ── API shapes ──

export type CaptureRequest = {
  platform: TrendPlatform
  scope: TrendScope
  niche?: string
}

export type CaptureResponse = {
  ok: boolean
  snapshotId: string
  entityCount: number
  source: string
}

export type ScoresRequest = {
  platform: TrendPlatform
  niche?: string
  productionLag?: ProductionLag
  limit?: number
}

export type ScoresResponse = {
  ok: boolean
  platform: TrendPlatform
  productionLag: ProductionLag
  insufficientHistory: boolean
  snapshotCount: number
  trends: TrendScore[]
}
