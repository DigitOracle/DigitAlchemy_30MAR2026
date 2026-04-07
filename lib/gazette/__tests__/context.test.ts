import { describe, it, expect } from "vitest";
import {
  isValidPlatform,
  isValidHorizon,
  withDefaults,
  validateUserContext,
  UserContextValidationError,
  DEFAULT_USER_CONTEXT,
} from "../context";

// ── isValidPlatform ─────────────────────────────────────────────────────

describe("isValidPlatform", () => {
  it("returns true for tiktok", () => expect(isValidPlatform("tiktok")).toBe(true));
  it("returns true for instagram", () => expect(isValidPlatform("instagram")).toBe(true));
  it("returns true for youtube", () => expect(isValidPlatform("youtube")).toBe(true));
  it("returns true for all", () => expect(isValidPlatform("all")).toBe(true));
  it("returns true for facebook", () => expect(isValidPlatform("facebook")).toBe(true));
  it("returns true for linkedin", () => expect(isValidPlatform("linkedin")).toBe(true));
  it("returns true for x", () => expect(isValidPlatform("x")).toBe(true));
  it("returns false for heygen", () => expect(isValidPlatform("heygen")).toBe(false));
  it("returns false for null", () => expect(isValidPlatform(null)).toBe(false));
  it("returns false for 42", () => expect(isValidPlatform(42)).toBe(false));
});

// ── isValidHorizon ──────────────────────────────────────────────────────

describe("isValidHorizon", () => {
  it("returns true for 24h", () => expect(isValidHorizon("24h")).toBe(true));
  it("returns true for same_day", () => expect(isValidHorizon("same_day")).toBe(true));
  it("returns true for 1w", () => expect(isValidHorizon("1w")).toBe(true));
  it("returns true for 6m", () => expect(isValidHorizon("6m")).toBe(true));
  it("returns false for 1y", () => expect(isValidHorizon("1y")).toBe(false));
  it("returns false for null", () => expect(isValidHorizon(null)).toBe(false));
});

// ── withDefaults ────────────────────────────────────────────────────────

describe("withDefaults", () => {
  it("returns DEFAULT_USER_CONTEXT for empty input", () => {
    const result = withDefaults({});
    expect(result).toEqual(DEFAULT_USER_CONTEXT);
  });

  it("merges partial input with defaults", () => {
    const result = withDefaults({ region: "SG", platform: "tiktok" });
    expect(result.region).toBe("SG");
    expect(result.platform).toBe("tiktok");
    expect(result.horizon).toBe("24h"); // default
  });

  it("preserves optional industry when provided", () => {
    const result = withDefaults({ industry: "real_estate" });
    expect(result.industry).toBe("real_estate");
  });

  it("preserves optional audience when provided", () => {
    const result = withDefaults({ audience: "gen_z" });
    expect(result.audience).toBe("gen_z");
  });

  it("omits industry when not provided", () => {
    const result = withDefaults({ region: "US" });
    expect(result).not.toHaveProperty("industry");
  });

  it("omits audience when not provided", () => {
    const result = withDefaults({ region: "US" });
    expect(result).not.toHaveProperty("audience");
  });
});

// ── validateUserContext ─────────────────────────────────────────────────

describe("validateUserContext", () => {
  const validFull = {
    region: "AE",
    platform: "tiktok",
    horizon: "24h",
    industry: "real_estate",
    audience: "all_ages",
  };

  const validMinimal = {
    region: "US",
    platform: "all",
    horizon: "1w",
  };

  it("passes valid full input", () => {
    const result = validateUserContext(validFull);
    expect(result).toEqual(validFull);
  });

  it("passes valid minimal input", () => {
    const result = validateUserContext(validMinimal);
    expect(result).toEqual(validMinimal);
  });

  it("throws on null", () => {
    expect(() => validateUserContext(null)).toThrow(UserContextValidationError);
  });

  it("throws on non-object", () => {
    expect(() => validateUserContext("string")).toThrow(UserContextValidationError);
  });

  it("throws on missing region", () => {
    expect(() => validateUserContext({ platform: "all", horizon: "24h" })).toThrow(
      UserContextValidationError,
    );
  });

  it("throws on empty string region", () => {
    expect(() =>
      validateUserContext({ region: "  ", platform: "all", horizon: "24h" }),
    ).toThrow(UserContextValidationError);
  });

  it("throws on missing platform", () => {
    expect(() => validateUserContext({ region: "AE", horizon: "24h" })).toThrow(
      UserContextValidationError,
    );
  });

  it("throws on invalid platform", () => {
    expect(() =>
      validateUserContext({ region: "AE", platform: "heygen", horizon: "24h" }),
    ).toThrow(UserContextValidationError);
  });

  it("throws on invalid horizon", () => {
    expect(() =>
      validateUserContext({ region: "AE", platform: "all", horizon: "1y" }),
    ).toThrow(UserContextValidationError);
  });

  it("throws on invalid audience value", () => {
    expect(() =>
      validateUserContext({ ...validMinimal, audience: "teenagers" }),
    ).toThrow(UserContextValidationError);
  });

  it("throws on invalid industry value", () => {
    expect(() =>
      validateUserContext({ ...validMinimal, industry: "construction" }),
    ).toThrow(UserContextValidationError);
  });

  it("strips extra unknown fields", () => {
    const result = validateUserContext({ ...validMinimal, extraField: "should be gone" });
    expect(result).toEqual(validMinimal);
    expect(result).not.toHaveProperty("extraField");
  });
});

// ── UserContextValidationError ──────────────────────────────────────────

describe("UserContextValidationError", () => {
  it("has correct name", () => {
    const err = new UserContextValidationError("test");
    expect(err.name).toBe("UserContextValidationError");
  });

  it("has correct field property", () => {
    const err = new UserContextValidationError("bad region", "region");
    expect(err.field).toBe("region");
  });

  it("has undefined field when not provided", () => {
    const err = new UserContextValidationError("generic error");
    expect(err.field).toBeUndefined();
  });

  it("is an instance of Error", () => {
    const err = new UserContextValidationError("test");
    expect(err).toBeInstanceOf(Error);
  });
});
