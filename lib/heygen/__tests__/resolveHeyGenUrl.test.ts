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
  it("returns true for standard dashboard URL", () => {
    expect(isHeyGenDashboardUrl("https://app.heygen.com/videos/abc123def456")).toBe(true);
  });

  it("returns true for bio- prefixed URL", () => {
    expect(isHeyGenDashboardUrl("https://app.heygen.com/videos/bio-cb2d34d5c79846d491e72b88dbd51e48")).toBe(true);
  });

  it("returns true with query params", () => {
    expect(isHeyGenDashboardUrl("https://app.heygen.com/videos/abc123?tab=preview")).toBe(true);
  });

  it("returns false for non-HeyGen URL", () => {
    expect(isHeyGenDashboardUrl("https://youtube.com/watch?v=abc")).toBe(false);
  });
});

describe("extractVideoId", () => {
  it("extracts standard video_id", () => {
    expect(extractVideoId("https://app.heygen.com/videos/abc123def456")).toBe("abc123def456");
  });

  it("extracts bio- prefixed id", () => {
    expect(extractVideoId("https://app.heygen.com/videos/bio-cb2d34d5c79846d491e72b88dbd51e48")).toBe("bio-cb2d34d5c79846d491e72b88dbd51e48");
  });

  it("strips query params", () => {
    expect(extractVideoId("https://app.heygen.com/videos/abc123?tab=preview")).toBe("abc123");
  });

  it("throws for invalid URL", () => {
    expect(() => extractVideoId("https://youtube.com/watch?v=abc")).toThrow(HeyGenResolveError);
  });
});

describe("resolveHeyGenUrl", () => {
  it("throws when API key is missing", async () => {
    vi.stubEnv("HEYGEN_API_KEY", "");
    await expect(resolveHeyGenUrl("https://app.heygen.com/videos/abc123")).rejects.toThrow("API key not configured");
  });

  it("resolves standard ID via status endpoint", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: { status: "completed", video_url: "https://cdn.heygen.com/video.mp4" } }),
    }));
    const url = await resolveHeyGenUrl("https://app.heygen.com/videos/abc123");
    expect(url).toBe("https://cdn.heygen.com/video.mp4");
  });

  it("throws for non-completed status", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: { status: "processing" } }),
    }));
    await expect(resolveHeyGenUrl("https://app.heygen.com/videos/abc123")).rejects.toThrow("still processing");
  });

  it("bio- URL skips status endpoint, tries list lookup", async () => {
    const mockFetch = vi.fn()
      // First call: video.list
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          data: {
            videos: [
              { video_id: "cb2d34d5c79846d491e72b88dbd51e48", status: "completed", video_url: "https://cdn.heygen.com/bio-video.mp4" },
            ],
          },
        }),
      });
    vi.stubGlobal("fetch", mockFetch);

    const url = await resolveHeyGenUrl("https://app.heygen.com/videos/bio-cb2d34d5c79846d491e72b88dbd51e48");
    expect(url).toBe("https://cdn.heygen.com/bio-video.mp4");
    // Should have called video.list, not video_status.get first
    expect(mockFetch.mock.calls[0][0]).toContain("video.list");
  });

  it("bio- URL with no list match falls back to status endpoint", async () => {
    const mockFetch = vi.fn()
      // First call: video.list — no match
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: { videos: [] } }),
      })
      // Second call: video_status.get — also fails
      .mockResolvedValueOnce({ ok: false, status: 404 });
    vi.stubGlobal("fetch", mockFetch);

    await expect(resolveHeyGenUrl("https://app.heygen.com/videos/bio-nomatch123")).rejects.toThrow("Could not resolve");
  });

  it("bio- URL with processing video in list throws clear error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        data: {
          videos: [
            { video_id: "cb2d34d5", status: "processing", video_url: null },
          ],
        },
      }),
    }));
    await expect(resolveHeyGenUrl("https://app.heygen.com/videos/bio-cb2d34d5")).rejects.toThrow("still processing");
  });
});
