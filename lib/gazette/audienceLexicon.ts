/**
 * Audience keyword lexicon for concept card ranking.
 * Phase 3b.3-early of DA-GAZETTE-UNIFICATION.
 */
import type { Audience } from "@/types/gazette";

export const AUDIENCE_LEXICON: Record<Audience, string[]> = {
  gen_z: ["genz", "gen-z", "zillenial", "tiktok", "fyp", "viral", "slay", "fire", "no cap", "periodt", "bussin", "rizz", "aesthetic", "vibe", "mood", "lowkey", "highkey", "iykyk", "main character"],
  millennials: ["millennial", "adulting", "nostalgia", "throwback", "90s", "00s", "y2k", "brunch", "avocado", "iphone", "instagram", "work from home", "remote", "hustle", "side hustle", "crypto", "netflix"],
  gen_x: ["genx", "gen x", "classic", "retro", "vintage", "analog", "mixtape", "grunge", "hip hop", "mtv", "blockbuster", "vhs", "walkman", "generation x"],
  boomers: ["boomer", "classic", "traditional", "golden", "retirement", "legacy", "heritage", "history", "vintage", "nostalgic", "generation", "memory"],
  all_ages: [],
};

/** Compute audience relevance for a text against one or more audiences (max across all). */
export function audienceRelevance(text: string, audiences: Audience[]): number {
  if (audiences.length === 0 || audiences.includes("all_ages")) return 0;
  const lower = text.toLowerCase();
  let maxRelevance = 0;
  for (const aud of audiences) {
    const keywords = AUDIENCE_LEXICON[aud];
    if (!keywords || keywords.length === 0) continue;
    const matches = keywords.filter((kw) => lower.includes(kw)).length;
    const rel = Math.min(1, matches / keywords.length);
    if (rel > maxRelevance) maxRelevance = rel;
  }
  return maxRelevance;
}
