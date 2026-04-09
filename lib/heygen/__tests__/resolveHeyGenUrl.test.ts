import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  isHeyGenDashboardUrl,
  extractVideoId,
  resolveHeyGenUrl,
  HeyGenResolveError,
} from "../resolveHeyGenUrl";

beforeEach(() => {
  vi.restoreAllMocks();
  vi.stubEnv("HEYGEN_API_KEY", "test-key");
});

describe("isHeyGenDashboardUrl", () => {
  it("returns true for valid dashboard URL", () => {
    expect(isHeyGenDashboardUrl("https://app.heygen.com/videos/bio-cb2d34d5c79846d491e72b88dbd5abc1")).toBe(true);
  });

  it("returns true with query params", () => {
    expect(isHeyGenDashboardUrl("https://app.heygen.com/videos/abc123?tab=preview")).toBe(true);
  });

  it("returns false for non-HeyGen URL", () => {
    expect(isHeyGenDashboardUrl("https://youtube.com/watch?v=abc")).toBe(false);
  });

  it("returns false for HeyGen CDN URL", () => {
    expect(isHeyGenDashboardUrl("https://resource.heygen.com/video/abc.mp4")).toBe(false);
  });
});

describe("extractVideoId", () => {
  it("extracts video_id from dashboard URL", () => {
    expect(extractVideoId("https://app.heygen.com/videos/bio-cb2d34d5c79846d491e72b88dbd5abc1")).toBe("bio-cb2d34d5c79846d491e72b88dbd5abc1");
  });

  it("strips query params", () => {
    expect(extractVideoId("https://app.heygen.com/videos/abc123?tab=preview")).toBe("abc123");
  });

  it("throws for non-HeyGen URL", () => {
    expect(() => extractVideoId("https://youtube.com/watch?v=abc")).toThrow(HeyGenResolveError);
  });
});

describe("resolveHeyGenUrl", () => {
  it("throws when API key is missing", async () => {
    vi.stubEnv("HEYGEN_API_KEY", "");
    await expect(resolveHeyGenUrl("https://app.heygen.com/videos/abc123")).rejects.toThrow("API key not configured");
  });

  it("throws for non-completed status", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: { status: "processing" } }),
    }));
    await expect(resolveHeyGenUrl("https://app.heygen.com/videos/abc123")).rejects.toThrow("still processing");
  });

  it("throws when video_url is missing", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: { status: "completed" } }),
    }));
    await expect(resolveHeyGenUrl("https://app.heygen.com/videos/abc123")).rejects.toThrow("no video URL");
  });

  it("returns CDN URL for completed video", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: { status: "completed", video_url: "https://cdn.heygen.com/video.mp4" } }),
    }));
    const url = await resolveHeyGenUrl("https://app.heygen.com/videos/abc123");
    expect(url).toBe("https://cdn.heygen.com/video.mp4");
  });
});
