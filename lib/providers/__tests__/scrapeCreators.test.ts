import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  fetchTikTokPopularHashtags,
  fetchTikTokPopularSongs,
  fetchTikTokPopularVideos,
  fetchTikTokSearchKeyword,
  fetchTikTokSearchHashtag,
  fetchInstagramReelsSearch,
} from "../scrapeCreators";

// Stub the API key so getConfig() doesn't short-circuit
beforeEach(() => {
  vi.restoreAllMocks();
  vi.stubEnv("SCRAPECREATORS_API_KEY", "test-key-123");
});

function mockFetchOk(body: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      json: () => Promise.resolve(body),
    }),
  );
}

function mockFetch500() {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      json: () => Promise.resolve({}),
    }),
  );
}

function mockFetchThrow() {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockRejectedValue(new Error("network failure")),
  );
}

function assertEnvelope(
  result: { ok: boolean; data: unknown; error: unknown; source: unknown; fetched_at: unknown },
  expected: { ok: boolean },
) {
  expect(result.source).toBe("scrapeCreators");
  expect(typeof result.fetched_at).toBe("string");
  expect(result.ok).toBe(expected.ok);
  if (expected.ok) {
    expect(result.data).not.toBeNull();
    expect(result.error).toBeNull();
  } else {
    expect(result.data).toBeNull();
    expect(result.error).not.toBeNull();
    expect(typeof result.error).toBe("string");
  }
}

// ── fetchTikTokPopularHashtags ──────────────────────────────────────────

describe("fetchTikTokPopularHashtags", () => {
  it("returns hashtag items on success", async () => {
    mockFetchOk({ list: [{ hashtag_name: "trending", views: 100 }] });
    const result = await fetchTikTokPopularHashtags({ region: "AE" });
    assertEnvelope(result, { ok: true });
    expect(Array.isArray(result.data)).toBe(true);
    expect(result.data!.length).toBe(1);
  });

  it("returns error on HTTP 500", async () => {
    mockFetch500();
    const result = await fetchTikTokPopularHashtags({ region: "AE" });
    assertEnvelope(result, { ok: false });
  });

  it("returns error on network failure", async () => {
    mockFetchThrow();
    const result = await fetchTikTokPopularHashtags({ region: "AE" });
    assertEnvelope(result, { ok: false });
    expect(result.error).toBe("network failure");
  });
});

// ── fetchTikTokPopularSongs ─────────────────────────────────────────────

describe("fetchTikTokPopularSongs", () => {
  it("returns song items on success", async () => {
    mockFetchOk({ sound_list: [{ title: "Song", author: "Artist" }] });
    const result = await fetchTikTokPopularSongs({ region: "AE" });
    assertEnvelope(result, { ok: true });
    expect(result.data!.length).toBe(1);
  });

  it("returns error on HTTP 500", async () => {
    mockFetch500();
    const result = await fetchTikTokPopularSongs({ region: "AE" });
    assertEnvelope(result, { ok: false });
  });

  it("returns error on network failure", async () => {
    mockFetchThrow();
    const result = await fetchTikTokPopularSongs({ region: "AE" });
    assertEnvelope(result, { ok: false });
  });
});

// ── fetchTikTokPopularVideos ────────────────────────────────────────────

describe("fetchTikTokPopularVideos", () => {
  it("returns video items on success", async () => {
    mockFetchOk({ data: [{ desc: "video description" }] });
    const result = await fetchTikTokPopularVideos({ region: "AE" });
    assertEnvelope(result, { ok: true });
    expect(result.data!.length).toBe(1);
  });

  it("returns error on HTTP 500", async () => {
    mockFetch500();
    const result = await fetchTikTokPopularVideos({ region: "AE" });
    assertEnvelope(result, { ok: false });
  });

  it("returns error on network failure", async () => {
    mockFetchThrow();
    const result = await fetchTikTokPopularVideos({ region: "AE" });
    assertEnvelope(result, { ok: false });
  });
});

// ── fetchTikTokSearchKeyword ────────────────────────────────────────────

describe("fetchTikTokSearchKeyword", () => {
  it("returns video items on success", async () => {
    mockFetchOk({ items: [{ desc: "trending content" }] });
    const result = await fetchTikTokSearchKeyword({ query: "dubai", region: "AE" });
    assertEnvelope(result, { ok: true });
    expect(result.data!.length).toBe(1);
  });

  it("returns error on HTTP 500", async () => {
    mockFetch500();
    const result = await fetchTikTokSearchKeyword({ query: "dubai", region: "AE" });
    assertEnvelope(result, { ok: false });
  });

  it("returns error on network failure", async () => {
    mockFetchThrow();
    const result = await fetchTikTokSearchKeyword({ query: "dubai", region: "AE" });
    assertEnvelope(result, { ok: false });
  });
});

// ── fetchTikTokSearchHashtag ────────────────────────────────────────────

describe("fetchTikTokSearchHashtag", () => {
  it("returns hashtag items on success", async () => {
    mockFetchOk({ challengeList: [{ name: "trending", viewCount: 5000 }] });
    const result = await fetchTikTokSearchHashtag({ keyword: "dubai", region: "AE" });
    assertEnvelope(result, { ok: true });
    expect(result.data!.length).toBe(1);
  });

  it("returns error on HTTP 500", async () => {
    mockFetch500();
    const result = await fetchTikTokSearchHashtag({ keyword: "dubai", region: "AE" });
    assertEnvelope(result, { ok: false });
  });

  it("returns error on network failure", async () => {
    mockFetchThrow();
    const result = await fetchTikTokSearchHashtag({ keyword: "dubai", region: "AE" });
    assertEnvelope(result, { ok: false });
  });
});

// ── fetchInstagramReelsSearch ───────────────────────────────────────────

describe("fetchInstagramReelsSearch", () => {
  it("returns reel items on success", async () => {
    mockFetchOk({ reels: [{ caption: "trending reel #dubai" }] });
    const result = await fetchInstagramReelsSearch({ keyword: "trending UAE", region: "AE" });
    assertEnvelope(result, { ok: true });
    expect(result.data!.length).toBe(1);
  });

  it("returns error on HTTP 500", async () => {
    mockFetch500();
    const result = await fetchInstagramReelsSearch({ keyword: "trending UAE", region: "AE" });
    assertEnvelope(result, { ok: false });
  });

  it("returns error on network failure", async () => {
    mockFetchThrow();
    const result = await fetchInstagramReelsSearch({ keyword: "trending UAE", region: "AE" });
    assertEnvelope(result, { ok: false });
  });
});
