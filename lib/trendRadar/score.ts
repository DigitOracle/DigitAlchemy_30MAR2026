// lib/trendRadar/score.ts — Rule-based scoring engine

import type { TrendSnapshot, TrendScore, TrendPlatform, TrendEntityType, ProductionLag, ConfidenceTier, TrendCause, StillWorthMaking, TrendOutlook, TrendDirection, ForecastConfidence, RecommendedNextStep } from "./types"

const MIN_SNAPSHOTS_FOR_CONFIDENCE = 5

// ── Source → confidence tier mapping ──
const SOURCE_TIERS: Record<string, ConfidenceTier> = {
  official_platform: "tier_1_official",
  scrape_creators_tiktok: "tier_2_live_scraped",
  scrape_creators_instagram_support: "tier_2_live_scraped",
  apify_live_scrape: "tier_2_live_scraped",
  xpoz_social_signal: "tier_3_context_enriched",
  perplexity: "tier_3_context_enriched",
  context_guided: "tier_3_context_enriched",
  claude: "tier_4_inferred",
  inferred_fallback: "tier_4_inferred",
}

// ── Metric functions ──

function velocity(rankHistory: (number | null)[], windowSize: number): number {
  const window = rankHistory.slice(-windowSize)
  const firstIdx = window.findIndex((r) => r !== null)
  const lastIdx = window.length - 1 - [...window].reverse().findIndex((r) => r !== null)
  if (firstIdx === -1 || lastIdx === -1 || firstIdx === lastIdx) return 0
  const first = window[firstIdx]!
  const last = window[lastIdx]!
  const delta = first - last
  const scale = Math.max(first, 10)
  return Math.max(-100, Math.min(100, Math.round(delta * (100 / scale))))
}

function acceleration(v6h: number, v24h: number): number { return v6h - v24h }

function persistence(seenCount: number, totalSnapshots: number): number {
  if (totalSnapshots === 0) return 0
  return Math.round((seenCount / totalSnapshots) * 100)
}

function novelty(firstSeenAt: string): number {
  const ageHours = (Date.now() - new Date(firstSeenAt).getTime()) / 3600000
  if (ageHours < 6) return 100
  if (ageHours < 24) return Math.round(100 - (ageHours - 6) * (40 / 18))
  if (ageHours < 72) return Math.round(60 - (ageHours - 24) * (50 / 48))
  return 10
}

function decayRisk(persist: number, v24h: number, nov: number): number {
  const base = 100 - persist
  const velocityPenalty = v24h < 0 ? Math.abs(v24h) * 0.5 : 0
  const noveltyPenalty = nov > 80 ? 20 : 0
  return Math.max(0, Math.min(100, Math.round(base + velocityPenalty + noveltyPenalty)))
}

function estimatedHalfLife(v24h: number): number | null {
  if (v24h >= 0) return null
  const decayRate = Math.abs(v24h) / 24
  if (decayRate < 0.1) return null
  return Math.round(50 / decayRate)
}

function productionLagFit(decay: number, persist: number, v24h: number): Record<ProductionLag, number> {
  return {
    same_day: Math.max(0, Math.round(100 - decay * 0.3)),
    "24h": Math.max(0, Math.round(100 - decay * 0.6 - (persist < 50 ? 20 : 0))),
    "48h": Math.max(0, Math.round(100 - decay * 0.9 - (v24h < -20 ? 30 : 0))),
    "72h": Math.max(0, Math.round(persist - decay * 0.5)),
    "1w": Math.max(0, Math.round(persist * 0.8 - decay * 0.7)),
    "2w": Math.max(0, Math.round(persist * 0.6 - decay * 0.9 - (v24h < 0 ? 30 : 0))),
    "4w": Math.max(0, Math.round(persist * 0.5 - decay - (v24h < -10 ? 40 : 0))),
    "6m": Math.max(0, Math.round(persist * 0.3)),
    "12m": Math.max(0, Math.round(persist * 0.2)),
  }
}

// ── Cross-platform echo ──
// Counts how many distinct sources/platforms contributed data for this entity

function computeCrossPlatformEcho(
  entity: string,
  allSnapshots: TrendSnapshot[]
): number {
  const sourcesWithEntity = new Set<string>()
  const platformsWithEntity = new Set<string>()

  for (const snap of allSnapshots) {
    for (const e of snap.entities) {
      if (e.entity === entity) {
        sourcesWithEntity.add(snap.source)
        platformsWithEntity.add(snap.platform)
      }
    }
  }

  const sourceCount = sourcesWithEntity.size
  const platformCount = platformsWithEntity.size

  if (platformCount >= 3) return 100
  if (platformCount >= 2) return 75
  if (sourceCount >= 3) return 50
  if (sourceCount >= 2) return 25
  return 0
}

// ── Confidence tier ──

function resolveConfidenceTier(sources: Set<string>): ConfidenceTier {
  // Best source wins
  for (const s of sources) {
    const tier = SOURCE_TIERS[s]
    if (tier === "tier_1_official") return "tier_1_official"
  }
  for (const s of sources) {
    const tier = SOURCE_TIERS[s]
    if (tier === "tier_2_live_scraped") return "tier_2_live_scraped"
  }
  for (const s of sources) {
    const tier = SOURCE_TIERS[s]
    if (tier === "tier_3_context_enriched") return "tier_3_context_enriched"
  }
  return "tier_4_inferred"
}

// ── Trend cause inference (rule-based) ──

const CALENDAR_KEYWORDS = [
  "christmas", "easter", "halloween", "valentine", "newyear", "thanksgiving",
  "ramadan", "eid", "diwali", "holyweek", "semanasanta", "mothersday", "fathersday",
  "backtoschool", "summer", "spring", "winter", "fall", "autumn", "holiday",
  "4thofjuly", "independenceday", "memorialday", "laborday", "blackfriday",
]
const EVERGREEN_KEYWORDS = [
  "howto", "tutorial", "tips", "hack", "diy", "recipe", "workout", "fitness",
  "motivation", "study", "learn", "education", "health", "wellness",
]

function inferTrendCause(entity: string, entityType: TrendEntityType, persist: number, nov: number, echo: number): TrendCause {
  const lower = entity.toLowerCase()

  // Calendar event: entity matches seasonal/holiday keywords
  if (CALENDAR_KEYWORDS.some((k) => lower.includes(k))) return "calendar_event"

  // Evergreen: high persistence, low novelty, matches evergreen keywords
  if (persist > 70 && nov < 30 && EVERGREEN_KEYWORDS.some((k) => lower.includes(k))) return "evergreen_topic"

  // Cross-platform migration: high echo score
  if (echo >= 75) return "cross_platform_migration"

  // Creator spillover: creator type entity or high novelty + rapid spread
  if (entityType === "creator") return "creator_spillover"
  if (nov > 80 && persist < 30) return "creator_spillover"

  // Platform feature push: format-type entities with high persistence
  if (entityType === "format" && persist > 50) return "platform_feature_push"

  return "unknown"
}

// ── Still worth making ──

function computeStillWorthMaking(
  lagFit: Record<ProductionLag, number>,
  lag: ProductionLag,
  decay: number,
  persist: number,
  tier: ConfidenceTier,
  echo: number
): StillWorthMaking {
  const fitness = lagFit[lag] ?? 0

  // Strong yes: high fitness + low decay + good confidence
  if (fitness >= 60 && decay <= 40 && (tier === "tier_1_official" || tier === "tier_2_live_scraped")) return "yes"
  if (fitness >= 70 && decay <= 30) return "yes"

  // Clear no: very low fitness or rapid fading
  if (fitness < 25 || decay > 80) return "no"

  // Boost for echo / persistence
  if (fitness >= 50 && (echo >= 50 || persist >= 60)) return "yes"

  return "maybe"
}

// ── Plain-English explanation ──

function generateWhyStillMatters(
  entity: string,
  classification: string,
  tier: ConfidenceTier,
  cause: TrendCause,
  echo: number,
  worth: StillWorthMaking,
  lagFit: number,
  decay: number,
  persist: number,
  lag: ProductionLag
): string {
  const parts: string[] = []

  // Confidence
  if (tier === "tier_1_official" || tier === "tier_2_live_scraped") {
    parts.push("Confirmed trending from live platform data.")
  } else if (tier === "tier_3_context_enriched") {
    parts.push("Identified via web search signals, not direct platform scraping.")
  } else {
    parts.push("AI-estimated trend \u2014 not yet confirmed by live data.")
  }

  // Cause
  const causeLabels: Record<TrendCause, string> = {
    calendar_event: "Likely tied to a seasonal or calendar event.",
    creator_spillover: "Appears to be driven by a specific creator or viral moment.",
    cross_platform_migration: "Showing up across multiple platforms.",
    platform_feature_push: "May be boosted by platform algorithm or feature.",
    evergreen_topic: "Recurring topic with steady interest over time.",
    search_demand: "Appears to match active search demand.",
    unknown: "",
  }
  if (causeLabels[cause]) parts.push(causeLabels[cause])

  // Echo
  if (echo >= 75) parts.push("Strong presence across multiple sources.")
  else if (echo >= 50) parts.push("Showing up in more than one data source.")

  // Verdict
  const lagLabels: Record<string, string> = { same_day: "today", "24h": "within 24 hours", "48h": "within 48 hours", "72h": "within 72 hours", "1w": "within 1 week", "2w": "within 2 weeks", "4w": "within 4 weeks" }
  const lagLabel = lagLabels[lag] ?? `within ${lag}`
  if (worth === "yes") {
    parts.push(`Good to create content around this ${lagLabel}.`)
  } else if (worth === "maybe") {
    parts.push(`Could still work if you publish ${lagLabel}, but signals are mixed.`)
  } else {
    if (decay > 70) parts.push(`This is fading quickly \u2014 likely too late for ${lagLabel} production.`)
    else parts.push(`Low confidence that this will still matter by publish time.`)
  }

  return parts.filter(Boolean).join(" ")
}

// ── Trend Outlook (forecast-ready, rule-based v1) ──

function computeDirection(v24h: number, accel: number, decay: number, nov: number, persist: number, insufficient: boolean): TrendDirection {
  if (insufficient) return "unclear"

  // Rising: positive velocity, not decelerating, low decay
  if (v24h > 20 && accel >= 0 && decay < 50) return "rising"

  // Peaking: still positive velocity but decelerating — the turn
  if (v24h > 5 && accel < -5 && nov > 50) return "peaking"

  // Fading: negative velocity, accelerating downward
  if (v24h < -20 && accel < -10 && decay > 60) return "fading"

  // Stable: persistent, low movement either way
  if (persist > 50 && Math.abs(v24h) < 15 && decay < 50) return "stable"

  // Fading (softer check)
  if (v24h < -10 && decay > 50) return "fading"

  return "unclear"
}

function computeForecastConfidence(
  insufficient: boolean,
  tier: ConfidenceTier,
  echo: number,
  seenCount: number
): ForecastConfidence {
  if (insufficient || seenCount < 2) return "low"

  let score = 0
  if (tier === "tier_1_official" || tier === "tier_2_live_scraped") score += 2
  else if (tier === "tier_3_context_enriched") score += 1

  if (echo >= 50) score += 1
  if (seenCount >= 5) score += 1
  if (seenCount >= 10) score += 1

  if (score >= 4) return "high"
  if (score >= 2) return "medium"
  return "low"
}

function computePublishWindowFit(
  lagFit: Record<ProductionLag, number>,
  selectedLag: ProductionLag
): ProductionLag | "poor_fit" {
  // Check if selected lag works
  if ((lagFit[selectedLag] ?? 0) >= 50) return selectedLag

  // Find best available window
  const ordered: ProductionLag[] = ["same_day", "24h", "48h", "72h", "1w", "2w", "4w", "6m", "12m"]
  for (const l of ordered) {
    if ((lagFit[l] ?? 0) >= 50) return l
  }
  return "poor_fit"
}

function computeNextStep(
  direction: TrendDirection,
  worth: StillWorthMaking,
  confidence: ForecastConfidence
): RecommendedNextStep {
  if (worth === "no" || direction === "fading") return "skip"
  if (worth === "yes" && (direction === "rising" || direction === "stable")) return "make_now"
  if (confidence === "low") return "wait_for_confirmation"
  return "monitor"
}

function generateOutlookRationale(
  entity: string,
  direction: TrendDirection,
  worth: StillWorthMaking,
  confidence: ForecastConfidence,
  bestWindow: ProductionLag | "poor_fit",
  decay: number,
  persist: number,
  tier: ConfidenceTier,
  selectedLag: ProductionLag
): string {
  const lagDisplayLabels: Record<string, string> = { same_day: "same-day", "24h": "24-hour", "48h": "48-hour", "72h": "72-hour", "1w": "1-week", "2w": "2-week", "4w": "4-week", "6m": "6-month", "12m": "12-month" }
  const lagLabel = lagDisplayLabels[selectedLag] ?? selectedLag

  // Direction-specific opening
  const directionPhrases: Record<TrendDirection, string> = {
    rising: "This trend is actively picking up speed right now.",
    stable: "This looks like a steady trend rather than a flash spike.",
    peaking: "This trend appears to be at or near its peak.",
    fading: "This trend is losing momentum.",
    unclear: "Not enough data yet to read the direction clearly.",
  }
  let rationale = directionPhrases[direction]

  // Durability
  if (direction === "stable" && persist > 60) {
    rationale += ` It\u2019s been showing up consistently, which suggests staying power.`
  } else if (direction === "rising" && decay < 30) {
    rationale += ` Low decay risk means it\u2019s likely to hold for a while.`
  } else if (direction === "peaking") {
    rationale += ` It could start dropping soon \u2014 best for fast turnaround content.`
  }

  // Window fit
  if (bestWindow === "poor_fit") {
    rationale += ` Unfortunately, it\u2019s unlikely to still be relevant by the time ${lagLabel} content is ready.`
  } else if (bestWindow === selectedLag) {
    rationale += ` It fits well with your ${lagLabel} production timeline.`
  } else {
    const betterLabel = lagDisplayLabels[bestWindow] ?? bestWindow
    rationale += ` Better suited for ${betterLabel} production than ${lagLabel}.`
  }

  // Confidence caveat
  if (confidence === "low") {
    rationale += " Note: this assessment is based on limited data \u2014 check back after more captures for a stronger signal."
  } else if (tier === "tier_3_context_enriched" || tier === "tier_4_inferred") {
    rationale += " This signal comes from web search context, not direct platform scraping, so treat it as directional."
  }

  return rationale
}

function computeTrendOutlook(
  v24h: number,
  accel: number,
  decay: number,
  nov: number,
  persist: number,
  insufficient: boolean,
  tier: ConfidenceTier,
  echo: number,
  seenCount: number,
  worth: StillWorthMaking,
  lagFit: Record<ProductionLag, number>,
  selectedLag: ProductionLag,
  entity: string
): TrendOutlook {
  const direction = computeDirection(v24h, accel, decay, nov, persist, insufficient)
  const forecastConfidence = computeForecastConfidence(insufficient, tier, echo, seenCount)
  const publishWindowFit = computePublishWindowFit(lagFit, selectedLag)
  const recommendedNextStep = computeNextStep(direction, worth, forecastConfidence)
  const rationale = generateOutlookRationale(entity, direction, worth, forecastConfidence, publishWindowFit, decay, persist, tier, selectedLag)

  return {
    direction,
    stillWorthMaking: worth,
    forecastConfidence,
    publishWindowFit,
    rationale,
    forecastModelUsed: "rule_based_v1",
    futureForecastEligible: seenCount >= 10,
    historyDepth: seenCount,
    recommendedNextStep,
  }
}

// ── Main scoring function ──

export function computeScores(
  snapshots: TrendSnapshot[],
  platform: TrendPlatform,
  niche: string | null,
  nicheFitKeywords: string[] = [],
  productionLag: ProductionLag = "same_day"
): TrendScore[] {
  if (snapshots.length === 0) return []

  const now = new Date().toISOString()
  const totalSnapshots = snapshots.length
  const insufficientHistory = totalSnapshots < MIN_SNAPSHOTS_FOR_CONFIDENCE

  const sorted = [...snapshots].sort((a, b) => a.capturedAt.localeCompare(b.capturedAt))

  // Build per-entity history
  type EntityAccum = {
    entityType: TrendEntityType
    firstSeen: string
    lastSeen: string
    seenCount: number
    rankHistory: (number | null)[]
    bestProviderScore: number | null
    niche: string | null
    sources: Set<string>
  }

  const entityMap = new Map<string, EntityAccum>()

  for (const snap of sorted) {
    const presentInSnap = new Set<string>()

    for (const e of snap.entities) {
      presentInSnap.add(e.entity)
      let accum = entityMap.get(e.entity)
      if (!accum) {
        accum = {
          entityType: e.entityType,
          firstSeen: snap.capturedAt,
          lastSeen: snap.capturedAt,
          seenCount: 0,
          rankHistory: [],
          bestProviderScore: null,
          niche: snap.niche,
          sources: new Set(),
        }
        const priorCount = sorted.indexOf(snap)
        for (let i = 0; i < priorCount; i++) accum.rankHistory.push(null)
        entityMap.set(e.entity, accum)
      }
      accum.seenCount++
      accum.lastSeen = snap.capturedAt
      accum.rankHistory.push(e.rank)
      accum.sources.add(snap.source)
      if (e.providerScore !== null && (accum.bestProviderScore === null || e.providerScore > accum.bestProviderScore)) {
        accum.bestProviderScore = e.providerScore
      }
    }

    for (const [, accum] of entityMap) {
      if (accum.rankHistory.length < sorted.indexOf(snap) + 1) {
        accum.rankHistory.push(null)
      }
    }
  }

  for (const accum of entityMap.values()) {
    while (accum.rankHistory.length < totalSnapshots) accum.rankHistory.push(null)
  }

  // Compute scores
  const scores: TrendScore[] = []
  const nicheSet = new Set(nicheFitKeywords.map((k) => k.toLowerCase()))

  for (const [entity, accum] of entityMap) {
    const v6h = velocity(accum.rankHistory, 2)
    const v24h = velocity(accum.rankHistory, 6)
    const v72h = velocity(accum.rankHistory, 18)
    const accel = acceleration(v6h, v24h)
    const persist = persistence(accum.seenCount, totalSnapshots)
    const nov = novelty(accum.firstSeen)
    const decay = decayRisk(persist, v24h, nov)
    const halfLife = estimatedHalfLife(v24h)
    const lagFit = productionLagFit(decay, persist, v24h)
    const echo = computeCrossPlatformEcho(entity, snapshots)
    const tier = resolveConfidenceTier(accum.sources)
    const cause = inferTrendCause(entity, accum.entityType, persist, nov, echo)

    const nicheFit = nicheSet.size > 0
      ? (nicheSet.has(entity) || [...nicheSet].some((k) => entity.includes(k)) ? 80 : 20)
      : 50

    const worth = computeStillWorthMaking(lagFit, productionLag, decay, persist, tier, echo)
    const whyStillMatters = generateWhyStillMatters(entity, "stable_opportunity", tier, cause, echo, worth, lagFit[productionLag] ?? 0, decay, persist, productionLag)
    const outlook = computeTrendOutlook(v24h, accel, decay, nov, persist, insufficientHistory, tier, echo, accum.seenCount, worth, lagFit, productionLag, entity)

    const score: TrendScore = {
      id: `score-${platform}-${Buffer.from(entity).toString("base64url").slice(0, 20)}`,
      platform,
      entity,
      entityType: accum.entityType,
      niche: accum.niche,
      firstSeen: accum.firstSeen,
      lastSeen: accum.lastSeen,
      seenCount: accum.seenCount,
      snapshotsTotal: totalSnapshots,
      rankHistory: accum.rankHistory.slice(-20),
      insufficientHistory,
      velocity_6h: v6h,
      velocity_24h: v24h,
      velocity_72h: v72h,
      acceleration: accel,
      persistence: persist,
      novelty: nov,
      decay_risk: decay,
      estimated_half_life_hours: halfLife,
      cross_platform_echo: echo,
      niche_fit: nicheFit,
      confidenceTier: tier,
      trendCause: cause,
      stillWorthMaking: worth,
      whyStillMatters,
      production_lag_fit: lagFit,
      trendOutlook: outlook,
      classification: "stable_opportunity",
      classificationConfidence: insufficientHistory ? "low" : "high",
      externalDemandScore: null,
      externalValidationSource: null,
      externalValidationStatus: null,
      updatedAt: now,
    }

    scores.push(score)
  }

  return scores
}
