/**
 * DigitAlchemy® Gazette — ConceptCard generator
 *
 * Orchestrates adapters, predictions, and Claude enrichment to produce
 * ConceptCard[] from real inputs. Runs alongside existing card flows.
 *
 * Phase 2.3f of DA-GAZETTE-UNIFICATION.
 */

import type { ConceptCard } from "@/types/conceptCard";
import type {
  Region,
  Industry,
  Platform,
  PerformanceDNA,
  PerformancePost,
  LikelyRange,
} from "@/types/gazette";
import type { ContentProfile } from "@/lib/firestore/contentProfile";
import type { ScoredTrend } from "@/lib/gazette/trends";
import type { Audience, Horizon } from "@/types/gazette";
import {
  adaptFollowTheTrendToConceptCard,
  adaptStayInYourLaneToConceptCard,
  adaptScoredTrendToConceptCard,
  type RecPost,
} from "@/lib/gazette/adapters";
import { industryRelevance } from "@/lib/gazette/industryLexicon";
import { audienceRelevance } from "@/lib/gazette/audienceLexicon";

// ============================================================================
// Dependencies — injected for testability
// ============================================================================

export interface CardGeneratorDeps {
  /** Predict engagement range for a card. Returns null on failure. */
  predict: (input: {
    platform: Platform;
    region: Region;
    industry?: Industry;
    niche?: string;
    performanceDNA: PerformanceDNA | null;
    recentPosts: PerformancePost[];
    baselinePosts: PerformancePost[];
  }) => LikelyRange | null;

  /** Enrich a skeleton card with Claude-generated hook and body. Returns null on failure. */
  enrichWithClaude: (input: {
    trendEntity: string;
    trendType: string;
    platform: string;
    region: string;
    industry?: string;
    contentDNA: ContentProfile | null;
  }) => Promise<{ hook: string; body: string } | null>;
}

// ============================================================================
// Input type
// ============================================================================

export interface GenerateConceptCardsInput {
  uid: string;
  region: Region;
  platform: Platform;
  industry?: Industry;
  horizon?: Horizon;
  audience?: Audience[];
  contentDNA: ContentProfile | null;
  performanceDNA: PerformanceDNA | null;
  recentPosts: PerformancePost[];
  baselinePosts: PerformancePost[];
  scoredTrends: ScoredTrend[];
  recPosts?: {
    followTrend: RecPost[];
    stayInLane: RecPost[];
  };
}

// ============================================================================
// Sort helpers
// ============================================================================

const CONFIDENCE_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 };
const SOURCE_ORDER: Record<string, number> = { blend: 0, style: 1, trend: 2 };

function sortCards(cards: ConceptCard[]): ConceptCard[] {
  return [...cards].sort((a, b) => {
    const confDiff = (CONFIDENCE_ORDER[a.confidence] ?? 2) - (CONFIDENCE_ORDER[b.confidence] ?? 2);
    if (confDiff !== 0) return confDiff;
    return (SOURCE_ORDER[a.source] ?? 2) - (SOURCE_ORDER[b.source] ?? 2);
  });
}

// ============================================================================
// Main generator
// ============================================================================

const MAX_ENRICHMENTS = 8;

export async function generateConceptCards(
  input: GenerateConceptCardsInput,
  deps: CardGeneratorDeps,
): Promise<ConceptCard[]> {
  console.log("[generator] inputs", { scoredTrendsCount: input.scoredTrends?.length ?? 0, followTrendCount: input.recPosts?.followTrend?.length ?? "missing", stayInLaneCount: input.recPosts?.stayInLane?.length ?? "missing", platform: input.platform, region: input.region });

  const cards: ConceptCard[] = [];
  const ctx = {
    region: input.region,
    platform: input.platform,
    industry: input.industry,
  };

  // ── 1. Adapt Follow the Trend cards ──
  if (input.recPosts?.followTrend) {
    for (const rec of input.recPosts.followTrend) {
      const card = adaptFollowTheTrendToConceptCard(rec, ctx);
      cards.push(card);
    }
  }

  // ── 2. Adapt Stay in Your Lane cards ──
  if (input.recPosts?.stayInLane) {
    const userPostCount = input.performanceDNA?.totalPostsAnalyzed ?? 0;
    for (const rec of input.recPosts.stayInLane) {
      const card = adaptStayInYourLaneToConceptCard(rec, ctx, userPostCount);
      cards.push(card);
    }
  }

  // ── 3. Adapt ScoredTrend cards (skeletons) — pre-filter low-signal trends ──
  const signalTrends = input.scoredTrends.filter((t) => !(t.velocity <= 0 && t.novelty <= 10));
  const skeletonCards: ConceptCard[] = [];
  for (const trend of signalTrends) {
    const card = adaptScoredTrendToConceptCard(trend, ctx);
    if (card) {
      cards.push(card);
      if (!card.hook && !card.body) skeletonCards.push(card);
    }
  }

  console.log("[generator] adapter results", { totalCards: cards.length, skeletonCount: skeletonCards.length, sources: cards.map(c => c.source) });

  // ── 4. Populate likelyRange via prediction module ──
  for (const card of cards) {
    try {
      const range = deps.predict({
        platform: card.platformFormat.platform as Platform,
        region: input.region,
        industry: input.industry,
        performanceDNA: input.performanceDNA,
        recentPosts: input.recentPosts,
        baselinePosts: input.baselinePosts,
      });
      card.likelyRange = range;
    } catch {
      // Prediction failed for this card — leave likelyRange as null
      card.likelyRange = null;
    }
  }

  // ── 5. Enrich skeleton cards with Claude (capped at MAX_ENRICHMENTS) ──
  const toEnrich = skeletonCards.slice(0, MAX_ENRICHMENTS);
  const enrichResults = await Promise.allSettled(
    toEnrich.map((card) =>
      deps.enrichWithClaude({
        trendEntity: card.title,
        trendType: card.platformFormat.format,
        platform: card.platformFormat.platform,
        region: input.region,
        industry: input.industry,
        contentDNA: input.contentDNA,
      }),
    ),
  );

  for (let i = 0; i < toEnrich.length; i++) {
    const result = enrichResults[i];
    if (result.status === "fulfilled" && result.value) {
      toEnrich[i].hook = result.value.hook;
      toEnrich[i].body = result.value.body;
    } else {
      // Claude failed for this card — use placeholder and mark low confidence
      toEnrich[i].hook = toEnrich[i].title;
      toEnrich[i].body = "Content suggestion based on trending data. Tap to customise.";
      toEnrich[i].confidence = "low";
    }
  }

  // Mark un-enriched skeletons beyond the cap
  for (const card of skeletonCards.slice(MAX_ENRICHMENTS)) {
    card.hook = card.title;
    card.body = "Content suggestion based on trending data.";
    card.confidence = "low";
  }

  // ── 6. Quality filter — drop noise cards ──
  const beforeFilter = cards.length;
  let countPlaceholder = 0;

  let countNoEnrichment = 0;
  const filtered = cards.filter((card) => {
    // Drop cards with generic placeholder body text (failed or boilerplate Claude enrichment)
    const bodyText = card.body || "";
    if (bodyText.startsWith("Content suggestion based on trending data") || bodyText.length < 10) {
      countPlaceholder++;
      return false;
    }

    // Drop cards with no hook and no body (enrichment returned null/undefined)
    if (!card.hook && !card.body) { countNoEnrichment++; return false; }

    return true;
  });

  const droppedNoSignal = input.scoredTrends.length - signalTrends.length;
  console.log("[generator] quality filter", { beforeFilter, droppedNoSignal, droppedPlaceholderBody: countPlaceholder, droppedNoEnrichment: countNoEnrichment, afterFilter: filtered.length });

  // ── 7. Re-rank by industry + audience signals ──
  const industry = input.industry;
  const audiences = (input.audience ?? []) as Audience[];
  const rankScores = new Map<string, number>();

  for (const card of filtered) {
    const cardText = `${card.title} ${card.hook} ${card.body} ${card.hashtags.join(" ")}`.toLowerCase();

    const indRel = industry ? industryRelevance(cardText, industry) : 0;
    const audRel = audienceRelevance(cardText, audiences);

    const indBoost = indRel > 0.05 ? 2.0 : 1.0;
    const audBoost = audRel > 0.05 ? 1.3 : 1.0;

    const confScore = card.confidence === "high" ? 3 : card.confidence === "medium" ? 2 : 1;
    const srcScore = card.source === "blend" ? 0.3 : card.source === "style" ? 0.2 : 0.1;
    const rankingScore = (confScore + srcScore) * indBoost * audBoost;

    rankScores.set(card.id, rankingScore);
  }

  // Sort by ranking score descending
  filtered.sort((a, b) => (rankScores.get(b.id) ?? 0) - (rankScores.get(a.id) ?? 0));

  const industryMatched = industry ? filtered.filter(c => industryRelevance(`${c.title} ${c.hook} ${c.body} ${c.hashtags.join(" ")}`.toLowerCase(), industry) > 0.05).length : 0;
  const audienceMatched = audiences.length > 0 ? filtered.filter(c => audienceRelevance(`${c.title} ${c.hook} ${c.body} ${c.hashtags.join(" ")}`.toLowerCase(), audiences) > 0.05).length : 0;
  console.log("[generator] ranking signals", { industry: industry || "none", audience: audiences, totalTrends: filtered.length, industryMatched, audienceMatched, topScore: rankScores.get(filtered[0]?.id) });

  return filtered;
}
