# Concept Card Classification Task

You are given a JSON file at `/files/ground_truth.json` containing social media posts. Each post has a `text` field (the post content) and a `platform` field (tiktok or instagram).

Your job: classify each post into exactly ONE concept-card category.

## Valid Categories

- **TREND_ALERT** — Posts about emerging viral trends, challenges, or movements
- **BRAND_SIGNAL** — Posts mentioning brands, products, or commercial partnerships
- **CULTURAL_MOMENT** — Posts tied to cultural events, holidays, or collective experiences
- **CREATOR_SPOTLIGHT** — Posts focused on individual creators, influencers, or their content
- **AUDIO_VIRAL** — Posts primarily driven by a trending sound or music clip
- **REGIONAL_PULSE** — Posts specific to a geographic region's local trends
- **TECH_INNOVATION** — Posts about technology, apps, or digital tools

## Output Format

Write your classifications to `/logs/output.json` as a JSON array:

```json
[
  {"id": 1, "predicted_category": "TREND_ALERT"},
  {"id": 2, "predicted_category": "BRAND_SIGNAL"},
  ...
]
```

Each entry must have an `id` (matching the post ID from ground_truth.json) and a `predicted_category` (one of the 7 valid categories above).

## Scoring

Your output will be scored using macro-averaged F1 score against the ground-truth labels. The pass threshold is **0.85**.
