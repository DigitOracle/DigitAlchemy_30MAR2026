/**
 * DigitAlchemy® Gazette — Filter provenance label
 *
 * Converts the current GazetteFilterState into a human-readable
 * one-line summary for the subhead under "YOUR CONTENT PLAYS".
 */

import type { GazetteFilterState } from "@/types/gazette";
import {
  REGION_SHORT_LABELS,
  PLATFORM_LABELS,
  HORIZON_LABELS,
  INDUSTRY_LABELS,
  AUDIENCE_LABELS,
} from "@/types/gazette";

const BRANCH_DISPLAY: Record<string, string> = {
  react_now: "React Now",
  plan_ahead: "Plan Ahead",
  analyse_history: "Analyse History",
};

export function filtersToLabel(f: GazetteFilterState): string {
  const parts: string[] = [];

  // Mode · Horizon
  const modeLabel = BRANCH_DISPLAY[f.mode] ?? f.mode;
  const horizonLabel = HORIZON_LABELS[f.horizon] ?? f.horizon;
  parts.push(`${modeLabel} \u00B7 ${horizonLabel}`);

  // for Platform in Region
  const platformLabel = PLATFORM_LABELS[f.platform] ?? f.platform;
  const regionLabel = REGION_SHORT_LABELS[f.region] ?? f.region;
  parts.push(`for ${platformLabel} in ${regionLabel}`);

  // Optional fields
  const extras: string[] = [];
  if (f.industry) {
    extras.push(INDUSTRY_LABELS[f.industry] ?? f.industry);
  }
  if (f.audience.length > 0) {
    const audienceNames = f.audience.map((a) => AUDIENCE_LABELS[a] ?? a);
    extras.push(audienceNames.join(" + "));
  }
  extras.push(f.actorType.toUpperCase());

  return `Showing ${parts.join(" ")}${extras.length > 0 ? ", " + extras.join(", ") : ""}`;
}
