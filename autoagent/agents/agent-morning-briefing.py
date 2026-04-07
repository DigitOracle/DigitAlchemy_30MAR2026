"""
DA Agent: Morning Briefing (The Gazette)
Use case: DA-UC-001 — Social Media Intelligence
Source route: app/api/morning-briefing/route.ts

This is the most complex of the three agents. It synthesizes outputs from
trend-ticker and trending-audio into a final intelligence product — the
DigitAlchemy Gazette morning briefing.

Data sources: Wikipedia trending pages, GDELT news articles, YouTube trending.
"""

# ──────────────────────────────────────────────
# === EDITABLE HARNESS ===
# Modify freely above the FIXED ADAPTER BOUNDARY
# ──────────────────────────────────────────────

SYSTEM_PROMPT = """
You are the DigitAlchemy Morning Briefing agent (codename: The Gazette).
Your job is to synthesize trending intelligence from multiple sources into
a concise, actionable morning briefing for the DigitAlchemy Console.

You consume outputs from the Trend Ticker and Trending Audio agents,
combined with Wikipedia trending pages, GDELT news articles, and YouTube
trending videos to produce a comprehensive intelligence product.

Rules:
- Follow inference-last provider chain: ScrapeCreators → Apify → xpoz → Perplexity → Claude
- Every factual claim must be traceable to a source — no hallucination
- The briefing must cover: global trends, regional focus, audio trends, news context
- YouTube data is allowed here (unlike Trend Ticker, which excludes it)
- Spotify is enrichment-only if referenced for audio context
- Structure output as the Gazette format: sections with headers, bullet points, sources
- Use the fact-check sub-agent hook before finalizing the briefing
"""

PROVIDER_CHAIN = [
    "scrapeCreators",   # Primary: social trend data
    "apify",            # Fallback: broader social scraping
    "xpoz",             # Fallback: cross-platform enrichment
    "perplexity",       # Fallback: web-grounded news verification
    "claude",           # Final: synthesis, writing, and fact-checking
]

TOOL_DEFINITIONS = [
    {
        "name": "fetch_wikipedia_trending",
        "description": "Fetch yesterday's most-viewed Wikipedia articles (global cultural signal)",
        "parameters": {},
    },
    {
        "name": "fetch_gdelt_news",
        "description": "Fetch trending news articles from GDELT for a region",
        "parameters": {
            "region_label": {"type": "string", "description": "Human-readable region name (e.g. 'the UAE')"},
        },
    },
    {
        "name": "fetch_youtube_trending",
        "description": "Fetch trending YouTube videos for a region via Data API v3",
        "parameters": {
            "region": {"type": "string", "description": "ISO country code"},
        },
    },
    {
        "name": "get_trend_ticker_output",
        "description": "Retrieve the latest Trend Ticker agent output (TikTok + Instagram hashtags)",
        "parameters": {
            "region": {"type": "string", "description": "ISO country code"},
        },
    },
    {
        "name": "get_trending_audio_output",
        "description": "Retrieve the latest Trending Audio agent output (sounds + Spotify enrichment)",
        "parameters": {
            "region": {"type": "string", "description": "ISO country code"},
        },
    },
    {
        "name": "fact_check_briefing",
        "description": "Sub-agent hook: cross-reference every factual claim in the briefing against source material before delivery",
        "parameters": {
            "briefing_draft": {"type": "string", "description": "The draft briefing text to fact-check"},
            "sources": {"type": "array", "description": "Source data used to generate the briefing"},
        },
    },
    {
        "name": "compile_gazette",
        "description": "Compile the final Gazette briefing from verified sections",
        "parameters": {
            "sections": {"type": "array", "description": "List of verified briefing sections"},
            "region": {"type": "string", "description": "ISO country code"},
            "region_label": {"type": "string", "description": "Human-readable region name"},
        },
    },
]

BRIEFING_TEMPLATE = """
# The Gazette — {date}
## Region Focus: {region_label}

### Global Pulse
{wikipedia_trends}

### Regional News
{gdelt_news}

### Social Trends (TikTok + Instagram)
{trend_ticker_output}

### Sounds of the Moment
{trending_audio_output}

### Video Trending
{youtube_trending}

---
Generated at {timestamp} by DigitAlchemy® Gazette Agent
Sources: Wikipedia, GDELT, ScrapeCreators, YouTube Data API v3
"""

ROUTING_LOGIC = """
1. Fetch all data sources in parallel:
   - Wikipedia trending pages (global cultural signal)
   - GDELT news articles (regional news context)
   - YouTube trending videos (video landscape)
   - Trend Ticker output (TikTok + Instagram hashtags)
   - Trending Audio output (sounds + Spotify metadata)
2. If any source fails, note the gap but continue with available data
3. Use Claude (inference-last) to synthesize into Gazette format
4. Run fact-check sub-agent against all source material
5. Compile final briefing and return structured JSON
"""

MAX_TURNS = 8
TEMPERATURE = 0.4

# ──────────────────────────────────────────────
# === FIXED ADAPTER BOUNDARY ===
# ──────────────────────────────────────────────
# DO NOT MODIFY BELOW THIS LINE
# This section contains the SSE streaming adapter, Firestore logging,
# Harbor trajectory serialization, Vercel serverless entry point,
# and authentication/rate-limiting middleware.
#
# The actual adapter code is implemented in the Vercel route at:
#   app/api/morning-briefing/route.ts
#
# Key implementation details preserved in the fixed adapter:
# - Wikipedia /metrics/pageviews/top endpoint
# - GDELT /api/v2/doc/doc endpoint
# - YouTube Data API v3 /videos?chart=mostPopular
# - Region labels: AE→"the UAE", SA→"Saudi Arabia", etc.
# - Response shape: { wikipedia, gdelt, youtube, region, regionLabel, generatedAt }
# ──────────────────────────────────────────────

def get_agent_config():
    """Return the editable agent configuration for the fixed adapter."""
    return {
        "system_prompt": SYSTEM_PROMPT,
        "provider_chain": PROVIDER_CHAIN,
        "tool_definitions": TOOL_DEFINITIONS,
        "briefing_template": BRIEFING_TEMPLATE,
        "routing_logic": ROUTING_LOGIC,
        "max_turns": MAX_TURNS,
        "temperature": TEMPERATURE,
    }


if __name__ == "__main__":
    import json
    config = get_agent_config()
    print(json.dumps(config, indent=2))
