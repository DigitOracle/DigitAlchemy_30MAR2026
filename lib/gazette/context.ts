/**
 * DigitAlchemy® Gazette — UserContext validation and defaulting
 *
 * Pure functions for working with UserContext objects. No I/O, no Firestore,
 * no provider calls. Imports only from types/gazette.ts.
 *
 * Phase 2.1 of DA-GAZETTE-UNIFICATION.
 */

import type {
  UserContext,
  Platform,
  Horizon,
} from "@/types/gazette";

// ============================================================================
// Type guards
// ============================================================================

const VALID_PLATFORMS: readonly Platform[] = [
  "tiktok",
  "instagram",
  "youtube",
  "all",
] as const;

const VALID_HORIZONS: readonly Horizon[] = [
  "24h",
  "7d",
  "30d",
  "6m",
] as const;

export function isValidPlatform(value: unknown): value is Platform {
  return typeof value === "string" && (VALID_PLATFORMS as readonly string[]).includes(value);
}

export function isValidHorizon(value: unknown): value is Horizon {
  return typeof value === "string" && (VALID_HORIZONS as readonly string[]).includes(value);
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
  region: "UAE",
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

  // region: required, non-empty string
  if (typeof obj.region !== "string" || obj.region.trim().length === 0) {
    throw new UserContextValidationError(
      "region must be a non-empty string",
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

  // industry: optional, but if present must be a non-empty string
  if (obj.industry !== undefined) {
    if (typeof obj.industry !== "string" || obj.industry.trim().length === 0) {
      throw new UserContextValidationError(
        "industry must be a non-empty string when provided",
        "industry",
      );
    }
  }

  // audience: optional, but if present must be an array of non-empty strings
  if (obj.audience !== undefined) {
    if (!Array.isArray(obj.audience)) {
      throw new UserContextValidationError(
        "audience must be an array when provided",
        "audience",
      );
    }
    for (const item of obj.audience) {
      if (typeof item !== "string" || item.trim().length === 0) {
        throw new UserContextValidationError(
          "audience items must be non-empty strings",
          "audience",
        );
      }
    }
  }

  // Construct the validated object explicitly to strip any extra fields
  const validated: UserContext = {
    region: obj.region,
    platform: obj.platform,
    horizon: obj.horizon,
  };
  if (obj.industry !== undefined) {
    validated.industry = obj.industry as string;
  }
  if (obj.audience !== undefined) {
    validated.audience = obj.audience as string[];
  }

  return validated;
}
