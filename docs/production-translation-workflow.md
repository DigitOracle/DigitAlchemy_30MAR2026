# Production Translation Workflow

**Document ID:** DA-WORKFLOW-001
**Owner:** Kendall Wilson (Doli)
**Purpose:** End-to-end protocol for translating AutoAgent Lessons into production TypeScript changes.
**Architecture Reference:** DA-TEC-2026-002 (Hybrid decision)

---

## Overview

This workflow describes the 12 steps from a winning Python experiment to a production deployment. Three steps require explicit human approval — these gates are non-negotiable.

```
Python Workshop ──> Lesson Document ──> Human Review ──> TypeScript PR ──> Preview Test ──> Production
     (auto)             (auto)           (HUMAN)          (auto)          (HUMAN)         (HUMAN)
```

---

## Step 1: Meta-agent produces winning change

**Actor:** Meta-agent (automated)
**Input:** Experiment results in `autoagent/results.tsv`
**Output:** Row with `status: keep` and a positive score delta

The meta-agent's experiment loop (defined in DA-UC-001) produces this automatically. A winning change is any commit where `weighted_score` improved over the previous best.

```bash
# Example results.tsv entry
8e0471e  0.9020  1/1  {"concept_card_f1": 0.9020}  —  keep  BASELINE RUN
a1b2c3d  0.9520  1/1  {"concept_card_f1": 0.9520}  —  keep  expand audio keywords
```

---

## Step 2: Lesson extractor generates LESSON-NNN.md

**Actor:** Lesson extractor script (automated)
**Input:** `autoagent/results.tsv` + git diff
**Output:** `autoagent/lessons/LESSON-NNN.md` with status DRAFT

```bash
python autoagent/scripts/extract_lessons.py --threshold 0.02
```

The extractor reads the winning commit, pulls the git diff of agent files, and populates the lesson template. It is idempotent — running it twice for the same commit produces no duplicate.

---

## Step 3: Human reviews the lesson

**Actor:** Doli (HUMAN GATE)
**Input:** `autoagent/lessons/LESSON-NNN.md`
**Output:** Lesson status changes from DRAFT to REVIEWED

### Review checklist:

- [ ] The score improvement is real (not a benchmark artifact)
- [ ] The Python diff makes logical sense
- [ ] The change does NOT violate architecture constraints:
  - [ ] Inference-last provider chain preserved
  - [ ] Spotify remains enrichment-only
  - [ ] TikTok + Instagram only for Trend Ticker (YouTube excluded)
  - [ ] Fixed adapter boundary untouched
- [ ] The translation notes are accurate and complete
- [ ] The risk assessment is appropriate
- [ ] The production test plan is sufficient

### To approve:

Edit the lesson file and change:
```
| **Approval Status** | DRAFT |
```
to:
```
| **Approval Status** | REVIEWED |
```

### To reject:

Change status to REJECTED and add a reason:
```
| **Approval Status** | REJECTED |
```
Add a `## Rejection Reason` section explaining why.

---

## Step 4: Claude Code reads the lesson and target TypeScript file

**Actor:** Claude Code (automated)
**Input:** LESSON-NNN.md (status: REVIEWED) + target TypeScript file
**Command:**

```
Read autoagent/lessons/LESSON-NNN.md.
Read the TypeScript target file specified in the lesson.
Propose a translated edit that applies the Python lesson to TypeScript.
Do NOT modify the fixed adapter boundary.
```

Claude Code compares the Python before/after diff with the TypeScript route structure and drafts the equivalent TypeScript change.

---

## Step 5: Claude Code proposes a translated edit on a new branch

**Actor:** Claude Code (automated)
**Output:** New branch `experiment/lesson-NNN` with the TypeScript change

```bash
git checkout -b experiment/lesson-NNN
# Claude Code makes the edit
git add app/api/<route>/route.ts
git commit -m "feat(<route>): apply LESSON-NNN — <short description>"
git push -u origin experiment/lesson-NNN
```

---

## Step 6: Claude Code opens a PR

**Actor:** Claude Code (automated)
**Output:** GitHub PR with lesson context in the description

```bash
gh pr create \
  --title "feat(<route>): apply LESSON-NNN — <short description>" \
  --body "$(cat <<'EOF'
## Lesson Applied

**Lesson:** LESSON-NNN
**Score improvement:** +X.XXXX (baseline → improved)
**Risk:** LOW/MEDIUM/HIGH

## What Changed

<Summary from the lesson's "What Changed and Why" section>

## Translation Notes

<From the lesson's "Translation Notes" section>

## Test Plan

<From the lesson's "Production Test Plan" section>

---
Source: autoagent/lessons/LESSON-NNN.md
EOF
)"
```

---

## Step 7: Vercel preview deployment builds automatically

**Actor:** Vercel (automated)
**Input:** PR on `experiment/lesson-NNN` branch
**Output:** Preview URL (e.g., `https://digitalchemy-xxx.vercel.app`)

Vercel auto-deploys all PR branches. The preview URL appears as a comment on the PR within 2-3 minutes.

---

## Step 8: Human tests the preview URL

**Actor:** Doli (HUMAN GATE)
**Input:** Vercel preview URL + lesson's production test plan
**Output:** Pass or fail determination

### Testing protocol:

1. Open the preview URL in browser
2. Navigate to the Console dashboard
3. Test the specific route mentioned in the lesson:
   - `/api/trend-ticker?region=AE` — verify response structure
   - `/api/trending-audio?region=AE` — verify Spotify enrichment
   - `/api/morning-briefing?region=AE` — verify Gazette structure
4. Check SSE streaming works (open browser dev tools → Network → EventStream)
5. Check Firestore logging (Firebase Console → Firestore → `da-experiments/`)
6. Run through the specific test scenarios from the lesson's test plan

### If tests pass:

Proceed to Step 9.

### If tests fail:

Comment on the PR with the failure details. The lesson status changes to REJECTED:
```
| **Approval Status** | REJECTED |
```
Add a `## Rejection Reason` section to the lesson documenting what failed in preview.

Close the PR without merging.

---

## Step 9: Human approves the PR

**Actor:** Doli (HUMAN GATE)
**Input:** Passing preview test + reviewed lesson
**Output:** PR approved, lesson status REVIEWED -> APPROVED

```bash
gh pr review <PR_NUMBER> --approve
```

Update the lesson:
```
| **Approval Status** | APPROVED |
```

---

## Step 10: Merge to main triggers production deploy

**Actor:** Doli or Claude Code (after explicit approval)
**Input:** Approved PR
**Output:** Merge commit on `main`, Vercel production deploy

```bash
gh pr merge <PR_NUMBER> --squash
```

Vercel automatically deploys `main` to production.

---

## Step 11: Claude Code updates the lesson with applied_commit

**Actor:** Claude Code (automated)
**Input:** Merge commit hash
**Output:** Lesson updated with final status

Update the lesson:
```
| **Approval Status** | APPLIED |
| **Applied Commit** | `<merge commit hash>` |
```

Check all lifecycle boxes:
```
- [x] Meta-agent produced winning change
- [x] Lesson extractor generated this document
- [x] Human reviewed lesson (DRAFT -> REVIEWED)
- [x] Claude Code translated to TypeScript on branch experiment/lesson-NNN
- [x] PR opened with lesson in description
- [x] Vercel preview deployed and tested
- [x] Human approved PR (REVIEWED -> APPROVED)
- [x] Merged to main (APPROVED -> APPLIED)
- [x] applied_commit hash recorded above
```

Commit the lesson update:
```bash
git add autoagent/lessons/LESSON-NNN.md
git commit -m "chore(autoagent): mark LESSON-NNN as applied (<merge hash>)"
```

---

## Step 12: Handle rejection

**Actor:** Claude Code + Doli
**Trigger:** Preview tests fail at Step 8

If a lesson fails preview testing:

1. Claude Code updates the lesson status to REJECTED
2. Add a `## Rejection Reason` section with:
   - What failed in the preview
   - Whether the failure was in the translation (Python → TS mismatch) or the optimization itself
   - Whether a retry with a different translation approach is worth attempting
3. Close the PR without merging
4. The lesson remains in `autoagent/lessons/` as a learning record

```bash
gh pr close <PR_NUMBER>
```

---

## Rollback Procedure

If production regresses after a merge:

### Immediate (< 5 minutes)

```bash
# Revert the merge commit on main
git revert <merge_commit_hash>
git push origin main
# Vercel auto-deploys the revert within 2-3 minutes
```

### Post-mortem

1. Update the lesson status from APPLIED to REJECTED
2. Add rejection reason: "Production regression detected after merge"
3. Document what metrics regressed and by how much
4. The Python workshop score was valid — the regression is in the translation, not the optimization
5. Queue a new task to investigate the translation failure

---

## Cost Tracking

Each lesson application should log its cost:

| Phase | Cost Source | Tracking |
|-------|-----------|----------|
| Python optimization | Claude API inference (inference-last) | `cost_usd` column in results.tsv |
| Lesson extraction | Negligible (local script) | — |
| TypeScript translation | Claude Code session | Note in PR description |
| Preview testing | Vercel preview build | Free on Vercel hobby/pro |
| Production deploy | Vercel production build | Free on Vercel hobby/pro |

**Budget rule (from DA-UC-001):** Individual experiments capped at $5 USD. Overnight runs capped at $50 USD total.

---

**End of workflow. This document is referenced by DA-TEC-2026-002.**
