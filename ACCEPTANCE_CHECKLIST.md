# DigitAlchemy Console — Manual Acceptance Checklist

## A. Reverse Engineer Flow

- [ ] Open http://localhost:3000
- [ ] Click "Reverse Engineer Platform Trends"
- [ ] Select a platform (TikTok recommended — has ScrapeCreators live data)
- [ ] Optionally enter a niche (e.g. "fitness")
- [ ] Select production lag (e.g. 48 Hours)
- [ ] Click "Scan Trends"
- [ ] Verify progress strip shows: Mode ✓ | Platform ✓ | Scope ✓ | Publish In ✓
- [ ] Verify SSE cards render in order:
  1. Platform Trends Now (or Context-Guided Platform Signals)
  2. Trending Audio Now
  3. Niche Trends (only if niche was entered)
  4. Suggested Video Ideas
  5. Hook Concepts
  6. Caption Starters
  7. Commercial-Safe Audio
  8. Vibe Suggestions
- [ ] Verify Trend Radar cards appear after SSE completes:
  9. Trend Radar
  10. Safe To Produce Now
  11. Too Late / Fading Fast
- [ ] Verify "insufficient history" warning appears (expected on first run)
- [ ] Verify provenance labels are correct (live vs context-guided vs inferred)
- [ ] Verify "Create content from these trends" CTA appears at completion
- [ ] Click "New task" — verify full reset back to mode selector

## B. Optimize Flow

- [ ] Click "Optimize Existing Content"
- [ ] Upload a video file
- [ ] Verify ingestion spinner appears
- [ ] Verify ingestion confirmed stage shows briefly
- [ ] Select platforms (e.g. Instagram)
- [ ] Verify Phase 2 cards render (platformTrends, topicTrends, trendingAudio, etc.)
- [ ] Verify NO Trend Radar cards appear (trendRadar, safeToProduceNow, tooLate should be absent)
- [ ] Verify NO production lag selector appeared
- [ ] Click "New task" — verify reset

## C. InfluxDB Cloud Optionality

### With env vars present (INFLUXDB_URL, INFLUXDB_TOKEN, INFLUXDB_ORG, INFLUXDB_BUCKET):
- [ ] Run reverse-engineer scan
- [ ] Check terminal for: `[influx] wrote N points for platform/scope`
- [ ] Hit GET /api/health/providers — verify influxdb provider shows configured + reachable

### Without env vars (comment them out in .env.local):
- [ ] Restart dev server
- [ ] Run reverse-engineer scan
- [ ] Check terminal for: `[influx] skipped — env vars not configured`
- [ ] Verify scan completes normally — no errors
- [ ] Hit GET /api/health/providers — verify influxdb shows configured: false, degraded: true

## D. Health Endpoint

- [ ] GET /api/health/providers
- [ ] Verify all providers listed with checkType (live_ping or config_only)
- [ ] Verify scrape_creators shows live_ping result
- [ ] Verify influxdb shows live_ping result (or config_only if env vars missing)

## E. Terminal Logs to Watch

During reverse-engineer scan, expect these in order:
```
[phase2] or [reverse-engineer] provider attempt logs
[trend-capture] stored N entities for platform/scope
[influx] wrote N points for platform/scope  (or "skipped")
```
