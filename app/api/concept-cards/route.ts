import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { getDb } from "@/lib/jobStore";
import { loadContentProfile } from "@/lib/firestore/contentProfile";
import { getPerformanceDNA, getPerformancePosts } from "@/lib/firestore/performanceDNA";
import { getRegionalEngagementSamples } from "@/lib/firestore/regionalEngagement";
import { fetchTrendsForContext, type ScoredTrend } from "@/lib/gazette/trends";
import { generateConceptCards, type CardGeneratorDeps } from "@/lib/gazette/conceptCardGenerator";
import { predictForCard } from "@/lib/gazette/predictions";
import { samplesToBaselinePosts } from "@/lib/gazette/predictions";
import type { Region, Industry, Platform } from "@/types/gazette";
import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function GET(req: NextRequest): Promise<NextResponse> {
  // ── Auth ──
  getDb();
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }
  let callerUid: string;
  try {
    const token = await getAuth().verifyIdToken(authHeader.slice(7));
    callerUid = token.uid;
  } catch {
    return NextResponse.json({ error: "Invalid auth token" }, { status: 401 });
  }

  // ── Params ──
  const region = (req.nextUrl.searchParams.get("region") || "AE") as Region;
  const platform = (req.nextUrl.searchParams.get("platform") || "tiktok") as Platform;
  const industry = req.nextUrl.searchParams.get("industry") as Industry | undefined;

  console.log("[concept-cards] request", { region, platform, callerUid, hasAuth: !!authHeader });

  try {
    // ── Fetch all data sources in parallel ──
    const base = `${req.nextUrl.protocol}//${req.nextUrl.host}`;
    const fwdHeaders: Record<string, string> = { Authorization: authHeader, "x-internal-caller": "concept-cards" };

    const [contentDNA, performanceDNA, recentPosts, regionalSamples, scoredTrends, genericRecsRes, personalRecsRes] = await Promise.all([
      loadContentProfile(callerUid),
      getPerformanceDNA(callerUid),
      getPerformancePosts(callerUid),
      getRegionalEngagementSamples({ platform, region, industry }),
      fetchTrendsForContext({ region, platform, horizon: "24h" }).catch((): ScoredTrend[] => []),
      // Fetch Follow the Trend (generic) and Stay in Your Lane (personalised) recs
      fetch(`${base}/api/post-recommendations?region=${region}&platform=${platform}`, { headers: fwdHeaders, signal: AbortSignal.timeout(15000) })
        .then(r => r.json()).catch((e) => ({ posts: [], _error: String(e) })),
      fetch(`${base}/api/post-recommendations?region=${region}&platform=${platform}&uid=${callerUid}`, { headers: fwdHeaders, signal: AbortSignal.timeout(15000) })
        .then(r => r.json()).catch((e) => ({ posts: [], _error: String(e) })),
    ]);

    console.log("[concept-cards] recPosts fetched", { genericRecsCount: Array.isArray(genericRecsRes?.posts) ? genericRecsRes.posts.length : "not-array", genericError: genericRecsRes?._error ?? null, personalRecsCount: Array.isArray(personalRecsRes?.posts) ? personalRecsRes.posts.length : "not-array", personalError: personalRecsRes?._error ?? null, scoredTrendsCount: scoredTrends?.length ?? 0 });

    const baselinePosts = samplesToBaselinePosts(regionalSamples);
    const genericRecs = (genericRecsRes.posts || []) as { topic: string; caption: string; hashtags: string; audio: string; best_time: string; format: string }[];
    const personalRecs = (personalRecsRes.posts || []) as { topic: string; caption: string; hashtags: string; audio: string; best_time: string; format: string }[];

    // ── Wire up dependencies ──
    const deps: CardGeneratorDeps = {
      predict: (input) => {
        try {
          return predictForCard(input);
        } catch (e) {
          console.error("[concept-cards] predict error", { message: e instanceof Error ? e.message : String(e) });
          return null;
        }
      },
      enrichWithClaude: async (input) => {
        try {
          const response = await client.messages.create({
            model: "claude-sonnet-4-20250514",
            max_tokens: 300,
            messages: [{
              role: "user",
              content: `You are a social media content strategist. Generate a hook (first line, max 80 chars) and body (2-3 sentence script outline) for a ${input.platform} ${input.trendType} about "${input.trendEntity}" in ${input.region}.${input.contentDNA ? ` Match this creator's style: tone=${input.contentDNA.tone}, visual=${input.contentDNA.visualStyle}.` : ""}\n\nReturn ONLY JSON: { "hook": "...", "body": "..." }`,
            }],
          });
          const text = response.content[0].type === "text" ? response.content[0].text : "";
          const cleaned = text.replace(/```json|```/g, "").trim();
          return JSON.parse(cleaned) as { hook: string; body: string };
        } catch (e) {
          console.error("[concept-cards] claude enrich error", { message: e instanceof Error ? e.message : String(e) });
          return null;
        }
      },
    };

    // ── Generate cards ──
    const cards = await generateConceptCards({
      uid: callerUid,
      region,
      platform,
      industry: industry || undefined,
      contentDNA,
      performanceDNA,
      recentPosts,
      baselinePosts,
      scoredTrends,
      recPosts: {
        followTrend: genericRecs,
        stayInLane: personalRecs,
      },
    }, deps);

    console.log("[concept-cards] generator returned", { cardCount: cards?.length ?? 0, firstCardSource: cards?.[0]?.source ?? "no-cards" });

    return NextResponse.json({
      ok: true,
      cards,
      count: cards.length,
      region,
      platform,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[concept-cards] EXCEPTION", { message: err instanceof Error ? err.message : String(err), stack: err instanceof Error ? err.stack : undefined, name: err instanceof Error ? err.name : typeof err });
    return NextResponse.json({ error: "Card generation failed" }, { status: 500 });
  }
}
