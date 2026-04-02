// lib/trendRadar/classify.ts — Maps scores → classifications

import type { TrendScore, TrendClassification, ProductionLag } from "./types"

/** Classify a single trend based on its computed scores */
export function classify(score: TrendScore): TrendClassification {
  const { novelty, velocity_24h, acceleration, persistence, decay_risk, niche_fit } = score

  // Breakout: new + fast-rising + accelerating
  if (novelty > 60 && velocity_24h > 30 && acceleration > 10) {
    return "breakout_candidate"
  }

  // Fading: velocity negative and accelerating downward
  if (velocity_24h < -20 && acceleration < -10 && decay_risk > 60) {
    return "fading_fast"
  }

  // Recurring: high persistence, moderate velocity (keeps showing up)
  if (persistence > 70 && Math.abs(velocity_24h) < 15) {
    return "recurring_pattern"
  }

  // Niche advantage: strong niche fit and not fading
  if (niche_fit > 70 && decay_risk < 50) {
    return "niche_advantage"
  }

  // Stable: persistent, not spiking, not fading
  if (persistence > 40 && decay_risk < 50) {
    return "stable_opportunity"
  }

  // Fallback
  return decay_risk > 60 ? "fading_fast" : "stable_opportunity"
}

/** Classify all scores in place and sort by relevance */
export function classifyAndSort(
  scores: TrendScore[],
  productionLag: ProductionLag = "same_day"
): TrendScore[] {
  for (const s of scores) {
    s.classification = classify(s)
  }

  // Sort: breakout first, then by production_lag_fit for chosen lag, then by persistence
  const lagKey = productionLag
  scores.sort((a, b) => {
    const classOrder: Record<TrendClassification, number> = {
      breakout_candidate: 0,
      niche_advantage: 1,
      stable_opportunity: 2,
      recurring_pattern: 3,
      fading_fast: 4,
    }
    const classDiff = classOrder[a.classification] - classOrder[b.classification]
    if (classDiff !== 0) return classDiff

    // Within same class, sort by lag fitness desc
    const lagDiff = (b.production_lag_fit[lagKey] ?? 0) - (a.production_lag_fit[lagKey] ?? 0)
    if (lagDiff !== 0) return lagDiff

    // Tiebreak by persistence
    return b.persistence - a.persistence
  })

  return scores
}

/** Filter to trends that are "safe to produce" given a production lag */
export function filterSafeToProduceNow(
  scores: TrendScore[],
  productionLag: ProductionLag,
  minFitness = 50
): TrendScore[] {
  return scores.filter((s) => {
    const fitness = s.production_lag_fit[productionLag] ?? 0
    return fitness >= minFitness && s.classification !== "fading_fast"
  })
}

/** Filter to trends that are "too late" given a production lag */
export function filterTooLate(
  scores: TrendScore[],
  productionLag: ProductionLag,
  maxFitness = 30
): TrendScore[] {
  return scores.filter((s) => {
    const fitness = s.production_lag_fit[productionLag] ?? 0
    return fitness <= maxFitness || s.classification === "fading_fast"
  })
}
