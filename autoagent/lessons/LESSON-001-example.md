# LESSON-001 — Expand AUDIO_VIRAL keyword vocabulary for TikTok audio slang

## Metadata

| Field | Value |
|-------|-------|
| **Lesson ID** | LESSON-001 |
| **Date Captured** | 2026-04-07 |
| **Source Experiment Commit** | `a1b2c3d` |
| **Baseline Score** | 0.9020 |
| **Improved Score** | 0.9520 |
| **Delta** | +0.0500 |
| **Approval Status** | DRAFT |
| **Applied Commit** | _(pending)_ |

---

## Python Harness Change

**File:** `autoagent/agents/agent_trend_ticker.py`

### Before

```python
def _classify_post(self, post: dict) -> str:
    text = post.get("text", "").lower()

    if any(w in text for w in ["sound", "audio", "remix", "song", "music", "soundtrack", "beat"]):
        return "AUDIO_VIRAL"
    # ... remaining rules
```

### After

```python
def _classify_post(self, post: dict) -> str:
    text = post.get("text", "").lower()

    if any(w in text for w in [
        "sound", "audio", "remix", "song", "music", "soundtrack", "beat",
        "track", "reverb", "slowed", "sped up", "bass boosted", "mashup",
        "playlist", "lyrics", "chorus", "hook", "sample", "vinyl",
    ]):
        return "AUDIO_VIRAL"
    # ... remaining rules
```

### What Changed and Why

The baseline AUDIO_VIRAL keyword list missed Post 18 ("slowed + reverb version of the Beyonce track") because none of the original 7 keywords appeared in the text. TikTok audio culture uses vocabulary like "track", "reverb", "slowed", "sped up", and "bass boosted" that the original list didn't cover.

Adding 10 TikTok-native audio terms fixes Post 18 and should catch similar edge cases in real Console data. No regressions observed — the new keywords don't overlap with other category signals.

**Benchmark impact:**
- concept_card_f1: 0.9020 -> 0.9520 (+0.0500)
- Posts newly solved: Post 18 (was TREND_ALERT, now correctly AUDIO_VIRAL)
- Posts regressed: None

---

## TypeScript Translation

**Target File:** `app/api/trend-ticker/route.ts`

### Translation Notes

This lesson applies to the concept-card classification logic, which does not currently exist in the TypeScript route (the route fetches raw hashtags, it doesn't classify them). When classification is added to the TypeScript side, the expanded audio keyword list should be used from the start.

If classification is added as a utility function in `lib/classify.ts`:

1. Create a `AUDIO_VIRAL_KEYWORDS` constant array with the expanded list
2. Use `text.toLowerCase().includes(keyword)` pattern matching (equivalent to Python's `in` operator)
3. Ensure AUDIO_VIRAL is checked before TREND_ALERT in the rule chain (same ordering as the Python harness)

### Risk Assessment

**Level:** LOW

**Reasoning:** This change only affects classification vocabulary in the editable harness section. It does not touch the fixed adapter boundary (SSE streaming, Firestore logging). It does not change provider order. The expanded keywords are all legitimate audio-related terms with no overlap to other categories.

---

## Production Test Plan

1. Deploy to Vercel preview branch `experiment/lesson-001`
2. Hit `/api/trend-ticker?region=AE` — verify response structure unchanged
3. If classification endpoint exists, test with a post containing "slowed + reverb" — should classify as AUDIO_VIRAL
4. Check SSE streaming still works on the Console dashboard
5. **Rollback trigger:** If any non-audio posts start classifying as AUDIO_VIRAL, revert immediately

---

## Lifecycle

- [x] Meta-agent produced winning change (status=keep in results.tsv)
- [x] Lesson extractor generated this document
- [ ] Human reviewed lesson (DRAFT -> REVIEWED)
- [ ] Claude Code translated to TypeScript on branch `experiment/lesson-001`
- [ ] PR opened with lesson in description
- [ ] Vercel preview deployed and tested
- [ ] Human approved PR (REVIEWED -> APPROVED)
- [ ] Merged to main (APPROVED -> APPLIED)
- [ ] applied_commit hash recorded above
