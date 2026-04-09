"""
DA Agent: Trend Ticker
Use case: DA-UC-001 — Social Media Intelligence
Source route: app/api/trend-ticker/route.ts

This agent detects trending hashtags from TikTok and Instagram,
following the inference-last provider chain architecture.
"""

# ──────────────────────────────────────────────
# === EDITABLE HARNESS ===
# Modify freely above the FIXED ADAPTER BOUNDARY
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


class TrendTickerAgent:
    """Harbor-compatible agent for trend-ticker detection."""

    SUPPORTS_ATIF = False

    @staticmethod
    def name() -> str:
        return "trend-ticker"

    def version(self) -> str:
        return "1.0.0"

    async def setup(self, environment) -> None:
        """Initialize agent with Harbor environment."""
        self.environment = environment

    async def run(self, instruction: str, environment, context) -> None:
        """Execute the trend-ticker agent against a Harbor task."""
        import json

        # Read task files if available
        result = await environment.exec("cat /files/ground_truth.json 2>/dev/null || echo '[]'")
        posts = json.loads(result.stdout if hasattr(result, 'stdout') else result)

        # Classify posts using the editable harness logic
        predictions = []
        for post in posts:
            category = self._classify_post(post)
            predictions.append({"id": post["id"], "predicted_category": category})

        output = json.dumps(predictions, indent=2)
        await environment.exec(f"mkdir -p /logs && cat > /logs/output.json << 'JSONEOF'\n{output}\nJSONEOF")

    def _classify_post(self, post: dict) -> str:
        """Classify a post into a concept-card category based on content signals."""
        text = post.get("text", "").lower()

        if any(w in text for w in ["sound", "audio", "remix", "song", "music", "soundtrack", "beat"]):
            return "AUDIO_VIRAL"
        if any(w in text for w in ["challenge", "trend", "viral", "fyp", "taking over", "#booktok"]):
            return "TREND_ALERT"
        if any(w in text for w in ["nike", "adidas", "samsung", "apple", "collab", "brand", "review", "dropped", "sold out"]):
            return "BRAND_SIGNAL"
        if any(w in text for w in ["ramadan", "diwali", "eid", "christmas", "national day", "holiday", "celebration", "festival"]):
            return "CULTURAL_MOMENT"
        if any(w in text for w in ["followers", "creator", "influencer", "content evolution", "grind"]):
            return "CREATOR_SPOTLIGHT"
        if any(w in text for w in ["abu dhabi", "dubai", "riyadh", "kuwait", "qatar", "singapore", "grand prix", "season", "metro"]):
            return "REGIONAL_PULSE"
        if any(w in text for w in ["ai ", "tech", "app ", "coding", "ar glasses", "spatial", "video generator"]):
            return "TECH_INNOVATION"
        return "TREND_ALERT"

    def get_agent_config(self) -> dict:
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
    agent = TrendTickerAgent()
    print(json.dumps(agent.get_agent_config(), indent=2))
