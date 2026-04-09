/**
 * Industry keyword lexicon for concept card ranking.
 * Phase 3b.3-early of DA-GAZETTE-UNIFICATION.
 */
import type { Industry } from "@/types/gazette";

export const INDUSTRY_LEXICON: Record<Industry, string[]> = {
  real_estate: ["property", "home", "house", "apartment", "villa", "dubai", "realty", "mortgage", "rent", "buyer", "seller", "listing", "investment", "off-plan", "offplan", "agent", "broker", "viewing", "tour", "interior", "exterior", "sqft", "square foot"],
  automotive: ["car", "truck", "suv", "dealership", "test drive", "mileage", "hybrid", "electric", "ev", "tesla", "bmw", "mercedes", "lexus", "gmc", "ford", "engine", "lease", "trade-in", "service", "warranty", "detailing"],
  hospitality: ["hotel", "resort", "booking", "stay", "check-in", "concierge", "suite", "brunch", "dinner", "breakfast", "cuisine", "chef", "menu", "reservation", "spa", "pool", "view", "weekend", "staycation", "room service"],
  food_beverage: ["restaurant", "food", "drink", "coffee", "wine", "cocktail", "menu", "chef", "recipe", "taste", "flavor", "cuisine", "dine", "dining", "eat", "brunch", "delivery", "takeout", "foodie", "plating"],
  fashion_beauty: ["fashion", "style", "outfit", "ootd", "dress", "makeup", "beauty", "skincare", "haircare", "trend", "runway", "designer", "brand", "luxury", "boutique", "lookbook", "collection", "season"],
  fitness_wellness: ["gym", "workout", "fitness", "training", "cardio", "strength", "yoga", "pilates", "meditation", "wellness", "nutrition", "protein", "recovery", "mobility", "coach", "transformation", "routine"],
  ecommerce: ["shop", "buy", "sale", "discount", "deal", "product", "store", "cart", "checkout", "shipping", "delivery", "review", "unboxing", "haul", "brand", "launch", "restock", "exclusive"],
  education: ["learn", "course", "lesson", "student", "teacher", "tutor", "school", "university", "certification", "study", "exam", "curriculum", "skill", "workshop", "training", "bootcamp"],
  healthcare: ["health", "doctor", "clinic", "hospital", "treatment", "therapy", "medicine", "dental", "dermatology", "checkup", "wellness", "prevention", "diagnosis", "specialist", "appointment"],
  financial_services: ["invest", "stock", "crypto", "bitcoin", "ethereum", "portfolio", "savings", "budget", "retirement", "wealth", "bank", "loan", "credit", "tax", "fund", "etf", "dividend"],
};

/** Compute industry relevance for a text (0 to 1). */
export function industryRelevance(text: string, industry: Industry): number {
  const lower = text.toLowerCase();
  const keywords = INDUSTRY_LEXICON[industry];
  if (!keywords || keywords.length === 0) return 0;
  const matches = keywords.filter((kw) => lower.includes(kw)).length;
  return Math.min(1, matches / keywords.length);
}
