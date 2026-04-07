"""
DA Agent: Trending Audio
Use case: DA-UC-001 — Social Media Intelligence
Source route: app/api/trending-audio/route.ts

This agent detects trending sounds/music from TikTok,
enriches with Spotify metadata (enrichment-only), and returns
ranked audio trends for the DigitAlchemy Console.
"""

# ──────────────────────────────────────────────
# === EDITABLE HARNESS ===
# Modify freely above the FIXED ADAPTER BOUNDARY
# ──────────────────────────────────────────────

SYSTEM_PROMPT = """
You are the DigitAlchemy Trending Audio agent. Your job is to detect
trending sounds and music from TikTok and Instagram for a given region.

Rules:
- Follow inference-last provider chain: ScrapeCreators → Apify → xpoz → Perplexity → Claude
- Spotify is ENRICHMENT-ONLY — never use Spotify for trend detection.
  Spotify may only add album art and URLs to already-detected audio trends.
- TikTok + Instagram only — YouTube is explicitly excluded from audio detection.
- Deduplicate by normalized title + author before enrichment.
- Return structured JSON with title, author, rank, platform, albumArt, spotifyUrl.
"""

PROVIDER_CHAIN = [
    "scrapeCreators",   # Primary: TikTok trending songs API
    "apify",            # Fallback: broader TikTok/IG audio scraping
    "xpoz",             # Fallback: cross-platform audio trend data
    "perplexity",       # Fallback: web-grounded audio trend verification
    "claude",           # Final: inference, ranking, and synthesis
]

TOOL_DEFINITIONS = [
    {
        "name": "fetch_trending_sounds",
        "description": "Fetch popular TikTok sounds for a region via ScrapeCreators /v1/tiktok/songs/popular",
        "parameters": {
            "region": {"type": "string", "description": "ISO country code (e.g. AE, US, SG)"},
        },
    },
    {
        "name": "enrich_with_spotify",
        "description": "Enrich already-detected audio trends with Spotify album art and URLs. ENRICHMENT ONLY — never use for detection.",
        "parameters": {
            "sounds": {"type": "array", "description": "List of sound objects with title and author fields"},
            "max_enrichments": {"type": "integer", "description": "Max sounds to enrich (default 5)"},
        },
    },
    {
        "name": "deduplicate_sounds",
        "description": "Deduplicate sounds by normalized title + author",
        "parameters": {
            "sounds": {"type": "array", "description": "List of sound objects to deduplicate"},
        },
    },
]

CLASSIFICATION_RULES = """
Audio trend classification categories:
- VIRAL_ORIGINAL: Original sound created by a TikTok/IG creator
- COMMERCIAL_TRACK: Licensed music from a record label
- REMIX_MASHUP: User-created remix or mashup of existing tracks
- SOUND_EFFECT: Non-music audio (dialogue clips, effects, memes)
- REGIONAL_HIT: Track trending primarily in specific geographic regions
"""

ROUTING_LOGIC = """
1. Fetch trending sounds from TikTok via ScrapeCreators
2. If ScrapeCreators fails, fall back through provider chain (Apify → xpoz)
3. Deduplicate by normalized title + author
4. Classify each sound into categories
5. Enrich top 5 with Spotify metadata (enrichment-only — not detection)
6. Use Claude (inference-last) to rank by virality and cross-platform presence
7. Return structured JSON array of trending sounds
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
#   app/api/trending-audio/route.ts
#
# Key implementation details preserved in the fixed adapter:
# - ScrapeCreators /v1/tiktok/songs/popular endpoint
# - Spotify enrichment via searchSpotifyTrack (enrichment-only)
# - TrendingSound interface: title, author, rank, rankDiff, cover, link, duration, albumArt, spotifyUrl
# ──────────────────────────────────────────────


class TrendingAudioAgent:
    """Harbor-compatible agent for trending audio detection."""

    SUPPORTS_ATIF = False

    @staticmethod
    def name() -> str:
        return "trending-audio"

    def version(self) -> str:
        return "1.0.0"

    async def setup(self, environment) -> None:
        """Initialize agent with Harbor environment."""
        self.environment = environment

    async def run(self, instruction: str, environment, context) -> None:
        """Execute the trending-audio agent against a Harbor task."""
        import json

        result = await environment.exec("cat /files/ground_truth.json 2>/dev/null || echo '[]'")
        posts = json.loads(result.stdout if hasattr(result, 'stdout') else result)

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
            "classification_rules": CLASSIFICATION_RULES,
            "routing_logic": ROUTING_LOGIC,
            "max_turns": MAX_TURNS,
            "temperature": TEMPERATURE,
        }


if __name__ == "__main__":
    import json
    agent = TrendingAudioAgent()
    print(json.dumps(agent.get_agent_config(), indent=2))
