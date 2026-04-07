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

### DA-Q-011 — Write architectural decision document DA-TEC-2026-002

**Priority:** P1
**Status:** PENDING
**Captured:** 2026-04-07
**Source:** Hybrid architecture decision

**Context:**
Compare Path A (Python workshop only), Path B (direct TypeScript optimization), and the Hybrid approach (Python workshop + lesson translation to TypeScript). Lock in the Hybrid decision with explicit rationale covering cost, risk, iteration speed, and production safety. This document becomes the architectural SSOT for how AutoAgent integrates with DigitAlchemy going forward.

**Files to create:**
- docs/DA-TEC-2026-002-architecture-decision.md

**Acceptance criteria:**
- Three-path comparison table with cost, risk, speed, complexity dimensions
- Explicit Hybrid decision with rationale
- Diagram or ASCII flow showing workshop → lesson → translation → production
- References DA-TEC-2026-001 and DA-UC-001

**Commit message:**
`docs(autoagent): lock in Hybrid architecture decision in DA-TEC-2026-002`

---

### DA-Q-012 — Create the Lesson format template

**Priority:** P1
**Status:** PENDING
**Captured:** 2026-04-07
**Source:** Hybrid architecture — workshop-to-production bridge

**Context:**
Define the structured format for capturing meta-agent optimization wins and translating them to production TypeScript. Every winning experiment generates a Lesson document. Lessons are the bridge between the Python workshop and the Vercel production app.

**Files to create:**
- autoagent/lessons/LESSON_TEMPLATE.md
- autoagent/lessons/README.md

**Template fields required:**
- lesson_id (e.g., LESSON-001)
- date_captured
- source_experiment_commit (git hash from results.tsv)
- baseline_score, improved_score, delta
- python_harness_file (path)
- python_diff (before/after code block)
- typescript_target_file (path in app/api/)
- translation_notes (human-readable explanation of how to apply the Python lesson to TypeScript)
- risk_assessment (LOW/MEDIUM/HIGH with reasoning)
- production_test_plan (how to verify the change in preview deployment)
- approval_status (DRAFT / REVIEWED / APPROVED / APPLIED / REJECTED)
- applied_commit (populated after translation and merge)

**Acceptance criteria:**
- Template file is a fillable markdown skeleton with all fields above
- README explains what lessons are, where they live, and the lifecycle
- One example lesson document showing a hypothetical filled-in version

**Commit message:**
`feat(autoagent): add lesson format template for hybrid translation workflow`

---

### DA-Q-013 — Build the Lesson Extractor script

**Priority:** P1
**Status:** PENDING
**Captured:** 2026-04-07
**Source:** Hybrid architecture — automated extraction

**Context:**
Automated extraction of winning experiments from results.tsv into Lesson documents. After each optimization run, the extractor identifies commits with status=keep and meaningful score deltas, reads the corresponding git diff, and generates populated lesson documents ready for human review.

**Files to create:**
- autoagent/scripts/extract_lessons.py
- autoagent/scripts/README.md

**Script behavior:**
- Read autoagent/results.tsv
- Filter: status == "keep" AND score_delta >= configurable threshold (default 0.02)
- For each qualifying row, read the git diff between that commit and its parent
- Generate a lesson document using LESSON_TEMPLATE.md
- Write to autoagent/lessons/LESSON-{NNN}.md
- Report: N lessons generated, N already exist, top 3 by delta

**Acceptance criteria:**
- Script is runnable via: python autoagent/scripts/extract_lessons.py
- Skips lessons that already exist (idempotent)
- Handles empty results.tsv gracefully
- Includes --threshold and --limit command-line flags

**Commit message:**
`feat(autoagent): add lesson extractor script for workshop-to-production bridge`

---

### DA-Q-014 — Design the ground truth labeling protocol

**Priority:** P1
**Status:** PENDING
**Captured:** 2026-04-07
**Source:** Baseline failure analysis — synthetic data ceiling

**Context:**
The synthetic 20-post dataset is proven insufficient (baseline already at 0.9020, ceiling reachable with trivial keyword fixes). Real optimization requires real labeled data from the Console. This task designs the labeling protocol — not the labeling itself.

**Files to create:**
- autoagent/tasks/concept-card-classification/LABELING_PROTOCOL.md

**Protocol must cover:**
- Source: which Firestore collection(s) hold real Console post data
- Query: how to pull a representative sample (target 100-200 posts, diverse across TikTok + Instagram, diverse across time windows)
- De-duplication rules
- The 7 concept-card categories with crisp edge-case rules (e.g., "Apple AR glasses" → TECH_INNOVATION not BRAND_SIGNAL)
- Labeling workflow: Claude Code proposes labels, human reviews, disagreements flagged
- Output format: ground_truth_real.json matching existing schema
- Quality gates: inter-rater reliability, minimum posts per category

**Commit message:**
`docs(autoagent): add ground truth labeling protocol for real Console data`

---

### DA-Q-015 — Execute the ground truth labeling

**Priority:** P2
**Status:** BLOCKED
**Reason blocked:** Depends on DA-Q-014 completing first.
**Captured:** 2026-04-07
**Source:** Ground truth pipeline

**Context:**
The actual labeling work. Pull real posts from Firestore, propose labels via Claude Code, human reviews edge cases, produces ground_truth_real.json. This is a hybrid human+AI task.

**Files to create:**
- autoagent/tasks/concept-card-classification/files/ground_truth_real.json

**Commit message:**
`feat(autoagent): add real Console ground truth dataset for benchmark`

---

### DA-Q-016 — Draft the Production Translation Workflow

**Priority:** P1
**Status:** PENDING
**Captured:** 2026-04-07
**Source:** Hybrid architecture — production bridge

**Context:**
End-to-end protocol for taking a Lesson document and applying it to the TypeScript production code. Every step that could touch production must have explicit human review gates.

**Files to create:**
- docs/production-translation-workflow.md

**Workflow steps to document:**
1. Meta-agent produces winning change in Python harness (status=keep in results.tsv)
2. Lesson extractor generates LESSON-NNN.md
3. Human reviews the lesson (approval_status: DRAFT → REVIEWED)
4. Claude Code reads the lesson and the target TypeScript file
5. Claude Code proposes a translated edit in a new branch (experiment/lesson-NNN)
6. Claude Code opens a PR with the lesson attached as PR description
7. Vercel preview deployment builds automatically
8. Human tests the preview URL against expected behavior
9. Human approves the PR (approval_status: REVIEWED → APPROVED)
10. Merge to main triggers production deploy
11. Claude Code updates LESSON-NNN.md with applied_commit hash (APPROVED → APPLIED)
12. If preview tests fail, lesson is marked REJECTED with reason

**Acceptance criteria:**
- Document covers all 12 steps with specific commands/examples
- Explicit human gates at steps 3, 8, 9
- Rollback procedure if production regresses after merge
- Cost tracking: each lesson application logs API spend

**Commit message:**
`docs(autoagent): add production translation workflow for hybrid architecture`

---

### DA-Q-017 — Run the first real hybrid optimization cycle

**Priority:** P1
**Status:** BLOCKED
**Reason blocked:** Depends on DA-Q-012, DA-Q-013, DA-Q-014, DA-Q-015, DA-Q-016 all completing.
**Captured:** 2026-04-07
**Source:** Hybrid architecture — end-to-end validation

**Context:**
The first end-to-end hybrid cycle. Meta-agent optimizes against real ground truth data, extractor generates lessons, human reviews top lesson, Claude Code translates to TypeScript, preview deploys, human approves, merges to production.

**Success criteria:**
- At least one lesson generated with score delta >= 0.05
- At least one lesson translated to TypeScript
- At least one preview deployment successfully built
- At least one production merge (with human approval)
- Production metrics measured before and after to quantify impact

**Commit message:**
`feat(autoagent): first hybrid optimization cycle complete`

---

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
