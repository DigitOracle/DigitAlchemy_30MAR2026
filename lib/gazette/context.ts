/**
 * DigitAlchemy® Gazette — UserContext validation and defaulting
 *
 * Pure functions for working with UserContext objects. No I/O, no Firestore,
 * no provider calls. Imports only from types/gazette.ts.
 *
 * Phase 2.1 + Phase 1.5 of DA-GAZETTE-UNIFICATION.
 */

import type {
  UserContext,
  Platform,
  Horizon,
  Region,
  Industry,
  Audience,
} from "@/types/gazette";

import {
  REGION_LABELS,
  PLATFORM_LABELS,
  HORIZON_LABELS,
  INDUSTRY_LABELS,
  AUDIENCE_LABELS,
} from "@/types/gazette";

// ============================================================================
// Type guards — derive valid values from the label maps (single source of truth)
// ============================================================================

const VALID_REGIONS = Object.keys(REGION_LABELS) as Region[];
const VALID_PLATFORMS = Object.keys(PLATFORM_LABELS) as Platform[];
const VALID_HORIZONS = Object.keys(HORIZON_LABELS) as Horizon[];
const VALID_INDUSTRIES = Object.keys(INDUSTRY_LABELS) as Industry[];
const VALID_AUDIENCES = Object.keys(AUDIENCE_LABELS) as Audience[];

export function isValidRegion(value: unknown): value is Region {
  return typeof value === "string" && (VALID_REGIONS as string[]).includes(value);
}

export function isValidPlatform(value: unknown): value is Platform {
  return typeof value === "string" && (VALID_PLATFORMS as string[]).includes(value);
}

export function isValidHorizon(value: unknown): value is Horizon {
  return typeof value === "string" && (VALID_HORIZONS as string[]).includes(value);
}

export function isValidIndustry(value: unknown): value is Industry {
  return typeof value === "string" && (VALID_INDUSTRIES as string[]).includes(value);
}

export function isValidAudience(value: unknown): value is Audience {
  return typeof value === "string" && (VALID_AUDIENCES as string[]).includes(value);
}

// ============================================================================
// Defaults
// ============================================================================

/**
 * Sensible defaults for a UserContext when the caller passes minimal input.
 * Defaults reflect the most common Console use case: UAE region, all platforms,
 * 24-hour horizon, no industry, no audience.
 */
export const DEFAULT_USER_CONTEXT: UserContext = {
  region: "AE",
  platform: "all",
  horizon: "24h",
};

/**
 * Fill in missing fields on a partial UserContext with defaults.
 * Does not validate — call validateUserContext after if validation is needed.
 */
export function withDefaults(partial: Partial<UserContext>): UserContext {
  return {
    region: partial.region ?? DEFAULT_USER_CONTEXT.region,
    platform: partial.platform ?? DEFAULT_USER_CONTEXT.platform,
    horizon: partial.horizon ?? DEFAULT_USER_CONTEXT.horizon,
    ...(partial.industry !== undefined && { industry: partial.industry }),
    ...(partial.audience !== undefined && { audience: partial.audience }),
  };
}

// ============================================================================
// Validation
// ============================================================================

export class UserContextValidationError extends Error {
  constructor(message: string, public readonly field?: string) {
    super(message);
    this.name = "UserContextValidationError";
  }
}

/**
 * Validate an unknown input as a UserContext. Throws UserContextValidationError
 * on any failure. Returns a typed UserContext on success.
 *
 * Strict: rejects unknown fields, wrong types, invalid enum values.
 * Use withDefaults first if you want to allow partial input.
 */
export function validateUserContext(input: unknown): UserContext {
  if (input === null || typeof input !== "object") {
    throw new UserContextValidationError("UserContext must be an object");
  }

  const obj = input as Record<string, unknown>;

  // region: required, must be a valid Region
  if (!isValidRegion(obj.region)) {
    throw new UserContextValidationError(
      `region must be one of: ${VALID_REGIONS.join(", ")}`,
      "region",
    );
  }

  // platform: required, must be a valid Platform
  if (!isValidPlatform(obj.platform)) {
    throw new UserContextValidationError(
      `platform must be one of: ${VALID_PLATFORMS.join(", ")}`,
      "platform",
    );
  }

  // horizon: required, must be a valid Horizon
  if (!isValidHorizon(obj.horizon)) {
    throw new UserContextValidationError(
      `horizon must be one of: ${VALID_HORIZONS.join(", ")}`,
      "horizon",
    );
  }

  // industry: optional, but if present must be a valid Industry
  if (obj.industry !== undefined) {
    if (!isValidIndustry(obj.industry)) {
      throw new UserContextValidationError(
        `industry must be one of: ${VALID_INDUSTRIES.join(", ")}`,
        "industry",
      );
    }
  }

  // audience: optional, but if present must be a valid Audience
  if (obj.audience !== undefined) {
    if (!isValidAudience(obj.audience)) {
      throw new UserContextValidationError(
        `audience must be one of: ${VALID_AUDIENCES.join(", ")}`,
        "audience",
      );
    }
  }

  // Construct the validated object explicitly to strip any extra fields
  const validated: UserContext = {
    region: obj.region as Region,
    platform: obj.platform as Platform,
    horizon: obj.horizon as Horizon,
  };
  if (obj.industry !== undefined) {
    validated.industry = obj.industry as Industry;
  }
  if (obj.audience !== undefined) {
    validated.audience = obj.audience as Audience;
  }

  return validated;
}
