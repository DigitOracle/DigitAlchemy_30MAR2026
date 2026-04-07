/**
 * DigitAlchemy® Gazette — Derive filter defaults from Content DNA
 *
 * On first load with no URL params, the Gazette infers filter defaults
 * from the user's Content DNA profile. If no DNA exists, hard-coded
 * defaults are used.
 *
 * Phase 2.3h of DA-GAZETTE-UNIFICATION.
 */

import type { GazetteFilterState } from "@/types/gazette";
import type { ContentProfile } from "@/lib/firestore/contentProfile";

export function dnaToFilterDefaults(
  profile: ContentProfile | null,
): GazetteFilterState {
  // Hard-coded defaults when no DNA exists
  if (!profile || profile.sampleCount === 0) {
    return {
      region: "AE",
      platform: "all",
      mode: "react_now",
      horizon: "24h",
      actorType: "b2c",
    };
  }

  // Infer from DNA topics
  const topics = (profile.topics || []).map((t) => t.toLowerCase());
  const isB2B = topics.some((t) =>
    ["construction", "bim", "architecture", "engineering", "consulting",
     "saas", "enterprise", "b2b", "corporate", "fintech", "proptech"].includes(t),
  );

  return {
    region: "AE",
    platform: "all",
    mode: "react_now",
    horizon: "24h",
    actorType: isB2B ? "b2b" : "b2c",
  };
}
