# DA-QUEUE-001 — DigitAlchemy® Action Queue

**Owner:** Kendall Wilson (Doli)
**Repo:** DigitOracle/DigitAlchemy_30MAR2026
**Purpose:** Mobile-captured tasks that Claude Code executes in batch at the desk.
**Protocol:** Voice → Claude (mobile) → append task card here → Claude Code executes

---

## How This Works

1. **Mobile capture:** Doli talks to Claude in the mobile app, describing what needs doing
2. **Claude drafts:** Claude converts the voice input into a structured task card and appends it below
3. **Desk execution:** Doli opens Claude Code, runs `/run-queue`, Claude Code executes all PENDING tasks
4. **Status update:** Claude Code updates each task's status (PENDING → DONE / BLOCKED / SKIPPED) with a commit hash

---

## Priority Tiers

- **P0** — Blocking, do first (broken builds, client deliverables due)
- **P1** — Important, do today (feature work, key improvements)
- **P2** — Should do this week (refactors, cleanups, nice-to-haves)
- **P3** — Someday/maybe (ideas worth capturing but not urgent)

## Status Values

- `PENDING` — Not yet started
- `IN_PROGRESS` — Claude Code actively working
- `DONE` — Completed, commit hash recorded
- `BLOCKED` — Needs human input or external dependency
- `SKIPPED` — Doli decided not to do this

---

## Active Queue

<!-- New tasks append here. Claude Code reads top-down. -->

<!-- APPEND NEW TASKS BELOW THIS LINE -->

---

## Completed (Archive)

<!-- DONE tasks move here after execution -->

### DA-Q-002 — Bootstrap AutoAgent directory structure

**Priority:** P1
**Status:** DONE
**Captured:** 2026-04-07
**Completed:** 2026-04-07
**Commit:** `005c18e`

---

### DA-Q-003 — Commit DA-UC-001 directive file

**Priority:** P1
**Status:** DONE
**Captured:** 2026-04-07
**Completed:** 2026-04-07
**Commit:** `005c18e`

---

### DA-Q-004 — Extract trend-ticker route into agent harness

**Priority:** P2
**Status:** DONE
**Captured:** 2026-04-07
**Completed:** 2026-04-07
**Commit:** `8aa2e59`

---

### DA-Q-005 — Add Dockerfile.base for AutoAgent

**Priority:** P2
**Status:** DONE
**Captured:** 2026-04-07
**Completed:** 2026-04-07
**Commit:** `dd68a66`

---

### DA-Q-006 — Extract trending-audio route into agent harness

**Priority:** P1
**Status:** DONE
**Captured:** 2026-04-07
**Completed:** 2026-04-07
**Commit:** `50ef6a4`

---

### DA-Q-007 — Extract morning-briefing route into agent harness

**Priority:** P1
**Status:** DONE
**Captured:** 2026-04-07
**Completed:** 2026-04-07
**Commit:** `02e9164`

---

### DA-Q-008 — Build concept-card-classification benchmark task

**Priority:** P1
**Status:** DONE
**Captured:** 2026-04-07
**Completed:** 2026-04-07
**Commit:** `e1e6468`

---

### DA-Q-010 — Fix Python module naming for AutoAgent harnesses

**Priority:** P0
**Status:** DONE
**Captured:** 2026-04-07
**Completed:** 2026-04-07
**Commit:** `8e0471e`

---

### DA-Q-009 — Run AutoAgent baseline (no optimization)

**Priority:** P1
**Status:** DONE
**Captured:** 2026-04-07
**Completed:** 2026-04-07
**Commit:** `9e4a45f`
**Baseline F1 Score:** 0.9020 (PASS, threshold ≥ 0.85)

---

## Blocked

<!-- BLOCKED tasks with reason -->

### DA-Q-001 — [EXAMPLE] Fix provider order in trend-ticker route

**Priority:** P1
**Status:** BLOCKED
**Captured:** 2026-04-07
**Source:** Voice note via Claude mobile
**Reason:** This was a template example task. The actual `app/api/trend-ticker/route.ts` uses ScrapeCreators for both TikTok and Instagram — Apify is not present in this route, so there is no reversed provider order to fix. Doli: remove this example card or rewrite with a real task.

---

## Notes

- **Golden rule:** Claude Code never touches the fixed adapter boundary (SSE streaming, Firestore logging) unless the task explicitly says so
- **Vercel git author:** Must be `k.wilsonqc@outlook.com` on all commits
- **Branch strategy:** Small tasks commit to current branch; large features get `feature/` branches
- **After execution:** Claude Code updates DA-OPS-001 with a new revision number
