"""
DA Agent: Trend Ticker
Use case: DA-UC-001 — Social Media Intelligence
Source route: app/api/trend-ticker/route.ts

This agent detects trending hashtags from TikTok and Instagram,
following the inference-last provider chain architecture.
"""

# ──────────────────────────────────────────────
# EDITABLE SECTION — modify freely above the boundary
# ──────────────────────────────────────────────

SYSTEM_PROMPT = """
You are the DigitAlchemy Trend Ticker agent. Your job is to detect
emerging hashtag trends from TikTok and Instagram for a given region.

Rules:
- Follow inference-last provider chain: ScrapeCreators → Apify → xpoz → Perplexity → Claude
- YouTube is excluded from Trend Ticker (handled separately via Data API v3)
- Spotify is enrichment-only — never use it for trend detection
- Deduplicate and rank trends by engagement velocity
- Return structured JSON with platform, hashtag, and rank
"""

PROVIDER_CHAIN = [
    "scrapeCreators",   # Primary: TikTok hashtags + Instagram reels
    "apify",            # Fallback: broader social scraping
    "xpoz",             # Fallback: cross-platform enrichment
    "perplexity",       # Fallback: web-grounded trend verification
    "claude",           # Final: inference, ranking, and synthesis
]

TOOL_DEFINITIONS = [
    {
        "name": "fetch_tiktok_hashtags",
        "description": "Fetch popular TikTok hashtags for a region via ScrapeCreators API",
        "parameters": {
            "region": {"type": "string", "description": "ISO country code (e.g. AE, US, SG)"},
        },
    },
    {
        "name": "fetch_instagram_hashtags",
        "description": "Extract hashtags from trending Instagram reels for a region",
        "parameters": {
            "region": {"type": "string", "description": "ISO country code"},
            "region_label": {"type": "string", "description": "Human-readable region name"},
        },
    },
    {
        "name": "rank_trends",
        "description": "Rank and deduplicate trends across platforms",
        "parameters": {
            "tiktok_tags": {"type": "array", "description": "TikTok hashtag list"},
            "instagram_tags": {"type": "array", "description": "Instagram hashtag list"},
        },
    },
]

ROUTING_LOGIC = """
1. Fetch TikTok hashtags via ScrapeCreators
2. Fetch Instagram hashtags via ScrapeCreators
3. If either fails, fall back through provider chain (Apify → xpoz)
4. Merge and deduplicate across platforms
5. Use Claude (inference-last) to rank by relevance and engagement velocity
6. Return top trends as structured JSON
"""

MAX_TURNS = 5
TEMPERATURE = 0.3

# ──────────────────────────────────────────────
# === FIXED ADAPTER BOUNDARY ===
# ──────────────────────────────────────────────
# DO NOT MODIFY BELOW THIS LINE
# This section contains the SSE streaming adapter, Firestore logging,
# Harbor trajectory serialization, Vercel serverless entry point,
# and authentication/rate-limiting middleware.
#
# The actual adapter code is implemented in the Vercel route at:
#   app/api/trend-ticker/route.ts
#
# This agent harness feeds configuration (SYSTEM_PROMPT, PROVIDER_CHAIN,
# TOOL_DEFINITIONS, ROUTING_LOGIC) into the fixed adapter at runtime.
# ──────────────────────────────────────────────

def get_agent_config():
    """Return the editable agent configuration for the fixed adapter."""
    return {
        "system_prompt": SYSTEM_PROMPT,
        "provider_chain": PROVIDER_CHAIN,
        "tool_definitions": TOOL_DEFINITIONS,
        "routing_logic": ROUTING_LOGIC,
        "max_turns": MAX_TURNS,
        "temperature": TEMPERATURE,
    }


if __name__ == "__main__":
    import json
    config = get_agent_config()
    print(json.dumps(config, indent=2))
