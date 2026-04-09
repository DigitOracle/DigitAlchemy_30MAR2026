/**
 * DigitAlchemy® Gazette — ConceptCard helper functions
 *
 * Type guards and display helpers for the canonical ConceptCard type.
 * Pure functions, no I/O.
 *
 * Phase 2.3d of DA-GAZETTE-UNIFICATION.
 */

import type { ConceptCard, ConceptCardFormat } from "@/types/conceptCard";
import type { PredictionMetric } from "@/types/gazette";

/** True only for Instagram Reels. */
export function isReel(card: ConceptCard): boolean {
  return card.platformFormat.platform === "instagram" && card.platformFormat.format === "reel";
}

/** True for any video-like format (Reel, TikTok video, YouTube short/long, feed_video, LinkedIn video). */
export function isVideoFormat(card: ConceptCard): boolean {
  const videoFormats: ConceptCardFormat["format"][] = ["reel", "feed_video", "video", "short", "long"];
  return videoFormats.includes(card.platformFormat.format);
}

/** Returns the default prediction metric for a card's platform-format. */
export function getDefaultMetric(card: ConceptCard): PredictionMetric {
  if (isVideoFormat(card)) return "views";
  if (card.platformFormat.platform === "linkedin") return "engagement";
  return "engagement";
}

/** Formatted display title with platform prefix. */
export function getCardTitle(card: ConceptCard): string {
  const platformLabels: Record<string, string> = {
    instagram: "Instagram",
    tiktok: "TikTok",
    youtube: "YouTube",
    linkedin: "LinkedIn",
  };
  const label = platformLabels[card.platformFormat.platform] ?? card.platformFormat.platform;
  return `${label}: ${card.title}`;
}

/** Human-readable confidence label. */
export function getCardConfidenceLabel(card: ConceptCard): string {
  switch (card.confidence) {
    case "high":
      return "High confidence";
    case "medium":
      return "Medium confidence";
    case "low":
      return "Low confidence \u2014 needs more data";
  }
}
