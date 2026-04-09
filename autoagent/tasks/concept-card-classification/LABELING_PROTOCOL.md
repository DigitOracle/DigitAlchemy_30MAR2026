# Ground Truth Labeling Protocol — Concept Card Classification

**Document ID:** DA-LABEL-001
**Owner:** Kendall Wilson (Doli)
**Purpose:** Define how to create a real-world labeled dataset from Console data for the concept-card-classification benchmark.
**Target:** 100-200 labeled posts in `ground_truth_real.json`

---

## 1. Data Source

### Firestore Collections

| Collection | Contains | Use |
|-----------|----------|-----|
| `da-experiments/social-media/*` | Experiment logs with raw social media posts | Primary source — posts already ingested by the Console |
| `trend-ticker-cache/{region}` | Cached TikTok + Instagram hashtag results | Fallback if experiment logs are sparse |
| `trending-audio-cache/{region}` | Cached TikTok sound data | Audio-specific posts |

### Query Parameters

```
Project: digitalchemy-de4b7
Regions: AE, US, SG (minimum 3 regions for diversity)
Time window: Last 30 days
Platforms: TikTok, Instagram only (YouTube excluded per DA-UC-001)
```

---

## 2. Sampling Strategy

### Target Distribution

| Category | Target Posts | Minimum | Notes |
|----------|-------------|---------|-------|
| TREND_ALERT | 25-35 | 15 | Challenges, viral trends, FYP phenomena |
| BRAND_SIGNAL | 20-30 | 15 | Product mentions, collabs, reviews |
| CULTURAL_MOMENT | 15-25 | 10 | Holidays, events, collective experiences |
| CREATOR_SPOTLIGHT | 15-20 | 10 | Influencer features, milestone celebrations |
| AUDIO_VIRAL | 15-25 | 10 | Trending sounds, remixes, audio-driven content |
| REGIONAL_PULSE | 15-20 | 10 | Location-specific trends and events |
| TECH_INNOVATION | 10-15 | 8 | Tech products, AI tools, apps |
| **Total** | **115-170** | **78** | |

### Sampling Rules

1. Pull 300+ candidate posts from Firestore
2. De-duplicate by normalized text (lowercase, strip hashtags, strip mentions)
3. Remove posts shorter than 20 characters (insufficient signal)
4. Remove non-English posts (for v1 — multilingual support in v2)
5. Stratified sample: ensure minimum per-category thresholds are met
6. Ensure at least 3 regions represented in the final dataset
7. Ensure at least 40% TikTok and 40% Instagram (no single-platform dominance)

---

## 3. Category Definitions with Edge-Case Rules

### TREND_ALERT
Posts about emerging viral trends, challenges, or movements.

**Include:** Dance challenges, hashtag movements, "taking over my FYP", BookTok/CleanTok/FoodTok, challenge participation, trend commentary.

**Exclude:** Brand-sponsored challenges (→ BRAND_SIGNAL), audio-driven trends where the sound is the main hook (→ AUDIO_VIRAL).

### BRAND_SIGNAL
Posts mentioning brands, products, or commercial partnerships.

**Include:** Product reviews, unboxings, brand collabs, sponsored content, product launches, "just got the new X", brand comparisons.

**Exclude:** Tech product announcements focused on innovation rather than the brand (→ TECH_INNOVATION). **Rule: If the post is primarily about what the technology does/changes rather than the brand selling it, classify as TECH_INNOVATION.** Example: "Apple just announced their AR glasses and this changes everything for spatial computing" → TECH_INNOVATION (not BRAND_SIGNAL), because the focus is on spatial computing innovation, not Apple as a brand.

### CULTURAL_MOMENT
Posts tied to cultural events, holidays, or collective experiences.

**Include:** Ramadan, Diwali, Christmas, National Day, Eid, New Year, cultural festivals, collective mourning/celebration, heritage events.

**Exclude:** Branded holiday content (→ BRAND_SIGNAL if brand is the focus).

### CREATOR_SPOTLIGHT
Posts focused on individual creators, influencers, or their content.

**Include:** Follower milestones, creator origin stories, content evolution, creator drama, "how X went from Y to Z", creator interviews.

**Exclude:** Posts where a creator is simply participating in a trend (→ TREND_ALERT) or using a sound (→ AUDIO_VIRAL).

### AUDIO_VIRAL
Posts primarily driven by a trending sound or music clip.

**Include:** Sound-driven content, remix culture, "this sound is everywhere", slowed/reverb edits, sped-up versions, bass-boosted tracks, mashups, "using this before it blows up", lyric-focused posts, music reactions, sound comparisons.

**Critical vocabulary (from baseline failure analysis):** Posts containing terms like "track", "reverb", "slowed", "sped up", "bass boosted", "mashup", "sample", "vinyl", "chorus", "hook", "lyrics", "version of", "cover", "remix" are strong AUDIO_VIRAL signals, even without the words "sound", "audio", "music", or "song".

**Edge case resolved:** "Okay but this slowed + reverb version of the Beyonce track is actually superior to the original" → **AUDIO_VIRAL** (not TREND_ALERT). The post is about audio manipulation and music comparison, not a trend or challenge.

### REGIONAL_PULSE
Posts specific to a geographic region's local trends.

**Include:** City/country-specific events, local infrastructure, regional entertainment (Riyadh Season, Abu Dhabi GP), local news, regional culture.

**Exclude:** Global events that happen to mention a location (→ CULTURAL_MOMENT if the cultural element dominates).

### TECH_INNOVATION
Posts about technology, apps, or digital tools.

**Include:** AI tools, new app features, spatial computing, coding, tech reviews focused on capability, "this changes everything", developer content.

**Edge case resolved:** "Apple just announced their AR glasses" → **TECH_INNOVATION** (not BRAND_SIGNAL). When a post discusses what a technology enables (spatial computing, AR experiences) rather than the brand selling it, tech intent dominates. **Rule: If the sentence could replace the brand name with "a company" and still be interesting because of the technology, it's TECH_INNOVATION.**

**Exclude:** Posts that are purely "I bought this brand's product" without tech discussion (→ BRAND_SIGNAL).

---

## 4. Labeling Workflow

### Phase 1: Claude Code Proposes Labels (Automated)

1. Export candidate posts from Firestore as JSON
2. Claude Code reads each post and proposes a category using the definitions above
3. Claude Code assigns a **confidence score** (HIGH / MEDIUM / LOW) based on signal clarity
4. Output: `proposed_labels.json` with `{id, text, platform, region, proposed_category, confidence}`

### Phase 2: Human Review (Doli)

1. Review all LOW confidence labels (expected ~20-30% of posts)
2. Spot-check 10% of HIGH confidence labels (sanity check)
3. Review all MEDIUM confidence labels
4. For disagreements: Doli's label is final
5. Flag any posts that genuinely don't fit any category → mark as AMBIGUOUS and exclude

### Phase 3: Finalization

1. Remove AMBIGUOUS posts from the dataset
2. Verify minimum per-category thresholds are met
3. Generate `ground_truth_real.json` matching the existing schema:

```json
[
  {
    "id": 1,
    "text": "Post content here...",
    "platform": "tiktok",
    "category": "TREND_ALERT"
  }
]
```

4. Run the F1 verifier against the baseline classifier to establish a real-world baseline score
5. Commit to `autoagent/tasks/concept-card-classification/files/ground_truth_real.json`

---

## 5. Quality Gates

| Gate | Threshold | Action if Failed |
|------|-----------|-----------------|
| Minimum total posts | 100 | Pull more data from Firestore |
| Minimum per category | See table in section 2 | Targeted sampling for underrepresented categories |
| Platform balance | 40% min each (TikTok/IG) | Rebalance sample |
| Region diversity | 3+ regions | Add regions |
| Human review coverage | 100% of LOW, 10% of HIGH | Continue review |
| Inter-rater agreement (if multiple humans) | Cohen's kappa >= 0.75 | Revisit category definitions for ambiguous boundaries |

---

## 6. Known Ambiguity Zones (from Baseline Failure Analysis)

These edge cases caused misclassifications in the baseline run and must be handled consistently:

### Brand + Tech Overlap
**Signal:** Post mentions a brand name AND a technology innovation.
**Rule:** If the post's primary subject is what the technology does/enables, classify as TECH_INNOVATION. If the primary subject is the brand's product as a purchasable item, classify as BRAND_SIGNAL.
**Test:** Replace the brand name with "a company" — if the post is still interesting, it's TECH_INNOVATION.

### Audio + Trend Overlap
**Signal:** Post references a sound/track AND participates in a trend.
**Rule:** If the sound is the main content driver (the post wouldn't exist without that specific sound), classify as AUDIO_VIRAL. If the trend/challenge is the main driver and the sound is incidental, classify as TREND_ALERT.

### Creator + Trend Overlap
**Signal:** A creator is doing a trending challenge.
**Rule:** If the post focuses on the creator themselves (milestones, story, personality), classify as CREATOR_SPOTLIGHT. If the post is about the trend and the creator is just participating, classify as TREND_ALERT.

---

**End of labeling protocol. Execute via DA-Q-015.**
