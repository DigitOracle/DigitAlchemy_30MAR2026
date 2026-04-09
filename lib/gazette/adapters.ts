/**
 * DigitAlchemy® Gazette — Adapters from existing vocabularies to ConceptCard
 *
 * Pure functions that convert existing card types into the canonical
 * ConceptCard format. No I/O, no Firestore, no API calls.
 *
 * Phase 2.3e of DA-GAZETTE-UNIFICATION.
 *
 * Adapted vocabularies:
 *   - RecPost (Follow the Trend + Stay in Your Lane from /api/post-recommendations)
 *   - ScoredTrend (from lib/gazette/trends.ts / Phase 2.2)
 *
 * Excluded vocabularies:
 *   - TrendingSound: audio metadata, not a content recommendation
 *   - WikiItem / GdeltItem / YoutubeItem: headlines / external content
 *   - Trend Ticker hashtags: signals, not cards
 *   - YouTube column: external creator content
 */

import type { ConceptCard, ConceptCardFormat } from "@/types/conceptCard";
import type { Region, Industry, Platform, LikelyRange } from "@/types/gazette";
import type { ScoredTrend } from "@/lib/gazette/trends";

// ============================================================================
// Shared types
// ============================================================================

/** The RecPost shape from /api/post-recommendations and MorningBriefing.tsx */
export interface RecPost {
  topic: string;
  caption: string;
  hashtags: string;
  audio: string;
  best_time: string;
  format: string;
}

export interface AdapterContext {
  region: Region;
  platform: Platform;
  industry?: Industry;
  likelyRange?: LikelyRange | null;
}

// ============================================================================
// Helpers
// ============================================================================

/** Simple stable hash for card IDs. */
function stableId(source: string, platform: string, title: string): string {
  let hash = 0;
  const str = `${source}:${platform}:${title}`;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return `cc_${Math.abs(hash).toString(36)}`;
}

/** Map a free-form format string to the discriminated union. */
function inferPlatformFormat(platform: Platform, formatHint: string): ConceptCardFormat {
  const hint = formatHint.toLowerCase();

  if (platform === "tiktok") return { platform: "tiktok", format: "video" };

  if (platform === "youtube") {
    if (hint.includes("short")) return { platform: "youtube", format: "short" };
    return { platform: "youtube", format: "short" };
  }

  if (platform === "linkedin") {
    if (hint.includes("video")) return { platform: "linkedin", format: "video" };
    if (hint.includes("carousel")) return { platform: "linkedin", format: "carousel" };
    return { platform: "linkedin", format: "post" };
  }

  // Instagram default
  if (platform === "instagram" || platform === "all") {
    if (hint.includes("reel")) return { platform: "instagram", format: "reel" };
    if (hint.includes("carousel")) return { platform: "instagram", format: "carousel" };
    if (hint.includes("image") || hint.includes("photo")) return { platform: "instagram", format: "image" };
    return { platform: "instagram", format: "reel" };
  }

  // Fallback for x, facebook, etc. — map to closest available format
  return { platform: "tiktok", format: "video" };
}

function parseHashtags(hashtagString: string): string[] {
  return hashtagString
    .split(/\s+/)
    .map((h) => h.trim())
    .filter((h) => h.length > 0)
    .map((h) => (h.startsWith("#") ? h : `#${h}`));
}

// ============================================================================
// 1. Follow the Trend → ConceptCard (generic recommendations)
// ============================================================================

export function adaptFollowTheTrendToConceptCard(
  rec: RecPost,
  ctx: AdapterContext,
): ConceptCard {
  const platformFormat = inferPlatformFormat(ctx.platform, rec.format || "");
  return {
    id: stableId("trend", platformFormat.platform, rec.topic),
    platformFormat,
    source: "trend",
    title: rec.topic,
    hook: rec.caption.slice(0, 80),
    body: rec.caption,
    hashtags: parseHashtags(rec.hashtags),
    likelyRange: ctx.likelyRange ?? null,
    reasoning: `Trending on ${platformFormat.platform} in ${ctx.region} right now`,
    confidence: "medium",
    basedOnTrendIds: [],
    basedOnUserPosts: 0,
    createdAt: Date.now(),
    region: ctx.region,
    industry: ctx.industry,
  };
}

// ============================================================================
// 2. Stay in Your Lane → ConceptCard (personalised recommendations)
// ============================================================================

export function adaptStayInYourLaneToConceptCard(
  rec: RecPost,
  ctx: AdapterContext,
  userPostCount: number,
): ConceptCard {
  const platformFormat = inferPlatformFormat(ctx.platform, rec.format || "");
  const conf = userPostCount >= 15 ? "high" : userPostCount >= 6 ? "medium" : "low";

  return {
    id: stableId("style", platformFormat.platform, rec.topic),
    platformFormat,
    source: "style",
    title: rec.topic,
    hook: rec.caption.slice(0, 80),
    body: rec.caption,
    hashtags: parseHashtags(rec.hashtags),
    likelyRange: ctx.likelyRange ?? null,
    reasoning: `Personalised to your content style (${userPostCount} posts analysed)`,
    confidence: conf,
    basedOnTrendIds: [],
    basedOnUserPosts: userPostCount,
    createdAt: Date.now(),
    region: ctx.region,
    industry: ctx.industry,
  };
}

// ============================================================================
// 3. ScoredTrend → ConceptCard (trend signal skeleton)
// ============================================================================

export function adaptScoredTrendToConceptCard(
  trend: ScoredTrend,
  ctx: AdapterContext,
): ConceptCard | null {
  // Skip trends with very low composite (noise)
  if (trend.composite < 10) return null;

  const platform = trend.platform as Platform;
  const platformFormat = inferPlatformFormat(platform, "video");

  const conf = trend.forecast.confidence >= 0.7 ? "high"
    : trend.forecast.confidence >= 0.4 ? "medium"
    : "low";

  const entityLabel = trend.entityType === "song"
    ? `Trending sound: ${trend.entity}`
    : trend.entityType === "hashtag"
      ? `Trending: #${trend.entity.replace(/^#/, "")}`
      : `Trending: ${trend.entity}`;

  return {
    id: stableId("trend", platform, trend.entity),
    platformFormat,
    source: "trend",
    title: entityLabel,
    hook: "",  // To be populated by Phase 2.3f card generator
    body: "",  // To be populated by Phase 2.3f card generator
    hashtags: trend.entityType === "hashtag" ? [`#${trend.entity.replace(/^#/, "")}`] : [],
    likelyRange: ctx.likelyRange ?? null,
    reasoning: `${trend.lifecycle} trend on ${platform} in ${ctx.region} (velocity ${trend.velocity}, novelty ${trend.novelty})`,
    confidence: conf,
    basedOnTrendIds: trend.snapshotIds,
    basedOnUserPosts: 0,
    createdAt: Date.now(),
    region: ctx.region,
    industry: ctx.industry,
  };
}
